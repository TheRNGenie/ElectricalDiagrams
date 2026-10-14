// Keeps Board Monitor on the phone so it opens and compiles without a connection.
// App files: network first (so updates arrive), falling back to the saved copy.
// The compiler and the compiled kit sketches: saved the first time they're used, then served from the phone.
const VERSION = 'bm-1';
const SHELL = ['./', 'index.html', 'app.css', 'monitor.js', 'flasher.js', 'parts-data.js', 'parts.js', 'sketches.js', 'editor.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'compiler/worker.js', 'compiler/build.js', 'compiler/flags.js', 'compiler/ino.js', 'compiler/pack.json'];
const FOREVER = /\/(compiler\/|bin\/)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url); url.search = '';
  if (FOREVER.test(url.pathname) && !/\.(js|json)$/.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(url, res.clone());
      return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) caches.open(VERSION).then(c => c.put(url, res.clone()));
    return res;
  }).catch(() => caches.match(url, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
