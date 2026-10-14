/* =============================================================================
   api/gas.js — JEMBATAN VERCEL → GOOGLE APPS SCRIPT  (SIPINTAR API)
   -----------------------------------------------------------------------------
   Fungsi ini membuat aplikasi (yang dibuka dari domain Vercel) dapat memakai
   mesin SIPINTAR di Google Apps Script TANPA masalah CORS dan tanpa
   menampilkan URL /exec Anda ke pengunjung.

        Browser  →  https://<domain-anda>/api/gas  →  GAS /exec (doPost)

   Keunggulan:
     • Satu domain untuk semua (tidak ada preflight CORS).
     • URL Apps Script tetap rahasia.
     • Tetap bekerja walau jaringan sekolah memblokir script.google.com
       (permintaan dikirim dari server Vercel, bukan dari browser murid).

   CARA MENYETEL URL GAS
     Pilihan A (disarankan) — Vercel → Project → Settings → Environment
        Variables → tambahkan:  GAS_WEB_APP_URL = https://script.google.com/...
        lalu Deploy ulang.
     Pilihan B — ubah nilai CADANGAN_GAS_URL di bawah ini.

   Runtime: Node.js (CommonJS agar kompatibel di semua jenis project Vercel)
   ============================================================================= */
'use strict';

/* --- URL web app GAS (cadangan bila environment variable belum diisi) ------ */
var CADANGAN_GAS_URL =
  process.env.GAS_WEB_APP_URL ||
  'https://script.google.com/macros/s/AKfycbzWMKpiFErd1P1b5WXv1S_s-T-UMZJBJRnEHITRgS_32Xrjc7wvdE1o3DJIJN78cTw2DA/exec';

var TIMEOUT_MS = 55000;                       /* batas tunggu ke Google */
var API_VERSION = '1.0.0';

/* -------------------------------------------------------------------------- */

function kirimJson(res, status, obj) {
  var body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sipintar-Action');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.end(body);
}

function ambilBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') return resolve(req.body);
      try { return resolve(JSON.stringify(req.body)); } catch (e) { return resolve(''); }
    }
    var potongan = [];
    req.on('data', function (c) { potongan.push(c); });
    req.on('end', function () {
      try { resolve(Buffer.concat(potongan).toString('utf8')); } catch (e) { resolve(''); }
    });
    req.on('error', function () { resolve(''); });
  });
}

function ambilQuery(req) {
  var out = {};
  try {
    var u = new URL(req.url, 'https://x.local');
    u.searchParams.forEach(function (v, k) { out[k] = v; });
  } catch (e) {}
  return out;
}

async function panggilGas(url, opsi) {
  var ctl = new AbortController();
  var timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, TIMEOUT_MS);
  try {
    var r = await fetch(url, {
      method: opsi.method,
      headers: opsi.headers,
      body: opsi.body,
      redirect: 'follow',
      signal: ctl.signal
    });
    var teks = await r.text();
    return { status: r.status, teks: teks };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */

module.exports = async function handler(req, res) {
  /* --- CORS preflight --- */
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sipintar-Action');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.end();
  }

  var q = ambilQuery(req);
  var gasUrl = CADANGAN_GAS_URL;
  if (!gasUrl) {
    return kirimJson(res, 200, {
      ok: false,
      error: {
        message: 'GAS_WEB_APP_URL belum disetel. Isi di Vercel → Settings → ' +
                 'Environment Variables (atau ubah CADANGAN_GAS_URL pada api/gas.js).'
      },
      meta: { via: 'proxy', api: API_VERSION }
    });
  }

  /* --- Pemeriksaan sehat sederhana: /api/gas?health=1 --- */
  if (q.health === '1' && req.method === 'GET') {
    return kirimJson(res, 200, {
      ok: true,
      data: { proxy: 'hidup', gas: gasUrl.replace(/\/(exec|dev).*$/, '/exec'), api: API_VERSION },
      meta: { via: 'proxy' }
    });
  }

  /* --- GET: diteruskan sebagai ?api=1&action=... (tanpa preflight) --- */
  if (req.method === 'GET') {
    var action = q.action || q.a || 'apiInfo';
    var target = gasUrl + (gasUrl.indexOf('?') < 0 ? '?' : '&') +
      'api=1&action=' + encodeURIComponent(action) +
      (q.args ? '&args=' + encodeURIComponent(q.args) : '');
    try {
      var g = await panggilGas(target, { method: 'GET', headers: {} });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(g.teks);
    } catch (e) {
      return kirimJson(res, 200, {
        ok: false,
        error: { message: 'Proxy tidak dapat menghubungi Apps Script: ' + (e.message || e) },
        meta: { via: 'proxy', api: API_VERSION }
      });
    }
  }

  /* --- POST: badan JSON diteruskan apa adanya sebagai text/plain --- */
  if (req.method === 'POST') {
    var body = await ambilBody(req);
    if (!body) {
      return kirimJson(res, 200, {
        ok: false,
        error: { message: 'Badan permintaan kosong.' },
        meta: { via: 'proxy', api: API_VERSION }
      });
    }
    var aksi = '?';
    try { aksi = JSON.parse(body).action || '?'; } catch (e) {}

    try {
      var out = await panggilGas(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body
      });

      var teks = (out.teks || '').trim();
      if (teks.charAt(0) !== '{') {
        /* GAS menjawab HTML → biasanya deployment belum diperbarui / bukan "Anyone" */
        return kirimJson(res, 200, {
          ok: false,
          error: {
            message: 'Apps Script tidak mengembalikan JSON. Periksa: (1) deploy ulang ' +
                     'dengan "New version" setelah mengganti code.gs, (2) Execute as = Me, ' +
                     'Who has access = Anyone, (3) URL /exec benar.',
            cuplikan: teks.substring(0, 200)
          },
          meta: { via: 'proxy', api: API_VERSION, action: aksi, status: out.status }
        });
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(teks);
    } catch (e) {
      var pesan = (e && e.name === 'AbortError')
        ? 'Apps Script tidak merespons dalam ' + Math.round(TIMEOUT_MS / 1000) + ' detik.'
        : ('Gagal menghubungi Apps Script: ' + (e.message || e));
      return kirimJson(res, 200, {
        ok: false,
        error: { message: pesan },
        meta: { via: 'proxy', api: API_VERSION, action: aksi }
      });
    }
  }

  return kirimJson(res, 405, {
    ok: false,
    error: { message: 'Metode ' + req.method + ' tidak didukung.' },
    meta: { via: 'proxy', api: API_VERSION }
  });
};
