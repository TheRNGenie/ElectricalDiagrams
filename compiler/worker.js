// The in-app compiler, run as a module Web Worker so the page stays responsive.
// Loads clang (compiler/llvm) and the UNO R4 WiFi board pack (compiler/pack.tar.gz) once,
// keeps them in one session, and builds sketches on request.
//   in:  { type: 'build', id, name, src }   |  { type: 'warm' }
//   out: { type: 'progress', text, frac }   |  { type: 'result', id, ok, stage, bin, ram, log, libs }
import { createSession, setAssetLoader } from './llvm/bundle.js';
import { buildSketch } from './build.js';

const SIZES = { 'llvm.core.wasm.gz': 19448128, 'llvm-resources.tar.gz': 4045408 };   // for progress before headers arrive
let done = 0, total = 0;
const say = (text, frac) => postMessage({ type: 'progress', text, frac });

// Downloads a file, counting bytes for the progress bar, and un-gzips it if needed
async function download(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn’t load ${url} (${res.status}).`);
  const len = +res.headers.get('content-length') || SIZES[url.split('/').pop()] || 0;
  total += len;
  const reader = res.body.getReader(), chunks = [];
  let got = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    chunks.push(value); got += value.length; done += value.length;
    if (total) say(`${label} ${Math.round(done / 1e6)} of ${Math.round(total / 1e6)} MB`, Math.min(0.99, done / total));
  }
  total += got - len; // in case the length was a guess
  let blob = new Blob(chunks);
  // un-gzip unless the server already did (gzip files start 1f 8b)
  if (chunks[0] && chunks[0][0] === 0x1f && chunks[0][1] === 0x8b) blob = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
  return new Uint8Array(await blob.arrayBuffer());
}

function untar(buf) {
  const tree = {};
  const text = (o, n) => { let s = ''; for (let i = o; i < o + n && buf[i]; i++) s += String.fromCharCode(buf[i]); return s; };
  for (let off = 0; off + 512 <= buf.length;) {
    const name = text(off, 100); if (!name) break;
    const prefix = text(off + 345, 155), size = parseInt(text(off + 124, 12), 8) || 0, type = text(off + 156, 1);
    const full = (prefix ? prefix + '/' : '') + name;
    if (type === '0' || type === '') {
      const parts = full.split('/').filter(Boolean); let node = tree;
      for (const p of parts.slice(0, -1)) node = node[p] ??= {};
      node[parts[parts.length - 1]] = buf.slice(off + 512, off + 512 + size);
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return tree;
}

let ready = null, pack = null, session = null;
function load() {
  return ready ??= (async () => {
    say('Downloading the compiler (once, then it works offline)…', 0);
    const [wasm, res, packTar, packJson] = await Promise.all([
      download('./llvm/llvm.core.wasm.gz', 'Downloading the compiler:'),
      download('./llvm/llvm-resources.tar.gz', 'Downloading the compiler:'),
      download('./pack.tar.gz', 'Downloading the compiler:'),
      fetch('./pack.json').then(r => r.json())
    ]);
    setAssetLoader(name => {
      if (name === 'llvm.core.wasm') return new Response(wasm, { headers: { 'content-type': 'application/wasm' } });
      if (name === 'llvm-resources.tar') return res;
      return null;   // the small adapter modules load normally
    });
    say('Starting the compiler…', 1);
    pack = packJson;
    session = createSession();
    await session.writeTree(untar(packTar));
  })().catch(e => { ready = null; throw e; });
}

let queue = Promise.resolve();
onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      await load();
      if (data.type !== 'build') { say('', 1); return; }
      say('Compiling…', 1);
      const r = await buildSketch(session, data.name, data.src, pack);
      postMessage({ type: 'result', id: data.id, ...r }, r.bin ? [r.bin.buffer] : []);
    } catch (e) {
      postMessage({ type: 'result', id: data.id, ok: false, stage: 'setup', log: String(e && e.message || e) });
    }
  });
};
