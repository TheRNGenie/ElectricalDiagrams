(() => {
const $ = id => document.getElementById(id);
const enc = new TextEncoder();
const MAXPTS = 300, MAXLINES = 1000;
let link = null;           // {write(str), close()}
let demoTimer = null;
let buf = '';
let lastPort = null;      // remembered so the uploader can reuse it
const series = new Map();  // name -> {vals:[], color}
const palette = ['--s1','--s2','--s3','--s4','--s5','--s6'];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---------- UI state ----------
function setState(text, cls){ const s=$('state'); s.textContent=text; s.className='pill '+(cls||''); }
function hint(text, err){ const h=$('hint'); h.textContent=text||''; h.className='note'+(err?' err':''); }
function connected(on){ $('disconnect').disabled=!on; $('usb-connect').disabled=on; $('ws-connect').disabled=on; }
function tab(which){
  $('tab-usb').setAttribute('aria-selected', which==='usb'); $('tab-wifi').setAttribute('aria-selected', which==='wifi');
  $('pane-usb').hidden = which!=='usb'; $('pane-wifi').hidden = which!=='wifi'; capHint();
}
$('tab-usb').onclick=()=>tab('usb'); $('tab-wifi').onclick=()=>tab('wifi');
function capHint(){
  if (!$('pane-usb').hidden){
    if ('serial' in navigator) hint('Plug the board in, then tap Connect USB and pick it from the list.');
    else if ('usb' in navigator) hint('Plug the board in, then tap Connect USB. This browser uses WebUSB, which works with boards that have native USB (ESP32-S2/S3, Pico, Leonardo). Boards with a CH340 or CP2102 chip need Web Serial (recent Chrome).');
    else hint('This browser can’t reach USB. Use Chrome on Android or a desktop, or switch to WiFi.', true);
  } else {
    hint(location.protocol==='https:' && !window.AndroidUsb && $('wsurl').value.startsWith('ws:')
      ? 'This page is on https, so the browser blocks plain ws:// links. Open the page from the board itself, or use wss://.'
      : 'Enter the WebSocket address your board serves, then tap Connect WiFi.');
  }
}
$('wsurl').oninput=capHint;

// ---------- Log ----------
function logLine(text, kind){
  const log=$('log'), div=document.createElement('div');
  if ($('ts').checked){ const t=document.createElement('span'); t.className='t'; t.textContent=new Date().toTimeString().slice(0,8)+'  '; div.append(t); }
  const s=document.createElement('span'); if(kind) s.className=kind; s.textContent=text; div.append(s);
  log.append(div);
  while (log.childNodes.length>MAXLINES) log.firstChild.remove();
  if ($('autoscroll').checked) log.scrollTop=log.scrollHeight;
}
$('clear').onclick=()=>{ $('log').textContent=''; series.clear(); renderReadouts(); draw(); };

// ---------- Parsing ----------
const NUM = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
function parse(line){
  const out=[];
  // name=value / name:value pairs
  const kv=[...line.matchAll(/([A-Za-z_][\w.\-]*)\s*[:=]\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(?![\w.])/g)];
  if (kv.length){ kv.forEach(m=>out.push([m[1], parseFloat(m[2])])); return out; }
  // bare numbers separated by comma, tab, space or semicolon
  const parts=line.trim().split(/[\s,;\t]+/).filter(Boolean);
  if (parts.length && parts.every(p=>NUM.test(p))) parts.forEach((p,i)=>out.push(['v'+(i+1), parseFloat(p)]));
  return out;
}
function ingest(chunk){
  buf += chunk;
  let i;
  while ((i = buf.search(/\r?\n|\r/)) >= 0){
    const line = buf.slice(0,i); buf = buf.slice(i + (buf[i]==='\r' && buf[i+1]==='\n' ? 2 : 1));
    handleLine(line);
  }
  if (buf.length > 4096){ handleLine(buf); buf=''; }
}
function handleLine(line){
  if (!line.length) return;
  logLine(line);
  const vals=parse(line); if (!vals.length) return;
  for (const [k,v] of vals){
    if (!series.has(k)) series.set(k,{vals:[],color:palette[series.size%palette.length]});
    const s=series.get(k); s.vals.push(v); if (s.vals.length>MAXPTS) s.vals.shift();
  }
  dirty=true;
}

// ---------- Readouts + plot ----------
let dirty=false;
function fmt(v){ return Math.abs(v)>=1e5||(Math.abs(v)<1e-3&&v!==0) ? v.toExponential(2) : +v.toFixed(3)+''; }
function renderReadouts(){
  const el=$('readouts');
  if (!series.size){ el.innerHTML='<div class="empty">Numbers in incoming lines show up here, like <code>temp=23.4,hum=51</code> or <code>23.4,51</code>.</div>'; return; }
  el.textContent='';
  for (const [k,s] of series){
    const d=document.createElement('div'); d.className='ro';
    const kk=document.createElement('div'); kk.className='k'; const sw=document.createElement('i'); sw.style.background=`var(${s.color})`; kk.append(sw, k);
    const vv=document.createElement('div'); vv.className='v'; vv.textContent=fmt(s.vals[s.vals.length-1]);
    d.append(kk,vv); el.append(d);
  }
}
function draw(){
  const c=$('plot'), dpr=window.devicePixelRatio||1, w=c.clientWidth, h=c.clientHeight;
  if (c.width!==w*dpr||c.height!==h*dpr){ c.width=w*dpr; c.height=h*dpr; }
  const g=c.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  let lo=Infinity, hi=-Infinity;
  for (const s of series.values()) for (const v of s.vals){ if(v<lo)lo=v; if(v>hi)hi=v; }
  const padL=56, padR=8, padT=8, padB=18, pw=w-padL-padR, ph=h-padT-padB;
  g.font='11px '+css('--mono'); g.fillStyle=css('--muted'); g.strokeStyle=css('--line'); g.lineWidth=1;
  if (!isFinite(lo)){ g.textAlign='center'; g.fillText('Waiting for numeric data', w/2, h/2); return; }
  if (hi===lo){ hi+=1; lo-=1; }
  const span=hi-lo; lo-=span*.05; hi+=span*.05;
  const y=v=>padT+ph*(1-(v-lo)/(hi-lo));
  g.textAlign='right'; g.textBaseline='middle';
  for (let k=0;k<=4;k++){ const v=lo+(hi-lo)*k/4, yy=y(v); g.beginPath(); g.moveTo(padL,yy+.5); g.lineTo(w-padR,yy+.5); g.stroke(); g.fillText(+v.toPrecision(4)+'', padL-6, yy); }
  g.textAlign='left'; g.textBaseline='alphabetic'; g.fillText(`${MAXPTS} samples →`, padL, h-4);
  for (const s of series.values()){
    const col=css(s.color), n=s.vals.length; if(!n) continue;
    const x=i=>padL+pw*(i+(MAXPTS-n))/(MAXPTS-1);
    g.strokeStyle=col; g.lineWidth=1.75; g.beginPath();
    s.vals.forEach((v,i)=> i?g.lineTo(x(i),y(v)):g.moveTo(x(i),y(v))); g.stroke();
    g.fillStyle=col; g.beginPath(); g.arc(x(n-1),y(s.vals[n-1]),3,0,7); g.fill();
  }
}
function frame(){ if (dirty && !$('paused').checked){ dirty=false; renderReadouts(); draw(); } requestAnimationFrame(frame); }
addEventListener('resize', draw);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);

// ---------- Web Serial ----------
function connectSerialWith(known){ return () => connectSerial(known); }
async function connectSerial(known){
  const port = known || await navigator.serial.requestPort();
  lastPort = port;
  await port.open({ baudRate: +$('baud').value });
  const reader = port.readable.getReader(); const writer = port.writable.getWriter();
  const dec = new TextDecoder(); let open = true;
  link = { kind:'USB', write: s => writer.write(enc.encode(s)),
    close: async () => { open=false; try{await reader.cancel();}catch{} try{reader.releaseLock(); writer.releaseLock();}catch{} try{await port.close();}catch{} } };
  (async () => {
    try { while (open){ const {value,done}=await reader.read(); if(done) break; if(value) ingest(dec.decode(value,{stream:true})); } }
    catch(e){ if(open) lost(e); }
  })();
  navigator.serial.addEventListener('disconnect', e => { if (e.target===port && link) lost(new Error('Board unplugged')); }, {once:true});
}

// ---------- WebUSB (CDC-ACM) fallback ----------
async function connectWebUSB(){
  const dev = await navigator.usb.requestDevice({ filters: [] });
  await dev.open(); if (!dev.configuration) await dev.selectConfiguration(1);
  let ctrl=null, data=null, epIn=null, epOut=null;
  for (const itf of dev.configuration.interfaces){
    const alt=itf.alternate;
    if (alt.interfaceClass===2) ctrl=itf.interfaceNumber;
    if (alt.interfaceClass===10 || (alt.interfaceClass===255 && !data)){
      const i=alt.endpoints.find(e=>e.direction==='in'&&e.type==='bulk'), o=alt.endpoints.find(e=>e.direction==='out'&&e.type==='bulk');
      if (i&&o){ data=itf.interfaceNumber; epIn=i; epOut=o; }
    }
  }
  if (data===null) throw new Error('No serial interface found on this USB device. It may need Web Serial (recent Chrome).');
  if (ctrl!==null) { try{ await dev.claimInterface(ctrl); }catch{} }
  await dev.claimInterface(data);
  const idx = ctrl ?? data;
  const baud=+$('baud').value, lc=new Uint8Array([baud&255,(baud>>8)&255,(baud>>16)&255,(baud>>24)&255,0,0,8]);
  try { await dev.controlTransferOut({requestType:'class',recipient:'interface',request:0x20,value:0,index:idx}, lc); } catch {}
  try { await dev.controlTransferOut({requestType:'class',recipient:'interface',request:0x22,value:0x03,index:idx}); } catch {}
  const dec=new TextDecoder(); let open=true;
  link = { kind:'USB', write: s => dev.transferOut(epOut.endpointNumber, enc.encode(s)),
    close: async () => { open=false; try{await dev.close();}catch{} } };
  (async () => {
    try { while (open){ const r=await dev.transferIn(epIn.endpointNumber, epIn.packetSize||64); if (r.data && r.data.byteLength) ingest(dec.decode(r.data,{stream:true})); } }
    catch(e){ if(open) lost(e); }
  })();
}

// ---------- WebSocket ----------
function connectWS(){
  return new Promise((res, rej) => {
    let ws; try { ws = new WebSocket($('wsurl').value.trim()); } catch(e){ return rej(e); }
    ws.binaryType='arraybuffer'; const dec=new TextDecoder(); let ok=false;
    ws.onopen = () => { ok=true; link={kind:'WiFi', write:s=>ws.send(s), close:async()=>{ ws.onclose=null; ws.close(); }}; res(); };
    ws.onmessage = e => { const t = typeof e.data==='string' ? e.data : dec.decode(e.data); ingest(/[\r\n]$/.test(t) ? t : t+'\n'); };
    ws.onerror = () => { if(!ok) rej(new Error('Could not reach '+ws.url+'. Check the address and that the phone is on the board’s WiFi.')); };
    ws.onclose = () => { if(ok && link) lost(new Error('Connection closed by the board')); };
  });
}

// ---------- Wiring ----------
async function start(fn){
  stopDemo(); hint('');
  try { await fn(); connected(true); setState('Connected · '+link.kind,'on'); logLine('Connected over '+link.kind,'sys'); }
  catch(e){ if (e && e.name==='NotFoundError') { capHint(); return; } setState('Not connected','err'); hint(e.message||String(e), true); }
}
function lost(e){ link=null; connected(false); setState('Disconnected','err'); logLine(e.message||'Disconnected','sys'); }
$('usb-connect').onclick = () => start('serial' in navigator ? connectSerial : ('usb' in navigator ? connectWebUSB : async()=>{throw new Error('This browser can’t reach USB. Use Chrome on Android or a desktop.');}));
$('ws-connect').onclick = () => start(connectWS);
$('disconnect').onclick = async () => { const l=link; link=null; if(l) await l.close(); connected(false); setState('Not connected'); logLine('Disconnected','sys'); };
$('sendform').onsubmit = async e => {
  e.preventDefault(); const v=$('cmd').value; if(!v) return;
  const eol=$('eol').value.replace('\\r','\r').replace('\\n','\n');
  if (!link){ hint('Connect to the board before sending.', true); return; }
  try { await link.write(v+eol); logLine('> '+v,'tx'); $('cmd').value=''; } catch(err){ hint('Send failed: '+err.message, true); }
};

// ---------- Demo ----------
function stopDemo(){ if(demoTimer){ clearInterval(demoTimer); demoTimer=null; $('demo').textContent='Run demo data'; if(!link) setState('Not connected'); } }
function startDemo(){
  if (link) return; series.clear(); $('log').textContent=''; let t=0;
  setState('Demo data','demo'); $('demo').textContent='Stop demo';
  demoTimer=setInterval(()=>{ t++;
    const temp=(22.5+Math.sin(t/25)*1.8+Math.random()*.2).toFixed(2), hum=(48+Math.cos(t/40)*6+Math.random()).toFixed(1), light=Math.round(520+Math.sin(t/9)*180+Math.random()*30);
    ingest(`temp=${temp},hum=${hum},light=${light}\n`);
  },150);
}
$('demo').onclick=()=> demoTimer ? stopDemo() : startDemo();

// Lets the uploader take over the USB port
window.boardMonitor = {
  async release(){ stopDemo(); const l=link; link=null; if(l){ await l.close(); connected(false); setState('Not connected'); logLine('Disconnected for upload','sys'); } },
  get port(){ return lastPort; },
  set port(p){ lastPort = p; },
  connectUSB(){ return start(connectSerialWith(lastPort)); }
};

tab('usb'); requestAnimationFrame(frame); draw(); startDemo();
})();
