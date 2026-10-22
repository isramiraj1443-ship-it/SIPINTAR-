/* =============================================================================
   SIPINTAR API CLIENT  v1.0.0
   web/api-client.js
   -----------------------------------------------------------------------------
   Membuat antarmuka `google.script.run` yang ASLI-KOMPATIBEL, tetapi
   pengirimannya lewat API JSON ke Google Apps Script (code.gs).

   Dengan berkas ini, index.html aplikasi SIPINTAR TIDAK PERLU DIUBAH SAMA
   SEKALI — 135+ pemanggilan `google.script.run.fungsi(...)` yang sudah ada
   tetap berjalan apa adanya, hanya jalurnya berubah:

       UI (Vercel)  →  /api/gas (proxy Vercel)  →  GAS code.gs (doPost)
                     ↳ atau langsung ke GAS ?api=1 (mode cadangan)

   Cara pakai (dipanggil otomatis di web/app.html):
       <script src="config.js"></script>
       <script src="api-client.js"></script>

   Konfigurasi (web/config.js):
       GAS_WEB_APP_URL : URL /exec Apps Script
       API_MODE        : 'auto' (default) | 'proxy' | 'direct'
       API_BASE_URL    : '' = domain sendiri (/api/gas). Boleh diisi URL penuh.
       API_TIMEOUT_MS  : batas tunggu normal (default 45000)
   ============================================================================= */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};

  var VERSION       = CFG.API_VERSION || '1.0.0';
  var GAS_URL       = String(CFG.GAS_WEB_APP_URL || '').replace(/\/+$/, '');
  var API_BASE      = String(CFG.API_BASE_URL || '').replace(/\/+$/, '');
  var PROXY_URL     = API_BASE ? (API_BASE + '/api/gas') : '/api/gas';
  var MODE          = String(CFG.API_MODE || 'auto').toLowerCase();
  var TIMEOUT_MS    = Number(CFG.API_TIMEOUT_MS) || 45000;
  var SLOW_MS       = Number(CFG.API_SLOW_TIMEOUT_MS) || 180000;
  var PROXY_MS      = Number(CFG.API_PROXY_TIMEOUT_MS) || 55000;
  var VERBOSE       = CFG.API_DEBUG === true;
  var MAX_PROXY_BYTES = Number(CFG.API_PROXY_MAX_BYTES) || 3500000;

  /* --- Aksi yang BOLEH diulang otomatis bila jalur gagal (hanya baca/tidak
         mengubah data) — mencegah data dobel pada simpan/submit. --- */
  var RETRY_SAFE = [
    'apiInfo', 'ping', 'pingLoginWarm', 'getScriptTimezone', 'getAppConfig',
    'checkSession', 'getMasterData', 'getExamList', 'getQuestionsByExam',
    'getExamQuestions', 'getUserList', 'getSavedImages', 'getAllImages',
    'getStudentProfile', 'listStudentProfiles', 'getTeacherAssignments',
    'getDashboardInfo', 'getBankQuestionStats', 'getQuestionDiagnostics',
    'getKisiKisiByExam', 'getPaketMateri', 'usulkanPaketMateri', 'getValidasiMap', 'getExamMonitorData',
    'getSiswaForGuru', 'getPengawasSaya', 'getPengawasList', 'getAIConfig',
    'getReportTemplate', 'getExamEssayPack', 'getEssayData', 'getExamResults',
    'getHasilAnalisis', 'getMyExamResult', 'getStudentAnswerDetail',
    'getStudentAnswerDetails', 'getKumpulSaya', 'listKumpulPenugasan',
    'listMateriPembelajaran', 'getMateriPembelajaran', 'listPenugasan',
    'getPenugasan', 'listJurnalPembelajaran', 'getJurnalPembelajaran',
    'listGamefikasi', 'listGamefikasiHasil', 'listCapaianPembelajaran',
    'listKartuTemplates', 'listKartuFolderFiles', 'listExamMusicLibrary',
    'listSoalUntukTautan', 'listKisiKisiSiswa', 'getKisiKisiSiswa',
    'listSiswaKelas', 'getPosisiGambarSoal', 'getExamMusicSettings',
    'hermesGetDashboard', 'hermesListUsulan', 'hermesAudit',
    'generateQuestionsAI', 'generateQuestionImageAI', 'getSiswaNilaiRekomendasi'
  ];

  /* --- Aksi berat/lama → utamakan jalur LANGSUNG ke GAS (tanpa proxy),
         karena proxy Vercel punya batas waktu ± 60 detik. --- */
  var SLOW_ACTIONS = [
    'generateQuestionsAI', 'generateQuestionImageAI', 'buatSoalDariKisiAI', 'perbaikiSoalKognitifAI',
    'buatKisiKisi', 'generateExamRecapPDF', 'generateStudentDetailPDF',
    'exportKartuUjianToFolder', 'exportBelajarPdfA4', 'exportJurnalPdfA4',
    'exportBankSoalFile', 'unduhKisiKisi', 'unduhKisiKisiSiswa',
    'importQuestionsFromForm', 'importUsersBulk', 'regradeExamResponses',
    'recalculateExamScores', 'processFolderImages', 'setupGamefikasiFolders',
    'uploadExamMusicFile', 'uploadBelajarFile', 'uploadJurnalFile',
    'uploadProfilFoto', 'kumpulPenugasanSiswa', 'getSavedImages',
    'listMateriPembelajaran', 'getAllImages', 'getExamMonitorData',
    'getStudentAnswerDetails', 'getHasilAnalisis'
  ];

  /* --- Aksi yang dilarang diulang-otomatis (efek samping permanen) --- */
  var NEVER_RETRY = ['submitExam', 'syncAnswers', 'logViolation', 'saveEssayGrade',
    'saveImportedQuestions', 'saveAIQuestions', 'kumpulPenugasanSiswa', 'perbaikiSoalKognitifAI', 'simpanPaketMateri'];

  var STORE_KEY = 'sipintar_api_channel_v1';
  var MEM = { channel: null, at: 0, probe: null, probes: 0 };

  /* ======================= utilitas ======================= */

  function log() {
    if (!VERBOSE) return;
    try { console.log.apply(console, ['[SIPINTAR-API]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function warn() {
    try { console.warn.apply(console, ['[SIPINTAR-API]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function uid() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
      if (window.crypto && window.crypto.getRandomValues) {
        var a = new Uint8Array(16); window.crypto.getRandomValues(a);
        return [].map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      }
    } catch (e) {}
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function hasProxy() { return true; }                       /* proxy selalu same-origin */
  function hasDirect() { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/.test(GAS_URL); }

  /** Ubah Date menjadi penanda agar bisa dihidupkan lagi di server. */
  function encode(val) {
    if (val === undefined) return null;
    if (val === null) return null;
    var t = typeof val;
    if (t === 'string' || t === 'number' || t === 'boolean') return val;
    if (t === 'function' || t === 'symbol') return null;
    if (Object.prototype.toString.call(val) === '[object Date]') {
      return isNaN(val.getTime()) ? null : { __sipDate: val.toISOString() };
    }
    if (Object.prototype.toString.call(val) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < val.length; i++) arr.push(encode(val[i]));
      return arr;
    }
    if (t === 'object') {
      var o = {};
      for (var k in val) {
        if (!Object.prototype.hasOwnProperty.call(val, k)) continue;
        o[k] = encode(val[k]);
      }
      return o;
    }
    return null;
  }

  /** Hidupkan kembali {__sipDate} dari server menjadi objek Date asli. */
  function revive(val, depth) {
    depth = depth || 0;
    if (depth > 60 || val === null || typeof val !== 'object') return val;
    if (Object.prototype.toString.call(val) === '[object Array]') {
      for (var i = 0; i < val.length; i++) val[i] = revive(val[i], depth + 1);
      return val;
    }
    var keys = Object.keys(val);
    if (keys.length === 1 && keys[0] === '__sipDate') {
      try { return new Date(String(val.__sipDate)); } catch (e) { return null; }
    }
    for (var j = 0; j < keys.length; j++) val[keys[j]] = revive(val[keys[j]], depth + 1);
    return val;
  }

  function inList(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i] === name) return true;
    return false;
  }

  function isSlow(action) { return inList(SLOW_ACTIONS, action); }
  function canRetry(action) {
    if (inList(NEVER_RETRY, action)) return false;
    return inList(RETRY_SAFE, action);
  }

  function bacaSaluranTersimpan() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.channel && (Date.now() - (o.at || 0)) < 10 * 60 * 1000) {
        MEM.channel = o.channel; MEM.at = o.at || 0;
      }
    } catch (e) {}
  }

  function simpanSaluran(ch) {
    MEM.channel = ch; MEM.at = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ channel: ch, at: MEM.at })); } catch (e) {}
  }

  function saluranUtama() {
    if (MODE === 'direct' && hasDirect()) return 'direct';
    if (MODE === 'proxy') return 'proxy';
    if (MEM.channel && (MEM.channel !== 'direct' || hasDirect())) return MEM.channel;
    if (!hasDirect()) return 'proxy';
    return 'proxy';                       /* default: same-origin (paling aman dari CORS) */
  }

  function saluranCadangan(utama) {
    if (utama === 'proxy' && hasDirect()) return 'direct';
    if (utama === 'direct') return 'proxy';
    return null;
  }

  /* ======================= HTTP ======================= */

  function fetchWithTimeout(url, opts, ms) {
    var ctl = null;
    try { if (typeof AbortController === 'function') ctl = new AbortController(); } catch (e) {}
    var timer = null;
    if (ctl) {
      opts.signal = ctl.signal;
      timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, ms);
    }
    return fetch(url, opts).then(function (res) {
      if (timer) clearTimeout(timer);
      return res;
    }, function (err) {
      if (timer) clearTimeout(timer);
      var habisWaktu = !!(ctl && ctl.signal && ctl.signal.aborted);
      var e2 = new Error(habisWaktu
        ? ('Server tidak merespons dalam ' + Math.round(ms / 1000) + ' detik (timeout).')
        : ((err && err.message) ? err.message : 'Gagal menghubungi server (jaringan/CORS).'));
      e2.__transport = true;
      e2.timeout = habisWaktu;
      e2.cause = err;
      throw e2;
    });
  }

  function pesanHtml(txt) {
    if (/Script function not found|doPost/i.test(txt)) {
      return 'Deploy GAS belum diperbarui: fungsi doPost (API) belum ada di versi yang aktif. ' +
             'Buka Apps Script → Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.';
    }
    if (/accounts\.google\.com|Sign in|Masuk ke|login/i.test(txt) && /<\/html>/i.test(txt)) {
      return 'Server Google meminta login. Ubah deployment menjadi: Execute as = Me, Who has access = Anyone.';
    }
    if (/ScriptError|We're sorry|Exception/i.test(txt)) {
      return 'Terjadi kesalahan di Apps Script. Buka eksekusi terakhir pada menu "Executions" di editor Apps Script.';
    }
    return 'Server mengembalikan HTML, bukan JSON. Periksa URL /exec dan pengaturan akses deployment ' +
           '(Execute as: Me, Who has access: Anyone).';
  }

  /** Kirim satu permintaan ke satu saluran. Mengembalikan Promise<hasil>. */
  function kirim(channel, action, args, opts) {
    var payload = {
      v: VERSION,
      action: action,
      args: args,
      client: { id: opts.cid, url: String(location.href || '').slice(0, 300), tz: zonaWaktu() }
    };
    var body = JSON.stringify(payload);
    var bytes = body.length;

    var url, headers, timeout;
    if (channel === 'proxy') {
      url = PROXY_URL;
      headers = { 'Content-Type': 'text/plain;charset=utf-8', 'X-Sipintar-Action': action };
      timeout = Math.min(opts.timeout, PROXY_MS);
      payload.via = 'proxy';
    } else {
      url = GAS_URL;
      headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      timeout = opts.timeout;
      payload.via = 'direct';
    }
    body = JSON.stringify(payload);

    var init = {
      method: 'POST',
      headers: headers,
      body: body,
      redirect: 'follow',
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store'
    };

    if (channel === 'proxy' && API_BASE && API_BASE.indexOf('http') === 0
        && API_BASE.indexOf(location.origin) !== 0) {
      init.credentials = 'omit';
    }

    return fetchWithTimeout(url, init, timeout).then(function (res) {
      return res.text().then(function (txt) {
        if (!res.ok && !txt) {
          var e = new Error('HTTP ' + res.status + ' dari ' + (channel === 'proxy' ? 'proxy Vercel' : 'Apps Script'));
          e.__transport = true; e.status = res.status;
          throw e;
        }
        var data = null;
        var t = (txt || '').trim();
        if (t && t.charAt(0) === '{') {
          try { data = JSON.parse(t); } catch (eParse) { data = null; }
        }
        if (!data) {
          var e2 = new Error(pesanHtml(t));
          e2.__transport = true; e2.status = res.status; e2.raw = t.slice(0, 400);
          throw e2;
        }
        if (data.ok === false) {
          var e3 = new Error((data.error && data.error.message) || 'Permintaan ditolak server.');
          e3.status = res.status;
          e3.meta = data.meta;
          e3.action = action;
          e3.channel = channel;
          e3.__appError = true;
          throw e3;
        }
        return { data: revive(data.data), meta: data.meta || {}, channel: channel, bytes: bytes };
      });
    });
  }

  function zonaWaktu() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }

  /**
   * sipRequest — inti: pilih saluran, kirim, dan (khusus aksi aman) pindah
   * saluran otomatis bila jalur pertama gagal secara teknis.
   */
  function sipRequest(action, args, opts) {
    opts = opts || {};
    var besar = (opts.bytes || 0) > MAX_PROXY_BYTES;
    var utama = saluranUtama();

    if (besar && hasDirect()) utama = 'direct';
    else if (isSlow(action) && hasDirect() && MODE !== 'proxy') utama = 'direct';

    if (opts.channel) utama = opts.channel;
    if (utama === 'direct' && !hasDirect()) utama = 'proxy';

    var cadangan = (MODE === 'auto') ? saluranCadangan(utama) : null;
    var bolehPindah = cadangan && canRetry(action);

    log('→', action, 'saluran:', utama, bolehPindah ? '(boleh pindah ke ' + cadangan + ')' : '');

    return kirim(utama, action, args, opts).then(function (hasil) {
      if (MEM.channel !== utama) simpanSaluran(utama);      /* hanya bila berubah */
      return hasil;
    }, function (err) {
      if (!bolehPindah) throw err;
      warn(action, 'gagal di', utama, '-', err.message, '→ pindah ke', cadangan);
      return kirim(cadangan, action, args, opts).then(function (hasil) {
        simpanSaluran(cadangan);
        return hasil;
      });
    });
  }

  /* ======================= google.script.run ======================= */

  function Runner() {
    this._ok = null;
    this._fail = null;
    this._user = null;
  }
  Runner.prototype.withSuccessHandler = function (fn) { this._ok = fn; return this; };
  Runner.prototype.withFailureHandler = function (fn) { this._fail = fn; return this; };
  Runner.prototype.withUserObject = function (o) { this._user = o; return this; };

  function jalankan(action, args, runner) {
    var t0 = Date.now();
    var opts = {
      timeout: isSlow(action) ? SLOW_MS : TIMEOUT_MS,
      cid: uid()
    };
    /* Kredensial sesi ditambahkan pada kontrak tulis/penilaian v3. Backend
       lama mengabaikan argumen ekstra; tidak menyimpan token di preferensi. */
    var inputArgs = (args || []).slice(), actor = window.currentUser;
    if (actor && actor.userID && actor.token) {
      if ((action === 'addQuestion' || action === 'updateQuestion') && inputArgs[0] && typeof inputArgs[0] === 'object') {
        inputArgs[0] = Object.assign({}, inputArgs[0], { requestorID: actor.userID, requestorToken: actor.token });
      }
      var authOffset = ({ deleteQuestion:1, deleteQuestionsBulk:1, getStudentAnswerDetail:1, getStudentAnswerDetails:1,
        generateStudentDetailPDF:1, getEssayData:1, saveEssayGrade:2, copyQuestions:2,
        saveImportedQuestions:2, importQuestionsFromForm:2 })[action];
      if (authOffset !== undefined) { inputArgs[authOffset] = actor.userID; inputArgs[authOffset+1] = actor.token; }
      if (action === 'submitExam' || action === 'syncAnswers') inputArgs[4] = actor.token;
      if (action === 'logViolation') inputArgs[6] = actor.token;
    }
    var siapArgs = inputArgs.map(encode);
    try { opts.bytes = JSON.stringify(siapArgs).length; } catch (e) { opts.bytes = 0; }

    /* Peringatan bila nama aksi tidak ada pada daftar resmi (membantu penelusuran) */
    var daftar = window.SIPINTAR_API_ACTIONS;
    if (daftar && daftar.length && daftar.indexOf(action) < 0) {
      warn('"' + action + '" tidak ada pada daftar aksi resmi (web/api-actions.js). ' +
           'Permintaan tetap dikirim; server akan menolaknya bila tidak diizinkan.');
    }

    return sipRequest(action, siapArgs, opts).then(function (hasil) {
      log('✓', action, (Date.now() - t0) + 'ms', hasil.channel);
      if (typeof runner._ok === 'function') {
        try { runner._ok.call(runner._user || null, hasil.data); }
        catch (eCb) { warn('handler sukses error pada', action, eCb); }
      }
      return hasil.data;
    }, function (err) {
      var pesan = (err && err.message) ? err.message : String(err);
      log('✗', action, (Date.now() - t0) + 'ms', pesan);
      var e = new Error(pesan);
      e.name = 'SipintarApiError';
      e.action = action;
      e.channel = err.channel || null;
      e.status = err.status || 0;
      e.meta = err.meta || null;
      e.transport = !!err.__transport;
      if (typeof runner._fail === 'function') {
        try { runner._fail.call(runner._user || null, e); }
        catch (eCb2) { warn('handler gagal error pada', action, eCb2); }
      } else {
        warn('Tidak ada withFailureHandler untuk', action, '→', pesan);
      }
      throw e;
    });
  }

  function buatRunner() {
    var inst = new Runner();
    var NAMA_INTERNAL = {
      withSuccessHandler: 1, withFailureHandler: 1, withUserObject: 1,
      constructor: 1, then: 1, toJSON: 1
    };
    var panggil = function (action, args) { return jalankan(action, args, inst); };

    if (typeof Proxy === 'function') {
      return new Proxy(inst, {
        get: function (target, prop) {
          if (typeof prop === 'symbol') return undefined;
          if (prop === 'then' || prop === 'toJSON' || prop === '$$typeof') return undefined;
          if (NAMA_INTERNAL[prop]) return target[prop];
          var nama = String(prop);
          return function () {
            return panggil(nama, [].slice.call(arguments));
          };
        },
        has: function (target, prop) { return ((prop in target) || typeof prop === 'string'); }
      });
    }
    return inst;                        /* browser sangat lama: lihat daftar aksi di bawah */
  }

  /* Tanpa Proxy (browser kuno) — pasang nama aksi dari daftar statis. */
  function pasangAksiStatis(runner) {
    var daftar = window.SIPINTAR_API_ACTIONS;
    if (!daftar || !daftar.length) return;
    for (var i = 0; i < daftar.length; i++) {
      (function (nama) {
        if (runner[nama]) return;
        runner[nama] = function () { return jalankan(nama, [].slice.call(arguments), runner); };
      })(daftar[i]);
    }
  }

  /* ======================= publik ======================= */

  /** Ringkas pesan galat supaya enak dibaca di layar. */
  function ringkasGalat(msg) {
    var m = String(msg || '');
    if (m === 'timeout/abort' || /tidak merespons dalam/i.test(m)) return 'timeout';
    if (/HTTP 4\d\d|HTTP 5\d\d/.test(m)) return m.match(/HTTP \d+/)[0];
    if (/not valid JSON|bukan JSON|Server mengembalikan HTML/i.test(m)) return 'jawaban bukan JSON';
    if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(m)) return 'jaringan/CORS';
    if (/doPost/i.test(m)) return 'deploy GAS belum diperbarui';
    return m.length > 60 ? m.slice(0, 57) + '…' : m;
  }

  /** Uji SATU saluran (tanpa mengubah saluran aktif). */
  function ujiSaluran(channel, ms) {
    var t0 = Date.now();
    return kirim(channel, 'apiInfo', [], { timeout: ms, cid: uid() }).then(function (r) {
      return { ok: true, channel: channel, ms: Date.now() - t0, info: r.data };
    }, function (e) {
      return {
        ok: false, channel: channel, ms: Date.now() - t0,
        error: (e && e.message) || String(e),
        ringkas: ringkasGalat(e && e.message),
        transport: !!e.__transport, status: (e && e.status) || 0
      };
    });
  }

  /**
   * health() — uji KEDUA saluran SEKALIGUS (paralel) dengan batas waktu pendek.
   * Dipakai portal supaya pengunjung tidak menunggu lama dan tahu penyebabnya.
   */
  function health() {
    var ms = Number(CFG.API_HEALTH_TIMEOUT_MS) || 9000;
    var tugas = [ujiSaluran('proxy', ms)];
    if (hasDirect()) tugas.push(ujiSaluran('direct', ms));

    return Promise.all(tugas).then(function (hasil) {
      var menang = null, i;
      for (i = 0; i < hasil.length; i++) if (hasil[i].ok && hasil[i].channel === 'proxy') menang = hasil[i];
      if (!menang) for (i = 0; i < hasil.length; i++) if (hasil[i].ok) menang = hasil[i];

      if (menang) {
        if (MEM.channel !== menang.channel) simpanSaluran(menang.channel);
        menang.semua = hasil;
        return menang;
      }

      var bagian = [];
      for (i = 0; i < hasil.length; i++) {
        bagian.push((hasil[i].channel === 'proxy' ? 'proxy Vercel' : 'langsung ke Google') + ': ' + hasil[i].ringkas);
      }
      var ms_ = 0;
      for (i = 0; i < hasil.length; i++) ms_ = Math.max(ms_, hasil[i].ms);
      return {
        ok: false, ms: ms_,
        error: bagian.join(' · '),
        transport: true,
        semua: hasil
      };
    });
  }

  /** Nama lama dipertahankan: probe = health (kompatibilitas). */
  function probe() { return health(); }

  function warmup() {
    if (CFG.API_WARMUP === false) return Promise.resolve(null);
    return sipRequest('pingLoginWarm', [], { timeout: 30000, cid: uid() })
      .then(function (h) { return h.data; }, function () { return null; });
  }

  var api = {
    version: VERSION,
    request: sipRequest,
    health: health,
    probe: probe,
    warmup: warmup,
    runner: buatRunner,
    actions: function () { return window.SIPINTAR_API_ACTIONS || null; },
    channel: function () { return MEM.channel || saluranUtama(); },
    setChannel: simpanSaluran,
    resetChannel: function () {
      MEM.channel = null; MEM.at = 0;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    },
    config: function () {
      return {
        api: VERSION, mode: MODE, proxy: PROXY_URL, gas: GAS_URL ? GAS_URL.slice(0, 60) + '…' : '',
        hasProxy: hasProxy(), hasDirect: hasDirect(), timeout: TIMEOUT_MS
      };
    }
  };

  /* --- Pemasangan google.script.run --- */
  window.SIPINTAR_API = api;
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  if (!window.google.script.run) {
    var r = buatRunner();
    if (typeof Proxy !== 'function') pasangAksiStatis(r);
    window.google.script.run = r;
    log('google.script.run (API mode) terpasang v' + VERSION);

    /* TAMBAHAN 15 Okt 2026 — isolasi rantai callback API yang berjalan bersamaan.
       Semua fungsi lama di atas TETAP UTUH. Sebelumnya satu runner dipakai
       bersama: unggahan/notifikasi/dashboard dapat saling menukar handler
       selama menunggu jaringan. Tiap pembacaan google.script.run kini mendapat
       runner sendiri, seperti pola layanan GAS. Native GAS tidak ditimpa.
       Browser tanpa Proxy juga mendapat daftar aksi statis yang sama. */
    try {
      Object.defineProperty(window.google.script, 'run', {
        configurable: true,
        enumerable: true,
        get: function () {
          var baru = buatRunner();
          if (typeof Proxy !== 'function') pasangAksiStatis(baru);
          return baru;
        }
      });
      api.runnerTerisolasi = true;
    } catch (eRunner) {
      /* Peramban yang tidak mengizinkan getter tetap memakai runner lama. */
      api.runnerTerisolasi = false;
    }
  } else {
    log('google.script.run sudah ada — tidak ditimpa.');
  }

  /* --- Pemanasan: kurangi "cold start" Google Apps Script --- */
  bacaSaluranTersimpan();
  try {
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('online', function () { api.resetChannel(); });
    }
    setTimeout(function () { try { warmup(); } catch (e) {} }, 1200);
  } catch (e) {}
})();
