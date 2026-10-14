/* =============================================================================
   SIPINTAR Service Worker  v10
   -----------------------------------------------------------------------------
   Tugasnya ringan saja: mempercepat muat ulang portal & kerangka aplikasi,
   serta menyediakan halaman offline sederhana.

   PENTING (perbaikan pada versi ini):
     • /api/  → SELALU ke jaringan, tidak pernah di-cache (data nilai/ujian
       tidak boleh basi).
     • Hanya permintaan GET dari domain sendiri yang ditangani; semua
       permintaan lain (Google, CDN, Drive) dibiarkan lewat apa adanya.
     • DoGet/doPost aplikasi tidak pernah dilayani dari cache.
   ============================================================================= */
const CACHE = 'sipintar-v10';
const INTI = [
  './',
  'index.html',
  'app',
  'config.js',
  'api-actions.js',
  'api-client.js',
  'app-boot.js',
  'manifest.webmanifest',
  'logo.png',
  'background.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* satu per satu supaya satu berkas gagal tidak membatalkan semuanya */
      return Promise.all(INTI.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function offlinePage() {
  return new Response(
    '<!DOCTYPE html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>SIPINTAR — Offline</title>' +
    '<body style="margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b1b33;color:#f8fafc;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center">' +
    '<div style="max-width:340px;padding:28px">' +
    '<h1 style="margin:0 0 8px;font-size:1.2rem">SIPINTAR</h1>' +
    '<p style="color:#cbd5e1;font-size:.9rem;line-height:1.6">Tidak ada koneksi internet.<br>' +
    'Ujian dan penilaian SIPINTAR memerlukan sambungan ke server sekolah/Google.<br><br>' +
    'Periksa Wi-Fi atau data seluler, lalu muat ulang halaman.</p>' +
    '<button onclick="location.reload()" style="margin-top:14px;padding:12px 18px;border:0;border-radius:12px;' +
    'font-weight:800;background:#f5d76e;color:#1b3a6b;cursor:pointer">Muat ulang</button>' +
    '</div></body>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;                       /* POST/DLL → jaringan langsung */

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;        /* Google/CDN/Drive → apa adanya */

  /* API: selalu jaringan, tidak pernah dari cache */
  if (url.pathname.indexOf('/api/') === 0) return;

  /* Halaman/Navigasi: jaringan dulu (selalu segar), cache hanya bila offline */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('app') || caches.match('index.html') || offlinePage();
        });
      })
    );
    return;
  }

  /* Berkas statis (gambar/ikon/font): cache dulu, perbarui di belakang */
  const nama = url.pathname.split('/').pop() || '';
  const statis = /\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf)$/i.test(nama);
  if (statis) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        const ambil = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            const salinan = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, salinan); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || ambil;
      })
    );
    return;
  }

  /* Skrip & konfigurasi: jaringan dulu (agar perubahan langsung terpakai) */
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then(function (res) {
      if (res && res.status === 200 && /\.(js|webmanifest)$/i.test(nama)) {
        const salinan = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, salinan); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || offlinePage(); });
    })
  );
});
