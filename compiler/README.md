# In-app compiler

Board Monitor compiles sketches for the UNO R4 WiFi inside the page, with no server.

- `llvm/` is Clang and LLD compiled to WebAssembly (microbit-clang-wasm, see `llvm/README.md`).
- `pack.tar.gz` holds the board pack: the arduino:renesas_uno 1.6.0 core and its bundled libraries, the
  kit libraries, the FSP headers and `libfsp.a`, and the newlib-nano and libstdc++ runtime from Arduino's
  arm-none-eabi-gcc 7-2017q4. Core and libraries are precompiled with the same clang. `pack.json`
  maps each header to its library so a sketch's `#include`s pick the libraries to link.
- `worker.js` loads both once (the service worker keeps them on the phone) and runs `build.js`, which
  turns the `.ino` into C++ (`ino.js`), compiles, links with the core's `fsp.ld`, and returns the `.bin`.

Not included: the RTC library (its `struct timeval` clashes with newlib under clang) and I2S (not part of
the UNO R4 WiFi variant).

## Rebuilding the pack

1. Run the "Export board core for the in-app compiler" workflow (Actions tab) on a branch. It commits
   `tools/raw/` with the core, libraries, gcc runtime and reference builds.
2. Extract `tools/raw/core.tgz` to `<dir>/core`, `libs.tgz` to `<dir>/libs`, `gcc.tgz` to `<dir>/gcc`.
3. `npm i microbit-clang-wasm`, then
   `node tools/build-pack.mjs <dir> node_modules/microbit-clang-wasm/gen/bundle.js`.
   It rewrites `pack.tar.gz` and `pack.json` and compiles every kit sketch as a check.
4. Delete `tools/raw/` before merging, and bump `VERSION` in `sw.js` so phones fetch the new pack.

## Licences

The compiler is LLVM (Apache-2.0 with LLVM exception). The Arduino core and Arduino libraries are
LGPL-2.1 (source: github.com/arduino/ArduinoCore-renesas), the Renesas FSP is BSD-3-Clause, newlib is
under BSD-style notices, libstdc++ is GPL-3.0 with the GCC Runtime Library Exception. The kit libraries
keep their own licences; the licence files that ship with them are inside `pack.tar.gz`.
