(() => {
const $ = id => document.getElementById(id);
const PARTS = window.PARTS;
const RAILS = new Set(['5V', 'GND']);
const NS = 'http://www.w3.org/2000/svg';

// ---------- Views ----------
function show(view) {
  $('view-monitor').hidden = view !== 'monitor';
  $('view-parts').hidden = view !== 'parts';
  $('nav-monitor').toggleAttribute('aria-current', view === 'monitor');
  $('nav-parts').toggleAttribute('aria-current', view === 'parts');
  if (view === 'monitor') $('nav-monitor').setAttribute('aria-current', 'page');
  if (view === 'parts') $('nav-parts').setAttribute('aria-current', 'page');
  try { localStorage.setItem('bm-view', view); } catch {}
  if (view === 'monitor') dispatchEvent(new Event('resize'));
}
$('nav-monitor').onclick = () => show('monitor');
$('nav-parts').onclick = () => show('parts');

// ---------- Helpers ----------
const pinId = p => Array.isArray(p) ? p[0] : p;
const pinLabel = p => Array.isArray(p) ? p[1] : p;
const isBlockRef = s => s.includes('.');
const wireClass = to => to === '5V' ? 'w5' : to === 'GND' ? 'wg' : to === '3V3' ? 'w3' : 'ws';
const colorVar = cls => ({ w5: '--w5', wg: '--wg', w3: '--w3', ws: '--wsig' })[cls];
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}
const boardName = to => ({ SDA: 'SDA (A4)', SCL: 'SCL (A5)', '3V3': '3.3V' })[to] || to;

// ---------- Wiring diagram ----------
// Board on the left, parts on the right, 5V rail on top, GND rail at the bottom.
// Each wire gets its own vertical track, so wires only ever cross, never overlap.
// A dot marks a real connection; lines that cross without a dot are not connected.
function diagram(part) {
  const PIN = 26, TITLE = 30, TOP = 74, BLK_W = 150, BRD_W = 116;
  const blocks = part.blocks.map(b => ({ ...b, pins: b.pins.map(p => ({ id: pinId(p), label: pinLabel(p) })) }));
  const pinPos = {};
  let y = TOP;
  for (const b of blocks) {
    b.y = y; b.h = TITLE + b.pins.length * PIN + 6;
    b.pins.forEach((p, i) => { pinPos[b.id + '.' + p.id] = { y: y + TITLE + i * PIN + PIN / 2 }; });
    y += b.h + 24;
  }
  const blocksBottom = y - 24;

  // Board pins, placed level with what they connect to where possible
  const bp = new Map();
  for (const [from, to] of part.wires) if (!isBlockRef(to) && !RAILS.has(to)) {
    if (!bp.has(to)) bp.set(to, []);
    bp.get(to).push(pinPos[from].y);
  }
  const boardPins = [...bp.entries()].map(([name, ys]) => ({ name, want: ys.reduce((a, b) => a + b, 0) / ys.length }))
    .sort((a, b) => a.want - b.want);
  let prev = TOP + TITLE - PIN / 2;
  const allPinYs = Object.entries(pinPos);
  for (const p of boardPins) {
    const own = new Set(part.wires.filter(w => w[1] === p.name).map(w => w[0]));
    let yy = Math.max(p.want, prev + PIN);
    // never sit level with an unrelated part pin, or its wire would run along this one
    while (allPinYs.some(([ref, v]) => !own.has(ref) && Math.abs(v.y - yy) < 6)) yy += PIN / 2;
    p.y = yy; prev = yy;
  }
  const boardTop = TOP, boardBottom = Math.max(prev + PIN / 2 + 8, TOP + TITLE + PIN * 2);

  const contentBottom = Math.max(blocksBottom, boardBottom);
  const RAIL5 = 34, RAILG = contentBottom + 40, H = RAILG + 26;

  // Tracks
  const routed = part.wires.map(([from, to, r]) => {
    const fy = pinPos[from].y;
    const ty = isBlockRef(to) ? pinPos[to].y : RAILS.has(to) ? (to === '5V' ? RAIL5 : RAILG) : boardPins.find(p => p.name === to).y;
    return { from, to, r, fy, ty, cls: isBlockRef(to) ? 'ws' : wireClass(to), straight: !isBlockRef(to) && !RAILS.has(to) && Math.abs(fy - ty) < 0.5 };
  });
  const needTrack = routed.filter(w => !w.straight).sort((a, b) => Math.abs(a.fy - a.ty) - Math.abs(b.fy - b.ty));
  const GAP = 18;
  const W = Math.max(600, 16 + BRD_W + 40 + needTrack.length * GAP + 130 + BLK_W + 16);
  const BRD_X = 16, BRD_R = BRD_X + BRD_W, BLK_X = W - 16 - BLK_W;
  const trackMax = BLK_X - 120, trackMin = BRD_R + 36;
  const step = needTrack.length > 1 ? Math.min(GAP * 2, (trackMax - trackMin) / (needTrack.length - 1)) : 0;
  needTrack.forEach((w, i) => { w.tx = trackMax - i * step; });

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Wiring diagram for ${part.name}` });

  // Rails
  const railLeft = part.psu ? trackMin - 12 : BRD_X;
  svg.append(el('line', { x1: railLeft, y1: RAIL5, x2: W - 16, y2: RAIL5, class: 'rail5' }));
  svg.append(el('text', { x: W - 16, y: RAIL5 - 9, 'text-anchor': 'end', class: 'tm' }, part.psu ? '5V rail (from power module)' : '5V rail'));
  svg.append(el('line', { x1: BRD_X, y1: RAILG, x2: W - 16, y2: RAILG, class: 'railg' }));
  svg.append(el('text', { x: W - 16, y: RAILG + 18, 'text-anchor': 'end', class: 'tm' }, 'GND rail'));

  // Board
  const bcx = BRD_X + BRD_W / 2;
  if (!part.psu) {
    svg.append(el('line', { x1: bcx, y1: RAIL5, x2: bcx, y2: boardTop, class: 'w w5' }));
    svg.append(el('circle', { cx: bcx, cy: RAIL5, r: 4, class: 'dot', style: 'fill:var(--w5)' }));
    svg.append(el('text', { x: bcx + 6, y: boardTop - 8, class: 'tm' }, '5V'));
  }
  svg.append(el('line', { x1: bcx, y1: boardBottom, x2: bcx, y2: RAILG, class: 'w wg' }));
  svg.append(el('circle', { cx: bcx, cy: RAILG, r: 4, class: 'dot', style: 'fill:var(--wg)' }));
  svg.append(el('text', { x: bcx + 6, y: boardBottom + 16, class: 'tm' }, 'GND'));
  svg.append(el('rect', { x: BRD_X, y: boardTop, width: BRD_W, height: boardBottom - boardTop, rx: 8, class: 'brd' }));
  svg.append(el('text', { x: BRD_X + 10, y: boardTop + 20, class: 'tb' }, 'UNO R4 WiFi'));
  for (const p of boardPins) {
    svg.append(el('text', { x: BRD_R - 10, y: p.y + 4, 'text-anchor': 'end', class: 'tm' }, boardName(p.name)));
    p.x = BRD_R;
  }

  // Wires
  const dots = [];
  const drawResistor = (g, x1, x2, yy, cls, label) => {
    // zigzag between x1 (right) and x2 (left)
    const mid = x1 - 55, half = 20, n = 6, amp = 5;   // always just left of the part pin
    let d = `M${x1},${yy} L${mid + half},${yy}`;
    for (let i = 0; i < n; i++) {
      const x = mid + half - (2 * half) * (i + 0.5) / n;
      d += ` L${x},${yy + (i % 2 ? amp : -amp)}`;
    }
    d += ` L${mid - half},${yy} L${x2},${yy}`;
    g.append(el('path', { d, class: 'w ' + cls }));
    g.append(el("text", { x: mid, y: yy - 8, "text-anchor": "middle", class: "tm", style: "font-size:9.5px" }, label));
  };
  for (const w of routed) {
    const g = el('g');
    const px = BLK_X;
    if (w.straight) {
      if (w.r) drawResistor(g, px, BRD_R, w.fy, w.cls, w.r);
      else g.append(el('line', { x1: px, y1: w.fy, x2: BRD_R, y2: w.ty, class: 'w ' + w.cls }));
    } else {
      // stub from the part pin to the track (resistor sits here)
      if (w.r) drawResistor(g, px, w.tx, w.fy, w.cls, w.r);
      else g.append(el('line', { x1: px, y1: w.fy, x2: w.tx, y2: w.fy, class: 'w ' + w.cls }));
      let d = `M${w.tx},${w.fy} L${w.tx},${w.ty}`;
      if (isBlockRef(w.to)) d += ` L${px},${w.ty}`;
      else if (!RAILS.has(w.to)) d += ` L${BRD_R},${w.ty}`;
      g.append(el('path', { d, class: 'w ' + w.cls }));
      if (RAILS.has(w.to)) dots.push([w.tx, w.ty, w.cls]);
    }
    svg.append(g);
  }
  // Junctions where two wires leave the same part pin
  const byPin = {};
  for (const w of routed) for (const end of [w.from, w.to]) if (isBlockRef(end) && w.tx != null) (byPin[end] = byPin[end] || []).push(w);
  for (const [ref, ws] of Object.entries(byPin)) {
    if (ws.length < 2) continue;
    const txs = ws.map(w => w.tx).sort((a, b) => b - a);
    const yy = pinPos[ref].y;
    txs.slice(0, -1).forEach(tx => dots.push([tx, yy, ws[0].cls]));
  }
  for (const [x, yy, cls] of dots) svg.append(el('circle', { cx: x, cy: yy, r: 4, class: 'dot', style: `fill:var(${colorVar(cls)})` }));

  // Parts
  for (const b of blocks) {
    svg.append(el('rect', { x: BLK_X, y: b.y, width: BLK_W, height: b.h, rx: 6, class: 'blk' }));
    const title = el('text', { x: BLK_X + 10, y: b.y + 19, class: 'tb' }, b.name);
    svg.append(title);
    b.pins.forEach(p => {
      const py = pinPos[b.id + '.' + p.id].y;
      svg.append(el('circle', { cx: BLK_X, cy: py, r: 3.5, class: 'pin' }));
      svg.append(el('text', { x: BLK_X + 10, y: py + 4, class: 't' }, p.label));
    });
  }
  // Long part names: shrink to fit the box
  requestAnimationFrame(() => svg.querySelectorAll('text.tb').forEach(t => {
    const max = t.getAttribute('x') < BLK_X ? BRD_W - 16 : BLK_W - 16;
    try { const len = t.getComputedTextLength(); if (len > max) t.setAttribute('textLength', max), t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } catch {}
  }));
  return svg;
}

// ---------- Pin table ----------
function pinTable(part) {
  const lbl = ref => {
    const [b, p] = ref.split('.');
    const blk = part.blocks.find(x => x.id === b);
    const pin = blk.pins.find(x => pinId(x) === p);
    return `${blk.name}: ${pinLabel(pin)}`;
  };
  const rows = part.wires.map(([from, to, r]) => {
    const dest = isBlockRef(to) ? lbl(to) : to === '5V' ? (part.psu ? '5V rail (power module)' : '5V rail') : to === 'GND' ? 'GND rail' : 'Board ' + boardName(to);
    return `<tr><td>${esc(lbl(from))}</td><td>${r ? esc(r) + ' resistor' : '<span style="color:var(--muted)">wire</span>'}</td><td>${esc(dest)}</td></tr>`;
  }).join('');
  return `<div class="tablewrap"><table class="pins"><thead><tr><th>From</th><th>Through</th><th>To</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- Basics card ----------
const BASICS = `
  <p>Resistor colour bands read from the end with the bands bunched together. The fourth band (gold) is the tolerance.</p>
  <div class="tablewrap"><table class="pins"><thead><tr><th>Value</th><th>Bands</th><th>Used for</th></tr></thead><tbody>
  <tr><td>220Ω</td><td>red, red, brown</td><td>LEDs on 5V boards rated for 20 mA pins</td></tr>
  <tr><td>330Ω</td><td>orange, orange, brown</td><td>LEDs and display segments on the UNO R4</td></tr>
  <tr><td>1kΩ</td><td>brown, black, red</td><td>Transistor base, LEDs on the 74HC595</td></tr>
  <tr><td>10kΩ</td><td>brown, black, orange</td><td>Light and temperature dividers, pull-ups</td></tr>
  </tbody></table></div>
  <ul class="notes">
    <li><b>LED resistor:</b> (5V − LED voltage) ÷ current. A red LED drops about 2V, so 3V ÷ 330Ω ≈ 9 mA before the pin’s own drop, about 7 mA in practice.</li>
    <li><b>UNO R4 pin limit:</b> keep each pin at 8 mA or less. Anything bigger (motors, relays without a module, long LED strips) needs a transistor or driver chip.</li>
    <li><b>1N4007 diode:</b> current flows from the plain end to the end with the grey band. Across a motor, the band faces +.</li>
    <li><b>PN2222 transistor:</b> flat side facing you, legs are E, B, C from left to right. A small current into B lets a big current flow from C to E.</li>
    <li><b>Breadboard:</b> each numbered row of 5 holes is connected. The long red and blue lines along the edges are the 5V and GND rails.</li>
  </ul>`;

// ---------- Detail ----------
let current = null;
function select(id, scroll) {
  const part = PARTS.find(p => p.id === id) || PARTS[0];
  current = part.id;
  document.querySelectorAll('.prow').forEach(r => r.setAttribute('aria-selected', r.dataset.id === part.id));
  const d = $('detail');
  d.textContent = '';
  const head = document.createElement('div');
  head.innerHTML = `<div class="label">${esc(part.cat)}</div><h2>${esc(part.name)}</h2>`;
  d.append(head);
  const what = document.createElement('p'); what.textContent = part.what; d.append(what);
  if (part.info) { const b = document.createElement('div'); b.className = 'view'; b.innerHTML = BASICS; d.append(b); finish(scroll); return; }

  if (part.need) {
    const ul = document.createElement('ul'); ul.className = 'need';
    part.need.forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.append(li); });
    d.append(ul);
  }
  if (part.warn) { const w = document.createElement('div'); w.className = 'warn'; w.textContent = part.warn; d.append(w); }

  const lab = document.createElement('div'); lab.className = 'label'; lab.textContent = 'Wiring diagram'; d.append(lab);
  const box = document.createElement('div'); box.className = 'diagram'; box.append(diagram(part)); d.append(box);
  const legend = document.createElement('div'); legend.className = 'legend';
  legend.innerHTML = '<span><i style="background:var(--w5)"></i>5V</span><span><i style="background:var(--wg)"></i>GND</span>' +
    (part.wires.some(w => w[1] === '3V3') ? '<span><i style="background:var(--w3)"></i>3.3V</span>' : '') +
    '<span><i style="background:var(--wsig)"></i>Signal</span><span>● joined</span><span>Lines that cross without a dot are not joined</span>';
  d.append(legend);

  const lab2 = document.createElement('div'); lab2.className = 'label'; lab2.textContent = 'Connections'; d.append(lab2);
  const t = document.createElement('div'); t.innerHTML = pinTable(part); d.append(t);

  if (part.notes?.length) {
    const ul = document.createElement('ul'); ul.className = 'notes';
    part.notes.forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.append(li); });
    d.append(ul);
  }

  if (part.code) {
    const ch = document.createElement('div'); ch.className = 'codehead';
    ch.innerHTML = `<div class="label">Arduino sketch</div>`;
    const btns = document.createElement('div'); btns.className = 'row';
    const copy = document.createElement('button'); copy.textContent = 'Copy sketch';
    const mon = document.createElement('button'); mon.className = 'primary'; mon.textContent = 'Open monitor';
    mon.onclick = () => { show('monitor'); scrollTo(0, 0); };
    btns.append(copy, mon); ch.append(btns); d.append(ch);
    if (part.libs?.length) {
      const p = document.createElement('p'); p.className = 'note';
      p.textContent = 'Install first (Arduino IDE → Tools → Manage Libraries): ' + part.libs.join('; ') + '.';
      d.append(p);
    }
    if (part.reads?.length) {
      const p = document.createElement('p'); p.className = 'note';
      p.textContent = 'In the monitor this shows up as: ' + part.reads.join(', ') + '.';
      d.append(p);
    }
    const pre = document.createElement('pre'); pre.className = 'code'; pre.textContent = part.code; d.append(pre);
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(part.code); copy.textContent = 'Copied'; }
      catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = 'Selected, copy it'; }
      setTimeout(() => copy.textContent = 'Copy sketch', 1800);
    };
  } else if (!part.info) {
    const p = document.createElement('p'); p.className = 'note'; p.textContent = 'No sketch needed. This part only supplies power.'; d.append(p);
  }
  finish(scroll);
}
function finish(scroll) {
  try { localStorage.setItem('bm-part', current); } catch {}
  if (scroll && matchMedia('(max-width: 679px)').matches) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Build planner ----------
const build = new Set();
const SHAREABLE = { SDA: 'i2c', SCL: 'i2c', D11: 'spi', D12: 'spi', D13: 'spi' };
function planner() {
  const box = $('planner');
  if (!build.size) { box.hidden = true; return; }
  box.hidden = false;
  const use = new Map();
  for (const id of build) {
    const p = PARTS.find(x => x.id === id);
    for (const [, to] of p.wires) if (!isBlockRef(to) && !RAILS.has(to) && to !== '3V3') {
      if (!use.has(to)) use.set(to, new Set());
      use.get(to).add(p);
    }
  }
  const order = n => (n[0] === 'D' ? 0 : n[0] === 'A' ? 100 : 200) + (parseInt(n.slice(1)) || 0);
  let clashes = 0;
  const rows = [...use.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([pin, set]) => {
    const parts = [...set];
    const bus = SHAREABLE[pin];
    const shared = parts.length > 1 && bus && parts.every(p => p.bus === bus);
    const clash = parts.length > 1 && !shared;
    if (clash) clashes++;
    const status = clash ? '<span class="clash">Clash</span>' : shared ? `<span class="ok">Shared ${bus.toUpperCase()} bus</span>` : '<span class="ok">OK</span>';
    return `<tr><td>${esc(boardName(pin))}</td><td>${parts.map(p => esc(p.name)).join('<br>')}</td><td>${status}</td></tr>`;
  }).join('');
  const names = [...build].map(id => PARTS.find(x => x.id === id).name);
  box.innerHTML = `<div class="codehead"><div class="label">Build planner · ${build.size} part${build.size > 1 ? 's' : ''}</div><button id="plan-clear">Clear</button></div>
    <p class="note">${esc(names.join(', '))}</p>
    <p>${clashes ? `<span class="clash">${clashes} pin clash${clashes > 1 ? 'es' : ''}.</span> Move one part to a free pin and change the number in its sketch.` : '<span class="ok">No pin clashes.</span> These parts can all be wired at once.'}</p>
    <div class="tablewrap"><table class="pins"><thead><tr><th>Board pin</th><th>Used by</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $('plan-clear').onclick = () => { build.clear(); document.querySelectorAll('.prow input').forEach(i => i.checked = false); planner(); };
}

// ---------- List ----------
function list() {
  const q = $('search').value.trim().toLowerCase();
  const box = $('plist'); box.textContent = '';
  const cats = [...new Set(PARTS.map(p => p.cat))];
  for (const c of cats) {
    const items = PARTS.filter(p => p.cat === c && (!q || (p.name + ' ' + p.cat + ' ' + (p.need || []).join(' ')).toLowerCase().includes(q)));
    if (!items.length) continue;
    const h = document.createElement('h3'); h.textContent = c; box.append(h);
    for (const p of items) {
      const row = document.createElement('div'); row.className = 'prow'; row.dataset.id = p.id;
      row.setAttribute('aria-selected', p.id === current);
      const b = document.createElement('button'); b.textContent = p.name; b.onclick = () => select(p.id, true);
      row.append(b);
      if (!p.info && !p.psu) {
        const l = document.createElement('label');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'add-' + p.id; cb.checked = build.has(p.id);
        cb.onchange = () => { cb.checked ? build.add(p.id) : build.delete(p.id); planner(); };
        l.append(cb, 'Add');
        row.append(l);
      }
      box.append(row);
    }
  }
}
$('search').oninput = list;

// ---------- Start ----------
let startPart = 'dht11', startView = 'monitor';
try { startPart = localStorage.getItem('bm-part') || startPart; startView = localStorage.getItem('bm-view') || startView; } catch {}
if (location.hash === '#parts') startView = 'parts';
current = startPart;
list();
select(startPart, false);
show(startView);
})();
