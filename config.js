// ============================================================
//  PORTAL & APLIKASI SIPINTAR — konfigurasi pusat (Vercel)
//  Setelah Deploy, jika URL /exec BERUBAH, ganti di sini.
// ============================================================
window.APP_CONFIG = {

  /* --- Alamat mesin SIPINTAR (Google Apps Script / code.gs) -----------------
     Bentuk: https://script.google.com/macros/s/XXXX/exec
     Tidak berubah saat Anda memilih "Deploy → New version". */
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzWMKpiFErd1P1b5WXv1S_s-T-UMZJBJRnEHITRgS_32Xrjc7wvdE1o3DJIJN78cTw2DA/exec",

  /* --- Identitas ----------------------------------------------------------- */
  APP_NAME: "SIPINTAR",
  APP_TAGLINE: "SMP Negeri 26 Surakarta",
  APP_VERSION: "2.2.3",

  /* --- Halaman aplikasi (UI) yang di-host di Vercel ------------------------
     Kosongkan untuk memakai bawaan: "app"  (dibuka sebagai /app). */
  APP_PATH: "app",

  /* ==========================================================================
     PENGATURAN API — biasanya TIDAK perlu diubah
     ========================================================================== */

  /* Versi lapisan API (lihat gas/api-layer.gs). Ikut tampil di tiap respons. */
  API_VERSION: "1.0.0",

  /* Jalur pengiriman permintaan ke Google:
       "auto"   = pakai proxy Vercel /api/gas, otomatis pindah ke jalur
                  langsung bila proxy bermasalah  (SANGAT DISARANKAN)
       "proxy"  = selalu lewat proxy Vercel (URL GAS tetap tersembunyi)
       "direct" = selalu langsung ke script.google.com (tanpa proxy) */
  API_MODE: "auto",

  /* Alamat proxy. Kosong = domain sendiri (…/api/gas).
     Isi hanya bila proxy diletakkan di domain lain, contoh:
     "https://sipintar-proxy.vercel.app" */
  API_BASE_URL: "",

  /* Batas waktu (milidetik) */
  API_TIMEOUT_MS: 45000,          // permintaan biasa
  API_SLOW_TIMEOUT_MS: 180000,    // permintaan berat (AI, cetak PDF, ekspor)
  API_PROXY_TIMEOUT_MS: 55000,    // batas proxy Vercel

  /* Pemanasan otomatis (ping) agar Apps Script tidak "dingin" saat login. */
  API_WARMUP: true,

  /* Tampilkan rincian teknis di Console browser (F12) bila perlu menelusuri. */
  API_DEBUG: false
};
