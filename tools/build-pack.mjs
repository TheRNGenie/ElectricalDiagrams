// Builds the in-app compiler's board pack from the exported Arduino core (tools/raw/*.tgz, extracted):
// compiles the UNO R4 WiFi core and every library with the same WebAssembly clang the app runs,
// keeps only the headers those builds read, and writes compiler/pack.tar.gz plus compiler/pack.json.
// It then compiles the kit sketches with the browser's own build code as a check.
//
//   node tools/build-pack.mjs <extracted dir with core/ libs/ gcc/> <microbit-clang-wasm/gen/bundle.js>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFLAGS, CXXFLAGS, CORE_INC, RUNTIME } from '../compiler/flags.js';

const [PK, BUNDLE] = process.argv.slice(2);
const ROOT = new URL('..', import.meta.url).pathname;
const { createSession } = await import(BUNDLE);
const s = createSession();
let errText = '';
const dec = new TextDecoder();
const io = { stderr: b => { if (b) errText += dec.decode(b); }, stdout: b => { if (b) errText += dec.decode(b); } };

// ---------- load the export into the virtual filesystem ----------
const SRC_EXT = /\.(h|hh|hpp|c|cpp|cc|inc|S|ipp|tpp)$/i;
const INC_DIRS = CORE_INC.map(f => f.slice(2)).map(v => [PK + '/core' + v.slice(3), v]);
// The WebAssembly filesystem doesn't resolve ".." in #include "../x.h", so such includes are
// rewritten to absolute paths, searched the way the compiler would: the file's folder, then -I.
function readTree(dir, vdir, extraInc = []) {
  const t = {};
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) t[e.name] = readTree(p, vdir + '/' + e.name, extraInc);
    else if (e.isFile()) {
      let data = fs.readFileSync(p);
      if (SRC_EXT.test(e.name)) {
        const text = data.toString('latin1');
        const fixed = text.replace(/(#\s*include\s*")([^"]*\.\.\/[^"]*)"/g, (m, pre, inc) => {
          for (const [rdir, vd] of [[dir, vdir], ...extraInc, ...INC_DIRS])
            if (fs.existsSync(path.resolve(rdir, inc))) return pre + path.posix.normalize(vd + '/' + inc) + '"';
          return m;
        });
        if (fixed !== text) data = Buffer.from(fixed, 'latin1');
      }
      t[e.name] = new Uint8Array(data);
    }
  }
  return t;
}
function walk(dir, rel = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!/^(examples?|extras|test|tests|docs?|\.\w+)$/i.test(e.name)) out.push(...walk(path.join(dir, e.name), r)); }
    else out.push(r);
  }
  return out;
}

// ---------- libraries: where their headers live ----------
const LIBS = [];
for (const [base, vbase] of [[PK + '/core/libraries', '/hw/libraries'], [PK + '/libs/libraries', '/libs']]) {
  for (const name of fs.readdirSync(base).sort()) {
    const dir = base + '/' + name;
    const layout = fs.existsSync(dir + '/src') ? 'src' : 'flat';
    const srcRoot = layout === 'src' ? dir + '/src' : dir;
    const vsrc = (layout === 'src' ? `${vbase}/${name}/src` : `${vbase}/${name}`);
    const inc = [vsrc]; if (layout === 'flat' && fs.existsSync(dir + '/utility')) inc.push(vsrc + '/utility');
    const files = layout === 'src' ? walk(srcRoot) : fs.readdirSync(srcRoot).filter(f => fs.statSync(srcRoot + '/' + f).isFile())
      .concat(fs.existsSync(dir + '/utility') ? walk(dir + '/utility').map(f => 'utility/' + f) : []);
    LIBS.push({ name, dir, vdir: `${vbase}/${name}`, vsrc, inc, files });
  }
}
const libIncDirs = LIBS.flatMap(l => l.inc.map(v => [(v.startsWith('/hw') ? PK + '/core' + v.slice(3) : PK + '/libs/libraries' + v.slice(5)), v]));

console.time('load');
const TREE = { hw: readTree(PK + '/core', '/hw', libIncDirs), gcc: readTree(PK + '/gcc', '/gcc'), libs: readTree(PK + '/libs/libraries', '/libs', libIncDirs) };
await s.writeTree(TREE);
console.timeEnd('load');

// ---------- compiling, with a record of every file each compile reads ----------
const used = new Set();
async function cc(src, obj, extra = []) {
  const isC = src.endsWith('.c'), isS = /\.S$/.test(src);
  const flags = isS ? [...CFLAGS.filter(f => !f.startsWith('-std')), '-x', 'assembler-with-cpp'] : isC ? CFLAGS : CXXFLAGS;
  errText = '';
  const rc = await s.clang([isC || isS ? 'clang' : 'clang++', ...flags, ...CORE_INC, ...extra, '-w', '-MD', '-MF', obj + '.d', '-c', src, '-o', obj], io);
  if (rc !== 0) return errText;
  const d = await s.readFile(obj + '.d');
  if (d) for (const f of dec.decode(d).replace(/\\\n/g, ' ').split(/\s+/).slice(1)) if (f.startsWith('/')) used.add(path.posix.normalize(f));
  return null;
}
async function ar(out, objs) { errText = ''; const rc = await s.run(['llvm-ar', 'rcs', out, ...objs], io); if (rc) throw new Error(errText); }

// core
console.time('core');
const coreFiles = walk(PK + '/core/cores/arduino').filter(f => /\.(c|cpp|S)$/.test(f)).map(f => '/hw/cores/arduino/' + f);
const variantFiles = ['tmp_gen_c_files/common_data.c', 'tmp_gen_c_files/main.c', 'tmp_gen_c_files/pin_data.c', 'variant.cpp'].map(f => '/hw/variants/UNOWIFIR4/' + f);
const coreObjs = [];
for (const f of [...coreFiles, ...variantFiles]) {
  const o = '/out/obj/core/' + f.replace(/\//g, '_') + '.o';
  const e = await cc(f, o); if (e) throw new Error('core failed: ' + f + '\n' + e);
  coreObjs.push(o);
}
await ar('/out/core.a', coreObjs.filter(o => !o.includes('variants')));
for (const o of coreObjs.filter(o => o.includes('variants'))) await s.writeFile('/out/' + path.basename(o).replace(/^_hw_variants_UNOWIFIR4_(tmp_gen_c_files_)?/, ''), await s.readFile(o));
console.timeEnd('core');

// libraries
const headerOwner = {};
for (const l of LIBS) for (const f of l.files) if (/\.(h|hpp)$/i.test(f)) {
  const base = f.split('/').pop(); if (!headerOwner[base]) headerOwner[base] = l.name;
  if (!headerOwner[f]) headerOwner[f] = l.name;
}
const allLibInc = LIBS.flatMap(l => l.inc.map(i => '-I' + i));
const packLibs = {};
console.time('libs');
for (const l of LIBS) {
  const srcs = l.files.filter(f => /\.(c|cpp|S)$/.test(f));
  const objs = [], failed = [];
  const extra = [...l.inc.map(i => '-I' + i), ...allLibInc];
  for (const f of srcs) {
    const o = `/out/obj/${l.name}/${f.replace(/\//g, '_')}.o`;
    const e = await cc(l.vsrc + '/' + f, o, extra);
    if (e) failed.push(f + ': ' + e.split('\n').find(x => /error/.test(x))); else objs.push(o);
  }
  // which other libraries this one includes
  const deps = new Set();
  for (const f of l.files) {
    const p = path.join(l.dir, fs.existsSync(l.dir + '/src') ? 'src' : '', f);
    if (!SRC_EXT.test(f) || !fs.existsSync(p)) continue;
    for (const m of fs.readFileSync(p, 'latin1').matchAll(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm)) {
      const owner = headerOwner[m[1]] || headerOwner[m[1].split('/').pop()];
      if (owner && owner !== l.name) deps.add(owner);
    }
  }
  if (failed.length) { console.log(`skip ${l.name}: ${failed.length} of ${srcs.length} files failed\n  ` + failed.slice(0, 3).join('\n  ')); continue; }
  if (objs.length) await ar(`/out/lib/${l.name}.a`, objs);
  packLibs[l.name] = { inc: l.inc, a: objs.length ? `/out/lib/${l.name}.a` : null, deps: [...deps].sort() };
  // all of a library's headers go in the pack, used or not, so sketches can include any of them
  for (const f of l.files) if (/\.(h|hh|hpp|inc|ipp|tpp)$/i.test(f) || l.files.every(x => !/\.(c|cpp)$/.test(x))) used.add(l.vsrc + '/' + f);
}
console.timeEnd('libs');
for (const n in packLibs) packLibs[n].deps = packLibs[n].deps.filter(d => packLibs[d]);
const headers = {};
for (const [h, n] of Object.entries(headerOwner)) if (packLibs[n]) headers[h] = n;

// ---------- runtime libraries ----------
const G = '/gcc/arm-none-eabi/lib/thumb/v7e-m/fpv4-sp/hard', GL = '/gcc/lib/gcc/arm-none-eabi/7.2.1/thumb/v7e-m/fpv4-sp/hard';
for (const [to, from] of Object.entries({ crti: GL + '/crti.o', crtbegin: GL + '/crtbegin.o', crtend: GL + '/crtend.o', crtn: GL + '/crtn.o',
  libc: G + '/libc_nano.a', libm: G + '/libm.a', libgcc: GL + '/libgcc.a', libnosys: G + '/libnosys.a', libstdcxx: G + '/libstdc++_nano.a', libsupcxx: G + '/libsupc++_nano.a' }))
  await s.writeFile(RUNTIME[to], await s.readFile(from));

// ---------- reference sketches through the browser build code ----------
const { buildSketch } = await import('../compiler/build.js');
const runtimeFiles = Object.values(RUNTIME);
const kit = fs.readdirSync(ROOT + 'sketches').filter(n => fs.existsSync(`${ROOT}sketches/${n}/${n}.ino`));
const pack = { version: 1, libs: packLibs, headers };
// the browser loads the pack at these same paths
await s.writeTree({ pack: { 'pack.json': JSON.stringify(pack) } });
const results = [];
for (const name of kit) {
  const src = fs.readFileSync(`${ROOT}sketches/${name}/${name}.ino`, 'utf8');
  const r = await buildSketch(s, name, src, pack, { onDeps: files => files.forEach(f => used.add(f)) });
  const ref = fs.existsSync(`${ROOT}bin/${name}.bin`) ? fs.statSync(`${ROOT}bin/${name}.bin`).size : null;
  results.push(`${r.ok ? 'ok  ' : 'FAIL'} ${name}  ${r.ok ? r.bin.length : ''}  (Arduino IDE build: ${ref})${r.ok ? '' : '\n' + r.log.slice(0, 1500)}`);
}
console.log(results.join('\n'));

// ---------- write the pack ----------
// everything the browser needs, under the same absolute paths
const files = new Map();
const add = async (vpath) => { const d = await s.readFile(vpath); if (d) files.set(vpath, d); else console.log('missing', vpath); };
for (const f of used) if (!f.startsWith('/sk/') && !f.startsWith('/out/obj') && !f.startsWith('/usr/')) await add(f);
for (const f of runtimeFiles) await add(f);
await add('/out/core.a');
for (const f of ['common_data.c.o', 'main.c.o', 'pin_data.c.o', 'variant.cpp.o']) await add('/out/' + f);
for (const n in packLibs) if (packLibs[n].a) await add(packLibs[n].a);
for (const f of ['/hw/variants/UNOWIFIR4/fsp.ld', '/hw/variants/UNOWIFIR4/memory_regions.ld', '/hw/variants/UNOWIFIR4/libs/libfsp.a']) await add(f);
// licences of the bundled code
for (const l of LIBS) for (const f of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'license.txt', 'COPYING']) {
  const v = `${l.vdir}/${f}`; if (await s.readFile(v)) await add(v);
}
await add('/hw/cores/arduino/api/LICENSE');

function tar(entries) {
  const blocks = [];
  for (const [name, data] of entries) {
    const n = name.replace(/^\//, '');
    let prefix = '', short = n;
    if (n.length > 100) { const cut = n.indexOf('/', n.length - 101); prefix = n.slice(0, cut); short = n.slice(cut + 1); }
    if (short.length > 100 || prefix.length > 155) throw new Error('path too long for tar: ' + n);
    const h = Buffer.alloc(512);
    h.write(short, 0); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136);
    h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263); h.write(prefix, 345);
    let sum = 0; for (const b of h) sum += b; h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, Buffer.from(data), Buffer.alloc((512 - data.length % 512) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}
const entries = [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const raw = tar(entries);
fs.writeFileSync(ROOT + 'compiler/pack.tar.gz', zlib.gzipSync(raw, { level: 9 }));
fs.writeFileSync(ROOT + 'compiler/pack.json', JSON.stringify(pack));
console.log(`pack: ${entries.length} files, ${(raw.length / 1e6).toFixed(1)} MB, gzipped ${(fs.statSync(ROOT + 'compiler/pack.tar.gz').size / 1e6).toFixed(1)} MB`);
console.log('libraries:', Object.keys(packLibs).join(', '));
