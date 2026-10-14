// Code tab: edit a sketch on the phone, compile it in the page, upload it over USB.
// Sketches are kept in this browser (localStorage); the kit's sketches are built into the app
// (sketches.js). Compiling runs clang compiled to WebAssembly in a worker (compiler/worker.js),
// so nothing here talks to GitHub or any other server.
(() => {
const $ = id => document.getElementById(id);
const KIT = window.SKETCHES || {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};

// ---------- Saved sketches ----------
// { name: { text, updated } }, newest edits win; kit sketches appear until you save your own copy
let mine = {};
try { mine = JSON.parse(store.get('bm-sketches')) || {}; } catch {}
const saveAll = () => store.set('bm-sketches', JSON.stringify(mine));
if (!mine.my_sketch && KIT.my_sketch) { mine.my_sketch = { text: KIT.my_sketch, updated: Date.now() }; saveAll(); }
const TEMPLATE = `// Prints name=value pairs at 115200 baud so Board Monitor can plot them.

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  Serial.print("a0=");
  Serial.println(analogRead(A0));
  delay(200);
}
`;

// ---------- Editor ----------
const ta = $('code'), gutter = $('gutter');
let marks = new Map();           // line -> 'err' | 'warn'
function renderGutter() {
  const n = ta.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= n; i++) { const m = marks.get(i); html += (m ? `<span class="g${m}">${i}</span>` : i) + '\n'; }
  gutter.innerHTML = html;
  gutter.scrollTop = ta.scrollTop;
}
ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
function caret() {
  const before = ta.value.slice(0, ta.selectionStart);
  const line = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
  $('ed-pos').textContent = `Line ${line}, col ${col}`;
}
['keyup', 'click', 'select', 'focus'].forEach(ev => ta.addEventListener(ev, caret));
function insert(text) {
  ta.focus();
  if (!document.execCommand('insertText', false, text)) {   // keeps the browser's undo history
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
function newline() {
  const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  const line = ta.value.slice(start, ta.selectionStart);
  let indent = line.match(/^[ \t]*/)[0];
  if (/[{(\[]\s*$/.test(line)) indent += '  ';
  insert('\n' + indent);
}
// Enter keeps the indent (and adds one after “{”). beforeinput catches Android keyboards, which send no usable key codes.
ta.addEventListener('beforeinput', e => {
  if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') { e.preventDefault(); newline(); }
});
ta.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); insert('  '); }
});
let saveTimer = null;
ta.addEventListener('input', () => {
  renderGutter(); caret();
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 300);
  if (bin && binFor === current) setFlashNote('Upload sends the last compiled version. Compile again to include your newest edits.');
});

// Symbols that are slow to reach on a phone keyboard
const KEYS = ['⇥', '{', '}', '(', ')', ';', '<', '>', '=', '"', "'", '[', ']', '#', '&', '|', '!', '+', '-', '*', '/', ':', ',', '_', '%', '↶', '↷'];
for (const k of KEYS) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = k;
  b.setAttribute('aria-label', { '⇥': 'Indent', '↶': 'Undo', '↷': 'Redo' }[k] || k);
  b.addEventListener('pointerdown', e => e.preventDefault());   // keep the keyboard open
  b.onclick = () => {
    if (k === '⇥') insert('  ');
    else if (k === '↶') { ta.focus(); document.execCommand('undo'); }
    else if (k === '↷') { ta.focus(); document.execCommand('redo'); }
    else insert(k);
  };
  $('keys').append(b);
}

function gotoLine(line, col = 1) {
  const lines = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  pos += Math.min(col - 1, (lines[line - 1] || '').length);
  $('s-editor').scrollIntoView({ block: 'start', behavior: 'smooth' });
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(pos, pos);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 19.5;
  ta.scrollTop = Math.max(0, (line - 1) * lh - ta.clientHeight / 3);
  ta.scrollLeft = 0;
  caret();
}

// ---------- Choosing a sketch ----------
let current = null;
let bin = null, binFor = null, busy = false;
function save() {
  if (!current) return;
  const kitText = KIT[current];
  if (!mine[current] && ta.value === kitText) return;       // an untouched kit sketch stays a kit sketch
  mine[current] = { text: ta.value, updated: Date.now() };
  saveAll(); status();
  if (!$('sk-pick').querySelector(`optgroup[data-g="mine"] option[value="${current}"]`)) fillPicker();
}
function status() {
  const st = $('ed-saved');
  if (!current) { st.textContent = ''; return; }
  const kit = KIT[current] != null;
  st.textContent = mine[current] ? (kit && mine[current].text !== KIT[current] ? 'Your copy, saved on this phone' : 'Saved on this phone') : 'Kit example';
  $('sk-reset').hidden = !(kit && mine[current] && mine[current].text !== KIT[current]);
  $('sk-delete').hidden = !mine[current] || kit;
}
function fillPicker() {
  const pick = $('sk-pick'); pick.textContent = '';
  const group = (label, key, names) => {
    if (!names.length) return;
    const g = document.createElement('optgroup'); g.label = label; g.dataset.g = key;
    for (const n of names) { const o = document.createElement('option'); o.value = n; o.textContent = n; g.append(o); }
    pick.append(g);
  };
  const own = Object.keys(mine).sort((a, b) => (b === 'my_sketch') - (a === 'my_sketch') || a.localeCompare(b));
  group('Your sketches', 'mine', own);
  group('Kit examples', 'kit', Object.keys(KIT).filter(n => !mine[n]).sort());
  if (current) pick.value = current;
}
function open(name) {
  if (busy) return;
  current = name;
  store.set('bm-sketch', name);
  ta.value = mine[name]?.text ?? KIT[name] ?? TEMPLATE;
  marks = new Map(); renderGutter(); ta.scrollTop = 0; ta.setSelectionRange(0, 0); caret();
  fillPicker(); status();
  if (binFor !== name) { bin = null; binFor = null; $('flash').disabled = true; setFlashNote('Compile first, then upload over the USB cable.'); }
  clearOutput();
  setState(mine[name] || !KIT[name] ? 'Ready. Compile builds it right here on the phone.' : 'Kit example. Edits are saved as your own copy.');
}
$('sk-pick').onchange = () => open($('sk-pick').value);
$('sk-reset').onclick = () => {
  if (!current || !confirm(`Put ${current} back to the kit version? Your changes to it will be lost.`)) return;
  delete mine[current]; saveAll(); open(current);
};
$('sk-delete').onclick = () => {
  if (!current || !confirm(`Delete ${current} from this phone?`)) return;
  delete mine[current]; saveAll(); open(Object.keys(mine)[0] || 'my_sketch');
};
$('sk-new').onclick = () => { $('newrow').hidden = !$('newrow').hidden; if (!$('newrow').hidden) $('newname').focus(); };
function validName(n) { return /^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(n); }
$('newrow').onsubmit = e => {
  e.preventDefault();
  const n = $('newname').value.trim().replace(/[\s-]+/g, '_');
  const note = $('newnote');
  if (!validName(n)) { note.textContent = 'Use letters, numbers and _ only, starting with a letter.'; return; }
  if (mine[n] || KIT[n]) { note.textContent = 'There’s already a sketch called ' + n + '. Pick it from the list.'; return; }
  note.textContent = ''; $('newname').value = ''; $('newrow').hidden = true;
  mine[n] = { text: TEMPLATE, updated: Date.now() }; saveAll(); open(n);
};
// .ino files in and out, so sketches can be backed up or moved to a computer
$('sk-export').onclick = () => {
  if (window.AndroidApp) { window.AndroidApp.saveText(current + '.ino', ta.value); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/plain' }));
  a.download = current + '.ino'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('sk-import').onclick = () => $('sk-file').click();
$('sk-file').onchange = async () => {
  const f = $('sk-file').files[0]; $('sk-file').value = '';
  if (!f) return;
  let n = f.name.replace(/\.(ino|cpp|txt)$/i, '').replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z]/.test(n)) n = 's_' + n;
  if (mine[n] && !confirm(`Replace your sketch ${n} with this file?`)) return;
  mine[n] = { text: await f.text(), updated: Date.now() }; saveAll(); open(n);
};

// ---------- Compiler ----------
let worker = null, nextId = 1;
const pending = new Map();
function compiler() {
  if (worker) return worker;
  worker = new Worker('compiler/worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') { if (data.text) setState(data.text); setProgress(data.frac); return; }
    const p = pending.get(data.id); if (p) { pending.delete(data.id); p(data); }
  };
  worker.onerror = e => { for (const p of pending.values()) p({ ok: false, stage: 'setup', log: 'The compiler stopped: ' + (e.message || 'unknown error') }); pending.clear(); worker = null; };
  return worker;
}
const compile = (name, src) => new Promise(res => { const id = nextId++; pending.set(id, res); compiler().postMessage({ type: 'build', id, name, src }); });

function setState(text, kind) { const s = $('b-state'); s.textContent = text; s.className = 'note' + (kind === 'err' ? ' err' : kind === 'ok' ? ' okline' : ''); }
function setProgress(f) { const p = $('b-prog'); if (f == null || f >= 1) p.removeAttribute('value'); else p.value = f; }
function setFlashNote(t, err) { const p = $('flash-note'); p.textContent = t; p.className = 'note' + (err ? ' err' : ''); }
function clearOutput() { $('problems').textContent = ''; $('b-log').textContent = ''; $('b-logbox').hidden = true; }
function lock(on) {
  busy = on;
  for (const id of ['build', 'build-up', 'sk-pick', 'sk-new']) $(id).disabled = on;
  $('flash').disabled = on || !bin;
  $('b-prog').hidden = !on;
}

function parseLog(text, name) {
  const seen = new Set(), problems = [];
  for (const m of text.matchAll(/^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning):\s*(.*)$/gm)) {
    const [, file, line, col, kind, msg] = m;
    const key = file + line + msg; if (seen.has(key)) continue; seen.add(key);
    const mine = file === name + '.ino';
    problems.push({ file, line: +line, col: +(col || 1), kind: kind === 'warning' ? 'warn' : 'err', msg, mine });
  }
  for (const m of text.matchAll(/undefined (?:symbol|reference to):? [`']?([^'`\s]+)/g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    problems.push({ kind: 'err', msg: `Nothing defines ${m[1]}. Check the spelling, or that the function has a body.` });
  }
  for (const m of text.matchAll(/ld\.lld: error: (?!undefined)(.*)/g)) problems.push({ kind: 'err', msg: m[1] });
  return problems;
}
function showResult(r, name) {
  const problems = parseLog(r.log || '', name);
  marks = new Map();
  const ul = $('problems'); ul.textContent = '';
  const list = [...problems].sort((a, b) => (a.kind === 'warn') - (b.kind === 'warn') || (b.mine === true) - (a.mine === true));
  for (const p of list) {
    const li = document.createElement('li'); li.className = 'p' + p.kind;
    const where = p.mine ? `Line ${p.line}` : p.file ? `${p.file.split('/').pop()}:${p.line}` : '';
    const b = document.createElement(p.mine ? 'button' : 'div'); b.className = 'prob';
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = p.kind === 'err' ? 'Error' : 'Warning';
    const w = document.createElement('span'); w.className = 'where'; w.textContent = where;
    const m = document.createElement('span'); m.className = 'msg'; m.textContent = p.msg;
    b.append(tag, ' ', w, m);
    if (p.mine) {
      b.type = 'button'; b.onclick = () => gotoLine(p.line, p.col);
      if (marks.get(p.line) !== 'err') marks.set(p.line, p.kind);
    }
    const lib = p.msg.match(/'([\w./-]+\.h)' file not found/);
    if (lib) {
      const hint = document.createElement('span'); hint.className = 'msg';
      hint.textContent = `${lib[1]} isn’t one of the libraries built into the app. Open “Libraries” below to see which ones are.`;
      b.append(hint);
    }
    li.append(b); ul.append(li);
  }
  if (!r.ok && !problems.length) {
    const li = document.createElement('li'); li.className = 'perr';
    li.textContent = r.stage === 'setup' ? r.log : 'It didn’t build, and the reason isn’t a line in the sketch. The full output below has the details.';
    ul.append(li);
  }
  renderGutter();
  $('b-log').textContent = (r.log || '').trim() || 'No messages.';
  $('b-logbox').hidden = r.stage === 'setup';
  $('b-logbox').open = !r.ok && !problems.length && r.stage !== 'setup';
  return problems;
}

async function build(thenUpload) {
  if (busy || !current) return;
  const name = current, src = ta.value;
  if (thenUpload) {
    // a board must be picked while the tap still counts as a user action
    if (!('serial' in navigator)) { setFlashNote('Uploading needs Web Serial. Use Chrome on Android or a computer.', true); return; }
    if (!window.boardMonitor.port && !(await navigator.serial.getPorts()).length) {
      try { setFlashNote('Pick the board in the list that opens.'); window.boardMonitor.port = await navigator.serial.requestPort(); setFlashNote(''); }
      catch { setFlashNote('No board picked. Plug the board in and try again.', true); return; }
    }
  }
  save();
  lock(true); clearOutput(); setProgress(null);
  setState(worker ? 'Compiling…' : 'Starting the compiler…');
  const t0 = performance.now();
  const r = await compile(name, src);
  lock(false);
  if (r.stage !== 'setup') { store.set('bm-compiler', '1'); $('b-first').hidden = true; }
  if (current !== name) return;
  const problems = showResult(r, name);
  if (!r.ok) {
    const n = problems.filter(p => p.kind === 'err').length;
    setState(r.stage === 'setup' ? 'The compiler couldn’t start.' : `It didn’t compile${n ? `: ${n} error${n > 1 ? 's' : ''}` : ''}.${problems.some(p => p.mine) ? ' Tap one to jump to its line.' : ''}`, 'err');
    return;
  }
  bin = r.bin; binFor = name;
  const secs = ((performance.now() - t0) / 1000).toFixed(1), w = problems.length;
  setState(`Compiled in ${secs} s. Uses ${bin.length.toLocaleString()} bytes of flash (${Math.round(100 * bin.length / 262144)}%) and ${r.ram.toLocaleString()} bytes of RAM (${Math.round(100 * r.ram / 32768)}%).` + (w ? ` ${w} warning${w > 1 ? 's' : ''}.` : ''), 'ok');
  setFlashNote('Ready to upload ' + name + '.');
  $('flash').disabled = false;
  if (thenUpload) await flash();
}

// ---------- Upload ----------
async function flash() {
  if (!bin || busy) return;
  const bar = $('flash-bar');
  lock(true); $('b-prog').hidden = true; bar.hidden = false; bar.value = 0; $('flash-mon').hidden = true;
  try {
    await window.R4Flasher.uploadToBoard(bin, (t, f) => { setFlashNote(t); if (f != null) bar.value = f; });
    setFlashNote('Uploaded ' + binFor + '. It’s running on the board now.');
    $('flash-mon').hidden = false;
  } catch (e) {
    setFlashNote(e && e.name === 'NotFoundError' ? 'No board picked.' : (e.message || String(e)), true);
  } finally { lock(false); bar.hidden = true; }
}
$('build').onclick = () => build(false);
$('build-up').onclick = () => build(true);
$('flash').onclick = flash;
$('flash-mon').onclick = () => { window.showView('monitor'); scrollTo(0, 0); window.boardMonitor.connectUSB(); };

// ---------- Libraries built into the app ----------
$('libs-box').addEventListener('toggle', async () => {
  if (!$('libs-box').open || $('libs-list').dataset.done) return;
  try {
    const pack = await (await fetch('compiler/pack.json')).json();
    const byLib = {};
    for (const [h, n] of Object.entries(pack.headers)) if (!h.includes('/')) (byLib[n] ??= []).push(h);
    $('libs-list').textContent = '';
    for (const n of Object.keys(pack.libs).sort((a, b) => a.localeCompare(b))) {
      const li = document.createElement('li');
      const b = document.createElement('b'); b.textContent = n.replace(/_/g, ' ');
      const c = document.createElement('code'); const key = n.toLowerCase().replace(/^(arduino|adafruit)_|_library$/g, '').replace(/_/g, '');
      c.textContent = (byLib[n] || []).filter(h => /\.h(pp)?$/.test(h)).sort((a, b) => b.toLowerCase().replace(/_/g, '').includes(key) - a.toLowerCase().replace(/_/g, '').includes(key)).slice(0, 2).map(h => `#include <${h}>`).join('  ');
      li.append(b, ' ', c); $('libs-list').append(li);
    }
    $('libs-list').dataset.done = '1';
  } catch { $('libs-list').textContent = 'Couldn’t read the library list.'; }
});

// ---------- Start ----------
window.codeEditor = {
  open(name) {
    window.showView('code'); scrollTo(0, 0);
    if (!busy && current !== name) open(name);
  }
};
$('b-first').hidden = !!store.get('bm-compiler');
const first = store.get('bm-sketch');
open(first && (mine[first] || KIT[first]) ? first : 'my_sketch');
})();
