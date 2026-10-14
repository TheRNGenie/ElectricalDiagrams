// Compiles and links one Arduino sketch for the UNO R4 WiFi inside a clang session
// (microbit-clang-wasm createSession()) that already holds the board pack.
// Shared by the in-app compiler (compiler/worker.js) and the pack builder (tools/build-pack.mjs).
import './ino.js';
import { CXXFLAGS, CORE_INC, RUNTIME, VARIANT_OBJS } from './flags.js';

const dec = new TextDecoder();
// core and library headers as system headers, so their warnings don't crowd out the sketch's own
const sys = flags => flags.flatMap(f => ['-isystem', f.slice(2)]);

// Libraries the sketch needs: the ones owning its #includes, plus what those depend on
export function librariesFor(src, pack) {
  const want = new Set();
  const add = n => { if (!n || want.has(n) || !pack.libs[n]) return; want.add(n); pack.libs[n].deps.forEach(add); };
  for (const inc of globalThis.InoPrep.includes(src)) add(pack.headers[inc] || pack.headers[inc.split('/').pop()]);
  return [...want];
}

export async function buildSketch(s, name, src, pack, { onDeps, extraFlags = [] } = {}) {
  let log = '';
  const io = { stdout: b => { if (b) log += dec.decode(b); }, stderr: b => { if (b) log += dec.decode(b); } };
  const libs = librariesFor(src, pack);
  const inc = libs.flatMap(n => pack.libs[n].inc.map(i => '-I' + i));
  const dir = '/sk/' + name;
  await s.remove(dir);
  await s.writeFile(`${dir}/${name}.ino.cpp`, globalThis.InoPrep.preprocess(src, `${name}.ino`));
  let rc = await s.clang(['clang++', ...CXXFLAGS, ...sys(CORE_INC), ...sys(inc), ...extraFlags, '-fno-color-diagnostics', '-ferror-limit=30',
    '-MD', '-MF', `${dir}/deps.d`, '-c', `${dir}/${name}.ino.cpp`, '-o', `${dir}/${name}.o`], io);
  if (rc !== 0) return { ok: false, stage: 'compile', log, libs };
  if (onDeps) { const d = await s.readFile(`${dir}/deps.d`); if (d) onDeps(dec.decode(d).replace(/\\\n/g, ' ').split(/\s+/).slice(1).filter(f => f.startsWith('/'))); }

  const libArchives = libs.map(n => pack.libs[n].a).filter(Boolean);
  rc = await s.run(['ld.lld', '--gc-sections', '-L/rt', '-L/hw/variants/UNOWIFIR4',
    RUNTIME.crti, RUNTIME.crtbegin, `${dir}/${name}.o`, ...VARIANT_OBJS,
    '--whole-archive', '/hw/variants/UNOWIFIR4/libs/libfsp.a', '/out/core.a', '--no-whole-archive',
    '--start-group', ...libArchives, RUNTIME.libstdcxx, RUNTIME.libsupcxx, RUNTIME.libm, RUNTIME.libc, RUNTIME.libgcc, RUNTIME.libnosys, '--end-group',
    RUNTIME.crtend, RUNTIME.crtn,
    // after the inputs: lld reads the script's GROUP() where -T appears
    '-T', '/hw/variants/UNOWIFIR4/fsp.ld', '-o', `${dir}/${name}.elf`], io);
  if (rc !== 0) return { ok: false, stage: 'link', log, libs };
  const elf = await s.readFile(`${dir}/${name}.elf`);
  let bin;
  try { bin = elfToBin(elf, ['.text', '.ARM.exidx', '.data']); }
  catch (e) { return { ok: false, stage: 'objcopy', log: log + e.message, libs }; }
  // RAM: .data + .bss + .noinit
  let sizes = '';
  await s.run(['llvm-size', '-A', `${dir}/${name}.elf`], { stdout: b => { if (b) sizes += dec.decode(b); } });
  let ram = 0;
  for (const m of sizes.matchAll(/^\.(data|bss|noinit)\s+(\d+)/gm)) ram += +m[2];
  return { ok: true, bin, ram, log, libs };
}

// Same as `objcopy -O binary -j .text -j .ARM.exidx -j .data`: each section at its load address
// (.data is stored in flash after the code), from the lowest address up. llvm-objcopy can't
// write its output in the WebAssembly filesystem, so this reads the ELF directly.
export function elfToBin(elf, names) {
  const v = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  if (v.getUint32(0) !== 0x7f454c46 || elf[4] !== 1) throw new Error('Not a 32-bit ELF file');
  const phoff = v.getUint32(28, true), phentsize = v.getUint16(42, true), phnum = v.getUint16(44, true);
  const shoff = v.getUint32(32, true), shentsize = v.getUint16(46, true), shnum = v.getUint16(48, true), shstrndx = v.getUint16(50, true);
  const segs = [];
  for (let i = 0; i < phnum; i++) {
    const o = phoff + i * phentsize;
    if (v.getUint32(o, true) === 1) segs.push({ vaddr: v.getUint32(o + 8, true), paddr: v.getUint32(o + 12, true), memsz: v.getUint32(o + 20, true) });
  }
  const strOff = v.getUint32(shoff + shstrndx * shentsize + 16, true);
  const nameAt = off => { let e = strOff + off, str = ''; while (elf[e]) str += String.fromCharCode(elf[e++]); return str; };
  const parts = [];
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    const name = nameAt(v.getUint32(o, true)), type = v.getUint32(o + 4, true);
    const addr = v.getUint32(o + 12, true), off = v.getUint32(o + 16, true), size = v.getUint32(o + 20, true);
    if (!names.includes(name) || type === 8 || !size) continue;          // 8 = NOBITS
    const seg = segs.find(sg => addr >= sg.vaddr && addr + size <= sg.vaddr + sg.memsz);
    const lma = seg ? addr - seg.vaddr + seg.paddr : addr;
    parts.push({ lma, data: elf.subarray(off, off + size) });
  }
  if (!parts.length) throw new Error('No code in the linked file');
  const lo = Math.min(...parts.map(p => p.lma)), hi = Math.max(...parts.map(p => p.lma + p.data.length));
  const out = new Uint8Array(hi - lo);
  for (const p of parts) out.set(p.data, p.lma - lo);
  return out;
}
