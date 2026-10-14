/* =============================================================================
   SIPINTAR APP BOOT  v1.0.0
   web/app-boot.js
   -----------------------------------------------------------------------------
   Perekat antara UI asli (index.html → web/app.html) dengan API baru.
   Semua yang dilakukan berkas ini bersifat TAMBAHAN dan tidak mengganggu
   fungsi/menu yang sudah ada:

     1. Menyamakan identitas tampilan (nama aplikasi, subjudul, logo,
        latar belakang login) dengan menu Konfigurasi di Spreadsheet —
        pengganti peran  <?= cfg.xxx ?>  milik Apps Script.
     2. Menampilkan spanduk diagnostik bila API GAS tidak terjangkau,
        lengkap dengan tautan mode cadangan /exec.
     3. Menandai bahwa aplikasi berjalan dalam MODE API.
   ============================================================================= */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var API = window.SIPINTAR_API;
  var OLD_DEFAULT_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/' +
    'Logo_of_Ministry_of_Education_and_Culture_of_Republic_of_Indonesia.svg/' +
    '250px-Logo_of_Ministry_of_Education_and_Culture_of_Republic_of_Indonesia.svg.png';

  window.SIPINTAR_MODE = 'api';

  function siap(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------------------------------------------------------------- 1. BRAND */
  function terapkanIdentitas(d) {
    if (!d) return;
    try {
      var nama = d.app_name && String(d.app_name).trim();
      var sub = d.app_subtitle && String(d.app_subtitle).trim();
      var logo = d.app_logo && String(d.app_logo).trim();
      var bg = d.app_background && String(d.app_background).trim();

      if (nama) {
        var judulSidebar = document.querySelectorAll('#admin-sidebar .sidebar-header-text h1');
        for (var i = 0; i < judulSidebar.length; i++) judulSidebar[i].textContent = nama;
      }
      if (sub) {
        var elSub = document.getElementById('login-subtitle');
        if (elSub) elSub.textContent = sub;
      }
      if (logo && logo !== OLD_DEFAULT_LOGO) {
        var img = document.getElementById('login-logo-img');
        if (img) img.src = logo;
      }
      if (bg) {
        var hal = document.getElementById('page-login');
        if (hal) {
          hal.style.backgroundImage = "url('" + bg.replace(/'/g, "\\'") + "')";
          hal.style.backgroundSize = 'cover';
          hal.style.backgroundPosition = 'center';
          hal.style.backgroundRepeat = 'no-repeat';
        }
      }
    } catch (e) { /* diabaikan — tampilan default sudah benar */ }
  }

  /* ------------------------------------------------------------ 2. DIAGNOSTIK */
  function spanduk(pesan) {
    if (document.getElementById('sip-api-banner')) return;
    if (/^https?:/.test(String(location.protocol)) === false) return;
    if (!document.body) return;
    var b = document.createElement('div');
    b.id = 'sip-api-banner';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
      'background:#7f1d1d;color:#fff;font:600 13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;' +
      'box-shadow:0 -6px 24px rgba(0,0,0,.35)';
    var txt = document.createElement('span');
    txt.textContent = 'Mode API belum terhubung: ' + pesan;
    txt.style.maxWidth = '760px';
    b.appendChild(txt);

    var ulang = document.createElement('button');
    ulang.type = 'button';
    ulang.textContent = 'Coba lagi';
    ulang.style.cssText = 'border:0;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer;' +
      'background:#fde68a;color:#7c2d12';
    ulang.onclick = function () {
      ulang.disabled = true; ulang.textContent = 'Memeriksa…';
      API.resetChannel();
      API.probe().then(function (h) {
        if (h.ok) { location.reload(); return; }
        ulang.disabled = false; ulang.textContent = 'Coba lagi';
      });
    };
    b.appendChild(ulang);

    if (CFG.GAS_WEB_APP_URL) {
      var a = document.createElement('a');
      a.href = CFG.GAS_WEB_APP_URL;
      a.textContent = 'Buka mode cadangan (Google)';
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.cssText = 'color:#fde68a;font-weight:800;text-decoration:underline';
      b.appendChild(a);
    }
    document.body.appendChild(b);
  }

  /* ------------------------------------ 3. PEMERIKSAAN BERKAS INTI (diagnosa)
     Bila web/api-client.js belum ada di Vercel, aplikasi lama akan menampilkan
     pesan "Login hanya di URL Google /exec" yang membingungkan. Bagian ini
     memeriksa lebih dulu, mencoba memuat ulang, lalu menjelaskan berkas mana
     yang kurang — jadi tidak perlu menebak-nebak. */
  var BERKAS_INTI = ['config.js', 'api-actions.js', 'api-client.js', 'app-boot.js'];

  function adaGoogleRun() {
    try { return !!(window.google && window.google.script && window.google.script.run); } catch (e) { return false; }
  }

  function alamatAbsolut(nama) {
    try { return new URL(nama, location.href).href; } catch (e) { return nama; }
  }

  function periksaBerkas() {
    var hasil = {};
    var tugas = BERKAS_INTI.map(function (nama) {
      return fetch(nama, { cache: 'no-store' }).then(function (r) {
        hasil[nama] = r.ok ? 'ok' : ('HTTP ' + r.status);
      }, function () {
        hasil[nama] = 'tidak terjangkau';
      });
    });
    return Promise.all(tugas).then(function () { return hasil; });
  }

  /** Coba muat ulang berkas API (kadang gagal sesaat karena jaringan). */
  function muatUlangApi() {
    return new Promise(function (selesai) {
      var sisa = 2;
      function turun() { if (--sisa === 0) setTimeout(selesai, 700); }
      ['api-actions.js', 'api-client.js'].forEach(function (nama) {
        var el = document.createElement('script');
        el.src = nama + '?ulang=' + Date.now();
        el.async = false;
        el.onload = turun;
        el.onerror = turun;
        document.head.appendChild(el);
      });
    });
  }

  function spandukBerkas(hasil) {
    if (document.getElementById('sip-berkas-banner')) return;
    var daftar = BERKAS_INTI.map(function (nama) {
      var st = hasil[nama] || '?';
      var tanda = st === 'ok' ? '✓' : '✗';
      return tanda + ' ' + nama + ' (' + st + ')';
    }).join('  •  ');

    var b = document.createElement('div');
    b.id = 'sip-berkas-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;background:#7f1d1d;color:#fff;' +
      'font:600 13px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 16px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.4)';
    b.innerHTML =
      '<div style="max-width:900px;margin:0 auto">' +
      '<b>Berkas aplikasi belum lengkap di server.</b> ' +
      'Akibatnya tombol login berhenti di pesan “Login hanya di URL Google /exec”.' +
      '<div style="margin-top:6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#fecaca">' +
      daftar + '</div>' +
      '<div style="margin-top:6px;font-size:12px;color:#fee2e2">' +
      'Yang harus ada di GitHub (isi mengikuti letak): ' +
      '<code>web/config.js</code> · <code>web/api-actions.js</code> · ' +
      '<code>web/api-client.js</code> · <code>web/app-boot.js</code>. ' +
      'Periksa langsung: <a id="sip-berkas-link" style="color:#fde68a" target="_blank" rel="noopener"></a>' +
      '</div>' +
      '<div style="margin-top:8px"><button id="sip-berkas-ulang" style="border:0;border-radius:8px;' +
      'padding:6px 12px;font-weight:800;cursor:pointer;background:#fde68a;color:#7c2d12">Muat ulang halaman</button></div>' +
      '</div>';

    document.body.appendChild(b);
    var link = document.getElementById('sip-berkas-link');
    if (link) { link.href = alamatAbsolut('api-client.js'); link.textContent = alamatAbsolut('api-client.js'); }
    var btn = document.getElementById('sip-berkas-ulang');
    if (btn) btn.onclick = function () { location.reload(); };
  }

  function jagaAplikasi() {
    if (adaGoogleRun()) return;                       /* normal: tidak ada gangguan */
    muatUlangApi().then(function () {
      if (adaGoogleRun()) return;                     /* berhasil dipulihkan */
      periksaBerkas().then(function (hasil) {
        if (!adaGoogleRun()) spandukBerkas(hasil);
      });
    });
  }

  /* ---------------------------------------------------------------- 4. JALAN */
  siap(function () {
    /* Diagnosa berkas inti — berjalan sendiri, tidak mengganggu apa pun */
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      setTimeout(jagaAplikasi, 900);
    }

    setTimeout(function () {
      if (!API || typeof API.request !== 'function') return;
      API.request('getAppConfig', [], { timeout: 20000, cid: 'boot' }).then(function (hasil) {
        /* hasil = { data, meta, channel } — data = nilai kembalian getAppConfig() */
        var res = hasil && hasil.data;
        if (res && res.success && res.data) terapkanIdentitas(res.data);
        else if (res === undefined) API.health().then(function (h) { if (!h.ok) spanduk(h.error || '-'); });
      }, function (err) {
        /* Jangan ganggu pengguna bila hanya gagal sesaat: cek kesehatan dulu. */
        API.health().then(function (h) {
          if (!h.ok) spanduk(h.error || 'tidak dapat menghubungi server');
        });
      });
    }, 1500);
  });

  console.log('%cSIPINTAR%c MODE API v' + (CFG.API_VERSION || '1.0.0') +
    ' — ' + (CFG.APP_VERSION || '') + ' (UI di Vercel, otak di Google Apps Script)',
    'background:#1b3a6b;color:#fff;padding:2px 6px;border-radius:4px;font-weight:800',
    'color:#64748b');
})();
