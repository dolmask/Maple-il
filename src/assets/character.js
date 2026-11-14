// "הדמות שלי": בוחרים מקצוע ורמה, ומקבלים רק את מה שמתאים מתוך המדריכים.
// הנתונים (character/data.json) נאספים בזמן הבנייה מהטבלאות שבמדריכים עצמם.
import { renderMarkdown, escapeHtml as esc } from './lib/markdown.js';

const base = window.SITE_BASE || '/';
const $ = s => document.querySelector(s);
const MAP = 'https://maplestory.io/api/gms/208.2.0/map/';

const form = $('#charForm'), body = $('#charBody');
const fCls = $('#cf-cls'), fLv = $('#cf-lv'), fBranch = $('#cf-branch'), wBranch = $('#cf-branch-wrap');

let D = null;
let me = readMe();

function readMe() {
  let m = {};
  try { m = JSON.parse(localStorage.getItem('me') || '{}') || {}; } catch (e) {}
  const q = new URLSearchParams(location.search);
  if (q.get('cls')) m = { cls: q.get('cls'), lv: +q.get('lv') || m.lv || 10, branch: q.get('branch') || '' };
  return { cls: m.cls || 'warrior', lv: Math.max(1, Math.min(200, Math.round(+m.lv || 10))), branch: m.branch || '' };
}
function saveMe() {
  try { localStorage.setItem('me', JSON.stringify(me)); } catch (e) {}
  const q = new URLSearchParams({ cls: me.cls, lv: me.lv });
  if (me.branch) q.set('branch', me.branch);
  history.replaceState(null, '', '?' + q);
  if (window.updateMeChip) window.updateMeChip();
}

const gUrl = slug => `${base}guides/${slug}/`;
const guide = slug => D.guides.find(g => g.slug === slug);
const md = src => renderMarkdown(src, { base }).html;

// השורות שמתאימות לרמה: השורה הנוכחית, ואם זו טבלת "לפי רמה" גם השורה הבאה בתור
function pickRows(rows, lv, withNext) {
  const num = rows.filter(r => r.a != null);
  let cur = num.filter(r => r.a <= lv && lv <= r.b);
  if (!cur.length) {
    const prev = num.filter(r => r.a <= lv);
    if (prev.length) { const top = prev[prev.length - 1].a; cur = prev.filter(r => r.a === top); }
  }
  const nxt = withNext ? num.find(r => r.a > lv) : null;
  return { cur, nxt };
}

function tableHtml(t, rows, nextRow) {
  const all = nextRow ? rows.concat(nextRow) : rows;
  let html = md([t.head, t.sep, ...all.map(r => r.line)].join('\n'));
  if (nextRow) html = html.replace(/<tr>(?![\s\S]*<tr>)/, '<tr class="is-next">');
  return html;
}

// כרטיס אחד לכל נושא; אם במדריך יש כמה טבלאות לאותו נושא, כל אחת מקבלת כותרת משנה
function card(title, parts, src) {
  parts = parts.filter(p => p.rows.length || p.nextRow);
  if (!parts.length) return '';
  const g = src && guide(src);
  const many = parts.length > 1;
  return `<section class="card ch-card"><div class="card-head"><h2>${esc(title)}</h2>${g ? `<a href="${gUrl(g.slug)}">${esc(g.short ? 'המדריך ל' + g.short : 'המדריך המלא')}</a>` : ''}</div>${parts.map(p => `${many || p.sub ? `<h3 class="card-sub">${esc(p.sub || p.t.heading)}</h3>` : ''}${tableHtml(p.t, p.rows, p.nextRow)}`).join('')}</section>`;
}

function render() {
  const C = D.classes[me.cls] || D.classes.warrior;
  const lv = me.lv;
  const branches = C.branches || [];
  const br = branches.find(b => b.slug === me.branch) || null;

  // טופס
  fCls.value = me.cls; fLv.value = lv;
  wBranch.hidden = !(branches.length && lv >= 30);
  fBranch.innerHTML = `<option value="">עוד לא בחרתי</option>` + branches.map(b => `<option value="${b.slug}"${b.slug === me.branch ? ' selected' : ''}>${esc(b.name)}</option>`).join('');

  // ראש העמוד
  const name = br && lv >= 30 ? br.name : C.name;
  $('#charTitle').textContent = `${name}, רמה ${lv}`;
  const av = $('#charAv');
  const pic = (br && lv >= 30 && br.img) || C.img;
  if (pic) { av.src = pic; av.hidden = false; } else av.hidden = true;
  try { localStorage.setItem('meView', JSON.stringify({ name, lv, img: pic || '' })); } catch (e) {}
  if (window.updateMeChip) window.updateMeChip();
  const town = C.town ? (typeof C.town === 'object' ? C.town : { id: C.town }) : null;
  $('#charTown').innerHTML = town ? `<img src="${MAP}${town.id}/render?resize=0.25" alt="" loading="lazy" decoding="async"${town.pos ? ` style="object-position:${esc(town.pos)}"` : ''} onerror="this.remove()">` : '';

  // הצעד הבא
  let from, to, label, link;
  if (me.cls === 'beginner') { from = 1; to = 10; label = lv >= 10 ? 'הגיע הזמן לבחור מקצוע' : `ג'וב ראשון ב-Lv 10 (קוסם כבר ב-Lv 8)`; link = 'choosing-a-class'; }
  else if (lv < 30) { from = C.first; to = 30; label = `הג'וב השני ב-Lv 30`; link = 'second-job-advancement'; }
  else if (lv < 70) { from = 30; to = 70; label = `הג'וב השלישי (Lv 70) עוד לא הגיע לקלאסיק`; link = ''; }
  else { from = 70; to = 70; label = 'הגעתם לסוף התוכן שיש כרגע בקלאסיק'; link = ''; }
  const pct = to > from ? Math.max(0, Math.min(100, ((lv - from) / (to - from)) * 100)) : 100;
  const left = Math.max(0, to - lv);
  $('#charNext').innerHTML = `<div class="next-row"><span>${esc(label)}${left && lv < 70 ? ` · עוד ${left} רמות` : ''}</span><span class="next-num">${lv} / ${to}</span></div>
<div class="bar" role="progressbar" aria-label="התקדמות לצעד הבא" aria-valuemin="${from}" aria-valuemax="${to}" aria-valuenow="${Math.min(lv, to)}"><span style="width:${pct.toFixed(1)}%"></span></div>
${link && guide(link) ? `<a class="next-link" href="${gUrl(link)}">${esc(guide(link).title)}</a>` : ''}`;

  // מאיזה מדריך לוקחים: ענף מ-Lv 30, מדריך המקצוע עד 30
  const srcSlug = me.cls === 'beginner' ? '' : lv >= 30 ? (br ? br.slug : '') : C.guide;
  const T = (srcSlug && D.tables[srcSlug]) || [];
  const out = [];

  // 1. אימון
  const spots = (D.tables['training-spots'] || []).find(t => t.h2Range && t.h2Range[0] <= lv && lv <= t.h2Range[1]);
  if (spots) out.push(card(`איפה להתאמן ברמה ${lv}`, [{ t: spots, rows: spots.rows, sub: `כל המקצועות, ${spots.heading.replace(/:.*/, '')}` }], 'training-spots'));
  out.push(card(`מפות מומלצות ל${name}`, T.filter(t => t.kind === 'train').map(t => ({ t, rows: pickRows(t.rows, lv, false).cur })), srcSlug));

  // 2. ציוד, 3. AP, 4. סקילים
  const sections = [['weapons', 'ציוד ונשקים לרמה שלכם', true], ['ap', 'איך לחלק AP עכשיו', false], ['skills', 'איפה לשים SP עכשיו', true]];
  for (const [kind, title, withNext] of sections) {
    out.push(card(title, T.filter(t => t.kind === kind).map(t => { const { cur, nxt } = pickRows(t.rows, lv, withNext); return { t, rows: cur, nextRow: nxt }; }), srcSlug));
  }

  // בחירת ענף
  if (me.cls !== 'beginner' && branches.length && (lv >= 25 && !br)) {
    out.unshift(`<section class="card ch-card"><div class="card-head"><h2>${lv >= 30 ? 'באיזה ענף בחרתם?' : `הג'וב השני, בעוד ${30 - lv} רמות`}</h2>${guide('second-job-advancement') ? `<a href="${gUrl('second-job-advancement')}">איך עוברים את המבחן</a>` : ''}</div>
<ul class="branches">${branches.map(b => `<li><button type="button" class="branch" data-branch="${b.slug}"${lv < 30 ? ' disabled' : ''}>${b.img ? `<img src="${esc(b.img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span>${esc(b.name)}</span></button><a href="${gUrl(b.slug)}">המדריך</a></li>`).join('')}</ul>
${lv >= 30 ? '<p class="card-sub">בחרו ענף כדי לראות ציוד, AP וסקילים שמתאימים לו.</p>' : ''}</section>`);
  }
  if (me.cls === 'beginner') {
    out.unshift(`<section class="card ch-card"><div class="card-head"><h2>עוד לא בחרתם מקצוע</h2><a href="${gUrl('choosing-a-class')}">איזה מקצוע לבחור?</a></div><p class="card-sub">עד Lv 10 כל המתחילים זהים. מומלץ להתחיל מהמדריך למתחילים ולהגיע לאי ויקטוריה.</p></section>`);
  }

  // 5. מדריכים לרמה
  const fits = g => {
    if (!g.range) return false;
    if (g.cls && g.cls !== me.cls) return false;
    if (g.cat === 'jobs2' && g.cls) return lv >= 25 && (!br || g.slug === br.slug);
    return true;
  };
  const now = D.guides.filter(g => fits(g) && g.range[0] <= lv && lv <= g.range[1] && g.slug !== 'training-spots');
  const soon = D.guides.filter(g => fits(g) && g.range[0] > lv && g.range[0] <= lv + 5);
  const li = (g, tag) => `<li><a class="row" href="${gUrl(g.slug)}"><span class="row-ic" aria-hidden="true">${g.thumb ? `<img src="${esc(g.thumb)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span><span class="row-t">${esc(g.title)}</span>${tag ? `<span class="lv">${tag}</span>` : ''}</a></li>`;
  if (now.length || soon.length) out.push(`<section class="card ch-card"><div class="card-head"><h2>מדריכים לרמה שלכם</h2></div><ul class="rows">${now.map(g => li(g, '')).join('')}${soon.map(g => li(g, `בקרוב: Lv ${g.range[0]}`)).join('')}</ul></section>`);

  body.innerHTML = out.join('') || '<p class="empty">לא מצאנו המלצות לרמה הזו.</p>';
}

function update(patch) {
  me = { ...me, ...patch };
  me.lv = Math.max(1, Math.min(200, Math.round(+me.lv || 1)));
  if (me.cls === 'beginner') me.branch = '';
  const C = D.classes[me.cls];
  if (me.branch && !(C && (C.branches || []).some(b => b.slug === me.branch))) me.branch = '';
  saveMe(); render();
}

form.addEventListener('submit', e => e.preventDefault());
fCls.addEventListener('change', () => update({ cls: fCls.value, branch: '' }));
fLv.addEventListener('change', () => update({ lv: fLv.value }));
fBranch.addEventListener('change', () => update({ branch: fBranch.value }));
$('#cf-up').addEventListener('click', () => update({ lv: me.lv + 1 }));
body.addEventListener('click', e => {
  const b = e.target.closest('[data-branch]');
  if (b) update({ branch: b.dataset.branch });
});

fetch(base + 'character/data.json').then(r => r.json()).then(d => { D = d; update({}); }).catch(() => {
  body.innerHTML = '<p class="empty">לא הצלחנו לטעון את הנתונים. נסו לרענן את העמוד.</p>';
});
