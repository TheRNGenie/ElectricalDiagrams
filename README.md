# Board Monitor

A phone-friendly page for the Arduino UNO R4 WiFi in the ELEGOO starter kit.

- **Monitor:** connect over USB (Chrome on Android or desktop) or WiFi, watch the serial output, plot any `name=value` numbers, and send commands.
- **Parts & wiring:** every part in the kit with a wiring diagram, a connection table, notes, and a ready-to-upload sketch that prints data the monitor can plot.
- **Code:** edit any sketch on the phone, compile it on GitHub Actions (`.github/workflows/compile-one.yml`), see compiler errors against your lines, and upload the result over USB. Needs a fine-grained GitHub token with Contents and Actions set to Read and write; the page walks you through it. Extra libraries go in `sketches/<name>/libraries.txt`.
- **Build planner:** tick several parts to check they don't need the same board pin.

Served with GitHub Pages from the `main` branch root. USB needs the https address.
