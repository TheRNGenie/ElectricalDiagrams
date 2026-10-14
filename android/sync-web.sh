#!/bin/sh
# Copies the Board Monitor page (the repo root) into the app, so everything it needs,
# compiler included, ships inside the APK and nothing is downloaded at run time.
set -e
here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
out="$here/app/src/main/assets/www"
rm -rf "$out"
mkdir -p "$out"
cd "$root"
cp index.html app.css native-bridge.js monitor.js flasher.js parts-data.js parts.js sketches.js editor.js \
   manifest.webmanifest icon.svg icon-192.png icon-512.png "$out/"
cp -R bin "$out/bin"
mkdir -p "$out/compiler"
cp compiler/*.js compiler/pack.json compiler/pack.tar.gz "$out/compiler/"
cp -R compiler/llvm "$out/compiler/llvm"
du -sh "$out"
