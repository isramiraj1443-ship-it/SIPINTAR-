
/* ==========================================================================
   MATH STUDIO BANK SOAL — TAMBAHAN BARU (permintaan user, 2026-09-29)
   Tombol "∑ Matematika" di editor soal manual (editor-content) dan editor
   opsi jawaban A-E (opt-0..4). Mirip Equation & Symbol di Microsoft Word:
   - Simbol matematika Unicode (dasar, pangkat/akar, geometri, himpunan,
     logika, yunani) — disisipkan sebagai teks, tampil di ujian siswa.
   - Equation builder: pecahan, pecahan campuran, pangkat, akar — disisipkan
     sebagai HTML bergaya inline sehingga tampil benar di soal dan opsi.
   Cara pasang: blok ini MURNI TAMBAHAN. Fungsi initRichEditor dan lain-lain
   tidak diubah — tombol didaftarkan lewat tinymce.ui.registry dan toolbar
   ditambah lewat pembungkus tinymce.init (tanpa mengedit kode lama).
   ========================================================================== */

var SIP_MATH_SYMBOLS_ = {
  dasar: [
    ['+', 'tambah'], ['−', 'tanda kurang / negatif'], ['×', 'kali'], ['÷', 'bagi'], [':', 'perbandingan'],
    ['=', 'sama dengan'], ['≠', 'tidak sama dengan'], ['<', 'lebih kecil'], ['>', 'lebih besar'],
    ['≤', 'lebih kecil atau sama dengan'], ['≥', 'lebih besar atau sama dengan'], ['±', 'plus minus'],
    ['≈', 'kurang lebih'], ['%', 'persen'], ['°', 'derajat'], ['′', 'menit (sudut)'],
    ['″', 'detik (sudut)'], ['(', 'kurung buka'], [')', 'kurung tutup'], ['[', 'kurung siku buka'],
    [']', 'kurung siku tutup'], ['{', 'kurung kurawal buka'], ['}', 'kurung kurawal tutup'],
    ['|', 'garis vertikal / nilai mutlak'], ["'", 'koma desimal']
  ],
  pangkat: [
    ['²', 'pangkat dua'], ['³', 'pangkat tiga'], ['ⁿ', 'pangkat n'], ['√', 'akar kuadrat'],
    ['∛', 'akar pangkat tiga'], ['¼', 'satu per empat'], ['½', 'satu per dua'], ['¾', 'tiga per empat'],
    ['⅓', 'satu per tiga'], ['⅔', 'dua per tiga'], ['⅛', 'satu per delapan'], ['±', 'plus minus'],
    ['∞', 'tak hingga'], ['‰', 'per mil']
  ],
  geometri: [
    ['∠', 'sudut'], ['∡', 'sudut berpanah'], ['∟', 'sudut siku-siku'], ['∥', 'sejajar'],
    ['⊥', 'tegak lurus'], ['△', 'segitiga'], ['▱', 'jajargenjang'], ['▭', 'persegi panjang'],
    ['□', 'persegi'], ['○', 'lingkaran'], ['⌒', 'busur'], ['°', 'derajat'], ['π', 'pi (22/7)'],
    ['▷', 'segitiga siku'], ['◆', 'belah ketupat'], ['⏢', 'trapesium']
  ],
  himpunan: [
    ['∈', 'anggota dari'], ['∉', 'bukan anggota'], ['∋', 'memuat anggota'], ['⊂', 'himpunan bagian'],
    ['⊃', 'memuat'], ['⊆', 'bagian dari / sama'], ['∪', 'irisan gabungan (gabungan)'], ['∩', 'irisan'],
    ['∅', 'himpunan kosong'], ['{', 'kurung himpunan buka'], ['}', 'kurung himpunan tutup'],
    ['ℕ', 'bilangan asli'], ['ℤ', 'bilangan bulat'], ['ℚ', 'bilangan rasional'], ['ℝ', 'bilangan real'],
    ['∁', 'komplemen']
  ],
  logika: [
    ['⇒', 'implikasi'], ['⇔', 'biimplikasi'], ['→', 'panah kanan'], ['←', 'panah kiri'],
    ['↔', 'dua arah'], ['∴', 'karena itu'], ['∵', 'karena'], ['≅', 'kongruen'], ['∼', 'serupa'],
    ['∝', 'sebanding'], ['≡', 'identik'], ['∀', 'untuk semua'], ['∃', 'ada'], ['‖', 'paralel'],
    ['∎', 'tutup pembuktian']
  ],
  yunani: [
    ['α', 'alfa'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'], ['θ', 'theta'], ['λ', 'lambda'],
    ['μ', 'mu'], ['ρ', 'rho'], ['σ', 'sigma'], ['φ', 'fi'], ['ω', 'omega'], ['Δ', 'delta besar'],
    ['Σ', 'sigma besar'], ['Ω', 'omega besar'], ['∑', 'sigma jumlah'], ['∏', 'pi kali'],
    ['∫', 'integral'], ['∂', 'turunan parsial']
  ]
};

var SIP_MATH_TAB_ = 'dasar';

function sipMathEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sipMathFrac_(n, d) {
  return '<span style="display:inline-block;vertical-align:middle;text-align:center;margin:0 2px;line-height:1.15;">' +
    '<span style="display:block;border-bottom:1.6px solid currentColor;padding:0 6px 1px;">' + n + '</span>' +
    '<span style="display:block;padding:1px 6px 0;">' + d + '</span></span>';
}

function sipMathMixed_(b, n, d) {
  return '<span style="margin-right:3px;">' + b + '</span>' + sipMathFrac_(n, d);
}

function sipMathPow_(b, e) {
  return b + '<sup style="font-size:0.72em;">' + e + '</sup>';
}

function sipMathRoot_(idx, r) {
  const pre = idx ? ('<sup style="font-size:0.72em;">' + idx + '</sup>') : '';
  return pre + '√<span style="border-top:1.6px solid currentColor;padding:0 3px;">' + r + '</span>';
}

function sipMathInsert_(html) {
  const ed = (window.tinymce && tinymce.activeEditor) ? tinymce.activeEditor : null;
  const warn = document.getElementById('sip-math-warn');
  if (!ed || typeof ed.insertContent !== 'function') {
    if (warn) {
      warn.textContent = 'Klik dulu di dalam kotak soal / opsi jawaban, lalu sisipkan lagi.';
      setTimeout(function () { if (warn) warn.textContent = ''; }, 3500);
    }
    return;
  }
  ed.insertContent(html);
  try { ed.focus(); } catch (e) {}
}

function sipMathStudioHtml_() {
  const tabs = [
    ['dasar', 'Simbol Dasar'], ['pangkat', 'Pangkat & Akar'], ['geometri', 'Geometri'],
    ['himpunan', 'Himpunan'], ['logika', 'Logika & Relasi'], ['yunani', 'Yunani & Lanjutan'],
    ['eq', 'Equation']
  ];
  let html = '<div style="text-align:left;font-size:14px">' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
    tabs.map(function (t) {
      return '<button type="button" data-sipmat-tab="' + t[0] + '" style="padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;background:' +
        (SIP_MATH_TAB_ === t[0] ? '#1b3a6b;color:#fff' : '#fff') + ';font-size:12px;font-weight:700;cursor:pointer">' + t[1] + '</button>';
    }).join('') + '</div><div id="sip-math-body"></div>' +
    '<p id="sip-math-warn" style="color:#e11d48;font-size:12px;font-weight:700;min-height:16px;margin:6px 0 0"></p></div>';
  return html;
}

function sipMathRenderTab_() {
  const box = document.getElementById('sip-math-body');
  if (!box) return;
  if (SIP_MATH_TAB_ === 'eq') {
    box.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr;gap:10px">' +
      '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc">' +
      '<p style="font-size:12px;font-weight:800;color:#334155;margin-bottom:6px">PECAHAN (a/b)</p>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      '<input id="sip-mat-frac-n" placeholder="pembilang (atas)" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<span style="font-weight:800">/</span>' +
      '<input id="sip-mat-frac-d" placeholder="penyebut (bawah)" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<button type="button" id="sip-mat-frac-go" style="padding:6px 12px;border-radius:8px;border:0;background:#1b3a6b;color:#fff;font-weight:700;font-size:12px;cursor:pointer">Sisipkan</button>' +
      '</div><div class="sip-mat-prev" data-prev="frac" style="margin-top:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;min-height:34px;font-size:15px"></div></div>' +

      '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc">' +
      '<p style="font-size:12px;font-weight:800;color:#334155;margin-bottom:6px">PECAHAN CAMPURAN (w a/b)</p>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      '<input id="sip-mat-mix-w" placeholder="bagian bulat" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<input id="sip-mat-mix-n" placeholder="pembilang" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<input id="sip-mat-mix-d" placeholder="penyebut" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<button type="button" id="sip-mat-mix-go" style="padding:6px 12px;border-radius:8px;border:0;background:#1b3a6b;color:#fff;font-weight:700;font-size:12px;cursor:pointer">Sisipkan</button>' +
      '</div><div class="sip-mat-prev" data-prev="mix" style="margin-top:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;min-height:34px;font-size:15px"></div></div>' +

      '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc">' +
      '<p style="font-size:12px;font-weight:800;color:#334155;margin-bottom:6px">PANGKAT (b<sup>e</sup>)</p>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      '<input id="sip-mat-pow-b" placeholder="basis, contoh: 2x" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<input id="sip-mat-pow-e" placeholder="pangkat, contoh: 2" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<button type="button" id="sip-mat-pow-go" style="padding:6px 12px;border-radius:8px;border:0;background:#1b3a6b;color:#fff;font-weight:700;font-size:12px;cursor:pointer">Sisipkan</button>' +
      '</div><div class="sip-mat-prev" data-prev="pow" style="margin-top:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;min-height:34px;font-size:15px"></div></div>' +

      '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc">' +
      '<p style="font-size:12px;font-weight:800;color:#334155;margin-bottom:6px">AKAR (√ atau ⁿ√)</p>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      '<input id="sip-mat-root-i" placeholder="indeks (kosongkan = akar kuadrat)" style="flex:1;min-width:160px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<input id="sip-mat-root-r" placeholder="isi akar, contoh: x+1" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px">' +
      '<button type="button" id="sip-mat-root-go" style="padding:6px 12px;border-radius:8px;border:0;background:#1b3a6b;color:#fff;font-weight:700;font-size:12px;cursor:pointer">Sisipkan</button>' +
      '</div><div class="sip-mat-prev" data-prev="root" style="margin-top:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;min-height:34px;font-size:15px"></div></div>' +
      '</div>';
    const bindPrev = function (ids, fn) {
      const update = function () {
        const prev = box.querySelector('.sip-mat-prev[data-prev="' + fn + '"]');
        if (!prev) return;
        const vals = ids.map(function (id) { const el = document.getElementById(id); return el ? el.value : ''; });
        prev.innerHTML = window['sipMathBuild_' + fn].apply(null, vals);
      };
      ids.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', update);
      });
    };
    bindPrev(['sip-mat-frac-n', 'sip-mat-frac-d'], 'frac');
    bindPrev(['sip-mat-mix-w', 'sip-mat-mix-n', 'sip-mat-mix-d'], 'mix');
    bindPrev(['sip-mat-pow-b', 'sip-mat-pow-e'], 'pow');
    bindPrev(['sip-mat-root-i', 'sip-mat-root-r'], 'root');
    const on = function (id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('sip-mat-frac-go', function () {
      const n = (document.getElementById('sip-mat-frac-n') || {}).value || '';
      const d = (document.getElementById('sip-mat-frac-d') || {}).value || '';
      if (!n.trim() || !d.trim()) return;
      sipMathInsert_(sipMathFrac_(sipMathEsc_(n.trim()), sipMathEsc_(d.trim())));
    });
    on('sip-mat-mix-go', function () {
      const w = (document.getElementById('sip-mat-mix-w') || {}).value || '';
      const n = (document.getElementById('sip-mat-mix-n') || {}).value || '';
      const d = (document.getElementById('sip-mat-mix-d') || {}).value || '';
      if (!n.trim() || !d.trim()) return;
      sipMathInsert_(sipMathMixed_(sipMathEsc_(w.trim()), sipMathEsc_(n.trim()), sipMathEsc_(d.trim())));
    });
    on('sip-mat-pow-go', function () {
      const b = (document.getElementById('sip-mat-pow-b') || {}).value || '';
      const e = (document.getElementById('sip-mat-pow-e') || {}).value || '';
      if (!b.trim() || !e.trim()) return;
      sipMathInsert_(sipMathPow_(sipMathEsc_(b.trim()), sipMathEsc_(e.trim())));
    });
    on('sip-mat-root-go', function () {
      const i = (document.getElementById('sip-mat-root-i') || {}).value || '';
      const r = (document.getElementById('sip-mat-root-r') || {}).value || '';
      if (!r.trim()) return;
      sipMathInsert_(sipMathRoot_(sipMathEsc_(i.trim()), sipMathEsc_(r.trim())));
    });
    return;
  }
  const syms = SIP_MATH_SYMBOLS_[SIP_MATH_TAB_] || [];
  box.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px">' +
    syms.map(function (s) {
      return '<button type="button" data-sipmat-sym="' + sipMathEsc_(s[0]) + '" title="' + sipMathEsc_(s[1]) + '" ' +
        'style="padding:8px 0;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:18px;cursor:pointer;font-family:Georgia,serif">' +
        sipMathEsc_(s[0]) + '</button>';
    }).join('') + '</div>' +
    '<p style="font-size:11px;color:#64748b;margin:8px 0 0">Klik simbol untuk menyisipkan. Studio tetap terbuka agar bisa menyisipkan banyak simbol.</p>';
}

function sipMathBindStudio_() {
  document.querySelectorAll('[data-sipmat-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      SIP_MATH_TAB_ = btn.getAttribute('data-sipmat-tab');
      document.querySelectorAll('[data-sipmat-tab]').forEach(function (b) {
        const on = b.getAttribute('data-sipmat-tab') === SIP_MATH_TAB_;
        b.style.background = on ? '#1b3a6b' : '#fff';
        b.style.color = on ? '#fff' : '#000';
      });
      sipMathRenderTab_();
    });
  });
  sipMathRenderTab_();
  const body = document.getElementById('sip-math-body');
  if (!body) return;
  body.addEventListener('click', function (ev) {
    const sym = ev.target.closest ? ev.target.closest('[data-sipmat-sym]') : null;
    if (sym) sipMathInsert_(sipMathEsc_(sym.getAttribute('data-sipmat-sym')));
  });
}

function sipOpenMathStudio_() {
  Swal.fire({
    width: 720,
    title: '<span class="text-base font-black text-slate-800">∑ Matematika — Simbol &amp; Equation</span>',
    html: sipMathStudioHtml_(),
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: sipMathBindStudio_
  });
}

/* Pasang tombol "∑ Matematika" ke TinyMCE tanpa mengubah fungsi lama:
   1) daftarkan tombol ke registry TinyMCE;
   2) bungkus tinymce.init agar toolbar editor soal (#editor-content) dan
      editor opsi jawaban (#opt-0..4) otomatis memuat tombol ini. */
(function () {
  function sipMathInstall_() {
    if (!(window.tinymce && tinymce.ui && tinymce.ui.registry && tinymce.init)) {
      setTimeout(sipMathInstall_, 250);
      return;
    }
    if (tinymce._sipMathInstalled) return;
    tinymce._sipMathInstalled = true;
    try {
      tinymce.ui.registry.addButton('sipmathbtn', {
        text: '∑ Matematika',
        tooltip: 'Simbol & Equation Matematika',
        onAction: function () { sipOpenMathStudio_(); }
      });
    } catch (eR) {}
    const origInit = tinymce.init;
    tinymce.init = function (settings) {
      try {
        const sel = String((settings && settings.selector) || '');
        const tb = String((settings && settings.toolbar) || '');
        const isSoal = sel.indexOf('editor-content') >= 0;
        const isOpsi = /#opt-\d/.test(sel);
        if ((isSoal || isOpsi) && tb.indexOf('sipmathbtn') < 0) {
          settings.toolbar = (tb ? tb + ' | ' : '') + 'sipmathbtn';
        }
      } catch (eW) {}
      return origInit.apply(this, arguments);
    };
  }
  sipMathInstall_();
})();
