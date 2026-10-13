// Uploads a compiled sketch (.bin) to an UNO R4 WiFi over Web Serial.
// Same steps as the Arduino IDE's bossac upload:
//   1. Open the port at 1200 baud and close it ("1200 bps touch"). The board's USB bridge
//      then restarts the main chip into its bootloader.
//   2. Reopen at 230400 and speak the bootloader's SAM-BA style commands:
//      S = send bytes into its RAM buffer, Y = write that buffer to flash (erases as it goes),
//      Z = CRC of a flash range (to verify), K = restart into the new sketch.
// Protocol reference: arduino/arduino-renesas-bootloader, src/bossa.c
window.R4Flasher = (() => {
  const CHUNK = 4096;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const hex8 = n => n.toString(16).toUpperCase().padStart(8, '0');
  const enc = new TextEncoder(), dec = new TextDecoder();

  // CRC-16/XMODEM, the same table the bootloader uses for Z
  const CRC = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1);
    CRC[i] = c & 0xffff;
  }
  const crc16 = bytes => { let c = 0; for (const b of bytes) c = ((c << 8) ^ CRC[((c >> 8) ^ b) & 0xff]) & 0xffff; return c; };

  async function openRetry(port, baudRate, tries = 8) {
    for (let i = 0; i < tries; i++) {
      try { await port.open({ baudRate }); return; }
      catch (e) { if (i === tries - 1) throw e; await sleep(400); }
    }
  }

  async function flash(port, bin, onStatus = () => {}) {
    if (!(bin instanceof Uint8Array)) bin = new Uint8Array(bin);
    // pad to a multiple of 8 bytes (the flash write unit)
    const size = Math.ceil(bin.length / 8) * 8;
    const image = new Uint8Array(size).fill(0xff); image.set(bin);

    onStatus('Restarting the board into upload mode…', 0);
    await openRetry(port, 1200);
    try { await port.setSignals({ dataTerminalReady: false }); } catch {}
    await port.close();
    await sleep(1500);
    await openRetry(port, 230400);

    const reader = port.readable.getReader();
    const writer = port.writable.getWriter();
    let rx = '';
    let reading = true;
    const pump = (async () => {
      try { while (reading) { const { value, done } = await reader.read(); if (done) break; if (value) rx += dec.decode(value, { stream: true }); } }
      catch {}
    })();
    const send = data => writer.write(typeof data === 'string' ? enc.encode(data) : data);
    async function cmd(s, expect, timeout = 3000) {
      rx = '';
      await send(s);
      const t0 = Date.now();
      while (!rx.includes(expect)) {
        if (Date.now() - t0 > timeout) throw new Error(`The board didn’t answer “${s}”. Unplug it, plug it back in and try again.`);
        await sleep(5);
      }
      return rx;
    }

    try {
      await cmd('N#', '\n\r');
      const ver = await cmd('V#', '\n\r');
      if (!/Arduino/i.test(ver)) throw new Error('This doesn’t look like an UNO R4 WiFi bootloader.');
      await cmd('X00000000#', 'X\n\r');

      for (let off = 0; off < size; off += CHUNK) {
        const part = image.subarray(off, Math.min(off + CHUNK, size));
        await send(`S00000000,${hex8(part.length)}#`);
        await sleep(15);                       // let the bootloader switch to data mode first
        await send(part);
        await cmd('Y00000000,0#', 'Y\n\r', 4000);
        await cmd(`Y${hex8(off)},${hex8(part.length)}#`, 'Y\n\r', 6000);
        onStatus(`Writing… ${Math.round(100 * (off + part.length) / size)}%`, (off + part.length) / size * 0.85);
      }

      for (let off = 0; off < size; off += CHUNK) {
        const part = image.subarray(off, Math.min(off + CHUNK, size));
        const r = await cmd(`Z${hex8(off)},${hex8(part.length)}#`, '#\n\r', 4000);
        const m = r.match(/Z([0-9A-F]{8})#/i);
        if (!m || (parseInt(m[1], 16) & 0xffff) !== crc16(part)) throw new Error('Check failed after writing. Try the upload again.');
        onStatus('Checking…', 0.85 + 0.15 * (off + part.length) / size);
      }

      await send('K#');
      await sleep(100);
      onStatus('Uploaded. The new sketch is running.', 1);
    } finally {
      reading = false;
      try { await reader.cancel(); } catch {}
      try { reader.releaseLock(); writer.releaseLock(); } catch {}
      await pump;
      try { await port.close(); } catch {}
    }
  }

  return { flash, crc16 };
})();
