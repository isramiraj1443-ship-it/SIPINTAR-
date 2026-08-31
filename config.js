// ============================================================
//  KONFIGURASI PORTAL — SIPINTAR MATEMATIKA
// ============================================================
//  LANGKAH WAJIB (1x):
//  1. Buka Google Spreadsheet → Extensions → Apps Script
//  2. Klik "Deploy" → "Manage deployments" → Web App
//     (atau "Deploy" → "New deployment" → Type: Web app)
//  3. Salin "URL" web app. Formatnya seperti ini:
//     https://script.google.com/macros/s/XXXXXXXX/exec
//  4. Tempel URL itu ke GAS_WEB_APP_URL di bawah (di antara kutip).
//  5. Push ke GitHub → Vercel otomatis deploy ulang.
//
//  ALTERNATIF TANPA EDIT FILE:
//  Gunakan tombol "Pengaturan Portal" di halaman portal
//  (URL tersimpan di perangkat masing-masing pengguna).
// ============================================================
window.APP_CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbwqgPRA85cEduLdx9ev2kt_RB0aOZbEUZpzD5QxJ5C53T_s-kNA-hM6IDNDmq_q_whSzQ/exec",
  APP_NAME: "SIPINTAR MATEMATIKA",
  APP_TAGLINE: "Portal Ujian Digital",
  APP_VERSION: "1.1.0"
};
