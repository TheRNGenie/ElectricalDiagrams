# Board Monitor

A phone-friendly page for the Arduino UNO R4 WiFi in the ELEGOO starter kit.

- **Monitor:** connect over USB (Chrome on Android or desktop) or WiFi, watch the serial output, plot any `name=value` numbers, and send commands.
- **Parts & wiring:** every part in the kit with a wiring diagram, a connection table, notes, and a ready-to-upload sketch that prints data the monitor can plot.
- **Code:** edit any sketch on the phone, compile it right in the page (clang compiled to WebAssembly, see `compiler/README.md`), see errors against your lines, and upload over USB. Sketches are saved on the phone; the kit's sketches and libraries are built into the app. After the first compile (about 30 MB, once) it works offline, and the page can be installed as an app.
- **Build planner:** tick several parts to check they don't need the same board pin.

Served with GitHub Pages from the `main` branch root. USB needs the https address.

## Android app

`android/` wraps the same page as an installable Android app with the compiler built in, so it needs no web address, no browser and no connection. USB goes through Android's own USB host support (`UsbSerialBridge.java`), which `native-bridge.js` presents to the page as Web Serial.

Every push to `main` builds it with GitHub Actions and publishes it here:
https://github.com/TheRNGenie/ElectricalDiagrams/releases/download/android/BoardMonitor.apk

To install: open that link on the phone, download, tap the file and allow installs from this source when Android asks. Plug the board in with a USB-C cable; Android offers to open Board Monitor, and ticking "Always" skips the USB question next time.

