// ========================= HCD2025 | HERO + ABOUT + SPEAKERS + PROGRAM =========================

// ---------- mini logger ----------
const log = (...a) => console.debug('[HCD]', ...a);

// ---------- CSV utils ----------
const csvToObjects = (text = "") => {
  const rows = [];
  let i = 0, inQ = false, cur = "", row = [];
  const pushCell = () => { row.push(cur); cur = ""; };
  const pushRow  = () => { if (row.length) rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === '"') {
      if (inQ && n === '"') { cur += '"'; i += 2; continue; }
      inQ = !inQ; i++; continue;
    }
    if (!inQ && c === ",") { pushCell(); i++; continue; }
    if (!inQ && (c === "\n" || c === "\r")) {
      pushCell(); pushRow();
      if (c === "\r" && n === "\n") i++;
      i++;
      continue;
    }
    cur += c; i++;
  }
  if (cur.length || row.length) { pushCell(); pushRow(); }
  if (!rows.length) return [];

  const header = rows.shift().map(h => (h || "").replace(/\ufeff/g, "").trim());
  return rows
    .filter(r => r.some(v => (v || "").trim() !== ""))
    .map(r => {
      const o = {};
      header.forEach((k, idx) => { o[k] = (r[idx] ?? "").trim(); });
      return o;
    });
};

const fetchText = async (url, timeoutMs = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
};

const fetchCsv       = async (path) => csvToObjects(await fetchText(path));
const fetchCsvStrict = async (path) => {
  const rows = csvToObjects(await fetchText(path));
  return rows.map(r => {
    const o = {};
    Object.entries(r).forEach(([k, v]) => {
      const nk = String(k || '').replace(/\ufeff/g, '').trim();
      o[nk] = (v ?? '').trim();
    });
    return o;
  });
};

// schedule_master 専用ローダー
// HCD2025 用：1行目をヘッダーとしてそのまま使う
const loadScheduleRows = async () => {
  const raw = await fetchText('./data/HCD2025_schedule_master.csv');
  if (!raw) return [];
  return csvToObjects(raw);
};

// ---------- Text maps（HERO/ABOUT/PROGRAM 用） ----------
let _textMapsPromise = null;
const loadTextMaps = async () => {
  if (_textMapsPromise) return _textMapsPromise;
  _textMapsPromise = (async () => {
    const rows = await fetchCsv("./data/HCD2025_LP_text_master.csv");
    const mapText = {}, mapLead = {}, allVals = [];
    rows.forEach(r => {
      const k = (r.key || r.name || r.id || "").trim();
      const t = (r.ja_text || r.text || r.value || r.content || "").trim();
      const l = (r.ja_lead || "").trim();
      if (k) {
        if (t) mapText[k] = t;
        if (l) mapLead[k] = l;
      }
      if (t) allVals.push(t);
      if (l) allVals.push(l);
    });
    return { mapText, mapLead, allVals };
  })();
  return _textMapsPromise;
};

// ======= グローバル：スクロールロック初期解除 =======
const clearScrollLock = () => {
  document.body.classList.remove('no-scroll');
};
document.addEventListener('DOMContentLoaded', clearScrollLock);
window.addEventListener('load', clearScrollLock);

// =============================================================================================
// HERO
// =============================================================================================
(() => {
  const el = {
    title: document.getElementById("hero-title-text"),
    meta : document.getElementById("hero-meta"),
    tag  : document.getElementById("hero-tagline"),
    reg  : document.getElementById("btn-register"),
    ics  : document.getElementById("btn-cal-ics"),
  };
  if (!el.title || !el.meta || !el.tag) return;

  // ★ ここでデフォルトのICSパスを決める（実際のファイル名に合わせて変更）
  const DEFAULT_ICS_URL = "./assets/HCD2025.ics";

  const applyTaglineBreak = (t = "") =>
    window.matchMedia("(max-width: 425px)").matches
      ? t.replace(/(言葉、? *整う。)\s*/u, "$1<br>")
      : t.replace(/\s*<br>\s*/g, "");

  const injectMobileBreakTitle = (s = "") =>
    s.replace(/\s*(\d{4})\s*$/, '<span class="br-sp"></span>$1');

  const injectMobileBreakMeta = (s = "") =>
    s.replace(/(\s+)(\d{1,2}\/\d{1,2}.*)$/u, '$1<span class="br-sp"></span>$2');

  (async () => {
    try {
      const { mapText, allVals } = await loadTextMaps();

      el.title.innerHTML =
        injectMobileBreakTitle(mapText.hero_title_jp || "ホームカミングデー 2025");

      el.meta.innerHTML =
        injectMobileBreakMeta(mapText.hero_meta || "東京校 ／ オンライン ハイブリッド開催 12/14 13:00start");

      const rawTag =
        mapText.hero_tagline ||
        "選択肢、増える。 言葉、整う。 足が、前に出る。 そんな日。";
      el.tag.innerHTML = applyTaglineBreak(rawTag);

      el.reg.textContent = mapText.btn_register || "Peatixで参加申込";
      el.reg.href        = mapText.peatix_url || "https://hcd-tokyo-2025.peatix.com/view";

      let icsLabel = mapText.btn_calendar_ics || "";
      if (!icsLabel) {
        icsLabel =
          allVals.find(v => /ics/i.test(v) || /カレンダー.*追加/u.test(v)) ||
          "カレンダーに追加(.ics)";
      }
      el.ics.textContent = icsLabel;

      // ★ ここでURLを決定：CSV優先、なければデフォルトパス
      const csvIcsUrl = (mapText.calendar_ics_url || "").trim();
      const icsUrl = csvIcsUrl || DEFAULT_ICS_URL;

      if (icsUrl) {
        el.ics.href = icsUrl;
        // ダウンロード用ファイル名（任意）
        el.ics.download = icsUrl.split("/").pop();
      } else {
        // どちらも設定できない場合はボタン非表示（保険）
        el.ics.style.display = "none";
      }

      window.addEventListener(
        "resize",
        () => { el.tag.innerHTML = applyTaglineBreak(rawTag); },
        { passive: true }
      );
    } catch (e) {
      log('HERO error', e);
    }
  })();
})();

// =============================================================================================
// ABOUT
// =============================================================================================
(() => {
  const sec  = document.getElementById("about");
  if (!sec) return;
  const h2   = document.getElementById("about-title");
  const lead = document.getElementById("about-lead");
  const grid = sec.querySelector(".about-cards");

  const applyAboutLeadBreak = (s = "") => {
    const isSP = window.matchMedia("(max-width: 425px)").matches;

    // いったん既存の <br> は全部削除
    let t = s.replace(/\s*<br\s*\/?>\s*/g, "");

    if (isSP) {
      // スマホ専用の改行位置
      t = t
        .replace("ゆるやかに再会し、", "ゆるやかに再会し、<br>")
        .replace("学びと会話が交わる1日。", "学びと会話が交わる1日。<br>")
        // 『…足が前に出る。』 のあとで必ず改行
        .replace(/足が前に出る。』\s*——/, "足が前に出る。』<br>——");
    } else {
      // PC / タブレットは今までどおり1ヶ所だけ
      t = t.replace("学びと会話が交わる1日。", "学びと会話が交わる1日。<br>");
    }

    return t;
  };

  (async () => {
    try {
      const { mapText, mapLead } = await loadTextMaps();
      h2.textContent = mapText.about_title || "Homecoming Dayとは";

      const rawLead = mapText.about_lead || "";
      lead.innerHTML = applyAboutLeadBreak(rawLead);

      grid.innerHTML = "";
      [1, 2, 3].forEach(i => {
        const title = (mapText[`about_tip_${i}`] || "").trim();
        const body  = (mapLead[`about_tip_${i}`] || "").trim();
        if (!title) return;

        const card = document.createElement("div");
        card.className = "about-card";
        const wm = document.createElement("span");
        wm.className = "wm";
        wm.textContent = String(i);
        const h3 = document.createElement("h3");
        h3.textContent = title;
        const p  = document.createElement("p");
        p.textContent  = body;

        card.append(wm, h3, p);
        grid.append(card);
      });

      window.addEventListener(
        "resize",
        () => { lead.innerHTML = applyAboutLeadBreak(rawLead); },
        { passive: true }
      );
    } catch (e) {
      log('ABOUT error', e);
    }
  })();
})();


// =============================================================================================
// SPEAKERS（assets_full 対応版・レイアウトは card--keynote / card--std 方式）
// =============================================================================================
(() => {
  const GRID = document.getElementById('speakers-grid');
  if (!GRID) return;

  const ORDER = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11];
  const KEYNOTE_IDS = new Set([1, 2]);
  const PLACEHOLDER = './assets/placeholder_square.jpg';

  // ---- scroll lock（body だけロック）----
  const setScrollLock = (on) => {
    if (!document.body) return;
    document.body.classList.toggle('no-scroll', !!on);
  };

  // ---- assets_full.csv -> ./assets/<basename> ----
  let _assetPathByNamePromise = null;
  const loadAssetPathByName = async () => {
    if (_assetPathByNamePromise) return _assetPathByNamePromise;
    _assetPathByNamePromise = (async () => {
      const map = {};
      try {
        const rows = await fetchCsv('./data/HCD2025_assets_full.csv');
        rows.forEach(r => {
          const u = (r.url || '').trim();
          if (!u) return;
          const base = u.split('/').pop();
          if (base) map[base] = `./assets/${base}`;
        });
      } catch (_) {}
      return map;
    })();
    return _assetPathByNamePromise;
  };

  const setPhoto = async (imgEl, fileOrUrl) => {
    const base = (fileOrUrl || '').trim().split('/').pop();
    const map  = await loadAssetPathByName();
    const preferred = base ? (map[base] || `./assets/${base}`) : '';

    imgEl.onerror = null;
    if (preferred) {
      try {
        const res = await fetch(preferred, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          imgEl.src = preferred;
          return;
        }
      } catch (_) {}
    }
    imgEl.src = PLACEHOLDER;
  };

  const pick = (row, keys, def = '') => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return def;
  };

  const sanitizeName = (jp, row) =>
    (/^(yes|no)$/i.test(jp) || jp === '') ? pick(row, ['name_jp'], '') : jp;

  // ---- Modal ----
  const MODAL = document.getElementById('speaker-modal');
  const EL = MODAL ? {
    photo:   document.getElementById('modal-photo'),
    name:    document.getElementById('modal-name'),
    aff:     document.getElementById('modal-aff'),
    badges:  document.getElementById('modal-badges'),
    titles:  document.getElementById('modal-titles'),
    bio:     document.getElementById('modal-bio'),
    session: document.getElementById('modal-session')
  } : null;

  const closeModal = () => {
    if (!MODAL) return;
    MODAL.classList.remove('is-open');
    MODAL.setAttribute('aria-hidden', 'true');
    setScrollLock(false);
  };

  if (MODAL) {
    MODAL.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) closeModal();
    });
    const btn = MODAL.querySelector('.modal__close');
    if (btn) btn.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(sp) {
    if (!MODAL || !EL || !sp) return;

    const fullList = window.HCD_SPEAKERS_FULL || [];
    const rich = fullList.find(s => s.id === sp.id) || sp;

    // 画像
    setPhoto(EL.photo, rich.photo_file || rich.photo_url);
    EL.photo.alt = `${rich.name_jp || ''}（${rich.affiliation || ''}）`;

    // 名前・所属
    EL.name.textContent = `${rich.name_jp || ''} / ${rich.name_en || ''}`;
    EL.aff.textContent  = rich.affiliation || '';

    // バッジ＆タイトル
    EL.badges.innerHTML = '';
    EL.titles.innerHTML = '';
    const titles = [rich.title1, rich.title2, rich.title3, rich.title4, rich.title5].filter(Boolean);
    titles.forEach(t => {
      if (/20\d{2}期生/.test(t)) {
        const b = document.createElement('span');
        b.className = 'badge-cohort';
        b.textContent = t;
        EL.badges.appendChild(b);
      } else {
        const div = document.createElement('div');
        div.textContent = t;
        EL.titles.appendChild(div);
      }
    });

    // プロフィール本文
    EL.bio.textContent = rich.bio_ja || rich.bio || '';

    // 登壇セッション（speakers_master の session_titles のみを見る）
    const lines = [];
    const seen  = new Set();

    const selfTitles = Array.isArray(rich.session_titles)
      ? rich.session_titles
      : [];

    selfTitles.forEach(t => {
      const tt = String(t || '').trim();
      if (!tt || seen.has(tt)) return;
      seen.add(tt);
      lines.push(tt);
    });

    if (!lines.length) {
      lines.push('決まり次第ご案内します');
    }

    EL.session.innerHTML = ['登壇セッション', ...lines].join('<br>');
    EL.session.removeAttribute('href');

    MODAL.classList.add('is-open');
    MODAL.setAttribute('aria-hidden', 'false');
    setScrollLock(true);
  }

  window.openModal = openModal;

  const unlockIfClosed = () => {
    if (!MODAL) return;
    if (!MODAL.classList.contains('is-open')) setScrollLock(false);
  };
  ['hashchange', 'resize', 'visibilitychange', 'pageshow', 'popstate'].forEach(ev =>
    window.addEventListener(ev, unlockIfClosed, { passive: true })
  );
  setInterval(unlockIfClosed, 1500);
  unlockIfClosed();

  // ---- カード描画 ----
  (async () => {
    try {
      const rows = await fetchCsvStrict('./data/HCD2025_speakers_master.csv');

      const norm = rows.map(r => {
        const id = Number(pick(r, ['order', 'id'], '0').replace(/[^\d]/g, '')) || 0;
        const name_jp = sanitizeName(pick(r, ['name_jp', 'name_ja', '氏名', '名前'], ''), r);
        const name_en = pick(r, ['name_en', 'name_en_us', 'name_en_gb'], '');
        const affiliation = pick(r, ['affiliation', 'org', 'organization', 'company'], '');

        const session_title_raw = pick(r, ['session_title','session_title_filled'], '');
        const session_titles_self = session_title_raw
          ? session_title_raw
              .split(/[，,／\/\n]/)
              .map(s => s.trim())
              .filter(Boolean)
          : [];

        const session_raw = pick(r, ['session_id', 'Session_ID', 'id'], '');
        const session_ids = session_raw.split(',').map(s => s.trim()).filter(Boolean);

        const session_titles = [];
        const seenTitles = new Set();
        session_titles_self.forEach(tt => {
          const t = tt.trim();
          if (t && !seenTitles.has(t)) {
            seenTitles.add(t);
            session_titles.push(t);
          }
        });

        return {
          id,
          name_jp,
          name_en,
          affiliation,
          title1: pick(r, ['title1'], ''),
          title2: pick(r, ['title2'], ''),
          title3: pick(r, ['title3'], ''),
          title4: pick(r, ['title4'], ''),
          title5: pick(r, ['title5'], ''),
          bio_ja: pick(r, ['bio_ja', 'bio'], ''),
          photo_file: pick(r, ['photo_file', 'photo', 'photo_url'], ''),
          photo_url:  pick(r, ['photo_url'], ''),
          session_ids,
          session_title: session_title_raw,
          session_titles
        };
      });

      const byId = new Map(norm.map(sp => [sp.id, sp]));
      window.HCD_SPEAKERS_BY_ID = byId;
      window.HCD_SPEAKERS_FULL  = norm;

      const ordered = ORDER.map(id => byId.get(id)).filter(Boolean);

      GRID.innerHTML = ''; // フラットにカードを詰める

      const createCard = (sp) => {
        const card = document.createElement('article');
        card.className = 'card ' + (KEYNOTE_IDS.has(sp.id) ? 'card--keynote' : 'card--std');
        card.id = `speaker-${sp.id}`;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${sp.name_jp || '登壇者'} のプロフィールを開く`);

        const imgWrap = document.createElement('div');
        imgWrap.className = 'card__photo-wrap';
        const img = document.createElement('img');
        img.className = 'card__photo';
        setPhoto(img, sp.photo_file || sp.photo_url);
        img.alt = sp.name_jp || '';
        imgWrap.appendChild(img);

        const body = document.createElement('div');
        body.className = 'card__body';
        const nm = document.createElement('h3');
        nm.className = 'card__name';
        nm.textContent = sp.name_jp || '';
        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'card__cta';
        cta.textContent = '詳しく見る';
        body.append(nm, cta);

        card.append(imgWrap, body);

        const handleOpen = () => openModal(sp);
        card.addEventListener('click', handleOpen);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        });
        cta.addEventListener('click', (e) => {
          e.stopPropagation();
          handleOpen();
        });

        return card;
      };

      ordered.forEach(sp => {
        if (!sp) return;
        const card = createCard(sp);
        GRID.append(card);
      });
    } catch (e) {
      log('SPEAKERS error', e);
    }
  })();
})();


// =============================================================================================
// PROGRAM（第1〜3部：テキストマスター＋スケジュール＋登壇者リンク）
// =============================================================================================
(() => {
  const SEC    = document.getElementById('program');
  const TITLE  = document.getElementById('program-title');
  const BLOCKS = document.getElementById('program-blocks');
  if (!SEC || !TITLE || !BLOCKS) return;

  // ローカル pick
  const pick = (row, keys, def='') => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return def;
  };

  const SESSION_NUM = ['①','②','③','④','⑤','⑥'];

  // 休憩バー
  const createBreakBar = (label) => {
    const bar = document.createElement('div');
    bar.className = 'program-break';
    bar.textContent = label || '休憩';
    return bar;
  };

  // 「第◯部」のカードコンテナ
  const createPartCard = (headingText) => {
    const card = document.createElement('section');
    card.className = 'program-card';

    const h3 = document.createElement('h3');
    h3.className = 'program-card__head';
    h3.textContent = headingText;

    const body = document.createElement('div');
    body.className = 'program-card__body';

    card.append(h3, body);
    return { card, body };
  };

  // 第2部のセッションカード
  const createSessionCard = (opts) => {
    const { index, session, speakers } = opts;

    const card = document.createElement('article');
    card.className = 'program-session-card';

    const header = document.createElement('div');
    header.className = 'program-session-card__header';

    const sessionLabel = document.createElement('div');
    sessionLabel.className = 'program-session-card__session-label';
    sessionLabel.textContent = `セッション${SESSION_NUM[index] || ''}`;

    header.append(sessionLabel);
    card.append(header);

    // ---- タイトル決定ロジック ----
    const labelMap = window.HCD_SESSION_TITLE_BY_ID || {};
    const talkMap  = window.HCD_SESSION_TALK_TITLE_BY_ID || {};
    const id = (session.session_id || '').trim();
    const talkFromMap  = id ? (talkMap[id]  || '') : '';
    const labelFromMap = id ? (labelMap[id] || '') : '';

    // schedule 側に入っている講演タイトル（あれば最優先：desc 起点）
    const talkTitleDirect = session.talk_title || '';

    // speakers_master 側から拾えるタイトル（最初の1本）
    const sessionTitleFromSpeakers =
      (speakers || [])
        .map(sp =>
          (sp.session_title && sp.session_title.trim()) ||
          (Array.isArray(sp.session_titles) &&
           sp.session_titles[0] &&
           sp.session_titles[0].trim()) ||
          ''
        )
        .find(Boolean) || '';

    const sessionTitle =
      (talkTitleDirect && talkTitleDirect.trim()) ||
      (talkFromMap && talkFromMap.trim()) ||
      (sessionTitleFromSpeakers && sessionTitleFromSpeakers.trim()) ||
      labelFromMap;

    if (sessionTitle) {
      const titleEl = document.createElement('div');
      titleEl.className = 'program-session-card__title';

      const isIto = speakers.some(sp => sp.name_jp === '伊藤浩孝');
      // 伊藤さんだけ注記をタイトルの末尾に連結
      titleEl.textContent = isIto
        ? `${sessionTitle}　※東京校参加者限定。`
        : sessionTitle;

      card.append(titleEl);
    }

    // 会場
    const track = session.track || (speakers[0]?.track || '');
    if (track) {
      const trackEl = document.createElement('div');
      trackEl.className = 'program-session-card__track';
      trackEl.textContent = `会場：${track}`;
      card.append(trackEl);
    }

    // 登壇者リンク
    const speakersWrap = document.createElement('div');
    speakersWrap.className = 'program-session-card__speakers';

    speakers.forEach(sp => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'program-session-card__speaker-link';
      btn.textContent = sp.name_jp || '';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.openModal) window.openModal(sp);
      });
      speakersWrap.append(btn);
    });

    card.append(speakersWrap);

    return card;
  };

  (async () => {
    try {
      // 1) テキストマスター
      const { mapText } = await loadTextMaps();
      TITLE.textContent =
        mapText.program_section_title || 'Homecoming Day 2025 全体スケジュール';

      // 2) スケジュール（ラベル用＋講演タイトル用を分離）
      const scheduleRowsRaw = await loadScheduleRows();

      const schedule = [];
      const titleBySessionId = {};      // ラベル用（全体講演 / 分科会① など）
      const talkTitleBySessionId = {};  // 講演タイトル用

      scheduleRowsRaw.forEach(r => {
        const session_id = pick(
          r,
          ['session_id', 'Session_ID', 'id', 'ID'],
          ''
        );
        if (!session_id) return;

        // ★ ラベル（「全体講演」「分科会①」など）
        const label = pick(
          r,
          ['title', 'セッション名'],
          ''
        );

        // ★ 実際の講演タイトル（HCD2025 では desc がメイン）
        const talkTitle = pick(
          r,
          ['desc', '概要', 'session_title_filled', 'session_title'],
          ''
        );

        const track = pick(r, ['track', 'room', 'location', '会場'], '');
        const tagsRaw = pick(r, ['tags', 'tag', 'タグ'], '');
        const tags = tagsRaw
          ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean)
          : [];

        const row = {
          ...r,
          session_id,
          title: label,        // ラベルとして使う
          talk_title: talkTitle,
          track,
          tags
        };
        schedule.push(row);

        // セッションID → ラベル
        if (label) {
          titleBySessionId[session_id] = label;
        }

        // セッションID → 講演タイトル
        if (talkTitle) {
          talkTitleBySessionId[session_id] = talkTitle;
        } else if (label) {
          // 講演タイトルが空なら、ラベルで穴埋め
          talkTitleBySessionId[session_id] = label;
        }
      });

      // 3) スピーカー情報：session_id → speaker[]
      const speakerRows = await fetchCsvStrict('./data/HCD2025_speakers_master.csv');
      const bySession = {};

      const normSpeakers = speakerRows.map(r => {
        const id = Number(
          pick(r, ['order','id'], '0').replace(/[^\d]/g,'')
        ) || 0;
        const name_jp = pick(r, ['name_jp','name_ja','氏名','名前'], '');
        const name_en = pick(r, ['name_en','name_en_us','name_en_gb'], '');
        const affiliation = pick(r, ['affiliation','org','organization','company'], '');
        const photo_file = pick(r, ['photo_file','photo','photo_url'], '');
        const photo_url  = pick(r, ['photo_url'], '');
        const bio_ja = pick(r, ['bio_ja','bio'], '');
        const title1 = pick(r, ['title1'], '');
        const title2 = pick(r, ['title2'], '');
        const title3 = pick(r, ['title3'], '');
        const title4 = pick(r, ['title4'], '');
        const title5 = pick(r, ['title5'], '');
        const track  = pick(r, ['track'], '');

        // speakers_master 側に書いてあるセッションタイトル（講演タイトル／補完用）
        const session_title_raw = pick(r, ['session_title','session_title_filled'], '');

        const session_raw = pick(r, ['session_id','Session_ID'], '');
        const session_ids = session_raw
          ? session_raw.split(',').map(s => s.trim()).filter(Boolean)
          : [];

        const session_titles = session_title_raw
          ? session_title_raw
              .split(/[，,／\/\n]/)
              .map(s => s.trim())
              .filter(Boolean)
          : [];

        const sp = {
          id,
          name_jp,
          name_en,
          affiliation,
          photo_file,
          photo_url,
          bio_ja,
          title1, title2, title3, title4, title5,
          track,
          session_ids,
          session_title: session_title_raw,
          session_titles
        };

        // session_id → speaker[] のインデックス & タイトル補完
        session_ids.forEach(sid => {
          if (!sid) return;
          if (!bySession[sid]) bySession[sid] = [];
          bySession[sid].push(sp);

          // ラベルが空なら speakers 側タイトルで補完（第1部など想定）
          if (session_title_raw && !titleBySessionId[sid]) {
            titleBySessionId[sid] = session_title_raw;
          }
          // talkTitle も、schedule 側に無い場合だけ補完
          if (session_title_raw && !talkTitleBySessionId[sid]) {
            talkTitleBySessionId[sid] = session_title_raw;
          }
        });

        return sp;
      });

      // PROGRAM / SPEAKERS / モーダル共通のマップ
      window.HCD_SESSION_TITLE_BY_ID      = titleBySessionId;      // ラベル（全体講演／分科会① など）
      window.HCD_SESSION_TALK_TITLE_BY_ID = talkTitleBySessionId;  // 講演タイトル
      window.HCD_SPEAKERS_FULL           = normSpeakers;

      // ===================================================================
      // 第1部：オープニング＆全体講演
      // ===================================================================
      const part1Title =
        mapText.program_part1_title || '第1部：オープニング＆全体講演（13:00〜14:45）';
      const { card: card1, body: body1 } = createPartCard(part1Title);

      // Keynote セッション（S-KN-03 優先）
      const keynoteRow =
        schedule.find(r => r.session_id === 'S-KN-03') ||
        schedule.find(r => (r.tags || []).includes('Keynote')) ||
        schedule.find(r => /全体講演/.test(r.title || ''));

      // 時間
      const time1 = document.createElement('p');
      time1.className = 'program-part-time';
      time1.textContent =
        mapText.program_part1_time_range || '13:00〜14:45';
      body1.append(time1);

      // 会場
      if (keynoteRow && keynoteRow.track) {
        const trackEl = document.createElement('p');
        trackEl.className = 'program-part-track';
        trackEl.textContent = `会場：${keynoteRow.track}`;
        body1.append(trackEl);
      }

      // オープニングラベル
      const openingLabel = document.createElement('p');
      openingLabel.className = 'program-part-caption';
      openingLabel.textContent =
        mapText.program_legend_opening || 'オープニング';
      body1.append(openingLabel);

      // 全体講演ラベル
      const keynoteLabel = document.createElement('p');
      keynoteLabel.className = 'program-part-caption';
      keynoteLabel.textContent =
        mapText.program_legend_keynote || '全体講演';
      body1.append(keynoteLabel);

      // 全体講演タイトル
      if (keynoteRow && keynoteRow.session_id) {
        const spList = bySession[keynoteRow.session_id] || [];
        const sid    = keynoteRow.session_id;

        // speakers_master 側からのフォールバック
        const keynoteFromSpeakers =
          (spList || [])
            .map(sp =>
              (sp.session_title && sp.session_title.trim()) ||
              (Array.isArray(sp.session_titles) &&
               sp.session_titles[0] &&
               sp.session_titles[0].trim()) ||
              ''
            )
            .find(Boolean) || '';

        const keynoteTitle =
          (window.HCD_SESSION_TALK_TITLE_BY_ID[sid] || '').trim() ||
          keynoteFromSpeakers ||
          (keynoteRow.title || '').trim() ||
          '';

        if (keynoteTitle) {
          const st = document.createElement('p');
          st.className = 'program-session-main-title';
          st.textContent = keynoteTitle;
          body1.append(st);
        }

        // キーノート登壇者ミニカード
        const grid = document.createElement('div');
        grid.className = 'program-speaker-grid';

        spList.forEach(sp => {
          const card = document.createElement('article');
          card.className = 'program-speaker-card';

          const img = document.createElement('img');
          img.className = 'program-speaker-card__photo';
          const base = (sp.photo_file || sp.photo_url || '').split('/').pop();
          img.src = base  ? `./assets/${base}`: './assets/placeholder_square.jpg';
          img.alt = sp.name_jp || '';

          const name = document.createElement('p');
          name.className = 'program-speaker-card__name';
          name.textContent = sp.name_jp || '';
          name.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.openModal) window.openModal(sp);
          });

          card.append(img, name);
          grid.append(card);
        });

        body1.append(grid);
      }

      BLOCKS.append(card1);

      // 休憩①
      BLOCKS.append(
        createBreakBar(mapText.program_break1_label || '休憩（14:45〜15:00）')
      );

      // ===================================================================
      // 第2部：分科会①／分科会②
      // ===================================================================
      const part2Title =
        mapText.program_part2_title ||
        '第2部：分科会①／分科会②（15:00〜17:20）';
      const { card: card2, body: body2 } = createPartCard(part2Title);

      // 分科会① = S-1◯ (Zは除外)
      const breakout1Rows = schedule.filter(r =>
        (r.session_id || '').startsWith('S-1') && !/-Z-/.test(r.session_id)
      );

      const sec1 = document.createElement('section');
      sec1.className = 'program-breakout';

      const h1 = document.createElement('h4');
      h1.className = 'program-breakout__title';
      h1.textContent =
        mapText.program_legend_breakout_part1 ||
        '分科会①（講演／ワークショップ） 15:00〜16:00';
      sec1.append(h1);

      const grid1 = document.createElement('div');
      grid1.className = 'program-session-grid';

      breakout1Rows.forEach((session, idx) => {
        const speakers = bySession[session.session_id] || [];
        grid1.append(
          createSessionCard({
            index: idx,
            session,
            speakers
          })
        );
      });

      sec1.append(grid1);
      body2.append(sec1);

      // 休憩②（内側）
      const breakInner = createBreakBar(
        mapText.program_break2_label || '休憩（16:00〜16:20）'
      );
      breakInner.classList.add('program-break--inner');
      body2.append(breakInner);

      // 分科会② = S-2◯ (Zは除外)
      const breakout2Rows = schedule.filter(r =>
        (r.session_id || '').startsWith('S-2') && !/-Z-/.test(r.session_id)
      );

      const sec2 = document.createElement('section');
      sec2.className = 'program-breakout';

      const h2 = document.createElement('h4');
      h2.className = 'program-breakout__title';
      h2.textContent =
        mapText.program_legend_breakout_part2 ||
        '分科会②（講演／ワークショップ） 16:20〜17:20';
      sec2.append(h2);

      const grid2 = document.createElement('div');
      grid2.className = 'program-session-grid';

      breakout2Rows.forEach((session, idx) => {
        const speakers = bySession[session.session_id] || [];
        grid2.append(
          createSessionCard({
            index: idx,
            session,
            speakers
          })
        );
      });

      sec2.append(grid2);
      body2.append(sec2);

      BLOCKS.append(card2);

      // 休憩③
      BLOCKS.append(
        createBreakBar(mapText.program_break3_label || '休憩（17:20〜17:30）')
      );

      // ===================================================================
      // 第3部：全体懇親会
      // ===================================================================
      const part3Title =
        mapText.program_part3_title || '第3部：全体懇親会（17:30〜19:00）';
      const { card: card3, body: body3 } = createPartCard(part3Title);

      const part3Row =
        schedule.find(r => (r.session_id || '').trim() === 'S-3') ||
        schedule.find(r => /懇親会/.test((r.talk_title || r.title || '')));

      // 時間
      const time3 = document.createElement('p');
      time3.className = 'program-part-time';
      time3.textContent =
        mapText.program_part3_time_range || '17:30〜19:00';
      body3.append(time3);

      // 会場
      const trackText =
        (part3Row && part3Row.track) ||
        mapText.program_part3_track ||
        '';
      if (trackText) {
        const track3 = document.createElement('p');
        track3.className = 'program-part-track';
        track3.textContent = `会場：${trackText}`;
        body3.append(track3);
      }

      BLOCKS.append(card3);
    } catch (e) {
      log('PROGRAM error', e);
    }
  })();
})();


// =============================================================================================
// FAQ（HCD2025_LP_text_master.csv → faq_q1〜faq_q8 / faq_a1〜faq_a8）
// =============================================================================================
(() => {
  const SEC     = document.getElementById('faq');
  const TITLE   = SEC ? SEC.querySelector('.faq-title') : null;
  const LIST    = document.getElementById('faq-list');
  if (!SEC || !LIST) return;

  (async () => {
    try {
      const { mapText } = await loadTextMaps();

      // セクションタイトルを差し替え
      if (TITLE) {
        TITLE.textContent = mapText.faq_section_title || 'よくあるご質問';
      }

      // Q1〜Q8 を順番に生成
      for (let i = 1; i <= 8; i++) {
        const qKey = `faq_q${i}`;
        const aKey = `faq_a${i}`;

        const q = (mapText[qKey] || '').trim();
        const a = (mapText[aKey] || '').trim();
        if (!q) continue;

        // カード全体
        const card = document.createElement('article');
        card.className = 'faq-card';

        // 質問ボタン
        const qBtn = document.createElement('button');
        qBtn.type = 'button';
        qBtn.className = 'faq-card__question';

        const qText = document.createElement('span');
        qText.className = 'faq-card__q-text';
        qText.textContent = `Q. ${q}`;

        const icon = document.createElement('span');
        icon.className = 'faq-card__icon';
        icon.textContent = '＋';

        qBtn.append(qText, icon);

        // 回答
        const aWrap = document.createElement('div');
        aWrap.className = 'faq-card__answer';
        aWrap.hidden = true;

        const aP = document.createElement('p');
        aP.textContent = `A. ${a}`;
        aWrap.appendChild(aP);

        // 開閉処理
        qBtn.addEventListener('click', () => {
          const willOpen = aWrap.hidden;
          aWrap.hidden = !willOpen;              // true → false で表示
          card.classList.toggle('is-open', willOpen);
          icon.textContent = willOpen ? '－' : '＋';
        });

        card.append(qBtn, aWrap);
        LIST.append(card);
      }
    } catch (e) {
      console.error('FAQ error', e);
    }
  })();
})();


// =============================================================================================
// HEADER NAV: hamburger & smooth scroll
// =============================================================================================
(() => {
  const HEADER_OFFSET = 64; // ヘッダー高さぶんオフセット

  const header = document.querySelector('.global-header');
  const menuBtn = document.querySelector('.global-header__menu-btn');
  if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
      const open = header.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ヘッダー内のすべての #リンク（PCナビ＋ドロワーの両方）
  const links = document.querySelectorAll('.global-header a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      // ドロワーを閉じる
      if (header && header.classList.contains('is-open')) {
        header.classList.remove('is-open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
      }

      // スムーズスクロール
      const y = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
})();
