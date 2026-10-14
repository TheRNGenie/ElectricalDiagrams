package com.therngenie.boardmonitor;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.hardware.usb.UsbRequest;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * USB serial for the page, through Android's USB host API. Speaks CDC-ACM, which is what the
 * UNO R4 WiFi (and most boards with native USB) present, so no driver library is needed.
 *
 * The page calls these methods from native-bridge.js with a callback id; results come back
 * through window.__androidSerial._done(id, errorName, message, resultJson). Incoming bytes
 * arrive as _data(deviceId, base64), and an unplugged board as _gone(deviceId).
 */
public class UsbSerialBridge {
    private static final String ACTION_PERMISSION = BuildConfig.APPLICATION_ID + ".USB_PERMISSION";
    // CDC-ACM class requests
    private static final int SET_LINE_CODING = 0x20, SET_CONTROL_LINE_STATE = 0x22;
    private static final int REQ_TYPE_CLASS_INTERFACE_OUT = 0x21;

    private final Activity activity;
    private final WebView web;
    private final UsbManager manager;
    private final Handler ui = new Handler(Looper.getMainLooper());
    // One worker thread, so the page's open / write / close calls happen in the order it made them
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Map<Integer, Port> ports = new ConcurrentHashMap<>();
    private final Map<Integer, CountDownLatch> permissionWaits = new ConcurrentHashMap<>();
    private final Map<Integer, Boolean> permissionAnswers = new ConcurrentHashMap<>();

    private final BroadcastReceiver permissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent intent) {
            UsbDevice d = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if (d == null) return;
            permissionAnswers.put(d.getDeviceId(), intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false));
            CountDownLatch l = permissionWaits.remove(d.getDeviceId());
            if (l != null) l.countDown();
        }
    };
    private final BroadcastReceiver detachReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent intent) {
            UsbDevice d = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if (d == null) return;
            int id = d.getDeviceId();
            Port p = ports.remove(id);
            if (p != null) exec.execute(p::close);
            js("_gone(" + id + ")");
        }
    };

    public UsbSerialBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        this.manager = (UsbManager) activity.getSystemService(Context.USB_SERVICE);
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(permissionReceiver, new IntentFilter(ACTION_PERMISSION), Context.RECEIVER_NOT_EXPORTED);
            activity.registerReceiver(detachReceiver, new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED), Context.RECEIVER_EXPORTED);
        } else {
            activity.registerReceiver(permissionReceiver, new IntentFilter(ACTION_PERMISSION));
            activity.registerReceiver(detachReceiver, new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED));
        }
    }

    public void shutdown() {
        try { activity.unregisterReceiver(permissionReceiver); } catch (Exception ignored) {}
        try { activity.unregisterReceiver(detachReceiver); } catch (Exception ignored) {}
        for (Port p : ports.values()) p.close();
        ports.clear();
        exec.shutdownNow();
    }

    // ---------- Calls from the page ----------

    /** Plugged-in USB devices that look like serial ports, as JSON. */
    @JavascriptInterface
    public String list() {
        JSONArray a = new JSONArray();
        for (UsbDevice d : serialDevices()) a.put(describe(d));
        return a.toString();
    }

    /** Like navigator.serial.requestPort(): pick a device (asks only when there are several) and get permission. */
    @JavascriptInterface
    public void request(int cb) {
        List<UsbDevice> devs = serialDevices();
        if (devs.isEmpty()) {
            fail(cb, "Error", "No board found. Plug it in with the USB cable, then try again.");
            return;
        }
        if (devs.size() == 1) {
            exec.execute(() -> grantThenReturn(cb, devs.get(0)));
            return;
        }
        ui.post(() -> {
            String[] names = new String[devs.size()];
            for (int i = 0; i < names.length; i++) names[i] = label(devs.get(i));
            final boolean[] picked = {false};
            new AlertDialog.Builder(activity)
                    .setTitle("Pick the board")
                    .setItems(names, (dlg, which) -> {
                        picked[0] = true;
                        exec.execute(() -> grantThenReturn(cb, devs.get(which)));
                    })
                    .setOnDismissListener(dlg -> {
                        if (!picked[0]) fail(cb, "NotFoundError", "No port selected.");
                    })
                    .show();
        });
    }

    @JavascriptInterface
    public void open(int cb, int deviceId, int vid, int pid, int baud) {
        exec.execute(() -> {
            try {
                UsbDevice d = find(deviceId, vid, pid);
                if (d == null) throw new IOException("The board isn’t plugged in.");
                if (!ensurePermission(d)) throw new IOException("USB access was not allowed. Tap Connect again and choose Allow.");
                Port old = ports.remove(d.getDeviceId());
                if (old != null) old.close();
                Port p = new Port(d);
                p.open(baud);
                ports.put(d.getDeviceId(), p);
                ok(cb, describe(d).toString());
            } catch (Exception e) {
                fail(cb, "NetworkError", message(e, "Couldn’t open the USB port."));
            }
        });
    }

    @JavascriptInterface
    public void write(int cb, int deviceId, String base64) {
        byte[] data = Base64.decode(base64, Base64.NO_WRAP);
        exec.execute(() -> {
            Port p = ports.get(deviceId);
            try {
                if (p == null) throw new IOException("The port is closed.");
                p.write(data);
                ok(cb, null);
            } catch (Exception e) {
                fail(cb, "NetworkError", message(e, "Couldn’t send to the board."));
            }
        });
    }

    /** dtr / rts: 1 on, 0 off, -1 leave as is. */
    @JavascriptInterface
    public void signals(int cb, int deviceId, int dtr, int rts) {
        exec.execute(() -> {
            Port p = ports.get(deviceId);
            try {
                if (p == null) throw new IOException("The port is closed.");
                if (dtr >= 0) p.dtr = dtr == 1;
                if (rts >= 0) p.rts = rts == 1;
                p.applyLines();
                ok(cb, null);
            } catch (Exception e) {
                fail(cb, "NetworkError", message(e, "Couldn’t set the port’s signals."));
            }
        });
    }

    @JavascriptInterface
    public void close(int cb, int deviceId) {
        exec.execute(() -> {
            Port p = ports.remove(deviceId);
            if (p != null) p.close();
            ok(cb, null);
        });
    }

    // ---------- Devices and permission ----------

    private List<UsbDevice> serialDevices() {
        List<UsbDevice> out = new ArrayList<>();
        for (UsbDevice d : manager.getDeviceList().values()) if (endpoints(d) != null) out.add(d);
        return out;
    }

    private UsbDevice find(int deviceId, int vid, int pid) {
        UsbDevice same = null;
        for (UsbDevice d : manager.getDeviceList().values()) {
            if (d.getDeviceId() == deviceId) return d;
            // The board can come back with a new id after a reset into its bootloader
            if (d.getVendorId() == vid && d.getProductId() == pid && same == null) same = d;
        }
        return same;
    }

    private void grantThenReturn(int cb, UsbDevice d) {
        if (ensurePermission(d)) ok(cb, describe(d).toString());
        else fail(cb, "NotFoundError", "USB access was not allowed.");
    }

    /** Asks Android for access if needed and waits for the answer. Runs on the worker thread. */
    private boolean ensurePermission(UsbDevice d) {
        if (manager.hasPermission(d)) return true;
        CountDownLatch latch = new CountDownLatch(1);
        permissionWaits.put(d.getDeviceId(), latch);
        permissionAnswers.remove(d.getDeviceId());
        int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
        Intent i = new Intent(ACTION_PERMISSION).setPackage(activity.getPackageName());
        PendingIntent pi = PendingIntent.getBroadcast(activity, d.getDeviceId(), i, flags | PendingIntent.FLAG_UPDATE_CURRENT);
        ui.post(() -> manager.requestPermission(d, pi));
        try { latch.await(2, TimeUnit.MINUTES); } catch (InterruptedException e) { return false; }
        return Boolean.TRUE.equals(permissionAnswers.remove(d.getDeviceId())) || manager.hasPermission(d);
    }

    private JSONObject describe(UsbDevice d) {
        JSONObject o = new JSONObject();
        try {
            o.put("id", d.getDeviceId());
            o.put("vid", d.getVendorId());
            o.put("pid", d.getProductId());
            o.put("name", label(d));
            o.put("granted", manager.hasPermission(d));
        } catch (Exception ignored) {}
        return o;
    }

    private static String label(UsbDevice d) {
        String n = d.getProductName();
        if (n == null || n.isEmpty()) n = String.format("USB device %04x:%04x", d.getVendorId(), d.getProductId());
        return n;
    }

    // ---------- Back to the page ----------

    private void ok(int cb, String resultJson) {
        js("_done(" + cb + ",null,null," + (resultJson == null ? "null" : JSONObject.quote(resultJson)) + ")");
    }

    private void fail(int cb, String name, String msg) {
        js("_done(" + cb + "," + JSONObject.quote(name) + "," + JSONObject.quote(msg) + ",null)");
    }

    private void js(String call) {
        String code = "window.__androidSerial&&window.__androidSerial." + call;
        ui.post(() -> web.evaluateJavascript(code, null));
    }

    private static String message(Exception e, String fallback) {
        return e.getMessage() != null ? e.getMessage() : fallback;
    }

    /** [control interface or null, data interface, in endpoint, out endpoint], or null if not a serial device. */
    static Object[] endpoints(UsbDevice d) {
        UsbInterface control = null, data = null;
        UsbEndpoint in = null, out = null;
        for (int pass = 0; pass < 2 && data == null; pass++) {
            for (int i = 0; i < d.getInterfaceCount(); i++) {
                UsbInterface itf = d.getInterface(i);
                int cls = itf.getInterfaceClass();
                if (cls == UsbConstants.USB_CLASS_COMM && control == null) control = itf;
                // first pass: the CDC data interface; second pass: any interface with bulk in + out
                if (data != null || (pass == 0 && cls != UsbConstants.USB_CLASS_CDC_DATA)) continue;
                if (pass == 1 && cls != UsbConstants.USB_CLASS_VENDOR_SPEC) continue;
                UsbEndpoint ei = null, eo = null;
                for (int e = 0; e < itf.getEndpointCount(); e++) {
                    UsbEndpoint ep = itf.getEndpoint(e);
                    if (ep.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                    if (ep.getDirection() == UsbConstants.USB_DIR_IN) ei = ep; else eo = ep;
                }
                if (ei != null && eo != null) { data = itf; in = ei; out = eo; }
            }
        }
        return data == null ? null : new Object[]{control, data, in, out};
    }

    // ---------- One open CDC-ACM port ----------

    private class Port {
        final UsbDevice device;
        UsbDeviceConnection conn;
        UsbInterface control, data;
        UsbEndpoint in, out;
        volatile boolean running;
        Thread reader;
        boolean dtr = true, rts = true;   // Web Serial raises both when a port opens

        // Pending incoming bytes, handed to the page at most once per frame
        private final ByteArrayOutputStream pending = new ByteArrayOutputStream();
        private boolean flushQueued;

        Port(UsbDevice d) { device = d; }

        void open(int baud) throws IOException {
            Object[] e = UsbSerialBridge.endpoints(device);
            if (e == null) throw new IOException("This USB device doesn’t have a serial port the app can use.");
            control = (UsbInterface) e[0]; data = (UsbInterface) e[1]; in = (UsbEndpoint) e[2]; out = (UsbEndpoint) e[3];
            conn = manager.openDevice(device);
            if (conn == null) throw new IOException("Couldn’t open the USB device.");
            if (control != null) conn.claimInterface(control, true);
            if (!conn.claimInterface(data, true)) { conn.close(); throw new IOException("The USB port is busy."); }
            setBaud(baud);
            applyLines();
            running = true;
            reader = new Thread(this::readLoop, "usb-read-" + device.getDeviceId());
            reader.start();
        }

        int controlIndex() { return (control != null ? control : data).getId(); }

        void setBaud(int baud) {
            byte[] lc = {(byte) baud, (byte) (baud >> 8), (byte) (baud >> 16), (byte) (baud >> 24), 0 /* 1 stop bit */, 0 /* no parity */, 8};
            conn.controlTransfer(REQ_TYPE_CLASS_INTERFACE_OUT, SET_LINE_CODING, 0, controlIndex(), lc, lc.length, 1000);
        }

        void applyLines() {
            int v = (dtr ? 1 : 0) | (rts ? 2 : 0);
            conn.controlTransfer(REQ_TYPE_CLASS_INTERFACE_OUT, SET_CONTROL_LINE_STATE, v, controlIndex(), null, 0, 1000);
        }

        void write(byte[] b) throws IOException {
            int off = 0;
            while (off < b.length) {
                int n = conn.bulkTransfer(out, b, off, Math.min(16384, b.length - off), 5000);
                if (n < 0) throw new IOException("Couldn’t send to the board. Is the cable still plugged in?");
                off += n;
            }
        }

        private void readLoop() {
            UsbRequest req = new UsbRequest();
            if (!req.initialize(conn, in)) { lost(); return; }
            ByteBuffer buf = ByteBuffer.allocate(16384);
            try {
                if (!req.queue(buf)) { lost(); return; }
                while (running) {
                    UsbRequest done;
                    try { done = conn.requestWait(250); }
                    catch (TimeoutException t) { continue; }
                    if (done == null) { if (running) lost(); break; }
                    if (done != req) continue;
                    int n = buf.position();
                    if (n > 0) deliver(buf.array(), n);
                    buf.clear();
                    if (!running || !req.queue(buf)) break;
                }
            } catch (Exception e) {
                if (running) lost();
            } finally {
                try { req.cancel(); } catch (Exception ignored) {}
                try { req.close(); } catch (Exception ignored) {}
            }
        }

        private void deliver(byte[] b, int n) {
            synchronized (pending) {
                pending.write(b, 0, n);
                if (flushQueued) return;
                flushQueued = true;
            }
            ui.postDelayed(() -> {
                String s;
                synchronized (pending) {
                    s = Base64.encodeToString(pending.toByteArray(), Base64.NO_WRAP);
                    pending.reset();
                    flushQueued = false;
                }
                web.evaluateJavascript("window.__androidSerial&&window.__androidSerial._data(" + device.getDeviceId() + ",'" + s + "')", null);
            }, 12);
        }

        private void lost() {
            int id = device.getDeviceId();
            if (ports.remove(id, this)) {
                exec.execute(this::close);
                js("_gone(" + id + ")");
            }
        }

        void close() {
            if (conn == null) return;
            running = false;
            Thread t = reader;
            if (t != null && t != Thread.currentThread()) {
                try { t.join(1000); } catch (InterruptedException ignored) {}
            }
            try { conn.releaseInterface(data); } catch (Exception ignored) {}
            if (control != null) try { conn.releaseInterface(control); } catch (Exception ignored) {}
            try { conn.close(); } catch (Exception ignored) {}
            conn = null;
        }
    }
}
