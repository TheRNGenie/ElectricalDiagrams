# Board Monitor

A phone-friendly page for the Arduino UNO R4 WiFi in the ELEGOO starter kit.

- **Monitor:** connect over USB (Chrome on Android or desktop) or WiFi, watch the serial output, plot any `name=value` numbers, and send commands.
- **Parts & wiring:** every part in the kit with a wiring diagram, a connection table, notes, and a ready-to-upload sketch that prints data the monitor can plot.
- **Code:** edit any sketch on the phone, compile it right in the page (clang compiled to WebAssembly, see `compiler/README.md`), see errors against your lines, and upload over USB. Sketches are saved on the phone; the kit's sketches and libraries are built into the app. After the first compile (about 30 MB, once) it works offline, and the page can be installed as an app.
- **Build planner:** tick several parts to check they don't need the same board pin.

Served with GitHub Pages from the `main` branch root. USB needs the https address.
