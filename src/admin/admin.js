// מערכת הניהול של מייפלורז.
// עורכת את קבצי התוכן ישירות במאגר ב-GitHub. כל שמירה = commit, ו-GitHub Actions בונה ומפרסם את האתר מחדש.
// התצוגה המקדימה משתמשת באותו קוד בדיוק שבונה את האתר, כך שהעיצוב תמיד זהה.
import { parseFrontMatter, stringifyFrontMatter, escapeHtml as e, slugify } from '../assets/lib/markdown.js';
import { guidePage, staticPage } from '../assets/lib/render.js';
import { ICONS, CLASS_INFO } from '../assets/lib/icons.js';

const SITE_BASE = location.pathname.replace(/admin\/.*$/, '') || '/';
const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let manifest = { guides: [], pages: [], config: null };
let config = null;
let token = store.get('gh_token');
let offline = false;
const localImages = {}; // path -> dataURL, for previewing images before the site rebuilds

$('#brandLeaf').innerHTML = ICONS.leaf;

// ---------------- helpers ----------------
function toast(msg, isErr = false, ms = 4200) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : ''); t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
const b64encode = str => { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); };
const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
const today = () => new Date().toISOString().slice(0, 10);
const gh = () => (config && config.github) || {};

async function api(path, opts = {}) {
  const r = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (r.status === 404 && opts.allow404) return null;
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msgs = {
      401: 'הטוקן לא תקין או פג תוקף. התחברו מחדש עם טוקן חדש.',
      403: 'לטוקן אין הרשאה לפעולה הזו. ודאו שנתתם לו Contents: Read and write על המאגר.',
      404: 'לא נמצא. בדקו ששם המאגר בהגדרות נכון ושהטוקן מורשה עליו.',
      409: 'הקובץ השתנה במקביל. רעננו את העמוד ונסו שוב.',
      422: 'GitHub דחה את הבקשה: ' + (j.message || ''),
    };
    throw new Error(msgs[r.status] || `שגיאה מ-GitHub (${r.status}): ${j.message || ''}`);
  }
  return r.status === 204 ? null : r.json();
}
const repoPath = p => `/repos/${gh().owner}/${gh().repo}/contents/${p}`;
async function getFile(path) {
  const j = await api(repoPath(path) + `?ref=${gh().branch || 'main'}&t=${Date.now()}`, { allow404: true });
  return j ? { text: b64decode(j.content), sha: j.sha } : null;
}
async function putFile(path, content, message, sha, isBase64 = false) {
  return api(repoPath(path), {
    method: 'PUT',
    body: JSON.stringify({ message, content: isBase64 ? content : b64encode(content), branch: gh().branch || 'main', ...(sha ? { sha } : {}) }),
  });
}
async function deleteFile(path, sha, message) {
  return api(repoPath(path), { method: 'DELETE', body: JSON.stringify({ message, sha, branch: gh().branch || 'main' }) });
}
async function listDir(path) {
  const j = await api(repoPath(path) + `?ref=${gh().branch || 'main'}&t=${Date.now()}`, { allow404: true });
  return (j || []).filter(f => f.type === 'file' && f.name.endsWith('.md'));
}

// ---------------- deploy status ----------------
let deployTimer = null;
async function checkDeploy(poll = false) {
  if (offline || !token) return;
  const el = $('#deployStatus');
  try {
    const j = await api(`/repos/${gh().owner}/${gh().repo}/actions/runs?per_page=1&branch=${gh().branch || 'main'}`);
    const run = j.workflow_runs && j.workflow_runs[0];
    if (!run) { el.hidden = true; return; }
    el.hidden = false;
    if (run.status !== 'completed') { el.className = 'deploy run'; el.textContent = 'האתר מתעדכן…'; }
    else if (run.conclusion === 'success') { el.className = 'deploy ok'; el.textContent = 'האתר מעודכן'; }
    else { el.className = 'deploy fail'; el.innerHTML = `<a href="${run.html_url}" target="_blank" rel="noopener">העדכון נכשל, לפרטים</a>`; }
    clearTimeout(deployTimer);
    if (poll || run.status !== 'completed') deployTimer = setTimeout(() => checkDeploy(run.status !== 'completed'), 8000);
  } catch { el.hidden = true; }
}

// ---------------- boot ----------------
async function boot() {
  try {
    manifest = await (await fetch('manifest.json?t=' + Date.now())).json();
  } catch { manifest = { guides: [], pages: [], config: null }; }
  config = manifest.config || { github: {}, categories: [] };
  $('#siteNameSmall').textContent = config.siteName || '';
  if (!token && !offline) return renderLogin();
  $('#logoutBtn').hidden = offline;
  route();
  checkDeploy();
}
window.addEventListener('hashchange', () => { if (token || offline) route(); });
$('#logoutBtn').addEventListener('click', () => { store.del('gh_token'); token = null; location.hash = ''; renderLogin(); $('#logoutBtn').hidden = true; });

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [view, type, slug] = h.split('/');
  if (view === 'edit') return renderEditor(type || 'guides', slug);
  if (view === 'new') return renderEditor(type || 'guides', null);
  if (view === 'settings') return renderSettings(type);
  if (view === 'media') return renderMedia();
  if (view === 'visual') return renderVisual(type || '');
  return renderDashboard(type === 'pages' ? 'pages' : 'guides');
}

// ---------------- login ----------------
function renderLogin(err = '') {
  const g = gh();
  app.innerHTML = `
<section class="window login">
  <div class="window-bar"><span>כניסה למערכת הניהול</span></div>
  <div class="panel">
    <p>המערכת שומרת מדריכים ישירות במאגר שלכם ב-GitHub (<span dir="ltr">${e(g.owner || '?')}/${e(g.repo || '?')}</span>). כדי להתחבר צריך טוקן גישה. עושים את זה פעם אחת בלבד:</p>
    <ol>
      <li>פתחו את <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">יצירת טוקן חדש ב-GitHub</a>.</li>
      <li>תנו לו שם (למשל "ניהול האתר") ותוקף של שנה.</li>
      <li>תחת <strong>Repository access</strong> בחרו <strong>Only select repositories</strong> ואת המאגר <span dir="ltr">${e(g.repo || '')}</span>.</li>
      <li>תחת <strong>Permissions</strong>: <strong>Contents</strong> ← Read and write, ו-<strong>Actions</strong> ← Read-only.</li>
      <li>לחצו <strong>Generate token</strong>, העתיקו והדביקו כאן.</li>
    </ol>
    <form id="loginForm" class="ed-form">
      <label class="f">טוקן גישה<input class="in" id="tokenIn" type="password" dir="ltr" placeholder="github_pat_…" autocomplete="off" required></label>
      ${err ? `<p class="box box-warning" role="alert" style="padding:10px 14px;margin:0">${e(err)}</p>` : ''}
      <div class="row"><button class="btn" type="submit">התחברות</button><button class="btn btn-ghost" type="button" id="offlineBtn">עבודה בלי חיבור</button></div>
      <p class="muted small">הטוקן נשמר רק בדפדפן הזה. "עבודה בלי חיבור" מאפשרת לכתוב ולראות תצוגה מקדימה, ולהוריד את הקובץ במקום לפרסם.</p>
    </form>
  </div>
</section>`;
  $('#loginForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    token = $('#tokenIn').value.trim();
    const btn = ev.submitter; btn.disabled = true; btn.textContent = 'בודק…';
    try {
      const repo = await api(`/repos/${gh().owner}/${gh().repo}`);
      if (repo.permissions && !repo.permissions.push) throw new Error('לטוקן יש רק הרשאת קריאה. צריך Contents: Read and write.');
      store.set('gh_token', token);
      toast('מחוברים. אפשר להתחיל לכתוב.');
      boot();
    } catch (x) { token = null; renderLogin(x.message); }
  });
  $('#offlineBtn').addEventListener('click', () => { offline = true; boot(); });
}

// ---------------- dashboard ----------------
async function renderDashboard(kind) {
  app.innerHTML = `<div class="loading">טוען…</div>`;
  let files = [];
  try { files = offline ? [] : await listDir(kind === 'pages' ? 'content/pages' : 'content/guides'); }
  catch (x) { toast(x.message, true); }
  const metas = kind === 'pages' ? manifest.pages : manifest.guides;
  const bySlug = Object.fromEntries(metas.map(m => [m.file ? m.file.split('/').pop().replace(/\.md$/, '') : m.slug, m]));
  const names = files.length ? files.map(f => f.name.replace(/\.md$/, '')) : metas.map(m => m.slug);
  const rows = names.map(n => ({ ...(bySlug[n] || { slug: n, title: n }), file: n }));
  const catName = id => (config.categories.find(c => c.id === id) || {}).name || '';
  const catIdx = id => { const i = config.categories.findIndex(c => c.id === id); return i < 0 ? 99 : i; };
  rows.sort((a, b) => catIdx(a.category) - catIdx(b.category) || (a.order ?? 50) - (b.order ?? 50));

  app.innerHTML = `
<div class="dash-head">
  <h1>${kind === 'pages' ? 'עמודים' : 'מדריכים'}</h1>
  <span class="muted">${rows.length} ${kind === 'pages' ? 'עמודים' : 'מדריכים'}</span>
  <span class="spacer"></span>
  <a class="btn" href="#/new/${kind}">${kind === 'pages' ? 'עמוד חדש' : 'מדריך חדש'}</a>
</div>
<div class="tabs" role="tablist">
  <a class="tab${kind === 'guides' ? ' is-on' : ''}" href="#/list/guides">מדריכים</a>
  <a class="tab${kind === 'pages' ? ' is-on' : ''}" href="#/list/pages">עמודים (אודות, פרטיות)</a>
  <a class="tab" href="#/visual/">עריכת תמונות על גבי האתר</a>
  <a class="tab" href="#/media">תמונות</a>
  <a class="tab" href="#/settings">הגדרות האתר ופרסומות</a>
  <a class="tab" href="${SITE_BASE}" target="_blank" rel="noopener">צפייה באתר</a>
</div>
<input class="in filter" id="filter" type="search" placeholder="סינון לפי שם…" aria-label="סינון">
<div class="g-list" id="gList" style="margin-top:12px">
${rows.map(r => {
  const cls = r.cls && CLASS_INFO[r.cls];
  const cat = config.categories.find(c => c.id === r.category);
  const icon = ICONS[r.icon] || ICONS[cls?.icon] || ICONS[cat?.icon] || ICONS.book;
  return `<div class="g-row${r.cls ? ' cls-' + e(r.cls) : ''}" data-q="${e((r.title + ' ' + r.file).toLowerCase())}">
  <span class="g-icon">${icon}</span>
  <span><span class="g-title">${e(r.title)}</span><span class="g-meta">${r.draft ? '<span class="badge-draft">טיוטה</span>' : ''}${r.level ? `<span class="lv">Lv ${e(r.level)}</span>` : ''}<span>${e(catName(r.category))}</span><span class="slug">${e(r.file)}</span></span></span>
  <span class="row"><a class="btn btn-ghost btn-sm" href="#/edit/${kind}/${encodeURIComponent(r.file)}">עריכה</a><a class="btn btn-ghost btn-sm" href="${SITE_BASE}${kind === 'pages' ? '' : 'guides/'}${encodeURIComponent(r.slug || r.file)}/" target="_blank" rel="noopener">צפייה</a></span>
</div>`;
}).join('') || '<p class="muted">אין עדיין תוכן. צרו את הראשון.</p>'}
</div>`;
  $('#filter').addEventListener('input', ev => {
    const q = ev.target.value.toLowerCase().trim();
    app.querySelectorAll('.g-row').forEach(r => { r.hidden = q && !r.dataset.q.includes(q); });
  });
}

// ---------------- editor ----------------
const NEW_GUIDE_BODY = `פסקת פתיחה: על מה המדריך ולמי הוא מיועד. שמות של ערים ודמויות כותבים בעברית עם האנגלית בסוגריים, למשל הניסיס (Henesys).

:::info בקצרה
- הנקודה הראשונה
- הנקודה השנייה
:::

## כותרת ראשונה

טקסט רגיל. אפשר **להדגיש**, להוסיף [קישור למדריך אחר](/guides/beginners-guide/), ותג רמה כמו {{lv 30}}.

| עמודה | עמודה |
|---|---|
| ערך | ערך |

:::tip טיפ
טיפ שימושי לשחקנים.
:::
`;

async function renderEditor(kind, slug) {
  const isPage = kind === 'pages';
  const dir = isPage ? 'content/pages' : 'content/guides';
  let data = isPage ? { title: '', slug: '' } : { title: '', slug: '', category: config.categories[0]?.id || '', order: 50, updated: today() };
  let body = isPage ? 'תוכן העמוד.\n' : NEW_GUIDE_BODY;
  let sha = null;
  const origSlug = slug ? decodeURIComponent(slug) : null;

  if (origSlug) {
    app.innerHTML = `<div class="loading">טוען את הקובץ…</div>`;
    try {
      const f = offline
        ? await fetch(`content/${kind}/${origSlug}.md`).then(r => r.ok ? r.text() : null).then(t => t && { text: t, sha: null })
        : await getFile(`${dir}/${origSlug}.md`);
      if (f) { const p = parseFrontMatter(f.text); data = p.data; body = p.body; sha = f.sha; }
      else if (!offline) { toast('הקובץ לא נמצא במאגר.', true); }
    } catch (x) { toast(x.message, true); }
  }
  const draftKey = `draft:${kind}/${origSlug || '__new'}`;
  const draft = JSON.parse(store.get(draftKey) || 'null');

  const catOpts = config.categories.map(c => `<option value="${e(c.id)}">${e(c.name)}</option>`).join('');
  const clsOpts = `<option value="">ללא</option>` + Object.entries(CLASS_INFO).map(([k, v]) => `<option value="${k}">${v.name} (${v.en})</option>`).join('');
  const iconOpts = `<option value="">אוטומטי</option>` + Object.keys(ICONS).filter(k => !['search', 'menu', 'moon', 'sun'].includes(k)).map(k => `<option value="${k}">${k}</option>`).join('');
  const slugList = manifest.guides.map(g => `<option value="${e(g.slug)}">${e(g.title)}</option>`).join('');

  app.innerHTML = `
<div class="dash-head">
  <a class="btn btn-ghost btn-sm" href="#/list/${kind}">חזרה לרשימה</a>
  <h1>${origSlug ? 'עריכה' : (isPage ? 'עמוד חדש' : 'מדריך חדש')}</h1>
  <span class="spacer"></span>
  <div class="tabs ed-tabs"><button class="tab is-on" data-view="edit">עריכה</button><button class="tab" data-view="preview">תצוגה מקדימה</button></div>
</div>
${draft ? `<div class="box box-info" id="draftBox" style="padding:10px 14px"><div class="row"><span>יש טיוטה שלא פורסמה מ-${new Date(draft.ts).toLocaleString('he-IL')}.</span><span class="spacer"></span><button class="btn btn-sm" id="restoreDraft">שחזור הטיוטה</button><button class="btn btn-ghost btn-sm" id="dropDraft">מחיקה</button></div></div>` : ''}
<div class="ed" data-view="edit">
  <form class="ed-form" id="edForm" autocomplete="off">
    <div class="window ed-meta">
      <label class="f">כותרת<input class="in" name="title" required placeholder="למשל: מדריך לוחם: Lv 1 עד 30"></label>
      <div class="grid-2">
        <label class="f">כתובת (באנגלית)<small>אותיות קטנות, מספרים ומקפים</small><input class="in" name="slug" dir="ltr" required pattern="[a-z0-9-]+" placeholder="warrior-guide"></label>
        ${isPage ? '' : `<label class="f">קטגוריה<select class="in" name="category">${catOpts}</select></label>`}
      </div>
      <label class="f">תקציר<small>מופיע בכרטיס, בגוגל ובראש המדריך. משפט או שניים.</small><textarea class="in" name="summary" rows="2"></textarea></label>
      ${isPage ? '' : `
      <details>
        <summary>הגדרות נוספות</summary>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
          <div class="grid-3">
            <label class="f">טווח רמות<input class="in" name="level" dir="ltr" placeholder="30–70"></label>
            <label class="f">מקצוע (צבע)<select class="in" name="cls">${clsOpts}</select></label>
            <label class="f">אייקון<select class="in" name="icon">${iconOpts}</select></label>
          </div>
          <div class="grid-3">
            <label class="f">סדר בקטגוריה<input class="in" name="order" type="number" min="0" max="999"></label>
            <label class="f">שם קצר<small>לכפתורי הענפים בדף הבית</small><input class="in" name="short"></label>
            <label class="f">עודכן<input class="in" name="updated" type="date"></label>
          </div>
          <label class="f">מילות חיפוש<small>מופרדות בפסיקים, גם באנגלית</small><input class="in" name="keywords" placeholder="warrior, לוחם, power strike"></label>
          <label class="f">מדריכים קשורים<small>כתובות מופרדות בפסיקים</small><input class="in" name="related" dir="ltr" list="slugList" placeholder="fighter, page"></label>
          <datalist id="slugList">${slugList}</datalist>
          <div class="grid-2">
            <label class="f">תמונת באנר<small>מוצגת בראש המדריך</small><span class="row"><input class="in" name="cover" dir="ltr" placeholder="/images/…" style="flex:1"><button type="button" class="btn btn-ghost btn-sm" data-upload="cover">בחירה</button></span></label>
            <label class="f">תמונה לכרטיס<small>מחליפה את האייקון ברשימות</small><span class="row"><input class="in" name="thumb" dir="ltr" placeholder="/images/…" style="flex:1"><button type="button" class="btn btn-ghost btn-sm" data-upload="thumb">בחירה</button></span></label>
          </div>
          <label class="f">תיאור תמונת הבאנר<small>לנגישות ולגוגל</small><input class="in" name="coverAlt"></label>
          <label class="f">מקורות<small>קישורים מופרדים בפסיקים</small><input class="in" name="sources" dir="ltr" placeholder="https://…"></label>
          <label class="check-f"><input type="checkbox" name="draft"> טיוטה (לא יופיע באתר)</label>
        </div>
      </details>`}
    </div>
    <div class="body-box">
      <div class="toolbar" id="toolbar" role="toolbar" aria-label="כלי עיצוב">
        <button type="button" class="tb" data-ins="h2">כותרת</button>
        <button type="button" class="tb" data-ins="h3">כותרת משנה</button>
        <button type="button" class="tb" data-ins="bold"><b>מודגש</b></button>
        <button type="button" class="tb" data-ins="link">קישור</button>
        <button type="button" class="tb" data-ins="ul">רשימה</button>
        <button type="button" class="tb" data-ins="ol">רשימה ממוספרת</button>
        <button type="button" class="tb" data-ins="table">טבלה</button>
        <span class="tb-sep"></span>
        <button type="button" class="tb" data-ins="tip">טיפ</button>
        <button type="button" class="tb" data-ins="warning">אזהרה</button>
        <button type="button" class="tb" data-ins="info">מידע</button>
        <button type="button" class="tb" data-ins="npc">NPC מדבר</button>
        <button type="button" class="tb" data-ins="stats">כרטיס נתונים</button>
        <button type="button" class="tb" data-ins="lv">תג רמה</button>
        <span class="tb-sep"></span>
        <button type="button" class="tb" data-ins="img">תמונה</button>
        <button type="button" class="tb" data-ins="shot">צילום מסך</button>
        <button type="button" class="tb" data-ins="ad">מקום לפרסומת</button>
        <button type="button" class="tb" data-ins="help">עזרה</button>
        <input type="file" id="imgInput" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      </div>
      <textarea class="in" id="body" name="body" spellcheck="true" aria-label="תוכן המדריך"></textarea>
    </div>
    <div class="window panel help" id="helpBox" hidden>
      <h2>איך כותבים</h2>
      <div class="table-wrap"><table><tbody>
        <tr><td><code>## כותרת</code></td><td>כותרת של סעיף (נכנסת לתוכן העניינים)</td></tr>
        <tr><td><code>**טקסט**</code></td><td>טקסט מודגש</td></tr>
        <tr><td><code>[טקסט](/guides/warrior/)</code></td><td>קישור למדריך אחר באתר</td></tr>
        <tr><td><code>{{lv 30}}</code></td><td>תג רמה בסגנון המשחק</td></tr>
        <tr><td><code>:::tip כותרת</code> … <code>:::</code></td><td>תיבת טיפ ירוקה. גם <code>warning</code>, <code>info</code></td></tr>
        <tr><td><code>:::npc שם (Name)</code> … <code>:::</code></td><td>בועת דיבור של NPC</td></tr>
        <tr><td><code>:::stats כותרת</code><br><code>מפתח: ערך</code><br><code>:::</code></td><td>כרטיס נתונים כהה, כמו חלון פריט במשחק</td></tr>
        <tr><td><code>[[shot henesys | כיתוב]]</code></td><td>מסגרת לצילום מסך. מופיעה באתר רק אחרי שמעלים בלשונית "תמונות" קובץ בשם הזה (למשל henesys.png)</td></tr>
        <tr><td><code>[[ad]]</code></td><td>מקום לפרסומת. אם לא שמים, פרסומת נכנסת אוטומטית לפני הכותרת השלישית</td></tr>
      </tbody></table></div>
      <p class="muted">שמות ערים ודמויות: בעברית עם האנגלית בסוגריים. שמות של מפות, פריטים וסקילים: באנגלית, כמו במשחק.</p>
    </div>
    <div class="ed-actions">
      <button class="btn" type="submit" id="saveBtn">${offline ? 'הורדת הקובץ' : 'פרסום'}</button>
      <span class="muted small" id="saveNote">${offline ? 'מצב בלי חיבור: הקובץ יורד למחשב.' : 'הפרסום שומר ב-GitHub, והאתר מתעדכן תוך כדקה-שתיים.'}</span>
      <span class="spacer"></span>
      ${origSlug && !offline ? `<button class="btn btn-danger btn-sm" type="button" id="delBtn">מחיקה</button>` : ''}
    </div>
  </form>
  <div class="ed-preview">
    <div class="pv-bar"><strong>תצוגה מקדימה</strong><span class="spacer"></span><button class="tab is-on" type="button" data-pv="desktop">מחשב</button><button class="tab" type="button" data-pv="mobile">טלפון</button></div>
    <iframe class="pv-frame" id="pv" title="תצוגה מקדימה"></iframe>
  </div>
</div>`;

  const form = $('#edForm');
  const ta = $('#body');
  const fields = ['title', 'slug', 'category', 'summary', 'level', 'cls', 'icon', 'order', 'short', 'updated', 'keywords', 'related', 'sources', 'cover', 'coverAlt', 'thumb'];
  function fill(d, b) {
    for (const f of fields) {
      const el = form.elements[f]; if (!el) continue;
      const v = d[f];
      el.value = Array.isArray(v) ? v.join(', ') : (v ?? '');
    }
    if (form.elements.draft) form.elements.draft.checked = !!d.draft;
    ta.value = b;
  }
  function collect() {
    const d = { ...data };
    for (const f of fields) {
      const el = form.elements[f]; if (!el) continue;
      let v = el.value.trim();
      if (['keywords', 'related', 'sources'].includes(f)) v = v ? v.split(',').map(x => x.trim()).filter(Boolean) : undefined;
      else if (f === 'order') v = v === '' ? undefined : Number(v);
      d[f] = v === '' ? undefined : v;
    }
    if (form.elements.draft) d.draft = form.elements.draft.checked || undefined;
    // keep key order tidy
    const order = ['title', 'short', 'slug', 'category', 'cls', 'order', 'level', 'icon', 'cover', 'coverAlt', 'thumb', 'summary', 'keywords', 'related', 'updated', 'sources', 'draft'];
    const out = {};
    for (const k of order) if (d[k] !== undefined && d[k] !== '' && !(Array.isArray(d[k]) && !d[k].length)) out[k] = d[k];
    for (const k of Object.keys(d)) if (!(k in out) && d[k] !== undefined && !['body', 'file'].includes(k)) out[k] = d[k];
    return { d: out, b: ta.value };
  }
  fill(data, body);

  // auto slug from title for new docs (latin letters only)
  let slugTouched = !!origSlug;
  form.elements.slug.addEventListener('input', () => { slugTouched = true; });
  form.elements.title.addEventListener('input', () => {
    if (slugTouched) return;
    const latin = (form.elements.title.value.match(/[A-Za-z0-9 ]+/g) || []).join(' ');
    form.elements.slug.value = slugify(latin).replace(/[^a-z0-9-]/g, '');
  });

  if (draft) {
    $('#restoreDraft').addEventListener('click', () => { fill(draft.d, draft.b); $('#draftBox').remove(); schedule(); toast('הטיוטה שוחזרה.'); });
    $('#dropDraft').addEventListener('click', () => { store.del(draftKey); $('#draftBox').remove(); });
  }

  // ----- preview -----
  const pv = $('#pv');
  let pvTimer = null;
  function renderPreview() {
    const { d, b } = collect();
    const ctx = { config: { ...config }, base: SITE_BASE, guides: manifest.guides.filter(g => g.slug !== origSlug && g.slug !== d.slug), preview: true, images: previewImages };
    let html;
    if (isPage) html = staticPage(ctx, { ...d, slug: d.slug || 'page', body: b });
    else {
      const g = { ...d, slug: d.slug || 'new', title: d.title || 'מדריך ללא כותרת', body: b };
      ctx.guides = [...ctx.guides, g].sort((x, y) => (x.order ?? 50) - (y.order ?? 50));
      html = guidePage(ctx, g);
    }
    for (const [p, url] of Object.entries(localImages)) html = html.split(SITE_BASE + p).join(url);
    const y = pv.contentWindow ? pv.contentWindow.scrollY : 0;
    pv.onload = () => { try { pv.contentWindow.scrollTo(0, y); } catch {} };
    pv.srcdoc = html;
  }
  function schedule() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => {
      renderPreview();
      const { d, b } = collect();
      store.set(draftKey, JSON.stringify({ d, b, ts: Date.now() }));
    }, 350);
  }
  form.addEventListener('input', schedule);
  let previewImages = {};
  renderPreview();
  listImages().then(files => {
    files.forEach(f => { previewImages[f.name.replace(/\.[^.]+$/, '')] = f.name; localImages[`images/${f.name}`] = localImages[`images/${f.name}`] || f.download_url; });
    renderPreview();
  }).catch(() => {});

  app.querySelectorAll('[data-pv]').forEach(btn => btn.addEventListener('click', () => {
    app.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('is-on', x === btn));
    pv.classList.toggle('mobile', btn.dataset.pv === 'mobile');
  }));
  app.querySelectorAll('.ed-tabs .tab').forEach(btn => btn.addEventListener('click', () => {
    app.querySelectorAll('.ed-tabs .tab').forEach(x => x.classList.toggle('is-on', x === btn));
    $('.ed').dataset.view = btn.dataset.view;
    if (btn.dataset.view === 'preview') renderPreview();
  }));

  // ----- toolbar -----
  function insert(before, after = '', placeholder = '') {
    const s = ta.selectionStart, en = ta.selectionEnd;
    const sel = ta.value.slice(s, en) || placeholder;
    ta.setRangeText(before + sel + after, s, en, 'end');
    if (!ta.value.slice(s, en).length && placeholder) {
      ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + placeholder.length;
    }
    ta.focus(); schedule();
  }
  const block = text => {
    const s = ta.selectionStart;
    const pre = s > 0 && ta.value[s - 1] !== '\n' ? '\n\n' : (s > 1 && ta.value[s - 2] !== '\n' ? '\n' : '');
    insert(pre + text, '\n');
  };
  const SNIPS = {
    h2: () => block('## כותרת חדשה'),
    h3: () => block('### כותרת משנה'),
    bold: () => insert('**', '**', 'טקסט'),
    link: () => insert('[', '](/guides/beginners-guide/)', 'טקסט הקישור'),
    ul: () => block('- פריט ראשון\n- פריט שני\n- פריט שלישי'),
    ol: () => block('1. שלב ראשון\n2. שלב שני\n3. שלב שלישי'),
    table: () => block('| עמודה | עמודה | עמודה |\n|---|---|---|\n| ערך | ערך | ערך |\n| ערך | ערך | ערך |'),
    tip: () => block(':::tip טיפ\nכתבו כאן את הטיפ.\n:::'),
    warning: () => block(':::warning זהירות\nכתבו כאן את האזהרה.\n:::'),
    info: () => block(':::info לידיעתך\nכתבו כאן את המידע.\n:::'),
    npc: () => block(':::npc שם הדמות (Name)\nמה שהדמות אומרת.\n:::'),
    stats: () => block(':::stats כותרת הכרטיס\nרמה: 30\nHP: 1,000\nחולשה: אש\n:::'),
    lv: () => insert('{{lv ', '}}', '30'),
    ad: () => block('[[ad]]'),
    shot: () => block('[[shot שם-באנגלית | כיתוב מתחת לתמונה]]'),
    img: () => openPicker(path => block(`![תיאור התמונה](${path})`)),
    help: () => { const h = $('#helpBox'); h.hidden = !h.hidden; },
  };
  $('#toolbar').addEventListener('click', ev => { const b = ev.target.closest('[data-ins]'); if (b) SNIPS[b.dataset.ins](); });

  let uploadTarget = null;
  app.querySelectorAll('[data-upload]').forEach(b => b.addEventListener('click', () => {
    const field = b.dataset.upload;
    if (offline) { uploadTarget = field; $('#imgInput').click(); return; }
    openPicker(path => { form.elements[field].value = path; schedule(); });
  }));
  $('#imgInput').addEventListener('change', async ev => {
    const file = ev.target.files[0]; ev.target.value = '';
    const target = uploadTarget; uploadTarget = null;
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('התמונה גדולה מ-2MB. הקטינו אותה ונסו שוב.', true);
    const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    const name = `${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
    const path = `images/${name}`;
    localImages[path] = dataUrl;
    if (!offline) {
      toast('מעלה תמונה…', false, 20000);
      try { await putFile(`content/images/${name}`, dataUrl.split(',')[1], `הוספת תמונה: ${name}`, null, true); toast('התמונה הועלתה.'); }
      catch (x) { return toast(x.message, true); }
    }
    if (target) { form.elements[target].value = `/${path}`; schedule(); return; }
    block(`![תיאור התמונה](/${path})`);
  });

  // ----- save -----
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const { d, b } = collect();
    if (!d.title) return toast('חסרה כותרת.', true);
    if (!/^[a-z0-9-]+$/.test(d.slug || '')) return toast('הכתובת צריכה להיות באנגלית: אותיות קטנות, מספרים ומקפים.', true);
    if (!isPage) d.updated = d.updated || today();
    const text = stringifyFrontMatter(d, b);
    if (offline) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
      a.download = `${d.slug}.md`; a.click();
      store.del(draftKey);
      return toast(`הקובץ ירד. העלו אותו לתיקייה ${dir} במאגר.`);
    }
    const btn = $('#saveBtn'); btn.disabled = true; btn.textContent = 'מפרסם…';
    try {
      const path = `${dir}/${d.slug}.md`;
      if (origSlug && origSlug !== d.slug) {
        const exists = await getFile(path);
        if (exists) throw new Error('כבר יש מדריך עם הכתובת הזו. בחרו כתובת אחרת.');
        await putFile(path, text, `שינוי כתובת: ${d.title}`);
        await deleteFile(`${dir}/${origSlug}.md`, sha, `הסרת כתובת ישנה: ${origSlug}`);
      } else {
        if (!origSlug) { const exists = await getFile(path); if (exists) throw new Error('כבר יש מדריך עם הכתובת הזו. בחרו כתובת אחרת.'); }
        await putFile(path, text, `${origSlug ? 'עדכון' : 'מדריך חדש'}: ${d.title}`, origSlug ? sha : null);
      }
      store.del(draftKey);
      // keep the local manifest in sync so lists and previews stay current
      const list = isPage ? manifest.pages : manifest.guides;
      const i = list.findIndex(g => g.slug === (origSlug || d.slug));
      const meta = { ...d, file: `${dir}/${d.slug}.md` };
      if (i > -1) list[i] = meta; else list.push(meta);
      toast('פורסם! האתר יתעדכן תוך כדקה-שתיים.', false, 6000);
      checkDeploy(true);
      location.hash = `#/edit/${kind}/${d.slug}`;
      if (origSlug === d.slug) renderEditor(kind, d.slug);
    } catch (x) {
      toast(x.message, true, 8000);
      btn.disabled = false; btn.textContent = 'פרסום';
    }
  });

  const del = $('#delBtn');
  if (del) del.addEventListener('click', async () => {
    if (!confirm(`למחוק את "${data.title}"? אי אפשר לבטל.`)) return;
    try {
      await deleteFile(`${dir}/${origSlug}.md`, sha, `מחיקה: ${data.title}`);
      const list = isPage ? manifest.pages : manifest.guides;
      const i = list.findIndex(g => g.slug === origSlug); if (i > -1) list.splice(i, 1);
      toast('נמחק. האתר יתעדכן תוך כדקה-שתיים.');
      checkDeploy(true);
      location.hash = `#/list/${kind}`;
    } catch (x) { toast(x.message, true); }
  });
}

// ---------------- settings ----------------
async function renderSettings(section) {
  app.innerHTML = `<div class="loading">טוען הגדרות…</div>`;
  let cfg = config, sha = null;
  if (!offline) {
    try { const f = await getFile('site.config.json'); if (f) { cfg = JSON.parse(f.text); sha = f.sha; } }
    catch (x) { toast(x.message, true); }
  }
  const ads = cfg.ads || { slots: {} };
  const v = x => e(x ?? '');
  app.innerHTML = `
<div class="dash-head"><a class="btn btn-ghost btn-sm" href="#/list/guides">חזרה</a><h1>הגדרות האתר</h1></div>
<form id="setForm" class="ed-form" style="max-width:820px">
  <section class="window"><div class="window-bar"><span>כללי</span></div><div class="panel ed-form">
    <div class="grid-2">
      <label class="f">שם האתר<input class="in" name="siteName" value="${v(cfg.siteName)}" required></label>
      <label class="f">סלוגן<input class="in" name="tagline" value="${v(cfg.tagline)}"></label>
    </div>
    <label class="f">תיאור לגוגל<small>עד כ-160 תווים</small><textarea class="in" name="description" rows="2">${v(cfg.description)}</textarea></label>
    <label class="f">כותרת דף הבית<input class="in" name="heroTitle" value="${v(cfg.heroTitle)}"></label>
    <label class="f">טקסט דף הבית<textarea class="in" name="heroText" rows="2">${v(cfg.heroText)}</textarea></label>
    <label class="f">טקסט בתחתית<textarea class="in" name="footerText" rows="2">${v(cfg.footerText)}</textarea></label>
  </div></section>
  <section class="window"><div class="window-bar"><span>תמונות המקצועות בדף הבית</span></div><div class="panel ed-form">
    <p class="muted small">כתובת של תמונה שהעליתם (למשל /images/warrior.png). השאירו ריק כדי להציג את האייקון הרגיל.</p>
    <div class="grid-2">
      ${Object.entries(CLASS_INFO).map(([k, info]) => `<label class="f">${info.name} (${info.en})<span class="row"><input class="in" name="ci_${k}" dir="ltr" value="${v((cfg.classImages || {})[k])}" placeholder="/images/…" style="flex:1"><button type="button" class="btn btn-ghost btn-sm" data-pick="ci_${k}">בחירה</button></span></label>`).join('')}
    </div>
  </div></section>
  <section class="window" id="a11ySection"><div class="window-bar"><span>הצהרת נגישות: פרטי קשר</span></div><div class="panel ed-form">
    <p class="muted small">החוק מחייב לפרסם בהצהרת הנגישות פרטי קשר של רכז/ת נגישות. הפרטים יופיעו בעמוד <a href="${SITE_BASE}accessibility/" target="_blank" rel="noopener">הצהרת נגישות</a>.</p>
    <div class="grid-2">
      <label class="f">שם רכז/ת הנגישות<input class="in" name="a11yName" value="${v((cfg.accessibility || {}).name)}"></label>
      <label class="f">דוא״ל<input class="in" name="a11yEmail" type="email" dir="ltr" value="${v((cfg.accessibility || {}).email)}"></label>
      <label class="f">טלפון<input class="in" name="a11yPhone" type="tel" dir="ltr" value="${v((cfg.accessibility || {}).phone)}"></label>
      <label class="f">תאריך עדכון ההצהרה<input class="in" name="a11yUpdated" value="${v((cfg.accessibility || {}).updated)}" placeholder="14.11.2026"></label>
    </div>
  </div></section>
  <section class="window" id="catSection"><div class="window-bar"><span>קטגוריות</span></div><div class="panel ed-form">
    <p class="muted small">השמות והתיאורים של הקטגוריות, כפי שהם מופיעים בתפריט ובעמודי הקטגוריה.</p>
    ${(cfg.categories || []).map((c, i) => `<div class="grid-3">
      <label class="f">שם מלא<input class="in" name="cat_name_${i}" value="${v(c.name)}"></label>
      <label class="f">שם קצר בתפריט<input class="in" name="cat_short_${i}" value="${v(c.short)}"></label>
      <label class="f">תיאור<input class="in" name="cat_desc_${i}" value="${v(c.desc)}"></label>
    </div>`).join('')}
  </div></section>
  <section class="window"><div class="window-bar"><span>דומיין</span></div><div class="panel ed-form">
    <label class="f">כתובת האתר המלאה<small>משמשת למפת האתר ולגוגל</small><input class="in" name="siteUrl" dir="ltr" value="${v(cfg.siteUrl)}" placeholder="https://www.example.co.il"></label>
    <label class="f">דומיין פרטי (אופציונלי)<small>למשל www.mapleorz.co.il. אחרי השמירה, הגדירו CNAME אצל רשם הדומיין ל-${v(gh().owner)}.github.io</small><input class="in" name="customDomain" dir="ltr" value="${v(cfg.customDomain)}"></label>
  </div></section>
  <section class="window"><div class="window-bar"><span>פרסומות וסטטיסטיקות</span></div><div class="panel ed-form">
    <label class="check-f"><input type="checkbox" name="adsEnabled" ${ads.enabled ? 'checked' : ''}> להציג פרסומות של Google AdSense</label>
    <label class="f">מזהה מפרסם (Publisher ID)<small>מתחיל ב-ca-pub-. נמצא ב-AdSense תחת Account ← Account information</small><input class="in" name="adsClient" dir="ltr" value="${v(ads.client)}" placeholder="ca-pub-0000000000000000"></label>
    <div class="grid-3">
      <label class="f">יחידה: באנר עליון<input class="in" name="slotTop" dir="ltr" value="${v((ads.slots || {}).top)}" placeholder="1234567890"></label>
      <label class="f">יחידה: בתוך מדריך<input class="in" name="slotIn" dir="ltr" value="${v((ads.slots || {}).inArticle)}"></label>
      <label class="f">יחידה: צד<input class="in" name="slotSide" dir="ltr" value="${v((ads.slots || {}).sidebar)}"></label>
    </div>
    <p class="muted small">אפשר להשאיר את מזהי היחידות ריקים ולהפעיל ב-AdSense "Auto ads". קובץ ads.txt נוצר אוטומטית.</p>
    <label class="f">ייחוס למקור (לפי מדריך ה-IP של Nexon)<small>טקסט שמופיע בתחתית כל עמוד</small><input class="in" name="attrText" value="${v((cfg.attribution || {}).text)}"></label>
    <label class="f">קישור לייחוס<small>Nexon מבקשת קישור לערוץ היוטיוב של המשחק, אם יש</small><input class="in" name="attrUrl" dir="ltr" value="${v((cfg.attribution || {}).url)}" placeholder="https://www.youtube.com/…"></label>
    <label class="f">Google Analytics (Measurement ID)<input class="in" name="analyticsId" dir="ltr" value="${v(cfg.analyticsId)}" placeholder="G-XXXXXXXXXX"></label>
  </div></section>
  <div class="ed-actions"><button class="btn" type="submit">שמירת ההגדרות</button><span class="muted small">האתר ייבנה מחדש עם ההגדרות החדשות.</span></div>
</form>`;
  app.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const el = $('#setForm').elements[b.dataset.pick];
    openPicker(path => { el.value = path; });
  }));
  if (section === 'categories') $('#catSection').scrollIntoView({ block: 'start' });
  $('#setForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target.elements;
    const next = {
      ...cfg,
      siteName: f.siteName.value.trim(), tagline: f.tagline.value.trim(), description: f.description.value.trim(),
      heroTitle: f.heroTitle.value.trim(), heroText: f.heroText.value.trim(), footerText: f.footerText.value.trim(),
      siteUrl: f.siteUrl.value.trim().replace(/\/$/, ''), customDomain: f.customDomain.value.trim(), analyticsId: f.analyticsId.value.trim(),
      attribution: { text: f.attrText.value.trim(), url: f.attrUrl.value.trim() },
      accessibility: { name: f.a11yName.value.trim(), email: f.a11yEmail.value.trim(), phone: f.a11yPhone.value.trim(), updated: f.a11yUpdated.value.trim() },
      categories: (cfg.categories || []).map((c, i) => ({ ...c, name: f['cat_name_' + i].value.trim() || c.name, short: f['cat_short_' + i].value.trim(), desc: f['cat_desc_' + i].value.trim() })),
      classImages: Object.fromEntries(Object.keys(CLASS_INFO).map(k => [k, f['ci_' + k].value.trim()]).filter(([, x]) => x)),
      ads: { enabled: f.adsEnabled.checked, client: f.adsClient.value.trim(), slots: { top: f.slotTop.value.trim(), inArticle: f.slotIn.value.trim(), sidebar: f.slotSide.value.trim() } },
    };
    if (next.ads.client && !/^ca-pub-\d+$/.test(next.ads.client)) return toast('מזהה המפרסם צריך להיראות כך: ca-pub-1234567890123456', true);
    const text = JSON.stringify(next, null, 2) + '\n';
    if (offline) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'site.config.json'; a.click();
      return toast('הקובץ ירד. החליפו בו את site.config.json במאגר.');
    }
    try {
      await putFile('site.config.json', text, 'עדכון הגדרות האתר', sha);
      config = next; manifest.config = next;
      toast('ההגדרות נשמרו. האתר יתעדכן תוך כדקה-שתיים.');
      checkDeploy(true);
      renderSettings();
    } catch (x) { toast(x.message, true); }
  });
}

// ---------------- images ----------------
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
async function listImages() {
  if (offline) return [];
  const j = await api(repoPath('content/images') + `?ref=${gh().branch || 'main'}&t=${Date.now()}`, { allow404: true });
  return (j || []).filter(f => f.type === 'file' && IMG_RE.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
}
function cleanName(name) {
  const m = name.toLowerCase().match(/^(.*?)(\.[a-z0-9]+)?$/);
  const base = (m[1] || 'image').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || ('image-' + Date.now());
  return base + (m[2] || '.png');
}
const readDataUrl = file => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
// מעלה תמונה ל-content/images. אם קיים קובץ באותו שם, מחליף אותו (sha נדרש להחלפה).
async function uploadImage(file, existing = [], forcedBase = null) {
  if (!IMG_RE.test(file.name)) throw new Error(`${file.name}: זה לא קובץ תמונה (PNG, JPG, GIF, WEBP, SVG).`);
  if (file.size > 3 * 1024 * 1024) throw new Error(`${file.name}: גדול מ-3MB. הקטינו אותו ונסו שוב.`);
  const name = forcedBase ? cleanName(forcedBase + (file.name.match(/\.[a-z0-9]+$/i) || ['.png'])[0]) : cleanName(file.name);
  // אותו צילום עם סיומת אחרת: מחליפים את הקודם
  if (forcedBase) for (const f of existing.filter(x => x.name !== name && x.name.replace(/\.[^.]+$/, '') === forcedBase)) { await deleteFile(`content/images/${f.name}`, f.sha, `החלפת צילום מסך: ${f.name}`); }
  const dataUrl = await readDataUrl(file);
  const prev = existing.find(f => f.name === name);
  await putFile(`content/images/${name}`, dataUrl.split(',')[1], `${prev ? 'החלפת' : 'הוספת'} תמונה: ${name}`, prev && prev.sha, true);
  localImages[`images/${name}`] = dataUrl;
  return `/images/${name}`;
}
async function uploadMany(files, existing) {
  const done = [], failed = [];
  for (const f of files) {
    toast(`מעלה ${done.length + failed.length + 1} מתוך ${files.length}…`, false, 60000);
    try { done.push(await uploadImage(f, existing)); } catch (x) { failed.push(x.message); }
  }
  if (failed.length) toast(failed.join(' '), true, 9000);
  else toast(done.length === 1 ? 'התמונה הועלתה.' : `${done.length} תמונות הועלו.`);
  if (done.length) checkDeploy(true);
  return done;
}
const thumbHtml = f => `<img src="${e(f.download_url)}" alt="" loading="lazy">`;

// חלון בחירת תמונה (משמש את העורך ואת ההגדרות)
async function openPicker(onPick) {
  const layer = document.createElement('div');
  layer.className = 'picker-layer';
  layer.innerHTML = `<div class="window picker" role="dialog" aria-modal="true" aria-label="בחירת תמונה">
    <div class="window-bar"><span>בחירת תמונה</span><button type="button" class="tb" data-close>סגירה</button></div>
    <div class="panel">
      <div class="row" style="margin-bottom:10px"><label class="btn btn-sm">העלאת תמונה חדשה<input type="file" accept="image/*" multiple hidden data-up></label><input class="in filter" type="search" placeholder="סינון לפי שם…" data-filter><span class="muted small" data-count></span></div>
      <div class="media-grid" data-grid><div class="loading">טוען תמונות…</div></div>
    </div></div>`;
  document.body.appendChild(layer);
  const close = () => { layer.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = ev => { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  layer.addEventListener('click', ev => { if (ev.target === layer || ev.target.closest('[data-close]')) close(); });
  let files = [];
  const draw = () => {
    const q = layer.querySelector('[data-filter]').value.toLowerCase();
    const list = files.filter(f => f.name.includes(q));
    layer.querySelector('[data-count]').textContent = `${files.length} תמונות`;
    layer.querySelector('[data-grid]').innerHTML = list.map(f => `<button type="button" class="media-item" data-path="/images/${e(f.name)}" data-url="${e(f.download_url)}">${thumbHtml(f)}<span>${e(f.name)}</span></button>`).join('') || '<p class="muted">אין עדיין תמונות. העלו את הראשונה.</p>';
  };
  try { files = await listImages(); } catch (x) { toast(x.message, true); }
  draw();
  layer.querySelector('[data-filter]').addEventListener('input', draw);
  layer.querySelector('[data-grid]').addEventListener('click', ev => {
    const b = ev.target.closest('[data-path]'); if (!b) return;
    localImages[b.dataset.path.slice(1)] = localImages[b.dataset.path.slice(1)] || b.dataset.url;
    onPick(b.dataset.path); close();
  });
  layer.querySelector('[data-up]').addEventListener('change', async ev => {
    const picked = [...ev.target.files]; ev.target.value = '';
    const done = await uploadMany(picked, files);
    if (done.length === 1) { onPick(done[0]); close(); return; }
    files = await listImages().catch(() => files); draw();
  });
}

// ספריית התמונות + רשימת מה חסר
async function renderMedia() {
  if (offline) { app.innerHTML = '<p class="muted">ניהול תמונות זמין רק כשמחוברים.</p>'; return; }
  app.innerHTML = '<div class="loading">טוען תמונות…</div>';
  let files = [];
  try { files = await listImages(); } catch (x) { toast(x.message, true); }
  const used = new Set();
  manifest.guides.forEach(g => { [g.cover, g.thumb].forEach(x => x && used.add(x)); });
  Object.values(config.classImages || {}).forEach(x => used.add(x));
  const missingRows = manifest.guides.map(g => {
    const need = [];
    if (!g.cover) need.push('באנר');
    if (!g.thumb) need.push('תמונת כרטיס');
    return need.length ? `<tr><td>${e(g.title)}</td><td>${need.join(', ')}</td><td><a class="btn btn-ghost btn-sm" href="#/edit/guides/${encodeURIComponent(g.slug)}">הוספה</a></td></tr>` : '';
  }).join('');
  const have = new Set(files.map(f => f.name.replace(/\.[^.]+$/, '')));
  const shotMap = new Map();
  manifest.guides.forEach(g => (g.shots || []).forEach(sh => {
    if (!shotMap.has(sh.name)) shotMap.set(sh.name, { ...sh, guides: [] });
    shotMap.get(sh.name).guides.push(g);
  }));
  (manifest.siteShots || []).forEach(sh => { if (!shotMap.has(sh.name)) shotMap.set(sh.name, { ...sh, guides: [], where: sh.where }); });
  const shots = [...shotMap.values()];
  const shotsMissing = shots.filter(sh => !have.has(sh.name));
  const shotRows = shots.map(sh => `<tr class="${have.has(sh.name) ? 'ok' : ''}"><td dir="ltr"><code>${e(sh.name)}</code></td><td>${e(sh.caption)}</td><td>${sh.where ? e(sh.where) : ''}${sh.guides.map(g => `<a href="${SITE_BASE}guides/${encodeURIComponent(g.slug)}/" target="_blank" rel="noopener">${e(g.short || g.title)}</a>`).join(', ')}</td><td>${have.has(sh.name) ? '<span class="lv">הועלה</span>' : ''} <label class="btn btn-ghost btn-sm">${have.has(sh.name) ? 'החלפה' : 'העלאה'}<input type="file" accept="image/*" hidden data-shot="${e(sh.name)}"></label></td></tr>`).join('');
  const classMissing = Object.entries(CLASS_INFO).filter(([k]) => !(config.classImages || {})[k]).map(([, i]) => i.name);

  app.innerHTML = `
<div class="dash-head"><a class="btn btn-ghost btn-sm" href="#/list/guides">חזרה</a><h1>תמונות</h1><span class="muted">${files.length} תמונות</span></div>
<label class="dropzone window" id="drop">
  <input type="file" accept="image/*" multiple hidden id="mediaIn">
  <strong>גררו לכאן תמונות, או לחצו לבחירה</strong>
  <span class="muted small">אפשר כמה תמונות ביחד. עד 3MB לתמונה. קובץ עם שם שכבר קיים יחליף את הקודם.</span>
</label>
<div class="row" style="margin:14px 0 10px"><input class="in filter" id="mFilter" type="search" placeholder="סינון לפי שם…"></div>
<div class="media-grid big" id="mGrid">
${files.map(f => `<div class="media-card" data-name="${e(f.name)}">
  <a href="${e(f.download_url)}" target="_blank" rel="noopener" class="media-thumb">${thumbHtml(f)}</a>
  <div class="media-meta"><span class="media-name" dir="ltr">${e(f.name)}</span>${used.has('/images/' + f.name) ? '<span class="lv">בשימוש</span>' : ''}</div>
  <div class="row"><button class="tb" data-copy="/images/${e(f.name)}">העתקת קוד</button><label class="tb">החלפה<input type="file" accept="image/*" hidden data-replace="${e(f.name)}"></label><button class="tb" data-del="${e(f.name)}" data-sha="${e(f.sha)}">מחיקה</button></div>
</div>`).join('') || '<p class="muted">אין עדיין תמונות.</p>'}
</div>
<section class="window" style="margin-top:26px" id="shotsSection"><div class="window-bar"><span>צילומי מסך במדריכים</span><small>${shots.length - shotsMissing.length} מתוך ${shots.length} הועלו</small></div><div class="panel">
  <p class="muted small">כל שורה היא מסגרת שמחכה לצילום מסך מהמשחק. "העלאה" שומרת את הקובץ בשם הנכון, והוא יופיע במקום שלו בכל המדריכים תוך כדקה-שתיים. מסגרת בלי תמונה לא מוצגת לגולשים. מומלץ לחתוך את הצילום לחלק הרלוונטי בלבד, ולהעלות PNG או JPG ברוחב של עד 1200 פיקסלים.</p>
  <label class="check-f small" style="margin-bottom:8px"><input type="checkbox" id="onlyMissing" checked> להציג רק את מה שחסר</label>
  <div class="table-wrap"><table class="shots-table"><thead><tr><th>שם הקובץ</th><th>מה לצלם</th><th>מופיע ב</th><th></th></tr></thead><tbody>${shotRows}</tbody></table></div>
</div></section>
<section class="window" style="margin-top:26px"><div class="window-bar"><span>מה עוד חסר</span></div><div class="panel">
  <p class="muted small">לכל מדריך אפשר להוסיף באנר (בראש המדריך) ותמונת כרטיס (ברשימות ובדף הבית). "הוספה" פותחת את המדריך בעורך, ושם לוחצים "בחירה" ליד השדה.</p>
  ${classMissing.length ? `<p><strong>תמונות מקצועות לדף הבית:</strong> חסרות ל${classMissing.join(', ')}. <a href="#/settings">להגדרות</a></p>` : '<p>תמונות המקצועות בדף הבית: הכול מוכן.</p>'}
  ${missingRows ? `<div class="table-wrap"><table><thead><tr><th>מדריך</th><th>חסר</th><th></th></tr></thead><tbody>${missingRows}</tbody></table></div>` : '<p>לכל המדריכים יש תמונות.</p>'}
</div></section>`;

  const refresh = () => renderMedia();
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, ev => { ev.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, ev => { ev.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', async ev => { const fl = [...ev.dataTransfer.files]; if (fl.length) { await uploadMany(fl, files); refresh(); } });
  $('#mediaIn').addEventListener('change', async ev => { const fl = [...ev.target.files]; ev.target.value = ''; if (fl.length) { await uploadMany(fl, files); refresh(); } });
  $('#mFilter').addEventListener('input', ev => { const q = ev.target.value.toLowerCase(); app.querySelectorAll('.media-card').forEach(c => { c.hidden = q && !c.dataset.name.includes(q); }); });
  $('#mGrid').addEventListener('click', async ev => {
    const c = ev.target.closest('[data-copy]');
    if (c) {
      const code = `![תיאור](${c.dataset.copy})`;
      try { await navigator.clipboard.writeText(code); toast('הקוד הועתק. הדביקו אותו במדריך.'); } catch { prompt('העתיקו את הקוד:', code); }
      return;
    }
    const d = ev.target.closest('[data-del]');
    if (d) {
      const n = d.dataset.del;
      if (used.has('/images/' + n) && !confirm(`התמונה ${n} בשימוש באתר. למחוק בכל זאת?`)) return;
      if (!used.has('/images/' + n) && !confirm(`למחוק את ${n}?`)) return;
      try { await deleteFile(`content/images/${n}`, d.dataset.sha, `מחיקת תמונה: ${n}`); toast('נמחקה.'); checkDeploy(true); refresh(); }
      catch (x) { toast(x.message, true); }
    }
  });
  const tableEl = app.querySelector('.shots-table');
  const applyFilter = () => tableEl.classList.toggle('only-missing', $('#onlyMissing').checked);
  $('#onlyMissing').addEventListener('change', applyFilter); applyFilter();
  app.querySelectorAll('[data-shot]').forEach(inp => inp.addEventListener('change', async ev => {
    const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
    try {
      toast('מעלה צילום מסך…', false, 60000);
      await uploadImage(file, files, ev.target.dataset.shot);
      toast('הצילום הועלה. הוא יופיע באתר תוך כדקה-שתיים.'); checkDeploy(true); refresh();
    } catch (x) { toast(x.message, true); }
  }));
  app.querySelectorAll('[data-replace]').forEach(inp => inp.addEventListener('change', async ev => {
    const file = ev.target.files[0]; if (!file) return;
    const target = ev.target.dataset.replace;
    const renamed = new File([file], target, { type: file.type });
    await uploadMany([renamed], files); refresh();
  }));
}

// ---------------- visual image editing ----------------
// מציג את האתר האמיתי בתוך מסגרת, ומוסיף כפתור העלאה ליד כל מקום שאפשר להציג בו תמונה:
// צילומי מסך במדריכים, באנר של מדריך, תמונת כרטיס ברשימות, ותמונות המקצועות בדף הבית.
const VIS_CSS = `
.edit-fab, .hud, .levelup, .totop { display: none !important; }
body.has-hud { padding-bottom: 0 !important; }
[data-vis] { position: relative; outline: 2px dashed #F2C14E; outline-offset: 3px; border-radius: 12px; }
.vis-btn { position: absolute; z-index: 30; top: 8px; inset-inline-start: 8px; display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; min-height: 36px; border: 0; border-radius: 10px; cursor: pointer; font: 800 14px/1 Assistant, system-ui, sans-serif;
  color: #1B1205; background: linear-gradient(180deg, #F7B24A, #E07F18); box-shadow: 0 4px 14px rgba(0,0,0,.45); white-space: nowrap; }
.vis-btn:hover { filter: brightness(1.08); }
.vis-btn.small { top: auto; bottom: -10px; inset-inline-start: -10px; padding: 4px 7px; min-height: 26px; font-size: 12px; border-radius: 8px; }
.vis-busy .vis-btn { opacity: .6; pointer-events: none; }
.g-icon[data-vis], .job-icon[data-vis] { overflow: visible !important; }
`;
async function renderVisual(rawPath) {
  if (offline) { app.innerHTML = '<p class="muted">עריכה על גבי האתר זמינה רק כשמחוברים.</p>'; return; }
  const path = decodeURIComponent(rawPath || '').replace(/^\/+/, '');
  const pages = [
    { p: '', t: 'דף הבית (תמונות המקצועות וצילום ראשי)' },
    { p: 'guides/', t: 'כל המדריכים (תמונות כרטיס)' },
    ...manifest.guides.map(g => ({ p: `guides/${g.slug}/`, t: `מדריך: ${g.title}` })),
    ...(config.categories || []).map(c => ({ p: `category/${c.id}/`, t: `קטגוריה: ${c.name}` })),
  ];
  app.innerHTML = `
<div class="dash-head">
  <a class="btn btn-ghost btn-sm" href="#/list/guides">חזרה</a>
  <h1>עריכת תמונות על גבי האתר</h1>
  <span class="spacer"></span>
  <label class="f" style="min-width:min(420px,100%)"><span class="sr-only">עמוד</span><select class="in" id="vPage">${pages.map(x => `<option value="${e(x.p)}"${x.p === path ? ' selected' : ''}>${e(x.t)}</option>`).join('')}</select></label>
</div>
<p class="muted small">זה האתר כפי שהגולשים רואים אותו. ליד כל מקום שאפשר לשים בו תמונה יש כפתור העלאה. התמונה נשמרת במאגר ומופיעה כאן מיד, ובאתר עצמו תוך כדקה-שתיים. מקומות מסומנים בקו מקווקו זהוב; מסגרות ריקות מוצגות כאן בלבד, ולגולשים הן מוסתרות עד שמעלים תמונה. אפשר גם לנווט בתוך האתר בלחיצה על קישורים.</p>
<iframe id="vFrame" class="vis-frame" title="האתר במצב עריכת תמונות" src="${SITE_BASE}${path}"></iframe>
<input type="file" id="vFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`;
  const frame = $('#vFrame'), sel = $('#vPage'), fileIn = $('#vFile');
  sel.addEventListener('change', () => { frame.src = SITE_BASE + sel.value; history.replaceState(null, '', '#/visual/' + encodeURIComponent(sel.value)); });
  let files = [];
  try { files = await listImages(); } catch (x) { toast(x.message, true); }

  const pickFile = () => new Promise(res => { fileIn.value = ''; fileIn.onchange = () => res(fileIn.files[0] || null); fileIn.click(); });
  async function setGuideField(slug, field, value) {
    const f = await getFile(`content/guides/${slug}.md`);
    if (!f) throw new Error('לא מצאתי את קובץ המדריך במאגר.');
    const p = parseFrontMatter(f.text);
    p.data[field] = value;
    await putFile(`content/guides/${slug}.md`, stringifyFrontMatter(p.data, p.body), `תמונה ל${field === 'cover' ? 'באנר' : 'כרטיס'}: ${p.data.title || slug}`, f.sha);
    const m = manifest.guides.find(g => g.slug === slug); if (m) m[field] = value;
  }
  async function setClassImage(key, value) {
    const f = await getFile('site.config.json');
    const cfg = JSON.parse(f.text);
    cfg.classImages = { ...(cfg.classImages || {}), [key]: value };
    await putFile('site.config.json', JSON.stringify(cfg, null, 2) + '\n', `תמונת מקצוע: ${key}`, f.sha);
    config.classImages = cfg.classImages;
  }
  async function doUpload(el, baseName, after) {
    const file = await pickFile(); if (!file) return;
    el.classList.add('vis-busy');
    try {
      toast('מעלה תמונה…', false, 60000);
      const path = await uploadImage(file, files, baseName);
      files = await listImages().catch(() => files);
      if (after) await after(path);
      const url = localImages[path.slice(1)];
      showImage(el, url);
      toast('נשמר. האתר יתעדכן תוך כדקה-שתיים.');
      checkDeploy(true);
    } catch (x) { toast(x.message, true, 8000); }
    el.classList.remove('vis-busy');
  }
  function showImage(el, url) {
    const doc = el.ownerDocument;
    if (el.matches('[data-shot], [data-slot="cover"]')) {
      el.classList.remove('shot-missing', 'cover-missing');
      const frameBox = el.querySelector('.shot-frame');
      if (frameBox) frameBox.innerHTML = `<img src="${url}" alt="">`;
      else el.innerHTML = `<img src="${url}" alt="">` + el.querySelector('.vis-btn').outerHTML;
    } else {
      el.classList.add('has-img');
      [...el.childNodes].forEach(n => { if (!(n.classList && n.classList.contains('vis-btn'))) n.remove(); });
      const im = doc.createElement('img'); im.src = url; im.alt = ''; el.prepend(im);
    }
    const b = el.querySelector('.vis-btn'); if (b) b.textContent = b.dataset.replaceLabel;
  }
  function addBtn(el, label, replaceLabel, has, small, handler) {
    if (el.querySelector(':scope > .vis-btn')) return;
    el.setAttribute('data-vis', '');
    const b = el.ownerDocument.createElement('button');
    b.type = 'button'; b.className = 'vis-btn' + (small ? ' small' : '');
    b.dataset.replaceLabel = replaceLabel; b.textContent = has ? replaceLabel : label;
    b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); handler(); }, true);
    el.appendChild(b);
  }
  function decorate() {
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc || !doc.body) return;
    const cur = frame.contentWindow.location.pathname.slice(SITE_BASE.length);
    if ([...sel.options].some(o => o.value === cur)) { sel.value = cur; history.replaceState(null, '', '#/visual/' + encodeURIComponent(cur)); }
    const st = doc.createElement('style'); st.textContent = VIS_CSS; doc.head.appendChild(st);
    doc.querySelectorAll('[data-shot][hidden], [data-slot][hidden]').forEach(n => n.removeAttribute('hidden'));
    doc.querySelectorAll('[data-shot]').forEach(el => {
      const name = el.dataset.shot;
      addBtn(el, 'העלאת צילום מסך', 'החלפת צילום', !el.classList.contains('shot-missing'), false, () => doUpload(el, name));
    });
    doc.querySelectorAll('[data-slot="cover"]').forEach(el => {
      const slug = el.dataset.guide;
      addBtn(el, 'העלאת באנר', 'החלפת באנר', !el.classList.contains('cover-missing'), false, () => doUpload(el, `cover-${slug}`, p => setGuideField(slug, 'cover', p)));
    });
    doc.querySelectorAll('[data-thumb]').forEach(el => {
      const slug = el.dataset.thumb;
      addBtn(el, 'תמונה', 'החלפה', el.classList.contains('has-img'), true, () => doUpload(el, `thumb-${slug}`, p => setGuideField(slug, 'thumb', p)));
    });
    doc.querySelectorAll('[data-class-img]').forEach(el => {
      const key = el.dataset.classImg;
      addBtn(el, 'תמונה', 'החלפה', el.classList.contains('has-img'), true, () => doUpload(el, `class-${key}`, p => setClassImage(key, p)));
    });
  }
  frame.addEventListener('load', decorate);
  // ייתכן שהעמוד נטען כבר בזמן שחיכינו לרשימת התמונות
  try { if (frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentDocument.body && frame.contentDocument.body.childElementCount) decorate(); } catch {}
}

boot();
