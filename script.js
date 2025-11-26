// ========================= HCD2025 | HERO + ABOUT + SPEAKERS + PROGRAM =========================

// ---------- mini logger ----------
const log = (...a) => console.debug('[HCD]', ...a);

// ---------- GA4 event helper ----------
const LP_ID = 'HCD2025_Tokyo';

const track = (eventName, params = {}) => {
  // このLP共通で付与したいパラメータをここでマージ
  const baseParams = {
    lp_id: LP_ID,              // このLPを識別するID
    page: location.pathname,   // デフォルトでパスも入れておく
    ...params                  // 呼び出し側の指定があれば上書き
  };

  try {
    if (typeof gtag === 'function') {
      gtag('event', eventName, baseParams);
    } else {
      log('GA not ready', eventName, baseParams);
    }
  } catch (e) {
    log('GA track error', e);
  }
};

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
// 共通：カードのホバー演出
// =============================================================================================
/* CSS 側に追加した想定：
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  transform: translateY(0);
}
.card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
}
*/

// =============================================================================================
// HERO
// =============================================================================================
(() => {
  const el = {
    title:  document.getElementById("hero-title-text"),
    meta:   document.getElementById("hero-meta"),
    tag:    document.getElementById("hero-tagline"),
    reg:    document.getElementById("btn-register"),
    ics:    document.getElementById("btn-cal-ics"),
    notice: document.getElementById("hero-notice-link"),
  };
  if (!el.title || !el.meta || !el.tag) return;

  const DEFAULT_ICS_URL = "./assets/HCD2025.ics";

  const applyTaglineBreak = (t = "") =>
    window.matchMedia("(max-width: 425px)").matches
      ? t.replace(/(言葉、? *整う。)\s*/u, "$1<br>")
      : t.replace(/\s*<br>\s*/g, "");

  const injectMobileBreakMeta = (s = "") =>
    s.replace(/(\s+)(\d{1,2}\/\d{1,2}.*)$/u, '$1<span class="br-sp"></span>$2');

  const formatHeroTitle = (s = "") => {
    const base = (s || "").replace(/\s+/g, " ").trim();
    const isSP = window.matchMedia("(max-width: 425px)").matches;

    if (!isSP) return base;

    let txt = base;
    const yearMatch = txt.match(/(20\d{2})/);
    let year = "";
    if (yearMatch) {
      year = yearMatch[1];
      txt = txt.replace(year, "").trim();
    }

    let campus = "";
    let main = txt;
    if (txt.startsWith("東京校")) {
      campus = "東京校";
      main = txt.replace(/^東京校\s*/, "").trim();
    }

    const lines = [campus, main, year].filter(Boolean);
    return lines.join("<br>");
  };

  (async () => {
    try {
      const { mapText, allVals } = await loadTextMaps();

      if (el.notice) {
        const noticeText =
          (mapText.hero_notice || '').trim() ||
          '＜重要なお知らせ＞オンライン参加 無料化について';
        el.notice.textContent = noticeText;
        el.notice.addEventListener('click', () => {
          track('hero_notice_click', {
            target_id: 'notice-cost',
          });
        });		  
      }

      const heroTitleRaw =
        mapText.hero_title_jp || "東京校 ホームカミングデー 2025";

      const applyHeroTitle = () => {
        el.title.innerHTML = formatHeroTitle(heroTitleRaw);
      };
      applyHeroTitle();

      el.meta.innerHTML =
        injectMobileBreakMeta(
          mapText.hero_meta ||
            "東京校 ／ オンライン ハイブリッド開催 12/14 13:00start"
        );

      const rawTag =
        mapText.hero_tagline ||
        "選択肢、増える。 言葉、整う。 足が、前に出る。 そんな日。";
      el.tag.innerHTML = applyTaglineBreak(rawTag);

      el.reg.textContent =
        mapText.btn_register || "Peatixで参加申込";
      el.reg.href =
        mapText.peatix_url || "https://hcd-tokyo-2025.peatix.com/view";

      el.reg.addEventListener("click", () => {
      track("peatix_click", {
        link_url: el.reg.href,
        position: "hero",
      });
	  });

      let icsLabel = mapText.btn_calendar_ics || "";
      if (!icsLabel) {
        icsLabel =
          allVals.find(
            (v) => /ics/i.test(v) || /カレンダー.*追加/u.test(v)
          ) || "カレンダーに追加(.ics)";
      }
      el.ics.textContent = icsLabel;

      const csvIcsUrl = (mapText.calendar_ics_url || "").trim();
      const icsUrl = csvIcsUrl || DEFAULT_ICS_URL;

      if (icsUrl) {
        el.ics.href = icsUrl;
        el.ics.download = icsUrl.split("/").pop();

        el.ics.addEventListener("click", () => {
          track("calendar_ics_download", {
            file: el.ics.download || icsUrl,
          });
        });
      } else {
        el.ics.style.display = "none";
      }

      window.addEventListener(
        "resize",
        () => {
          el.tag.innerHTML = applyTaglineBreak(rawTag);
          applyHeroTitle();
        },
        { passive: true }
      );
    } catch (e) {
      log("HERO error", e);
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
    let t = s.replace(/\s*<br\s*\/?>\s*/g, "");

    if (isSP) {
      t = t
        .replace("ゆるやかに再会し、", "ゆるやかに再会し、<br>")
        .replace("学びと会話が交わる1日。", "学びと会話が交わる1日。<br>")
        .replace(/足が前に出る。』\s*——/, "足が前に出る。』<br>——");
    } else {
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
		card.classList.add("card-hover");

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

  const setScrollLock = (on) => {
    if (!document.body) return;
    document.body.classList.toggle('no-scroll', !!on);
  };

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

    setPhoto(EL.photo, rich.photo_file || rich.photo_url);
    EL.photo.alt = `${rich.name_jp || ''}（${rich.affiliation || ''}）`;

    EL.name.textContent = `${rich.name_jp || ''} / ${rich.name_en || ''}`;
    EL.aff.textContent  = rich.affiliation || '';

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

    EL.bio.textContent = rich.bio_ja || rich.bio || '';

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

      GRID.innerHTML = '';

      const createCard = (sp) => {
        const card = document.createElement('article');
        card.className = 'card ' + (KEYNOTE_IDS.has(sp.id) ? 'card--keynote' : 'card--std');
		card.classList.add('card-hover');
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

        const handleOpen = () => {
          track('speaker_modal_open', {
            speaker_id: sp.id,
            speaker_name: sp.name_jp || '',
            speaker_affiliation: sp.affiliation || '',
          });
          openModal(sp);
        };

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

  const pick = (row, keys, def='') => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return def;
  };

  const SESSION_NUM = ['①','②','③','④','⑤','⑥'];

  const formatBreakoutTitle = (s = "") => {
    const base = String(s || "").replace(/\s+/g, " ").trim();
    const isSP = window.matchMedia("(max-width: 425px)").matches;
    if (!isSP) return base;

    if (base.startsWith("分科会①")) {
      return "分科会①（講演／ワークショップ）<br>15:00〜16:00";
    }
    if (base.startsWith("分科会②")) {
      return "分科会②（講演／ワークショップ）<br>16:20〜17:20";
    }
    return base;
  };

  const MOBILE_TITLE_RULES = [
    {
      match: (t) => t.includes("分科会①（講演／ワークショップ）15:00〜16:00"),
      html: "分科会①（講演／ワークショップ）<br>15:00〜16:00"
    },
    {
      match: (t) => t.includes("分科会②（講演／ワークショップ）16:20〜17:20"),
      html: "分科会②（講演／ワークショップ）<br>16:20〜17:20"
    },
    {
      match: (t) => t.includes("孤独なき『個の時代』"),
      html: "孤独なき『個の時代』の生存戦略<br>～自己変態理論とは～"
    },
    {
      match: (t) => t.includes("マーケティングが導く企業変革"),
      html: "マーケティングが導く企業変革<br>〜成長と革新のための戦略〜"
    },
    {
      match: (t) => t.includes("GRAが15年で築いた"),
      html: "GRAが15年で築いた<br>『社会課題解決型』<br>ローカルスタートアップの軌跡"
    },
    {
      match: (t) => t.includes("チームビルディングが一気に進む"),
      html: "組織における<br>チームビルディングが<br>一気に進む！<br>「エンゲージメントカード」<br>実践セッション"
    },
    {
      match: (t) => t.includes("速読×時間術で週3日で"),
      html: "【速読×時間術で週3日で<br>1,000万達成！！】<br>「時間と場所に縛られない」<br>パラレルキャリアの創り方"
    },
    {
      match: (t) => t.includes("夢を仕組みに変える！"),
      html: "夢を仕組みに変える！<br>〜マクアケ代表 木内氏が語る<br>ゼロからIPO<br>そしてその先への挑戦の軌跡〜"
    },
    {
      match: (t) => t.includes("新規事業立ち上げ」実践論"),
      html: "【挑戦の熱量を成果に変える】<br>「新規事業立ち上げ」実践論：<br>壁を乗り越え事業創造を駆動する<br>イントレプレナーの実行力と志"
    },
    {
      match: (t) => t.includes("応援される人になるための印象管理"),
      html: "応援される人になるための<br>印象管理～より良い<br>リレーショナルパワーの築き方～"
    },
    {
      match: (t) => t.includes("『デキる』リーダーが知るべき"),
      html: "『デキる』リーダーが知るべき、<br>『気遣い』と『ハラスメント』の<br>境界線<br>"
    }
  ];

  const formatSessionTitle = (title) => {
    const base = String(title || "");
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(max-width: 599px)").matches;

    if (!isMobile) {
      return base.replace(/\r?\n/g, " ");
    }

    for (const rule of MOBILE_TITLE_RULES) {
      if (rule.match(base)) {
        return rule.html;
      }
    }

    return base.replace(/\r?\n/g, "<br>");
  };

  const createBreakBar = (label) => {
    const bar = document.createElement('div');
    bar.className = 'program-break';
    bar.textContent = label || '休憩';
    return bar;
  };

  const createPartCard = (headingText) => {
    const card = document.createElement('section');
    card.className = 'program-card';
	card.classList.add('card-hover');

    const h3 = document.createElement('h3');
    h3.className = 'program-card__head';
    h3.textContent = headingText;

    const body = document.createElement('div');
    body.className = 'program-card__body';

    card.append(h3, body);
    return { card, body };
  };

  const createSessionCard = (opts) => {
    const { index, session, speakers } = opts;

    const card = document.createElement('article');
    card.className = 'program-session-card';
	card.classList.add('card-hover');

    const header = document.createElement('div');
    header.className = 'program-session-card__header';

    const sessionLabel = document.createElement('div');
    sessionLabel.className = 'program-session-card__session-label';
    sessionLabel.textContent = `セッション${SESSION_NUM[index] || ''}`;

    header.append(sessionLabel);
    card.append(header);

    const labelMap = window.HCD_SESSION_TITLE_BY_ID || {};
    const talkMap  = window.HCD_SESSION_TALK_TITLE_BY_ID || {};
    const id = (session.session_id || '').trim();
    const talkFromMap  = id ? (talkMap[id]  || '') : '';
    const labelFromMap = id ? (labelMap[id] || '') : '';

    const talkTitleDirect =
      session.talk_title ||
      session.session_title ||
      '';

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
      titleEl.innerHTML = formatSessionTitle(sessionTitle);
      card.append(titleEl);
    }

    const track = session.track || (speakers[0]?.track || '');
    if (track) {
      const trackEl = document.createElement('div');
      trackEl.className = 'program-session-card__track';
      trackEl.textContent = `会場：${track}`;
      card.append(trackEl);
    }

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

    const pillTags = session.tagPills || [];
    if (pillTags.length) {
      const tagWrap = document.createElement('div');
      tagWrap.className = 'program-session-card__tags';

      pillTags.slice(0, 2).forEach(t => {
        const pill = document.createElement('span');
        pill.className = 'program-session-card__tag-pill';
        pill.textContent = t;
        tagWrap.append(pill);
      });

      card.append(tagWrap);
    }

    return card;
  };

  (async () => {
    try {
      const { mapText } = await loadTextMaps();
      TITLE.textContent =
        mapText.program_section_title || 'Homecoming Day 2025 全体スケジュール';

      const scheduleRowsRaw = await loadScheduleRows();

      const schedule = [];
      const titleBySessionId = {};
      const talkTitleBySessionId = {};

      scheduleRowsRaw.forEach(r => {
        const session_id = pick(
          r,
          ['session_id', 'Session_ID', 'id', 'ID'],
          ''
        );
        if (!session_id) return;

        const label = pick(
          r,
          ['title', 'セッション名'],
          ''
        );

        const talkTitle = pick(
          r,
          ['desc', '概要', 'session_title'],
          ''
        );

        const track = pick(r, ['track', 'room', 'location', '会場'], '');

        const tagsRaw = pick(r, ['tags', 'タグ'], '');
        const tag1    = pick(r, ['tag1', 'tag_1', 'タグ1'], '');
        const tag2    = pick(r, ['tag2', 'tag_2', 'タグ2'], '');

        const tags = tagsRaw
          ? tagsRaw.split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [];

        const tagPills = [];
        if (tag1) tagPills.push(tag1);
        if (tag2) tagPills.push(tag2);

        const row = {
          ...r,
          session_id,
          title: label,
          talk_title: talkTitle,
          track,
          tags,
          tagPills
        };
        schedule.push(row);

        if (label) {
          titleBySessionId[session_id] = label;
        }
        if (talkTitle) {
          talkTitleBySessionId[session_id] = talkTitle;
        } else if (label) {
          talkTitleBySessionId[session_id] = label;
        }
      });

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

        const session_title_raw = pick(r, ['session_title'], '');

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

        session_ids.forEach(sid => {
          if (!sid) return;
          if (!bySession[sid]) bySession[sid] = [];
          bySession[sid].push(sp);

          if (session_title_raw && !titleBySessionId[sid]) {
            titleBySessionId[sid] = session_title_raw;
          }
          if (session_title_raw && !talkTitleBySessionId[sid]) {
            talkTitleBySessionId[sid] = session_title_raw;
          }
        });

        return sp;
      });

      window.HCD_SESSION_TITLE_BY_ID      = titleBySessionId;
      window.HCD_SESSION_TALK_TITLE_BY_ID = talkTitleBySessionId;
      window.HCD_SPEAKERS_FULL            = normSpeakers;

      // ---------- 第1部 ----------
      const part1Title =
        mapText.program_part1_title || '第1部：オープニング＆全体講演（13:00〜14:45）';
      const { card: card1, body: body1 } = createPartCard(part1Title);

      const keynoteRow =
        schedule.find(r => r.session_id === 'S-KN-03') ||
        schedule.find(r => (r.tags || []).includes('Keynote')) ||
        schedule.find(r => /全体講演/.test(r.title || ''));

      const time1 = document.createElement('p');
      time1.className = 'program-part-time';
      time1.textContent =
        mapText.program_part1_time_range || '13:00〜14:45';
      body1.append(time1);

      if (keynoteRow && keynoteRow.track) {
        const trackEl = document.createElement('p');
        trackEl.className = 'program-part-track';
        trackEl.textContent = `会場：${keynoteRow.track}`;
        body1.append(trackEl);
      }

      const openingLabel = document.createElement('p');
      openingLabel.className = 'program-part-caption';
      openingLabel.textContent =
        mapText.program_legend_opening || 'オープニング';
      body1.append(openingLabel);

      const keynoteLabel = document.createElement('p');
      keynoteLabel.className = 'program-part-caption';
      keynoteLabel.textContent =
        mapText.program_legend_keynote || '全体講演';
      body1.append(keynoteLabel);

      if (keynoteRow && keynoteRow.session_id) {
        const spList = bySession[keynoteRow.session_id] || [];
        const sid    = keynoteRow.session_id;

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
          st.innerHTML = formatSessionTitle(keynoteTitle);
          body1.append(st);
        }
        const grid = document.createElement('div');
        grid.className = 'program-speaker-grid';

        spList.forEach(sp => {
          const card = document.createElement('article');
          card.className = 'program-speaker-card';
          card.classList.add('card-hover');

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

      // ---------- 休憩① ----------
      BLOCKS.append(
        createBreakBar(mapText.program_break1_label || '休憩（14:45〜15:00）')
      );

      // ---------- 第2部：分科会 ----------
      const part2Title =
        mapText.program_part2_title ||
        '第2部：分科会①／分科会②（15:00〜17:20）';
      const { card: card2, body: body2 } = createPartCard(part2Title);

      card2.classList.add('program-card--part2');

      const breakoutTitle1 =
        mapText.program_legend_breakout_part1 ||
        '分科会①（講演／ワークショップ） 15:00〜16:00';
      const breakoutTitle2 =
        mapText.program_legend_breakout_part2 ||
        '分科会②（講演／ワークショップ） 16:20〜17:20';

      const breakout1Rows = schedule.filter(r =>
        (r.session_id || '').startsWith('S-1') && !/-Z-/.test(r.session_id)
      );

      const sec1 = document.createElement('section');
      sec1.className = 'program-breakout';

      const h1 = document.createElement('h4');
      h1.className = 'program-breakout__title';
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

      const breakInner = createBreakBar(
        mapText.program_break2_label || '休憩（16:00〜16:20）'
      );
      breakInner.classList.add('program-break--inner');
      body2.append(breakInner);

      const breakout2Rows = schedule.filter(r =>
        (r.session_id || '').startsWith('S-2') && !/-Z-/.test(r.session_id)
      );

      const sec2 = document.createElement('section');
      sec2.className = 'program-breakout';

      const h2 = document.createElement('h4');
      h2.className = 'program-breakout__title';
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

      const applyBreakoutTitles = () => {
        h1.innerHTML = formatBreakoutTitle(breakoutTitle1);
        h2.innerHTML = formatBreakoutTitle(breakoutTitle2);
      };
      applyBreakoutTitles();

      window.addEventListener('resize', applyBreakoutTitles, { passive: true });

      BLOCKS.append(card2);

      // ---------- 休憩③ ----------
      BLOCKS.append(
        createBreakBar(mapText.program_break3_label || '休憩（17:20〜17:30）')
      );

      // ---------- 第3部 ----------
      const part3Title =
        mapText.program_part3_title || '第3部：全体懇親会（17:30〜19:00）';
      const { card: card3, body: body3 } = createPartCard(part3Title);

      const part3Row =
        schedule.find(r => (r.session_id || '').trim() === 'S-3') ||
        schedule.find(r => /懇親会/.test(
          (r.talk_title || r.title || '')
        ));

      const time3 = document.createElement('p');
      time3.className = 'program-part-time';
      time3.textContent =
        mapText.program_part3_time_range || '17:30〜19:00';
      body3.append(time3);

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
// NOTICE（参加費変更のお知らせセクション）
// =============================================================================================
(() => {
  const SEC   = document.getElementById('notice-cost');
  const TITLE = document.getElementById('notice-title');
  const LEAD  = document.getElementById('notice-lead');
  const BODY  = document.getElementById('notice-body');
  const CHG_TITLE  = document.getElementById('notice-change-title');
  const CHG_BEFORE = document.getElementById('notice-change-before');
  const CHG_AFTER  = document.getElementById('notice-change-after');
  const FAQ_TITLE  = document.getElementById('notice-faq-title');
  const FAQ_LIST   = document.getElementById('notice-faq-list');

  if (!SEC) return;

  (async () => {
    try {
      const { mapText } = await loadTextMaps();

      if (TITLE) {
        const rawTitle =
          (mapText.notice_title || '').trim() ||
          '＜重要なお知らせ＞<br>オンライン参加 無料化について';
        TITLE.innerHTML = rawTitle;
      }

      if (LEAD) {
        LEAD.textContent =
          (mapText.notice_lead || '').trim() ||
          '本イベントでは、オンライン参加の参加費を無料とさせていただきました。';
      }

      if (BODY) {
        const body = (mapText.notice_body || '').trim();
        if (body) {
          BODY.innerHTML = body;
        }
      }

      const formatChangeText = (src, fallback) => {
        const raw = (src && src.trim()) || fallback || "";
        const lines = raw
          .split(/\r?\n/)
          .map(s => s.trim())
          .filter(Boolean);
        if (!lines.length) return "";

        const title  = lines[0];
        const bodies = lines.slice(1);

        const isMobile = window.matchMedia("(max-width: 599px)").matches;

        if (isMobile) {
          return [title, ...bodies].join("<br>");
        } else {
          const joined = bodies.join("／");
          return `${title}<br>${joined}`;
        }
      };

      if (CHG_TITLE) {
        CHG_TITLE.textContent =
          (mapText.notice_change_title || '').trim() ||
          '参加費に関する変更内容について';
      }

      if (CHG_BEFORE) {
        CHG_BEFORE.innerHTML = formatChangeText(
          mapText.notice_change_before,
          `【変更前】
東京校でのご参加の方：1,000円
オンラインでのご参加の方：1,000円`
        );
      }

      if (CHG_AFTER) {
        CHG_AFTER.innerHTML = formatChangeText(
          mapText.notice_change_after,
          `【変更後】
東京校でのご参加の方：1,000円
オンラインでのご参加の方：無料`
        );
        CHG_AFTER.classList.add('notice-change__after');
      }

      if (FAQ_TITLE) {
        FAQ_TITLE.textContent =
          (mapText.notice_faq_title || '').trim() ||
          '参加費変更に伴うよくあるご質問';
      }

      if (FAQ_LIST) {
        const groups = [
          { code: 'online', titleKey: 'notice_faq_cat_online_title' },
          { code: 'real',   titleKey: 'notice_faq_cat_real_title' },
        ];

        groups.forEach(group => {
          const titleText = (mapText[group.titleKey] || '').trim();
          if (!titleText) return;

          const catWrap = document.createElement('section');
          catWrap.className = 'notice-faq-category';

          const catTitle = document.createElement('h4');
          catTitle.className = 'notice-faq-category-title';
          catTitle.textContent = titleText;

          const catList = document.createElement('div');
          catList.className = 'notice-faq-category-list';

          for (let i = 1; i <= 10; i++) {
            const qKey = `notice_faq_${group.code}_q${i}`;
            const aKey = `notice_faq_${group.code}_a${i}`;
            const q = (mapText[qKey] || '').trim();
            const a = (mapText[aKey] || '').trim();
            if (!q) continue;

            const card = document.createElement('article');
            card.className = 'faq-card';
            card.classList.add('card-hover');

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

            const aWrap = document.createElement('div');
            aWrap.className = 'faq-card__answer';
            aWrap.hidden = true;

            const aP = document.createElement('p');
            aP.textContent = a ? `A. ${a}` : '';
            aWrap.appendChild(aP);

            qBtn.addEventListener('click', () => {
              const willOpen = aWrap.hidden;
              aWrap.hidden = !willOpen;
              card.classList.toggle('is-open', willOpen);
              icon.textContent = willOpen ? '－' : '＋';

              if (willOpen) {
                track('notice_faq_open', {
                  category: group.code, // 'online' or 'real'
                  index: i,             // 1〜10
                  question: q
                });
              }
            });

            card.append(qBtn, aWrap);
            catList.append(card);
          }

          if (catList.children.length === 0) return;

          catWrap.append(catTitle, catList);
          FAQ_LIST.append(catWrap);
        });

        const wrap = document.querySelector('.notice-wrap');
        if (wrap && BODY) {
          const changeEl = document.querySelector('.notice-change');
          const faqEl    = document.querySelector('.notice-faq');

          if (changeEl || faqEl || BODY.textContent.trim()) {
            const detail = document.createElement('div');
            detail.className = 'notice-detail is-collapsed';

            if (BODY.parentElement === wrap) {
              detail.appendChild(BODY);
            }
            if (changeEl && changeEl.parentElement === wrap) {
              detail.appendChild(changeEl);
            }
            if (faqEl && faqEl.parentElement === wrap) {
              detail.appendChild(faqEl);
            }

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'notice-toggle';
            toggle.innerHTML = `
              <span class="notice-toggle-icon">∨</span>
              <span class="notice-toggle-label">さらに詳しく</span>
            `;

            toggle.addEventListener('click', () => {
              const willOpen = detail.classList.contains('is-collapsed');
              detail.classList.toggle('is-collapsed', !willOpen);
              toggle.classList.toggle('is-open', willOpen);

              const label = toggle.querySelector('.notice-toggle-label');
              if (label) {
                label.textContent = willOpen ? '閉じる' : 'さらに詳しく';
              }

              track('notice_detail_toggle', {
                state: willOpen ? 'open' : 'close'
              });
            });

            if (LEAD && LEAD.parentElement === wrap) {
              wrap.insertBefore(toggle, LEAD.nextSibling);
              wrap.insertBefore(detail, toggle.nextSibling);
            } else {
              const ref =
                TITLE && TITLE.parentElement === wrap
                  ? TITLE.nextSibling
                  : wrap.firstChild;
              wrap.insertBefore(toggle, ref);
              wrap.insertBefore(detail, toggle.nextSibling);
            }
          }
        }
      }
    } catch (e) {
      console.error('NOTICE error', e);
    }
  })();
})();

// =============================================================================================
// FAQ（HCD2025_LP_text_master.csv → faq_q1〜faq_q15 / faq_a1〜faq_a15）
// =============================================================================================
(() => {
  const SEC   = document.getElementById('faq');
  const TITLE = SEC ? SEC.querySelector('.faq-title') : null;
  const LIST  = document.getElementById('faq-list');
  if (!SEC || !LIST) return;

  (async () => {
    try {
      const { mapText } = await loadTextMaps();

      if (TITLE) {
        TITLE.textContent = mapText.faq_section_title || 'よくあるご質問';
      }

      for (let i = 1; i <= 15; i++) {
        const qKey = `faq_q${i}`;
        const aKey = `faq_a${i}`;

        const q = (mapText[qKey] || '').trim();
        const a = (mapText[aKey] || '').trim();
        if (!q) continue;

        const card = document.createElement('article');
        card.className = 'faq-card';
        card.classList.add('card-hover');

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

        const aWrap = document.createElement('div');
        aWrap.className = 'faq-card__answer';
        aWrap.hidden = true;

        const aP = document.createElement('p');
        aP.textContent = `A. ${a}`;
        aWrap.appendChild(aP);

        qBtn.addEventListener('click', () => {
          const willOpen = aWrap.hidden;
          aWrap.hidden = !willOpen;
          card.classList.toggle('is-open', willOpen);
          icon.textContent = willOpen ? '－' : '＋';

          if (willOpen) {
            track('faq_open', {
              faq_index: i,
              faq_question: q,
            });
          }
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
  const HEADER_OFFSET = 64;

  const header = document.querySelector('.global-header');
  const menuBtn = document.querySelector('.global-header__menu-btn');

  const headerCta = document.querySelector('.global-header__cta');
  if (headerCta) {
    headerCta.addEventListener('click', () => {
      track('peatix_click', {
        link_url: headerCta.href,
        position: 'header',
      });
    });
  }

  // ハンバーガー開閉
  if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
      const open = header.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  track('global_nav_toggle', {
        state: open ? 'open' : 'close',
      });
    });
  }
  // ナビ内アンカーのスムーススクロール
  const links = document.querySelectorAll('.global-header a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      if (header && header.classList.contains('is-open')) {
        header.classList.remove('is-open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
      }

      const y = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // ▼ ここから追加：スクロールしたら .is-scrolled を付ける
  if (header) {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      header.classList.toggle('is-scrolled', y > 20);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // 初期状態も反映
  }
})();

// =============================================================================================
// VOICES（HCDの声 / G会の声）
// =============================================================================================
(() => {
  const secH   = document.getElementById('voices-hcd');
  const secG   = document.getElementById('voices-gkai');
  if (!secH && !secG) return;

  const gridH  = document.getElementById('voices-hcd-grid');
  const gridG  = document.getElementById('voices-gkai-grid');

  const titleH = document.getElementById('voices-hcd-title');
  const subH   = document.getElementById('voices-hcd-sub');
  const titleG = document.getElementById('voices-gkai-title');
  const subG   = document.getElementById('voices-gkai-sub');

  const PLACEHOLDER = './assets/placeholder_square.jpg';

  const safe = (v) => (v == null ? '' : String(v).trim());

  const formatVoicesTitle = (kind, text = "") => {
    const base = safe(text);
    const isSP =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(max-width: 480px)').matches;

    if (!isSP) return base;

    if (kind === 'gkai') {
      return base.replace(
        'グロービス経営大学院卒業生ネットワーク『G会』',
        'グロービス経営大学院<br>卒業生ネットワーク<br>『G会』'
      );
    }

    return base;
  };

  const equalizeVoiceCardHeights = () => {
    const cards = document.querySelectorAll('.voice-card');
    if (!cards.length) return;

    cards.forEach((card) => {
      card.style.height = 'auto';
    });

    const mq = window.matchMedia('(min-width: 600px)');
    if (!mq.matches) return;

    let maxH = 0;
    cards.forEach((card) => {
      const h = card.offsetHeight;
      if (h > maxH) maxH = h;
    });

    cards.forEach((card) => {
      card.style.height = `${maxH}px`;
    });
  };

  const createCard = (row, mode) => {
    const name    = safe(row.person_name);
    const tagline = safe(row.person_tagline);
    const photo   = safe(row.photo_file);

    const title =
      mode === 'hcd'
        ? safe(row.voice_hcd_title)
        : safe(row.voice_gkai_title);

    const body =
      mode === 'hcd'
        ? safe(row.voice_hcd_body)
        : safe(row.voice_gkai_body);

    if (!title && !body) return null;

    const card = document.createElement('article');
    card.className = 'voice-card card-hover';

    const head = document.createElement('div');
    head.className = 'voice-card__head';

    const photoWrap = document.createElement('div');
    photoWrap.className = 'voice-card__photo-wrap';

    const img = document.createElement('img');
    img.className = 'voice-card__photo';
    img.src = photo ? `./assets/${photo}` : PLACEHOLDER;
    img.alt = name || '参加者';
    img.onerror = () => {
      img.onerror = null;
      img.src = PLACEHOLDER;
    };

    photoWrap.appendChild(img);

    const headText = document.createElement('div');

    const nameEl = document.createElement('p');
    nameEl.className = 'voice-card__name';
    nameEl.textContent = name;

    const tagEl = document.createElement('p');
    tagEl.className = 'voice-card__tagline';
    tagEl.textContent = tagline;

    headText.append(nameEl, tagEl);
    head.append(photoWrap, headText);

    const titleEl = document.createElement('h3');
    titleEl.className = 'voice-card__title';
    titleEl.textContent = title;

    const bodyEl = document.createElement('p');
    bodyEl.className = 'voice-card__body';
    bodyEl.textContent = body;

    card.append(head, titleEl, bodyEl);
    return card;
  };

  const formatVoicesSub = (kind, text = "") => {
    const base = String(text || "");
    const isSP =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(max-width: 480px)").matches;

    if (!isSP) return base;

    let t = base;

    if (kind === "hcd") {
      t = t.replace(
        "幅広い期・多様なバックグラウンドの",
        "幅広い期・多様なバックグラウンドの<br>"
      );
      t = t.replace(
        "卒業生と事務局の方に、",
        "卒業生と事務局の方に、<br>"
      );
      t = t.replace(
        "印象に残っているシーンなど、",
        "印象に残っているシーンなど、<br>"
      );
    } else if (kind === "gkai") {
      t = t.replace(
        "『タテ・ヨコ・ナナメのゆるいつながりを作る』",
        "『タテ・ヨコ・ナナメのゆるいつながりを作る』<br>"
      );
      t = t.replace(
        "G会は、<br>卒業生全員が",
        "G会は、卒業生全員が"
      );
      t = t.replace(
        "卒業生全員がメンバーとするグロービス",
        "卒業生全員がメンバーとするグロービス<br>"
      );
      t = t.replace(
        "アルムナイネットワークです。",
        "アルムナイネットワークです。<br>"
      );
      t = t.replace(
        "挑戦を応援し合う仲間、",
        "挑戦を応援し合う仲間、<br>"
      );
      t = t.replace(
        "あなたにとってG会とはどんな存在か？",
        "あなたにとってG会とはどんな存在か？<br>"
      );
    }
    return t;
  };

  const setupVoicesObserver = () => {
    if (typeof window === 'undefined') return;

    const cards = document.querySelectorAll('.voice-card');
    if (!cards.length) return;

    if (!('IntersectionObserver' in window)) {
      cards.forEach((card) => {
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    cards.forEach((card) => observer.observe(card));
  };

  (async () => {
    try {
      const { mapText } = await loadTextMaps();

      const rawTitleH =
        safe(mapText.voices_hcd_title) || 'ホームカミングデーの思い出';
      const rawTitleG =
        safe(mapText.voices_gkai_title) || 'グロービス卒業生ネットワーク『G会』';

      const applyVoicesTitles = () => {
        if (titleH) {
          titleH.innerHTML = formatVoicesTitle('hcd', rawTitleH);
        }
        if (titleG) {
          titleG.innerHTML = formatVoicesTitle('gkai', rawTitleG);
        }
      };
      applyVoicesTitles();
      window.addEventListener('resize', applyVoicesTitles, { passive: true });

      const rawSubH = safe(mapText.voices_hcd_sub);
      const rawSubG = safe(mapText.voices_gkai_sub);

      if (subH) {
        const applySubH = () => {
          const txt =
            rawSubH ||
            'これまでのHomecoming Dayに参加した卒業生の声をご紹介します。';
          subH.innerHTML = formatVoicesSub("hcd", txt);
        };
        applySubH();
        window.addEventListener("resize", applySubH, { passive: true });
      }

      if (subG) {
        const applySubG = () => {
          const txt =
            rawSubG ||
            'G会や卒業生コミュニティへの想いを、卒業生のみなさんに伺いました。';
          subG.innerHTML = formatVoicesSub("gkai", txt);
        };
        applySubG();
        window.addEventListener("resize", applySubG, { passive: true });
      }

      const rows = await fetchCsvStrict('./data/HCD2025_voices_master.csv');

      const sorted = rows
        .map((r) => ({
          ...r,
          orderNum: Number(safe(r.order).replace(/[^\d]/g, '')) || 9999,
        }))
        .sort((a, b) => a.orderNum - b.orderNum);

      if (secH && gridH) {
        sorted.forEach((row) => {
          const card = createCard(row, 'hcd');
          if (card) {
            gridH.appendChild(card);
          }
        });
      }

      if (secG && gridG) {
        sorted.forEach((row) => {
          const card = createCard(row, 'gkai');
          if (card) {
            gridG.appendChild(card);
          }
        });
      }

      equalizeVoiceCardHeights();

      window.addEventListener('resize', equalizeVoiceCardHeights, {
        passive: true,
      });

      setupVoicesObserver();

    } catch (e) {
      console.error('VOICES error', e);
    }
  })();
})();

// =============================================================================================
// FOOTER：Facebookリンクのクリック計測
// =============================================================================================
(() => {
  const fbLink = document.querySelector('.site-footer__fb');
  if (!fbLink) return;

  fbLink.addEventListener('click', () => {
    track('footer_facebook_click', {
      link_url: fbLink.href,
      position: 'footer',
    });
  });
})();

// =============================================================================================
// SECTION VIEW tracking（各セクションが初めて 40% 以上見えたタイミングで計測）
// =============================================================================================
(() => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return;
  }

  const targets = [
    { id: 'hero',        name: 'hero' },
    { id: 'about',       name: 'about' },
    { id: 'notice-cost', name: 'notice_cost' },
    { id: 'program',     name: 'program' },
    { id: 'speakers',    name: 'speakers' },
    { id: 'voices-hcd',  name: 'voices_hcd' },
    { id: 'faq',         name: 'faq' },
    { id: 'access',      name: 'access' },
    { id: 'voices-gkai', name: 'voices_gkai' }
  ];

  const seen = new Set();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        const conf = targets.find(t => t.id === id);
        if (!conf || seen.has(conf.name)) return;

        seen.add(conf.name);

        track('section_view', {
          section: conf.name,
        });

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.4
    }
  );

  targets.forEach((t) => {
    const el = document.getElementById(t.id);
    if (el) observer.observe(el);
  });
})();
