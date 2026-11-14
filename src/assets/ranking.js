// דירוג השחקנים: ציור הטבלה, הסינונים והעמוד של שחקן, מתוך ranking/data.json.
import { FAMILIES, JOBS, TIER_LABEL, jobInfo, unpackRows, filterRows, paginate, findPlayer, summarize } from './lib/ranking-data.js';
import { ICONS } from './lib/icons.js';

const BASE = window.SITE_BASE || '/';
const CFG = window.RANK_CFG || {};
const SIZE = CFG.pageSize || 25;
const MSIO = 'https://maplestory.io/api/gms/208.2.0/mob/';
const LIVE_API = 'https://classicrank.com/api/v1/characters/';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => (n === null || n === undefined || n === '' || isNaN(+n) ? '–' : new Intl.NumberFormat('he-IL').format(+n));
const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });

function ago(iso) {
  const t = Date.parse(iso);
  if (!t) return '–';
  const s = (t - Date.now()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  return 'עכשיו';
}
function fullDate(iso) {
  const t = Date.parse(iso);
  return t ? new Date(t).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
const playerUrl = n => `${BASE}ranking/player/?name=${encodeURIComponent(n)}`;
const guideUrl = s => `${BASE}guides/${s}/`;
const profileUrl = r => r.profile_url && /^https:\/\/classicrank\.com\//.test(r.profile_url) ? r.profile_url : `https://classicrank.com/user/${encodeURIComponent(r.name)}`;
const safePhoto = p => (typeof p === 'string' && /^https:\/\//.test(p) ? p : '');

function avatar(r, cls = '') {
  const fam = jobInfo(r.job).family;
  const icon = ICONS[(FAMILIES[fam] || FAMILIES.other).icon] || ICONS.user;
  const p = safePhoto(r.photo);
  return `<span class="av fam-${fam} ${cls}" aria-hidden="true">${icon}${p ? `<img src="${esc(p)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
}
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.parentElement && t.parentElement.classList.contains('av')) t.remove(); }, true);

const verifiedMark = r => (r.verified ? `<span class="vf" title="מאומת: נראה בסורק של ClassicRank">${ICONS.check}<span class="sr-only">מאומת</span></span>` : '');
function jobCell(r) {
  const j = jobInfo(r.job);
  const tier = TIER_LABEL[r.job_tier ?? j.tier] || '';
  const name = j.guide ? `<a href="${guideUrl(j.guide)}">${esc(j.he)}</a>` : esc(j.he);
  return `<span class="job-cell fam-${j.family}"><span class="fam-ic" aria-hidden="true">${ICONS[(FAMILIES[j.family] || FAMILIES.other).icon] || ''}</span><span>${name}${tier ? `<small>${esc(tier)}</small>` : ''}</span></span>`;
}

async function loadData() {
  const res = await fetch(`${BASE}ranking/data.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  return { meta: d.meta || {}, rows: unpackRows(d) };
}

// ---------------- ranking page ----------------
const TABS = {
  overall: { title: 'דירוג כללי', sub: 'לפי רמה' },
  fame: { title: 'דירוג פרסום', sub: 'לפי Fame' },
  class: { title: 'דירוג לפי מקצוע', sub: 'בחרו מקצוע או ענף' },
  islander: { title: 'אי ההתחלה', sub: 'מתחילים שעוד לא עזבו את האי מייפל' },
  permanent: { title: 'מתחילים לנצח', sub: 'שחקנים שבחרו להישאר Beginner' },
  israel: { title: 'שחקנים ישראלים', sub: 'בקרוב' },
};
const KEYS = ['tab', 'family', 'job', 'tier', 'min', 'max', 'q', 'true', 'verified', 'page'];

function readState() {
  const p = new URLSearchParams(location.search);
  const s = Object.fromEntries(KEYS.map(k => [k, p.get(k) || '']));
  if (!TABS[s.tab]) s.tab = 'overall';
  if (s.family && !FAMILIES[s.family]) s.family = '';
  if (s.job && !JOBS[s.job]) s.job = '';
  if (s.tab === 'class' && !s.family) s.family = s.job ? jobInfo(s.job).family : 'warrior';
  return s;
}
function writeState(s, push) {
  const p = new URLSearchParams();
  for (const k of KEYS) if (s[k] && !(k === 'tab' && s[k] === 'overall') && !(k === 'page' && +s[k] === 1)) p.set(k, s[k]);
  const q = p.toString();
  history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + (q ? '?' + q : ''));
}
function hrefFor(s, patch) {
  const n = { ...s, ...patch };
  const p = new URLSearchParams();
  for (const k of KEYS) if (n[k] && !(k === 'tab' && n[k] === 'overall') && !(k === 'page' && +n[k] === 1)) p.set(k, n[k]);
  const q = p.toString();
  return location.pathname + (q ? '?' + q : '');
}

function fillJobs(sel, family, current) {
  const fams = family ? [family] : ['warrior', 'magician', 'bowman', 'thief', 'beginner'];
  sel.innerHTML = '<option value="">כל הענפים</option>' + fams.map(f => {
    const list = Object.entries(JOBS).filter(([, j]) => j.family === f);
    const opts = list.map(([en, j]) => `<option value="${esc(en)}"${en === current ? ' selected' : ''}>${esc(j.he)}</option>`).join('');
    return family ? opts : `<optgroup label="${esc(FAMILIES[f].he)}">${opts}</optgroup>`;
  }).join('');
  if (current && !sel.value) sel.value = '';
}

function pagerHtml(s, page, pages) {
  if (pages <= 1) return '';
  const nums = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages));
  const list = [...nums].sort((a, b) => a - b);
  let out = '', last = 0;
  for (const n of list) {
    if (n - last > 1) out += '<li class="gap" aria-hidden="true">…</li>';
    out += n === page
      ? `<li><span class="pg-n is-cur" aria-current="page">${nf(n)}</span></li>`
      : `<li><a class="pg-n" href="${esc(hrefFor(s, { page: n }))}" data-page="${n}" aria-label="עמוד ${n}">${nf(n)}</a></li>`;
    last = n;
  }
  const prev = page > 1 ? `<a class="pg-n pg-arrow" href="${esc(hrefFor(s, { page: page - 1 }))}" data-page="${page - 1}" aria-label="העמוד הקודם">→</a>` : '<span class="pg-n pg-arrow is-off" aria-hidden="true">→</span>';
  const next = page < pages ? `<a class="pg-n pg-arrow" href="${esc(hrefFor(s, { page: page + 1 }))}" data-page="${page + 1}" aria-label="העמוד הבא">←</a>` : '<span class="pg-n pg-arrow is-off" aria-hidden="true">←</span>';
  return `<ul>${`<li>${prev}</li>`}${out}<li>${next}</li></ul>
<form class="pg-go" data-pages="${pages}"><label><span>עמוד</span><input type="number" name="page" min="1" max="${pages}" value="${page}" inputmode="numeric"></label><button type="submit" class="btn btn-ghost">מעבר</button><span class="pg-of">מתוך ${nf(pages)}</span></form>`;
}

function initRanking() {
  const form = $('#rankFilters');
  const tbody = $('#rankTable tbody');
  const live = $('#rankLive');
  const podium = $('#rankPodium');
  const pager = $('#rankPager');
  const soon = $('#rankSoon');
  const tableWrap = $('.rank-table-wrap');
  const mobBox = $('.rank-mobs');
  let state = readState();
  let data = null;

  const setMob = tab => {
    const id = (CFG.mobs || {})[tab] || (CFG.mobs || {}).overall;
    if (!mobBox || !id) return;
    mobBox.innerHTML = `<img class="rank-mob" src="${MSIO}${encodeURIComponent(id)}/render/stand" alt="" loading="lazy" decoding="async">`;
    mobBox.querySelector('img').addEventListener('error', e => e.target.remove());
  };

  function syncForm() {
    form.q.value = state.q;
    form.family.value = state.family;
    fillJobs(form.job, state.family, state.job);
    form.job.value = state.job;
    form.tier.value = state.tier;
    form.min.value = state.min;
    form.max.value = state.max;
    form.true.checked = state.true === '1';
    form.verified.checked = state.verified === '1';
    document.querySelectorAll('.rank-tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
    const n = ['job', 'tier', 'min', 'max', 'true', 'verified'].filter(k => state[k]).length + (state.family && state.tab !== 'class' ? 1 : 0);
    $('#rfCount').textContent = n ? `(${n})` : '';
  }

  function render(focus) {
    const tab = TABS[state.tab];
    $('#rankTitle').textContent = tab.title;
    $('#rankSub').textContent = tab.sub;
    $('#rankCaption').textContent = `${tab.title}, ${tab.sub}`;
    document.querySelector('.rank-window').dataset.tab = state.tab;
    setMob(state.tab);
    const isSoon = state.tab === 'israel';
    soon.hidden = !isSoon;
    form.hidden = isSoon;
    tableWrap.hidden = isSoon;
    if (isSoon) { podium.innerHTML = ''; pager.innerHTML = ''; live.textContent = 'דירוג השחקנים הישראלים יגיע בקרוב.'; return; }

    if (!data) return;
    if (!data.rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="rank-msg">${data.meta.empty ? 'הנתונים יתעדכנו בקרוב. נסו שוב בעוד כמה דקות.' : 'אין נתונים.'}</td></tr>`;
      podium.innerHTML = ''; pager.innerHTML = ''; live.textContent = '';
      return;
    }

    const opts = { tab: state.tab, family: state.family, job: state.job, tier: state.tier, min: state.min, max: state.max, q: state.q, trueRank: state.true === '1', verified: state.verified === '1' };
    const rows = filterRows(data.rows, opts);
    const { page, pages, items } = paginate(rows, state.page, SIZE);
    if (String(page) !== String(state.page || 1)) { state.page = page > 1 ? String(page) : ''; writeState(state, false); }

    const filtered = state.family || state.job || state.tier || state.min || state.max || state.q || state.true || state.verified;
    live.textContent = rows.length
      ? `${nf(rows.length)} שחקנים${filtered ? ' מתאימים לסינון' : ''} · עמוד ${nf(page)} מתוך ${nf(pages)}`
      : 'לא נמצאו שחקנים שמתאימים לסינון.';

    const top = page === 1 && !state.q ? rows.slice(0, 3) : [];
    podium.innerHTML = top.map((r, i) => `<li class="pod pod-${i + 1}">
  <a href="${playerUrl(r.name)}">
    <span class="pod-medal" aria-hidden="true">${i + 1}</span>
    ${avatar(r, 'av-lg')}
    <span class="pod-txt"><span class="pod-name" dir="auto">${esc(r.display_name || r.name)}${verifiedMark(r)}</span>
    <span class="pod-meta"><span class="lv">Lv ${esc(r.level)}</span> ${esc(jobInfo(r.job).he)}${state.tab === 'fame' ? ` · Fame ${nf(r.fame)}` : ''}</span></span>
  </a>
</li>`).join('');
    podium.hidden = !top.length;

    tbody.innerHTML = items.length ? items.map(r => `<tr class="${r.pos <= 3 ? 'top-' + r.pos : ''}">
  <td class="c-pos"><span>${nf(r.pos)}</span></td>
  <td class="c-name"><a class="pl" href="${playerUrl(r.name)}">${avatar(r)}<span class="pl-txt"><span class="pl-name" dir="auto">${esc(r.display_name || r.name)}${verifiedMark(r)}</span><small class="pl-job">${esc(jobInfo(r.job).he)}</small></span></a></td>
  <td class="c-job">${jobCell(r)}</td>
  <td class="c-lv"><span class="lv">Lv ${esc(r.level)}</span></td>
  <td class="c-fame">${nf(r.fame)}</td>
  <td class="col-seen"><time datetime="${esc(r.last_checked || '')}" title="${esc(fullDate(r.last_checked))}">${esc(ago(r.last_checked))}</time></td>
</tr>`).join('') : `<tr><td colspan="6" class="rank-msg">לא נמצאו שחקנים. נסו לשנות את הסינון או <button type="reset" form="rankFilters" class="linkish">לאפס אותו</button>.</td></tr>`;

    pager.innerHTML = pagerHtml(state, page, pages);
    if (focus) document.querySelector('.rank-window').scrollIntoView({ block: 'start' });
  }

  function update(patch, { push = false, focus = false } = {}) {
    state = { ...state, ...patch };
    writeState(state, push);
    syncForm();
    render(focus);
  }

  // tabs
  document.querySelectorAll('.rank-tab').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    const patch = { tab, page: '' };
    if (tab === 'class' && !state.family) patch.family = 'warrior';
    if (tab !== 'class' && state.tab === 'class') { patch.family = ''; patch.job = ''; }
    update(patch, { push: true });
  }));

  // filters (on phones the extra filters fold behind a button)
  const tog = $('#rfToggle');
  const setOpen = open => { form.classList.toggle('is-collapsed', !open); tog.setAttribute('aria-expanded', String(open)); };
  tog.addEventListener('click', () => setOpen(form.classList.contains('is-collapsed')));
  if (['job', 'tier', 'min', 'max', 'true', 'verified'].some(k => state[k])) setOpen(true);
  let qTimer;
  form.addEventListener('input', e => {
    const t = e.target;
    if (t.name === 'q') { clearTimeout(qTimer); qTimer = setTimeout(() => update({ q: t.value.trim(), page: '' }), 200); return; }
    if (t.name === 'min' || t.name === 'max') { clearTimeout(qTimer); qTimer = setTimeout(() => update({ [t.name]: t.value, page: '' }), 300); }
  });
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'family') return update({ family: t.value, job: '', page: '' });
    if (t.name === 'job') return update({ job: t.value, family: t.value ? jobInfo(t.value).family : state.family, page: '' });
    if (t.name === 'tier') return update({ tier: t.value, page: '' });
    if (t.name === 'true' || t.name === 'verified') return update({ [t.name]: t.checked ? '1' : '', page: '' });
  });
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('reset', e => { e.preventDefault(); update({ family: state.tab === 'class' ? 'warrior' : '', job: '', tier: '', min: '', max: '', q: '', true: '', verified: '', page: '' }); form.q.focus(); });

  // pager
  pager.addEventListener('click', e => {
    const a = e.target.closest('a[data-page]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    update({ page: a.dataset.page }, { push: true, focus: true });
  });
  pager.addEventListener('submit', e => {
    e.preventDefault();
    const n = parseInt(e.target.page.value, 10);
    if (n) update({ page: String(n) }, { push: true, focus: true });
  });
  window.addEventListener('popstate', () => { state = readState(); syncForm(); render(); });

  syncForm();
  render();
  loadData().then(d => {
    data = d;
    const m = d.meta;
    const s = summarize(d.rows);
    const set = (k, v, title) => { const el = $(`[data-stat="${k}"]`); if (el) { el.textContent = v; if (title) el.title = title; } };
    set('total', nf(m.total || s.count));
    set('shown', nf(s.count));
    set('avgLevel', s.count ? s.avgLevel.toLocaleString('he-IL') : '–');
    set('avgFame', s.count ? s.avgFame.toLocaleString('he-IL') : '–');
    set('updated', m.updated ? ago(m.updated) : '–', fullDate(m.updated));
    if (!m.keyed && s.count) {
      const note = document.createElement('p');
      note.className = 'rank-note';
      note.textContent = `מוצגים ${nf(s.count)} השחקנים המובילים לפי רמה ולפי Fame. הסינונים פועלים בתוך הרשימה הזו.`;
      $('#rankStats').after(note);
    }
    if (m.fixture) document.body.insertAdjacentHTML('afterbegin', '<div class="fixture-banner">נתוני דוגמה לבדיקה מקומית בלבד</div>');
    const hasType = t => d.rows.some(r => String(r.beginner_type || '').toLowerCase().startsWith(t));
    for (const [tab, t] of [['islander', 'islander'], ['permanent', 'perm']]) {
      const b = $(`.rank-tab[data-tab="${tab}"]`);
      if (b && !hasType(t)) { b.hidden = true; if (state.tab === tab) state.tab = 'overall'; }
    }
    syncForm();
    render();
  }).catch(() => {
    data = { meta: { empty: true }, rows: [] };
    render();
  });
}

// ---------------- player page ----------------
function playerHtml(r) {
  const j = jobInfo(r.job);
  const tier = TIER_LABEL[r.job_tier ?? j.tier] || '';
  const stat = (k, v) => `<div class="stat-row"><span class="stat-k">${k}</span><span class="stat-v">${v}</span></div>`;
  const rank = n => (n ? `#${nf(n)}` : '–');
  const when = iso => (iso ? `<time datetime="${esc(iso)}" title="${esc(fullDate(iso))}">${esc(ago(iso))}</time>` : '–');
  return `<div class="player-top fam-${j.family}">
  ${avatar(r, 'av-xl')}
  <div class="player-id">
    <h2 dir="auto">${esc(r.display_name || r.name)}${verifiedMark(r)}</h2>
    <p><span class="lv">Lv ${esc(r.level)}</span> ${j.guide ? `<a href="${guideUrl(j.guide)}">${esc(j.he)}</a>` : esc(j.he)}${tier ? ` · ${esc(tier)}` : ''}${r.claimed ? ' · הפרופיל נדרש על ידי השחקן' : ''}</p>
  </div>
</div>
<div class="box box-stats"><div class="box-title">נתוני השחקן</div><div class="stat-grid">
  ${stat('רמה', esc(r.level))}
  ${stat('Fame', nf(r.fame))}
  ${stat('דירוג כללי', rank(r.overall_rank))}
  ${stat(`דירוג בין ה${esc(j.he)}`, rank(r.job_rank))}
  ${stat('דירוג Fame', rank(r.fame_rank))}
  ${stat('עלה רמה לאחרונה', when(r.level_updated))}
  ${stat('נראה לראשונה', when(r.first_seen))}
  ${stat('נבדק לאחרונה', when(r.last_checked))}
</div></div>
<p class="row-btns"><a class="btn" href="${esc(profileUrl(r))}" target="_blank" rel="noopener">לפרופיל המלא ב-ClassicRank</a><a class="btn btn-ghost" href="${BASE}ranking/">חזרה לדירוג</a></p>`;
}

function searchForm(msg = '') {
  return `${msg ? `<p>${msg}</p>` : ''}<form class="player-search" action="${BASE}ranking/player/" method="get" role="search">
  <label><span>שם הדמות</span><input type="search" name="name" required autocomplete="off" dir="auto"></label>
  <button class="btn" type="submit">חיפוש</button>
</form>`;
}

async function initPlayer() {
  const card = $('#playerCard .player-in');
  const name = (new URLSearchParams(location.search).get('name') || '').trim();
  if (!name) { card.innerHTML = searchForm('איזה שחקן לחפש?'); return; }
  document.title = `${name} | פרופיל שחקן | ${document.title.split('|').pop().trim()}`;
  let r = null;
  try { r = findPlayer((await loadData()).rows, name); } catch { /* ignore */ }
  if (!r) {
    try {
      const res = await fetch(`${LIVE_API}${encodeURIComponent(name)}?fields=all`, { headers: { Accept: 'application/json' } });
      if (res.ok) { const b = await res.json(); r = b && b.data && !Array.isArray(b.data) ? b.data : (b && b.name ? b : null); }
    } catch { /* ignore */ }
  }
  if (!r) {
    card.innerHTML = `<h2>לא מצאנו את "${esc(name)}"</h2>${searchForm(`ייתכן שהדמות עוד לא נסרקה, או שהשם שונה. אפשר לנסות <a href="https://classicrank.com/search?q=${encodeURIComponent(name)}" target="_blank" rel="noopener">לחפש ב-ClassicRank</a>.`)}`;
    return;
  }
  card.innerHTML = playerHtml(r);
}

if (CFG.player) initPlayer(); else if ($('#rankFilters')) initRanking();
