SIPINTAR MATEMATIKA — Repo GitHub
Repo ini berisi dua bagian:

text

github-sipintar/
├── gas/                  ← OTAK APLIKASI (tapi TIDAK di-deploy ke Vercel)
│   ├── code.gs              Kode backend Google Apps Script (deploy ke Apps Script)
│   └── index.html           UI aplikasi utama (deploy ke Apps Script)
└── web/                  ← PORTAL WEB + PWA (INI yang di-deploy ke Vercel)
    ├── index.html             Halaman portal (launcher) yang bisa di-install
    ├── config.js              ⚙️ Ganti URL web app GAS Anda di sini (1x)
    ├── manifest.webmanifest   Data PWA (nama, ikon, cara install)
    ├── sw.js                  Service worker (portal bisa dibuka offline)
    ├── vercel.json            Konfigurasi Vercel (cache, header)
    ├── logo.png               Logo resmi SIPINTAR (burung hantu) untuk header portal
    └── icon-192.png / icon-512.png   Ikon aplikasi (tampil saat di-install di HP)
Catatan arsitektur: semua logika inti (bank soal, ujian, AI generator,
rekap) berjalan di server Google (Apps Script + Spreadsheet).
Vercel hanya melayani portal masuk yang membuat aplikasi bisa dibuka
lewat web dan di-install di HP/laptop (PWA).

📋 LANGKAH PELAKSANAAN (± 15 menit)
Langkah 1 — Deploy web app di Google Apps Script (sudah Anda miliki)
Buka Spreadsheet → Extensions → Apps Script (pastikan sudah berisi
code.gs + index.html dari folder gas/ — salin tempel utuh ke
editor Apps Script).
Klik Deploy → New deployment → ⚙️ Web app:
Execute as: Me (akun Anda)
Who has access: Anyone
Klik Deploy, izinkan otorisasi, lalu salin URL web app
(bentuknya https://script.google.com/macros/s/XXXX/exec).
Uji: buka URL itu di browser → aplikasi SIPINTAR harus muncul.
⚠️ Setiap kali Anda mengubah kode dan memilih "Deploy → Manage
deployments → ✏️ Edit → New version", URL web app tetap sama —
tidak perlu update apa-apa di portal.

Langkah 2 — Isikan URL di 
config.js
Buka 
config.js
, tempel URL di GAS_WEB_APP_URL:

JavaScript

window.APP_CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/XXXX/exec",
  ...
};
(Alternatif: biarkan kosong — pengguna bisa isi sendiri lewat
"Pengaturan Portal" di halaman portal. Tapi mengisi di config.js lebih
baik karena berlaku untuk semua pengunjung.)

Langkah 3 — Upload ke GitHub
Buat akun (jika belum): github.com → New repository
→ nama mis. sipintar-matematika → Public → Create.
Di halaman repo: "uploading an existing file" → drag & drop
seluruh isi folder github-sipintar (folder gas/ + web/ +

README.md
 + 
.gitignore
) → Commit changes.
(Lewat web ini paling mudah — tidak perlu instal Git.)
Langkah 4 — Hubungkan ke Vercel
Daftar/login: vercel.com → Add New → Project.
Import repo sipintar-matematika dari GitHub (otomatis terdeteksi).
Saat muncul pertanyaan framework: pilih "Other" / "No framework"
→ Build Command: (kosongkan) → Output Directory: web
→ Root Directory: (kosongkan).
Klik Deploy. Tunggu ±1 menit.
Anda dapat URL: https://sipintar-matematika.vercel.app (atau subdomain lain).
Langkah 5 — Uji & Install di perangkat
Web: buka URL Vercel → tombol Buka Aplikasi → masuk seperti biasa.
Install di Android (Chrome): buka URL → menu ⋮ → "Install app"
(atau tombol "Install ke Perangkat" yang muncul).
Install di iPhone (Safari): buka URL → tombol Share →
"Add to Home Screen".
Desktop (Chrome/Edge): klik ikon 🖥️ di address bar → Install.
Setelah ter-install: ikon "SIPINTAR" muncul di layar utama, terbuka
full-screen tanpa bilah browser, dan langsung meluncur ke aplikasi
Anda.

🔄 Alur Pembaruan (setiap ada ubah)
Yang berubah	Lakukan di	Otomatis?
Kode fitur / UI (code.gs, index.html)	Salin tempel ulang di Apps Script → Deploy → New version	Ya, URL lama tetap valid
Halaman portal (web/)	Edit file → push ke GitHub	Ya, Vercel auto-deploy
URL web app berganti (jarang)	Update 
config.js
 → push	Ya, Vercel auto-deploy
❓ FAQ
Kenapa Vercel tidak menggantikan Apps Script?
Vercel tidak bisa mengakses Spreadsheet/Drive/Sheets API-nya Apps
Script secara instan; memindahkan seluruh logika (6.000+ baris) ke
Vercel = proyek rewrite terpisah. PWA ini cara tercepat & stabil
untuk "buka via web + install di device".
Apakah pengguna perlu akun Google?
Ya, saat pertama membuka web app akan muncul halaman izin Google
(sekali saja). Data ujian tetap aman di Spreadsheet Anda.
Bisa ganti nama domain?
Bisa: Vercel → Project → Settings → Domains → tambahkan domain
Anda (mis. app.sekolah.sch.id) → arahkan DNS. Gratis.
Gratis?
GitHub (public) ✅ dan Vercel Hobby ✅ gratis untuk kebutuhan ini.
