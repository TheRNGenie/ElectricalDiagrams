// Inside the Android app (android/), the page runs in a WebView, which has no Web Serial.
// The app's UsbSerialBridge talks to the board over Android's USB host API instead, and this
// file dresses it up as navigator.serial so monitor.js and flasher.js work unchanged.
// In a browser window.AndroidUsb doesn't exist and this does nothing.
(() => {
const A = window.AndroidUsb;
if (!A || 'serial' in navigator) return;
document.documentElement.classList.add('native-app');

let seq = 0;
const calls = new Map();
const call = (fn, ...args) => new Promise((res, rej) => { const id = ++seq; calls.set(id, { res, rej }); A[fn](id, ...args); });
const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const bytes = c => c instanceof Uint8Array ? c : ArrayBuffer.isView(c) ? new Uint8Array(c.buffer, c.byteOffset, c.byteLength) : new Uint8Array(c);

const known = new Map();   // device id -> port
const listeners = { connect: [], disconnect: [] };

class AndroidSerialPort {
  constructor(d) { this._d = d; this._open = false; this._rc = null; this.readable = null; this.writable = null; this.ondisconnect = null; }
  getInfo() { return { usbVendorId: this._d.vid, usbProductId: this._d.pid }; }
  async open({ baudRate } = {}) {
    if (this._open) throw new DOMException('The port is already open.', 'InvalidStateError');
    if (!baudRate) throw new TypeError('baudRate is required');
    const d = await call('open', this._d.id, this._d.vid, this._d.pid, baudRate);
    const info = JSON.parse(d);
    if (info.id !== this._d.id) { known.delete(this._d.id); this._d.id = info.id; }
    known.set(info.id, this);
    this._open = true;
    this.readable = new ReadableStream({ start: c => { this._rc = c; }, cancel: () => { this._rc = null; } });
    this.writable = new WritableStream({ write: chunk => call('write', this._d.id, toB64(bytes(chunk))) });
  }
  async setSignals({ dataTerminalReady, requestToSend } = {}) {
    if (!this._open) throw new DOMException('The port is closed.', 'InvalidStateError');
    const v = x => x === undefined ? -1 : (x ? 1 : 0);
    await call('signals', this._d.id, v(dataTerminalReady), v(requestToSend));
  }
  async close() {
    if (!this._open) return;
    this._open = false;
    try { this._rc?.close(); } catch {}
    this._rc = null; this.readable = null; this.writable = null;
    await call('close', this._d.id);
  }
  async forget() { await this.close(); }
  _push(u8) { if (this._open && this._rc) { try { this._rc.enqueue(u8); } catch {} } }
  _lost() {
    if (this._open) {
      this._open = false;
      try { this._rc?.error(new Error('Board unplugged')); } catch {}
      this._rc = null; this.readable = null; this.writable = null;
    }
    const ev = { type: 'disconnect', target: this };
    if (typeof this.ondisconnect === 'function') this.ondisconnect(ev);
    fire('disconnect', ev);
  }
}

function fire(type, ev) {
  for (const l of [...listeners[type]]) {
    if (l.once) listeners[type].splice(listeners[type].indexOf(l), 1);
    try { l.fn.call(navigator.serial, ev); } catch (e) { console.error(e); }
  }
}
function portFor(d) {
  let p = known.get(d.id);
  if (!p) { p = new AndroidSerialPort(d); known.set(d.id, p); }
  return p;
}

window.__androidSerial = {
  _done(id, errName, msg, result) {
    const c = calls.get(id); if (!c) return; calls.delete(id);
    if (errName) { const e = errName === 'Error' ? new Error(msg) : new DOMException(msg, errName); c.rej(e); }
    else c.res(result);
  },
  _data(devId, b64) { known.get(devId)?._push(fromB64(b64)); },
  _gone(devId) { known.get(devId)?._lost(); }
};

Object.defineProperty(navigator, 'serial', { configurable: true, value: {
  async requestPort() { return portFor(JSON.parse(await call('request'))); },
  async getPorts() { return JSON.parse(A.list()).filter(d => d.granted).map(portFor); },
  addEventListener(type, fn, opts) { if (listeners[type] && fn) listeners[type].push({ fn, once: !!(opts && opts.once) }); },
  removeEventListener(type, fn) { const l = listeners[type]; if (!l) return; const i = l.findIndex(x => x.fn === fn); if (i >= 0) l.splice(i, 1); }
} });

// Everything ships inside the app, so the first-compile download note doesn't apply
addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('b-first');
  if (b) b.textContent = 'The compiler is built into the app, so compiling works with no connection.';
});
})();
