// Code tab: edit a sketch on the phone, compile it with GitHub Actions, upload the result over USB.
//   1. The sketch is committed to sketches/<name>/<name>.ino through the GitHub API ([skip ci], so the
//      full kit build doesn't also start).
//   2. The "Compile one sketch" workflow is started with a build id, and the page finds that run by it.
//   3. The workflow commits bin/<name>.log (always) and bin/<name>.bin (when it builds); the page reads
//      both back, lists the compiler errors against the editor's line numbers, and keeps the .bin
//      ready for Upload to board.
// The GitHub token lives only in this browser's localStorage and is only sent to api.github.com.
(() => {
const $ = id => document.getElementById(id);
const WORKFLOW = 'compile-one.yml';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};
function defaultRepo() {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return m && seg ? `${m[1]}/${seg}` : 'TheRNGenie/ElectricalDiagrams';
}
const cfg = {
  token: store.get('bm-gh-token') || '',
  repo: store.get('bm-gh-repo') || defaultRepo(),
  branch: store.get('bm-gh-branch') || 'main'
};

// ---------- GitHub API ----------
function apiError(status, msg) {
  if (status === 401) return 'GitHub didn’t accept the token. It may have expired. Paste a new one under GitHub settings.';
  if (status === 403 && /rate limit/i.test(msg)) return 'GitHub’s rate limit was reached. Wait a few minutes and try again.';
  if (status === 403) return 'The token is missing a permission. It needs Contents and Actions set to “Read and write” for ' + cfg.repo + '.';
  if (status === 404) return 'GitHub couldn’t find that in ' + cfg.repo + '. Check the repository name, and that the token can see it.';
  if (status === 409) return 'The file changed on GitHub since it was opened here. Reload the sketch, then make your edits again.';
  return 'GitHub said: ' + (msg || 'error ' + status);
}
async function gh(path, { method = 'GET', body, accept = 'application/vnd.github+json', raw = false } = {}) {
  const headers = { Accept: accept, Authorization: 'Bearer ' + cfg.token };
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch('https://api.github.com' + path, { method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Couldn’t reach GitHub. Check the phone’s internet connection.'); }
  if (!res.ok) {
    let msg = ''; try { msg = (await res.json()).message || ''; } catch {}
    const e = new Error(apiError(res.status, msg)); e.status = res.status; throw e;
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json().catch(() => null);
}
const repoPath = p => `/repos/${cfg.repo}/contents/${p.split('/').map(encodeURIComponent).join('/')}`;
const b64enc = s => {
  const b = new TextEncoder().encode(s); let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(out);
};
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function getFile(path, ref = cfg.branch) {
  try { const j = await gh(repoPath(path) + '?ref=' + encodeURIComponent(ref)); return { text: b64dec(j.content || ''), sha: j.sha }; }
  catch (e) { if (e.status === 404) return null; throw e; }
}
async function putFile(path, text, sha, message) {
  const j = await gh(repoPath(path), { method: 'PUT', body: { message, content: b64enc(text), branch: cfg.branch, ...(sha ? { sha } : {}) } });
  return j.content.sha;
}
async function getBytes(path, ref) {
  const res = await gh(repoPath(path) + '?ref=' + encodeURIComponent(ref), { accept: 'application/vnd.github.raw', raw: true });
  return new Uint8Array(await res.arrayBuffer());
}

// ---------- GitHub settings ----------
function renderSetup() {
  const has = !!cfg.token;
  $('gh-form').hidden = has && !$('gh-form').dataset.open;
  $('gh-summary').hidden = !$('gh-form').hidden;
  $('gh-who').textContent = cfg.repo + ' · ' + cfg.branch;
  $('gh-token').value = ''; $('gh-token').placeholder = has ? 'Saved. Paste a new token to replace it' : 'github_pat_…';
  $('gh-repo').value = cfg.repo; $('gh-branch').value = cfg.branch;
  const owner = cfg.repo.split('/')[0];
  $('gh-new').href = 'https://github.com/settings/personal-access-tokens/new?name=' + encodeURIComponent('Board Monitor') +
    '&description=' + encodeURIComponent('Compile sketches from the Board Monitor page') +
    '&target_name=' + encodeURIComponent(owner) + '&expires_in=90&contents=write&actions=write';
  $('s-editor').hidden = !has; $('s-out').hidden = !has;
}
$('gh-change').onclick = () => { $('gh-form').dataset.open = '1'; renderSetup(); };
$('gh-form').onsubmit = async e => {
  e.preventDefault();
  const token = $('gh-token').value.trim() || cfg.token;
  const repo = $('gh-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '');
  const branch = $('gh-branch').value.trim() || 'main';
  const note = $('gh-note');
  if (!token) { note.textContent = 'Paste a token first.'; note.className = 'note err'; return; }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { note.textContent = 'Write the repository as owner/name.'; note.className = 'note err'; return; }
  const old = { ...cfg };
  Object.assign(cfg, { token, repo, branch });
  note.textContent = 'Checking…'; note.className = 'note';
  try {
    await gh(`/repos/${repo}/branches/${encodeURIComponent(branch)}`);
    store.set('bm-gh-token', token); store.set('bm-gh-repo', repo); store.set('bm-gh-branch', branch);
    note.textContent = ''; delete $('gh-form').dataset.open;
    renderSetup(); loadList(sketch?.name || store.get('bm-sketch') || 'my_sketch');
  } catch (err) {
    Object.assign(cfg, old);
    note.textContent = err.message; note.className = 'note err';
  }
};
$('gh-forget').onclick = () => {
  store.set('bm-gh-token', null); cfg.token = '';
  delete $('gh-form').dataset.open; $('gh-note').textContent = 'Token removed from this phone.'; $('gh-note').className = 'note';
  renderSetup();
};

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
  if (e.inputType === 'insertLineBreak' || (e.inputType === 'insertParagraph')) { e.preventDefault(); newline(); }
});
ta.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); insert('  '); }
});
let draftTimer = null;
ta.addEventListener('input', () => {
  renderGutter(); caret(); edited();
  clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400);
});
$('libs').addEventListener('input', () => { edited(); clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); });

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

// ---------- Sketches ----------
let sketch = null;   // { name, sha, remote, libsSha, libsRemote }
let names = [];
let bin = null, binFor = null, busy = false;
const inoPath = n => `sketches/${n}/${n}.ino`;
const libsPath = n => `sketches/${n}/libraries.txt`;
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
function saveDraft() {
  if (!sketch) return;
  const libs = $('libs').value;
  const same = ta.value === (sketch.remote ?? TEMPLATE) && libs === (sketch.libsRemote ?? '');
  store.set('bm-draft:' + sketch.name, same ? null : JSON.stringify({ text: ta.value, libs }));
}
function isEdited() { return sketch && (sketch.remote == null || ta.value !== sketch.remote || $('libs').value !== (sketch.libsRemote ?? '')); }
function edited() {
  const st = $('ed-saved');
  if (!sketch) { st.textContent = ''; return; }
  st.textContent = sketch.remote == null ? 'New, not on GitHub yet' : isEdited() ? 'Edited, saved on this phone' : 'Same as GitHub';
  if (bin && binFor === sketch.name && isEdited()) setFlashNote('Upload sends the last compiled version, not your newest edits.');
}
function fillPicker(current) {
  const pick = $('sk-pick'); pick.textContent = '';
  for (const n of names) { const o = document.createElement('option'); o.value = n; o.textContent = n; pick.append(o); }
  pick.value = current;
}
async function loadList(open) {
  setState('Loading sketches…');
  try {
    const items = await gh(repoPath('sketches') + '?ref=' + encodeURIComponent(cfg.branch));
    names = items.filter(i => i.type === 'dir').map(i => i.name).sort((a, b) => (b === 'my_sketch') - (a === 'my_sketch') || a.localeCompare(b));
  } catch (e) { if (e.status !== 404) { setState(e.message, 'err'); return; } names = []; }
  if (!names.includes(open)) open = names[0] || 'my_sketch';
  if (!names.includes(open)) names.unshift(open);
  await openSketch(open);
}
async function openSketch(name) {
  if (busy) return;
  fillPicker(name);
  setState('Opening ' + name + '…'); ta.disabled = true;
  try {
    const [ino, libs] = await Promise.all([getFile(inoPath(name)), getFile(libsPath(name))]);
    sketch = { name, sha: ino?.sha, remote: ino?.text ?? null, libsSha: libs?.sha, libsRemote: libs?.text ?? null };
    store.set('bm-sketch', name);
    let text = ino ? ino.text : TEMPLATE, libText = libs?.text ?? '';
    let draft = null; try { draft = JSON.parse(store.get('bm-draft:' + name)); } catch {}
    if (draft && (draft.text !== text || (draft.libs ?? '') !== libText)) { text = draft.text; libText = draft.libs ?? ''; $('ed-draft').hidden = false; }
    else $('ed-draft').hidden = true;
    ta.value = text; $('libs').value = libText;
    marks = new Map(); renderGutter(); ta.scrollTop = 0; ta.setSelectionRange(0, 0); caret(); edited();
    if (binFor !== name) { bin = null; binFor = null; $('flash').disabled = true; setFlashNote('Compile first, then upload over the USB cable.'); }
    clearOutput();
    setState(ino ? 'Ready. Compile builds it on GitHub, then Upload to board puts it on the R4.' : 'New sketch. Compile saves it to GitHub and builds it.');
  } catch (e) { setState(e.message, 'err'); }
  finally { ta.disabled = false; }
}
$('sk-pick').onchange = () => openSketch($('sk-pick').value);
$('ed-discard').onclick = () => {
  if (!sketch) return;
  store.set('bm-draft:' + sketch.name, null);
  ta.value = sketch.remote ?? TEMPLATE; $('libs').value = sketch.libsRemote ?? '';
  $('ed-draft').hidden = true; marks = new Map(); renderGutter(); caret(); edited();
};
$('sk-new').onclick = () => { $('newrow').hidden = !$('newrow').hidden; if (!$('newrow').hidden) $('newname').focus(); };
$('newrow').onsubmit = e => {
  e.preventDefault();
  const n = $('newname').value.trim().replace(/[\s-]+/g, '_');
  const note = $('newnote');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(n)) { note.textContent = 'Use letters, numbers and _ only, starting with a letter.'; return; }
  if (names.includes(n)) { note.textContent = 'There’s already a sketch called ' + n + '. Pick it from the list.'; return; }
  note.textContent = ''; $('newname').value = ''; $('newrow').hidden = true;
  names.push(n); openSketch(n);
};

// ---------- Build ----------
function setState(text, kind) { const s = $('b-state'); s.textContent = text; s.className = 'note' + (kind === 'err' ? ' err' : kind === 'ok' ? ' okline' : ''); }
function setFlashNote(t, err) { const p = $('flash-note'); p.textContent = t; p.className = 'note' + (err ? ' err' : ''); }
function clearOutput() { $('problems').textContent = ''; $('b-log').textContent = ''; $('b-logbox').hidden = true; $('b-run').hidden = true; }
function lock(on) {
  busy = on;
  for (const id of ['build', 'build-up', 'sk-pick', 'sk-new']) $(id).disabled = on;
  $('flash').disabled = on || !bin;
  $('b-prog').hidden = !on;
}
let tick = null;
function waiting(label, t0) {
  clearInterval(tick);
  const show = () => { const s = Math.round((Date.now() - t0) / 1000); setState(`${label} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); };
  show(); tick = setInterval(show, 1000);
}
const STEP_LABEL = {
  'Restore board core and libraries': 'Getting the board core ready…',
  'Install board core and libraries': 'Installing the board core and libraries…',
  'Compile': 'Compiling…',
  'Commit results': 'Saving the result…'
};

function parseLog(text, name) {
  const lines = text.split('\n'), head = {};
  let i = 0;
  for (; i < lines.length && lines[i].trim(); i++) { const m = lines[i].match(/^(\w+)=(.*)$/); if (m) head[m[1]] = m[2].trim(); }
  const body = lines.slice(i + 1).join('\n');
  const seen = new Set(), problems = [];
  for (const m of body.matchAll(/^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning):\s*(.*)$/gm)) {
    const [, file, line, col, kind, msg] = m;
    const key = file + line + msg; if (seen.has(key)) continue; seen.add(key);
    const mine = file === inoPath(name) || file.endsWith('/' + name + '.ino');
    problems.push({ file, line: +line, col: +(col || 1), kind: kind === 'warning' ? 'warn' : 'err', msg, mine });
  }
  for (const m of body.matchAll(/^.*undefined reference to [`'](.+?)'.*$/gm)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    problems.push({ kind: 'err', msg: 'Linker: nothing defines ' + m[1] + '. Check the name, or add the library that provides it.' });
  }
  const size = body.match(/Sketch uses (\d+) bytes \((\d+)%\)/);
  return { ok: head.result === 'ok', id: head.build_id, body, problems, size };
}
function showResult(r, name) {
  marks = new Map();
  const ul = $('problems'); ul.textContent = '';
  // errors first, then warnings; problems in the sketch itself before ones inside libraries
  const list = [...r.problems].sort((a, b) => (a.kind === 'warn') - (b.kind === 'warn') || (b.mine === true) - (a.mine === true));
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
    const lib = p.msg.match(/([\w./-]+\.h): No such file or directory/);
    if (lib) {
      const hint = document.createElement('span'); hint.className = 'msg';
      hint.textContent = `Add the library that provides ${lib[1]} under Libraries (its name as shown in the Arduino Library Manager), then compile again.`;
      b.append(hint);
    }
    li.append(b); ul.append(li);
  }
  if (!r.ok && !r.problems.length) {
    const li = document.createElement('li'); li.className = 'perr';
    li.textContent = 'It didn’t compile, and the reason isn’t a line in the sketch. The full log below has the details.';
    ul.append(li);
  }
  renderGutter();
  $('b-log').textContent = r.body.trim();
  $('b-logbox').hidden = false;
  if (!r.ok) $('b-logbox').open = !r.problems.length;
}

async function build(thenUpload) {
  if (busy || !sketch) return;
  const name = sketch.name;
  if (thenUpload) {
    // a board must be picked while the tap still counts as a user action; the build takes a minute or two
    if (!('serial' in navigator)) { setFlashNote('Uploading needs Web Serial. Use Chrome on Android or a computer.', true); return; }
    if (!window.boardMonitor.port && !(await navigator.serial.getPorts()).length) {
      try { setFlashNote('Pick the board in the list that opens.'); window.boardMonitor.port = await navigator.serial.requestPort(); setFlashNote(''); }
      catch { setFlashNote('No board picked. Plug the board in and try again.', true); return; }
    }
  }
  lock(true); clearOutput(); clearInterval(tick);
  try {
    // 1. save to GitHub
    const text = ta.value, libs = $('libs').value;
    if (sketch.remote == null || text !== sketch.remote) {
      setState('Saving to GitHub…');
      sketch.sha = await putFile(inoPath(name), text, sketch.sha, `Edit ${name} from Board Monitor [skip ci]`);
      sketch.remote = text;
    }
    if (libs !== (sketch.libsRemote ?? '') && (libs.trim() || sketch.libsSha)) {
      sketch.libsSha = await putFile(libsPath(name), libs, sketch.libsSha, `Set ${name} libraries from Board Monitor [skip ci]`);
      sketch.libsRemote = libs;
    }
    $('ed-draft').hidden = true; saveDraft(); edited();

    // 2. start the build and find its run
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const since = new Date(Date.now() - 2 * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
    const t0 = Date.now();
    setState('Starting the build…');
    try {
      await gh(`/repos/${cfg.repo}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: { ref: cfg.branch, inputs: { sketch: name, build_id: id } } });
    } catch (e) {
      if (e.status === 404) throw new Error(`The “Compile one sketch” workflow isn’t on the ${cfg.branch} branch of ${cfg.repo} yet.`);
      throw e;
    }
    waiting('Waiting for GitHub to start the build…', t0);
    let run = null;
    while (!run) {
      if (Date.now() - t0 > 120000) throw new Error('GitHub didn’t start the build. Open the repo’s Actions tab to check it.');
      await sleep(3000);
      const j = await gh(`/repos/${cfg.repo}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=20&created=${encodeURIComponent('>=' + since)}`);
      run = j.workflow_runs.find(r => (r.display_title || r.name || '').includes(`(${id})`));
    }
    $('b-run').href = run.html_url; $('b-run').hidden = false;

    // 3. wait for it
    let label = '';
    while (run.status !== 'completed') {
      const next = run.status === 'in_progress' ? (await currentStep(run.id)) : 'Waiting for a GitHub computer…';
      if (next !== label) { label = next; waiting(label, t0); }
      await sleep(4000);
      run = await gh(`/repos/${cfg.repo}/actions/runs/${run.id}`);
    }
    clearInterval(tick);

    // 4. read the result at one commit, so the log and the .bin match
    setState('Reading the result…');
    const ref = (await gh(`/repos/${cfg.repo}/git/ref/heads/${encodeURIComponent(cfg.branch)}`)).object.sha;
    const log = await getFile(`bin/${name}.log`, ref);
    const r = log && parseLog(log.text, name);
    if (!r || r.id !== id) {
      if (run.conclusion === 'cancelled') throw new Error('A newer build of this sketch replaced this one.');
      throw new Error('The build stopped before compiling. Tap “Open the build on GitHub” to see why.');
    }
    showResult(r, name);
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!r.ok) {
      const n = r.problems.filter(p => p.kind === 'err').length;
      setState(`It didn’t compile${n ? `: ${n} error${n > 1 ? 's' : ''}` : ''}. Tap one to jump to its line.`, 'err');
      return;
    }
    bin = await getBytes(`bin/${name}.bin`, ref); binFor = name;
    const w = r.problems.length;
    setState(`Compiled in ${secs} s.` + (r.size ? ` Uses ${(+r.size[1]).toLocaleString()} bytes (${r.size[2]}% of flash).` : '') + (w ? ` ${w} warning${w > 1 ? 's' : ''}.` : ''), 'ok');
    setFlashNote('Ready to upload ' + name + '.');
    lock(false);
    if (thenUpload) await flash();
  } catch (e) {
    clearInterval(tick);
    setState(e.message || String(e), 'err');
  } finally { clearInterval(tick); if (busy) lock(false); }
}
async function currentStep(runId) {
  try {
    const j = await gh(`/repos/${cfg.repo}/actions/runs/${runId}/jobs`);
    const step = j.jobs[0]?.steps?.find(s => s.status === 'in_progress');
    return STEP_LABEL[step?.name] || 'Getting the build ready…';
  } catch { return 'Building…'; }
}

// ---------- Upload ----------
async function flash() {
  if (!bin || busy) return;
  const bar = $('flash-bar');
  lock(true); bar.hidden = false; bar.value = 0; $('flash-mon').hidden = true;
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

// ---------- Start ----------
let started = false;
window.codeEditor = {
  open(name) {
    store.set('bm-sketch', name);
    window.showView('code'); scrollTo(0, 0);
    if (!started || !cfg.token || busy || sketch?.name === name) return;   // a first visit loads it from bm-sketch
    if (!names.includes(name)) names.push(name);
    openSketch(name);
  }
};
// load sketches the first time the tab is shown
new MutationObserver(() => {
  if (!$('view-code').hidden && !started) { started = true; if (cfg.token && !sketch) loadList(store.get('bm-sketch') || 'my_sketch'); }
}).observe($('view-code'), { attributes: true, attributeFilter: ['hidden'] });
renderSetup(); renderGutter();
})();
