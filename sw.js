/* ============================================================
 *  Service Worker — Portal SIPINTAR MATEMATIKA
 *  Meng-cache halaman portal agar bisa terbuka walau offline
 *  (aplikasi utama tetap membutuhkan koneksi ke server Google).
 * ============================================================ */
const CACHE_NAME = 'sipintar-portal-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './logo.png',
  './background.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Permintaan lintas-origen (mis. script.google.com) → biarkan jaringan biasa
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: network-first, fallback ke cache (tombak offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset statis: cache-first, lalu jaringan
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
