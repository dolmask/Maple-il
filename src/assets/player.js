// התחברות עם שם הדמות: חלון התחברות, רענון ברקע מול ClassicRank, וברכה כשעולים רמה.
// בלי שרת ובלי סיסמה: הכול נשמר ב-localStorage של הגולש ולא נשלח אלינו.
import { normalizePlayer, toMe, needsRefresh, effectiveLevel, levelGain, unlocks } from './lib/player.js';
import { addItemIcons } from './lib/items.js';
import { jobInfo, unpackRows, findPlayer } from './lib/ranking-data.js';
import { escapeHtml as esc } from './lib/markdown.js';

const BASE = window.SITE_BASE || '/';
const LIVE_API = 'https://classicrank.com/api/v1/characters/';
const $ = s => document.querySelector(s);

// ---------- אחסון ----------
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const changed = () => window.dispatchEvent(new CustomEvent('player:change'));

let charData = null;
function loadCharData() {
  if (!charData) charData = fetch(`${BASE}character/data.json`).then(r => r.json()).catch(() => { charData = null; return null; });
  return charData;
}

// שומר את הדמות ומעדכן גם את "הדמות שלי" (me) ואת הצ'יפ (meView)
async function store(p, seenLevel) {
  write('player', { ...p, seenLevel });
  const D = await loadCharData();
  const old = read('me') || {};
  const m = D ? toMe(p, D.classes) : { cls: null, branch: '' };
  const sameCls = !m.cls || m.cls === old.cls;
  write('me', {
    cls: m.cls || old.cls || 'beginner',
    lv: effectiveLevel(sameCls ? old.lv : 0, p),
    branch: m.cls ? (m.branch || (sameCls ? old.branch || '' : '')) : old.branch || '',
  });
  const view = read('meView') || {};
  write('meView', { name: p.display, lv: Math.max(p.level, (read('me') || {}).lv || 0), img: p.photo || view.img || '' });
  if (window.updateMeChip) window.updateMeChip();
}

// ---------- חיפוש דמות ----------
async function lookup(name) {
  name = String(name || '').trim();
  if (!name) return null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(`${LIVE_API}${encodeURIComponent(name)}?fields=all`, { headers: { Accept: 'application/json' }, signal: ac.signal });
    clearTimeout(t);
    if (res.ok) { const p = normalizePlayer(await res.json()); if (p) return p; }
  } catch { /* נופלים לנתונים של האתר */ }
  try {
    const res = await fetch(`${BASE}ranking/data.json`);
    if (res.ok) { const r = findPlayer(unpackRows(await res.json()), name); if (r) return normalizePlayer(r); }
  } catch { /* ignore */ }
  return null;
}

// ---------- החלון ----------
const dlg = $('#loginDialog'), layer = $('#loginLayer'), form = $('#loginForm'), out = $('#loginResult');
let lastFocus = null, found = null;

function open() {
  if (!dlg) return;
  lastFocus = document.activeElement;
  dlg.hidden = false; if (layer) layer.hidden = false;
  out.innerHTML = ''; found = null;
  const cur = read('player');
  form.name.value = cur ? cur.name : '';
  form.name.focus();
}
function close() {
  if (!dlg || dlg.hidden) return;
  dlg.hidden = true; if (layer) layer.hidden = true;
  (lastFocus && document.contains(lastFocus) ? lastFocus : $('#meChip'))?.focus();
}

const avatar = p => `<span class="av fam-${jobInfo(p.job).family} av-lg" aria-hidden="true">${esc((p.display || '?')[0].toUpperCase())}${p.photo ? `<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;

function confirmCard(p) {
  const j = jobInfo(p.job);
  return `<div class="login-card">${avatar(p)}<div class="login-who"><strong dir="auto">${esc(p.display)}</strong><span>${esc(j.he)} · <span class="lv">Lv ${esc(p.level)}</span></span></div></div>
<p class="login-q">זו הדמות שלכם?</p>
<div class="row-btns"><button type="button" class="btn" data-login-yes>כן, זה אני</button><button type="button" class="btn btn-ghost" data-login-again>חיפוש אחר</button></div>`;
}

if (dlg) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = form.name.value.trim();
    if (!name) return;
    out.innerHTML = '<p class="login-wait">מחפשים…</p>';
    found = await lookup(name);
    if (found) { out.innerHTML = confirmCard(found); out.querySelector('[data-login-yes]').focus(); return; }
    out.innerHTML = `<p class="login-miss">לא מצאנו את "<bdi>${esc(name)}</bdi>". ייתכן ש-ClassicRank עוד לא סרק את הדמות, או שהשם שונה.</p>
<div class="row-btns"><button type="button" class="btn btn-ghost" data-login-again>לנסות שם אחר</button><a class="btn btn-ghost" href="${BASE}character/">להמשיך בלי חיבור</a></div>`;
  });
  dlg.addEventListener('click', async e => {
    if (e.target.closest('[data-login-close]')) return close();
    if (e.target.closest('[data-login-again]')) { out.innerHTML = ''; found = null; form.name.select(); form.name.focus(); return; }
    if (e.target.closest('[data-login-yes]') && found) {
      await store(found, found.level);
      close();
      changed();
    }
  });
  if (layer) layer.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (dlg.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...dlg.querySelectorAll('input, button, a[href]')].filter(x => !x.disabled && x.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

function logout() {
  write('player', null);
  changed();
}

window.playerApi = { get: () => read('player'), open, logout, lookup };
if (window.updateMeChip) window.updateMeChip();

// ---------- ברכת עליית רמה ----------
const toast = $('#playerToast');
const gUrl = slug => `${BASE}guides/${slug}/`;

function unlockHtml(u) {
  if (u.type === 'item') {
    // שורה אחת: הרמה והפריט (העמודה השנייה בטבלה), עם האיור
    const cells = u.line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/\*\*|`/g, ''));
    return `<li><span class="lu-k">${esc(u.label)}</span><span class="lu-item">${addItemIcons(esc(cells[1] || ''))}</span><span class="lv">Lv ${esc(cells[0])}</span></li>`;
  }
  const k = u.type === 'milestone' ? 'נפתח' : 'מדריך חדש';
  return `<li><span class="lu-k">${k}</span><a href="${gUrl(u.slug)}">${esc(u.label)}</a></li>`;
}

window.showLevelUp = async function ({ from, to }) {
  if (!toast) return;
  const D = await loadCharData();
  const me = read('me') || {};
  const list = D ? unlocks(D, { cls: me.cls, branch: me.branch || '' }, from, to) : [];
  const n = to - from;
  toast.innerHTML = `<strong>LEVEL UP!</strong><span class="lu-msg">${n > 1 ? `עלית ${n} רמות, לרמה ${to}!` : `עלית לרמה ${to}!`}</span>
${list.length ? `<ul class="lu-list">${list.map(unlockHtml).join('')}</ul>` : ''}
<a class="lu-me" href="${BASE}character/">לדמות שלי</a><button type="button" data-close-lu aria-label="סגירה">✕</button>`;
  // בעמוד מדריך: אם ברכת סיום המדריך פתוחה, מחכים שתיסגר
  const guideLu = $('#levelUp');
  const show = () => { toast.hidden = false; };
  if (guideLu && !guideLu.hidden) {
    const mo = new MutationObserver(() => { if (guideLu.hidden) { mo.disconnect(); show(); } });
    mo.observe(guideLu, { attributes: true, attributeFilter: ['hidden'] });
  } else show();
};
if (toast) toast.addEventListener('click', e => { if (e.target.closest('[data-close-lu]')) toast.hidden = true; });

// ---------- רענון ברקע ----------
async function refresh() {
  const cur = read('player');
  if (!cur || !needsRefresh(cur)) return;
  const fresh = await lookup(cur.name);
  if (!fresh) return; // כישלון: לא משנים כלום, מנסים שוב בטעינה הבאה
  const gain = levelGain(cur.seenLevel, fresh.level);
  const moved = fresh.level !== cur.level || fresh.job !== cur.job;
  await store(fresh, gain ? gain.to : cur.seenLevel);
  if (moved) changed();
  if (gain && window.showLevelUp) window.showLevelUp(gain);
}
refresh();
