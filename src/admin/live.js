// עריכה חיה על גבי האתר — נטען רק כשבדפדפן הזה יש התחברות למערכת הניהול.
// גולשים רגילים לא מורידים את הקובץ הזה בכלל.
// טקסט: לוחצים על פסקה/כותרת/טבלה/רשימה ועורכים אותה במקום. כותרת ותקציר נערכים ישירות.
// תמונות: כפתור ליד כל מקום לתמונה, הדבקה עם Ctrl+V, חיתוך והקטנה אוטומטיים.
import { renderMarkdown, parseFrontMatter, stringifyFrontMatter } from '../assets/lib/markdown.js';

const BASE = window.SITE_BASE || '/';
const token = (() => { try { return localStorage.getItem('gh_token'); } catch { return null; } })();
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let gh = {}, manifest = {};
const src = { path: document.body.dataset.src || '', text: null, sha: null, data: null, lines: null };
const edits = new Map();          // "start-end" -> new markdown
const fmEdits = {};               // front matter changes (title, summary)
const cfgEdits = {};              // site.config.json changes (heroTitle, heroText)
const images = {};                // uploaded images: base name -> file name
let files = [];

// ---------------- GitHub ----------------
async function api(path, opts = {}) {
  const r = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (r.status === 404 && opts.allow404) return null;
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const m = { 401: 'ההתחברות פגה. היכנסו שוב למערכת הניהול עם טוקן חדש.', 403: 'אין הרשאת כתיבה. ודאו שלטוקן יש Contents: Read and write.', 409: 'הקובץ השתנה במקביל. רעננו את העמוד ונסו שוב.' };
    throw new Error(m[r.status] || `שגיאה מ-GitHub (${r.status}): ${j.message || ''}`);
  }
  return r.status === 204 ? null : r.json();
}
const repo = p => `/repos/${gh.owner}/${gh.repo}/contents/${p}`;
const b64e = str => { const b = new TextEncoder().encode(str); let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
const b64d = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function getFile(p) { const j = await api(repo(p) + `?ref=${gh.branch || 'main'}&t=${Date.now()}`, { allow404: true }); return j ? { text: b64d(j.content), sha: j.sha } : null; }
async function putFile(p, content, message, sha, isB64 = false) {
  return api(repo(p), { method: 'PUT', body: JSON.stringify({ message, content: isB64 ? content : b64e(content), branch: gh.branch || 'main', ...(sha ? { sha } : {}) }) });
}
async function deleteFile(p, sha, message) { return api(repo(p), { method: 'DELETE', body: JSON.stringify({ message, sha, branch: gh.branch || 'main' }) }); }
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
async function listImages() {
  const j = await api(repo('content/images') + `?ref=${gh.branch || 'main'}&t=${Date.now()}`, { allow404: true });
  return (j || []).filter(f => f.type === 'file' && IMG_RE.test(f.name));
}

// ---------------- images: crop, resize, upload ----------------
const LIMITS = { shot: 1400, cover: 1600, thumb: 256, class: 256 };
function cleanName(name) {
  const m = name.toLowerCase().match(/^(.*?)(\.[a-z0-9]+)?$/);
  const base = (m[1] || 'image').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || ('image-' + Date.now());
  return base + (m[2] || '.png');
}
const loadImg = blob => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('לא הצלחתי לקרוא את התמונה.')); im.src = URL.createObjectURL(blob); });
function cropDialog(im, title) {
  return new Promise(resolve => {
    const layer = document.createElement('div');
    layer.className = 'lv-layer';
    layer.innerHTML = `<div class="lv-crop" role="dialog" aria-modal="true" aria-label="חיתוך תמונה">
      <div class="lv-crop-head"><strong>${esc(title || 'חיתוך התמונה')}</strong><span>גררו על התמונה כדי לסמן את האזור שרוצים לשמור</span></div>
      <div class="lv-stage"><img alt="" draggable="false"><div class="lv-sel" hidden></div></div>
      <div class="lv-row"><button type="button" class="lv-btn" data-act="crop" disabled>שמירת האזור שסימנתי</button><button type="button" class="lv-btn ghost" data-act="full">שמירה בלי חיתוך</button><span class="lv-sp"></span><button type="button" class="lv-btn ghost" data-act="cancel">ביטול</button></div>
    </div>`;
    document.body.appendChild(layer);
    const shown = $('.lv-stage img', layer), box = $('.lv-sel', layer), ok = $('[data-act="crop"]', layer);
    shown.src = im.src;
    let start = null, rect = null;
    const pos = ev => { const r = shown.getBoundingClientRect(); return { x: Math.max(0, Math.min(r.width, ev.clientX - r.left)), y: Math.max(0, Math.min(r.height, ev.clientY - r.top)) }; };
    const draw = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y); box.hidden = false; Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); rect = { x, y, w, h }; ok.disabled = w < 12 || h < 12; };
    shown.addEventListener('pointerdown', ev => { ev.preventDefault(); shown.setPointerCapture(ev.pointerId); start = pos(ev); draw(start, start); });
    shown.addEventListener('pointermove', ev => { if (start) draw(start, pos(ev)); });
    shown.addEventListener('pointerup', () => { start = null; });
    const scaled = () => { const k = im.naturalWidth / shown.getBoundingClientRect().width; return { x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k }; };
    const done = v => { layer.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = ev => { if (ev.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('click', ev => { const a = ev.target.closest('[data-act]'); if (!a) return; done(a.dataset.act === 'cancel' ? null : a.dataset.act === 'full' ? 'full' : scaled()); });
    $('[data-act="full"]', layer).focus();
  });
}
async function prepareImage(file, kind, title) {
  if (/gif$/i.test(file.type) || /\.svg$/i.test(file.name)) return file;
  const im = await loadImg(file);
  let r = { x: 0, y: 0, w: im.naturalWidth, h: im.naturalHeight };
  const c = await cropDialog(im, title);
  if (c === null) return null;
  if (c !== 'full') r = c;
  const k = Math.min(1, (LIMITS[kind] || 1600) / r.w);
  const cv = document.createElement('canvas'); cv.width = Math.round(r.w * k); cv.height = Math.round(r.h * k);
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height);
  let blob = await new Promise(res => cv.toBlob(res, 'image/webp', 0.86));
  if (blob && blob.type === 'image/webp') return new File([blob], 'x.webp', { type: 'image/webp' });
  blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.88));
  return new File([blob], 'x.jpg', { type: 'image/jpeg' });
}
async function uploadImage(file, baseName) {
  if (file.size > 3 * 1024 * 1024) throw new Error('התמונה גדולה מ-3MB גם אחרי דחיסה.');
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.png'])[0];
  const name = cleanName(baseName + ext);
  for (const f of files.filter(x => x.name !== name && x.name.replace(/\.[^.]+$/, '') === baseName)) await deleteFile(`content/images/${f.name}`, f.sha, `החלפת תמונה: ${f.name}`);
  const prev = files.find(f => f.name === name);
  const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  await putFile(`content/images/${name}`, dataUrl.split(',')[1], `${prev ? 'החלפת' : 'הוספת'} תמונה: ${name}`, prev && prev.sha, true);
  files = await listImages().catch(() => files);
  images[baseName] = name;
  return { path: `/images/${name}`, dataUrl };
}
async function setGuideField(slug, field, value) {
  const f = await getFile(`content/guides/${slug}.md`);
  if (!f) throw new Error('לא מצאתי את קובץ המדריך.');
  const p = parseFrontMatter(f.text); p.data[field] = value;
  await putFile(`content/guides/${slug}.md`, stringifyFrontMatter(p.data, p.body), `תמונה (${field}): ${p.data.title || slug}`, f.sha);
}
async function setConfig(mutate, message) {
  const f = await getFile('site.config.json');
  const cfg = JSON.parse(f.text); mutate(cfg);
  await putFile('site.config.json', JSON.stringify(cfg, null, 2) + '\n', message, f.sha);
}

// ---------------- UI shell ----------------
function toast(msg, err = false, ms = 4200) {
  let t = $('#lvToast');
  if (!t) { t = document.createElement('div'); t.id = 'lvToast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.className = 'lv-toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms);
}
const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = BASE + 'admin/live.css';
document.head.appendChild(css);

const bar = document.createElement('div');
bar.className = 'lv-bar';
bar.setAttribute('role', 'region');
bar.setAttribute('aria-label', 'סרגל עריכה למנהל');
bar.innerHTML = `
  <label class="lv-switch"><input type="checkbox" id="lvOn" checked><span>מצב עריכה</span></label>
  <span class="lv-status" id="lvStatus">אין שינויים</span>
  <span class="lv-sp"></span>
  <button type="button" class="lv-btn" id="lvSave" disabled>שמירה</button>
  <button type="button" class="lv-btn ghost" id="lvUndo" disabled>ביטול השינויים</button>
  <a class="lv-btn ghost" href="${BASE}admin/">לוח הניהול</a>`;
document.body.prepend(bar);
document.body.classList.add('lv-has-bar');

function dirtyCount() { return edits.size + Object.keys(fmEdits).length + Object.keys(cfgEdits).length; }
function refreshBar() {
  const n = dirtyCount();
  $('#lvStatus').textContent = n ? `${n} שינויים שלא נשמרו` : 'אין שינויים';
  $('#lvStatus').classList.toggle('dirty', !!n);
  $('#lvSave').disabled = !n; $('#lvUndo').disabled = !n;
}
window.addEventListener('beforeunload', ev => { if (dirtyCount()) { ev.preventDefault(); ev.returnValue = ''; } });

// ---------------- text editing ----------------
const norm = s => String(s).replace(/[‏‎⁠#✎]/g, '').replace(/\s+/g, ' ').trim();
function sourceFor(range) {
  const [a, b] = range.split('-').map(Number);
  return src.lines.slice(a, b).join('\n').replace(/\n+$/, '');
}
function renderSnippet(md) {
  const { html } = renderMarkdown(md, { base: BASE, images: Object.assign({}, window.__siteImages || {}, images), showMissingShots: true });
  return html.replace(/<!--AD-->/g, '');
}
function openBlock(el) {
  if (!src.lines) return toast('עדיין טוען את קובץ המקור. נסו שוב בעוד שנייה.');
  if (el.closest('.lv-editor')) return;
  const range = el.dataset.md;
  const current = edits.has(range) ? edits.get(range) : sourceFor(range);
  if (!edits.has(range)) {
    // ודאו שהעמוד המוצג תואם לקובץ במאגר (ייתכן שיש עדכון שעוד לא פורסם)
    const tmp = document.createElement('div'); tmp.innerHTML = renderSnippet(current);
    const a = norm(tmp.textContent), b = norm(el.textContent);
    if (a.slice(0, 40) !== b.slice(0, 40)) {
      return toast('העמוד הזה עודכן במאגר ועדיין לא פורסם מחדש. רעננו בעוד דקה-שתיים ואז ערכו.', true, 7000);
    }
  }
  const ed = document.createElement('div');
  ed.className = 'lv-editor';
  ed.innerHTML = `<textarea dir="rtl" spellcheck="true" aria-label="עריכת הבלוק"></textarea>
    <div class="lv-row"><button type="button" class="lv-btn" data-a="ok">אישור</button><button type="button" class="lv-btn ghost" data-a="cancel">ביטול</button><button type="button" class="lv-btn ghost danger" data-a="del">מחיקת הבלוק</button><span class="lv-sp"></span><span class="lv-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> לאישור · <kbd>Esc</kbd> לביטול · <a href="${BASE}admin/" target="_blank" rel="noopener">עזרה בתחביר</a></span></div>`;
  const ta = $('textarea', ed);
  ta.value = current;
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 4, 80) + 'px'; };
  el.replaceWith(ed);
  grow(); ta.focus();
  ta.addEventListener('input', grow);
  const finish = (md) => {
    const wrap = document.createElement('div');
    wrap.className = 'lv-group';
    wrap.dataset.md = range;
    wrap.innerHTML = md === null ? '' : renderSnippet(md);
    if (md !== null && md.trim() === '') wrap.innerHTML = '<p class="lv-deleted">(הבלוק יימחק בשמירה)</p>';
    ed.replaceWith(wrap.childElementCount === 1 && md !== null && md.trim() ? (() => { const only = wrap.firstElementChild; only.dataset.md = range; return only; })() : wrap);
    decorateImages(document);
  };
  ed.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'cancel') { finish(edits.has(range) ? edits.get(range) : sourceFor(range)); return; }
    if (b.dataset.a === 'del') { edits.set(range, ''); refreshBar(); finish(''); return; }
    const md = ta.value.replace(/\s+$/, '');
    if (md !== sourceFor(range)) edits.set(range, md); else edits.delete(range);
    refreshBar(); finish(md);
  });
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); $('[data-a="ok"]', ed).click(); }
    if (ev.key === 'Escape') { ev.preventDefault(); $('[data-a="cancel"]', ed).click(); }
  });
}
function enableInline() {
  document.querySelectorAll('[data-fm], [data-cfg]').forEach(el => {
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.classList.add('lv-inline');
    if (el._lv) return; el._lv = true;
    const orig = el.textContent.replace(/‏/g, '').trim();
    el.addEventListener('input', () => {
      const v = el.textContent.replace(/‏/g, '').replace(/\s+/g, ' ').trim();
      const store = el.dataset.fm ? fmEdits : cfgEdits, key = el.dataset.fm || el.dataset.cfg;
      if (v === orig) delete store[key]; else store[key] = v;
      refreshBar();
    });
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } });
    el.addEventListener('paste', ev => { if ([...(ev.clipboardData?.items || [])].some(i => i.type.startsWith('image/'))) return; ev.preventDefault(); document.execCommand('insertText', false, ev.clipboardData.getData('text/plain')); });
  });
}
function disableInline() { document.querySelectorAll('.lv-inline').forEach(el => el.removeAttribute('contenteditable')); }

document.addEventListener('click', ev => {
  if (!document.body.classList.contains('lv-on')) return;
  const blk = ev.target.closest('.prose [data-md]');
  if (!blk || ev.target.closest('.lv-btn, .lv-editor, [data-lvimg]')) return;
  if (blk.matches('[data-shot]')) return; // צילומי מסך נערכים דרך כפתור התמונה
  ev.preventDefault();
  openBlock(blk);
}, true);

// ---------------- image slots ----------------
let active = null;
function showImage(el, url) {
  if (el.matches('[data-shot], [data-slot="cover"]')) {
    el.classList.remove('shot-missing', 'cover-missing'); el.removeAttribute('hidden');
    const fb = $('.shot-frame', el);
    if (fb) fb.innerHTML = `<img src="${url}" alt="">`;
    else { const im = $('img', el); if (im) im.src = url; }
  } else {
    el.classList.add('has-img');
    let im = $(':scope > img', el);
    if (!im) { im = document.createElement('img'); im.alt = ''; el.prepend(im); }
    im.src = url; im.removeAttribute('onerror');
  }
  const b = $(':scope > .lv-img-btn', el); if (b) b.textContent = b.dataset.replace;
}
async function handleFile(el, raw) {
  const s = el._slot; if (!s) return;
  el.classList.add('lv-busy');
  try {
    const file = await prepareImage(raw, s.kind, el.dataset.caption || s.title);
    if (!file) return;
    toast('מעלה תמונה…', false, 60000);
    const { path, dataUrl } = await uploadImage(file, s.base);
    if (s.after) await s.after(path);
    showImage(el, dataUrl);
    toast('התמונה נשמרה. לגולשים היא תופיע תוך כדקה-שתיים.');
  } catch (x) { toast(x.message, true, 8000); }
  finally { el.classList.remove('lv-busy'); }
}
function slot(el, conf) {
  if (el._slot) return;
  el._slot = conf;
  el.setAttribute('data-lvimg', '');
  const has = conf.has(el);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lv-img-btn' + (conf.small ? ' small' : '');
  b.dataset.replace = conf.small ? 'החלפה' : 'החלפת תמונה';
  b.textContent = has ? b.dataset.replace : (conf.small ? 'תמונה' : 'הוספת תמונה');
  b.setAttribute('aria-label', (has ? 'החלפת ' : 'הוספת ') + (conf.title || 'תמונה'));
  b.addEventListener('click', ev => {
    ev.preventDefault(); ev.stopPropagation();
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
    inp.onchange = () => inp.files[0] && handleFile(el, inp.files[0]);
    inp.click();
  }, true);
  el.appendChild(b);
  el.addEventListener('click', ev => {
    if (!document.body.classList.contains('lv-on') || ev.target.closest('.lv-img-btn')) return;
    ev.preventDefault(); ev.stopPropagation();
    if (active) active.classList.remove('lv-active');
    active = el; el.classList.add('lv-active');
    toast('נבחר מקום לתמונה. הדביקו צילום מסך עם Ctrl+V, או לחצו על הכפתור.', false, 3500);
  }, true);
}
function decorateImages(root) {
  root.querySelectorAll('[data-shot]').forEach(el => slot(el, { kind: 'shot', base: el.dataset.shot, title: el.dataset.caption || 'צילום מסך', has: e => !e.classList.contains('shot-missing') }));
  root.querySelectorAll('[data-slot="cover"]').forEach(el => { const slug = el.dataset.guide; slot(el, { kind: 'cover', base: `cover-${slug}`, title: 'באנר למדריך', has: e => !e.classList.contains('cover-missing'), after: p => setGuideField(slug, 'cover', p) }); });
  root.querySelectorAll('[data-thumb]').forEach(el => { const slug = el.dataset.thumb; slot(el, { kind: 'thumb', base: `thumb-${slug}`, title: 'תמונת כרטיס', small: true, has: e => e.classList.contains('has-img'), after: p => setGuideField(slug, 'thumb', p) }); });
  root.querySelectorAll('[data-class-img]').forEach(el => { const key = el.dataset.classImg; slot(el, { kind: 'class', base: `class-${key}`, title: 'תמונת מקצוע', small: true, has: e => e.classList.contains('has-img'), after: p => setConfig(c => { c.classImages = { ...(c.classImages || {}), [key]: p }; }, `תמונת מקצוע: ${key}`) }); });
  if (document.body.classList.contains('lv-on')) root.querySelectorAll('[data-shot][hidden], [data-slot][hidden]').forEach(n => { n.removeAttribute('hidden'); n.dataset.lvWasHidden = '1'; });
}
document.addEventListener('paste', ev => {
  if (!document.body.classList.contains('lv-on')) return;
  const item = [...(ev.clipboardData ? ev.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
  if (!item) return;
  ev.preventDefault();
  if (!active) return toast('קודם לחצו על המקום שבו התמונה צריכה להופיע, ואז הדביקו.', true);
  const blob = item.getAsFile();
  handleFile(active, new File([blob], 'paste.png', { type: blob.type || 'image/png' }));
});

// ---------------- save / undo ----------------
async function save() {
  const btn = $('#lvSave'); btn.disabled = true; btn.textContent = 'שומר…';
  try {
    if ((edits.size || Object.keys(fmEdits).length) && src.path) {
      const f = await getFile(src.path);
      if (!f) throw new Error('קובץ המקור לא נמצא במאגר.');
      const p = parseFrontMatter(f.text);
      const lines = p.body.split('\n');
      // ודאו שכל בלוק שנערך עדיין נמצא באותו מקום בקובץ העדכני
      const sorted = [...edits.entries()].map(([r, md]) => { const [a, b] = r.split('-').map(Number); return { a, b, md, orig: src.lines.slice(a, b).join('\n') }; }).sort((x, y) => y.a - x.a);
      for (const ed of sorted) {
        if (lines.slice(ed.a, ed.b).join('\n') !== ed.orig) throw new Error('הקובץ השתנה במאגר מאז שהעמוד נטען (אולי עריכה מהמסך השני). רעננו את העמוד וערכו שוב.');
      }
      for (const ed of sorted) lines.splice(ed.a, ed.b - ed.a, ...(ed.md.trim() ? ed.md.split('\n') : []));
      const data = { ...p.data, ...fmEdits };
      if (data.updated !== undefined || src.path.includes('/guides/')) data.updated = new Date().toISOString().slice(0, 10);
      const out = stringifyFrontMatter(data, lines.join('\n').replace(/\n{3,}/g, '\n\n'));
      await putFile(src.path, out, `עריכה חיה: ${data.title || src.path}`, f.sha);
      // הנתונים החדשים הם הבסיס להמשך
      const np = parseFrontMatter(out); src.data = np.data; src.lines = np.body.split('\n');
      // מספרי השורות השתנו, לכן מסמנים מחדש מהקובץ השמור
      remapBlocks();
    }
    if (Object.keys(cfgEdits).length) await setConfig(c => Object.assign(c, cfgEdits), 'עריכה חיה: טקסטים בדף הבית');
    edits.clear(); Object.keys(fmEdits).forEach(k => delete fmEdits[k]); Object.keys(cfgEdits).forEach(k => delete cfgEdits[k]);
    refreshBar();
    toast('נשמר. הגולשים יראו את השינוי תוך כדקה-שתיים.', false, 6000);
  } catch (x) { toast(x.message, true, 9000); }
  finally { btn.textContent = 'שמירה'; refreshBar(); }
}
function remapBlocks() {
  // אחרי שמירה: מרנדרים את גוף המדריך מהקובץ השמור כדי שכל הבלוקים יצביעו לשורות הנכונות
  const prose = $('.prose'); if (!prose) return;
  const { html } = renderMarkdown(src.lines.join('\n'), { base: BASE, images: Object.assign({}, window.__siteImages || {}, images), showMissingShots: true, srcMap: true });
  prose.innerHTML = html.replace(/<!--AD-->/g, '');
  decorateImages(prose);
}
$('#lvSave').addEventListener('click', save);
$('#lvUndo').addEventListener('click', () => { if (confirm('לבטל את כל השינויים שלא נשמרו?')) { edits.clear(); location.reload(); } });
document.addEventListener('keydown', ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && dirtyCount()) { ev.preventDefault(); save(); } });

// ---------------- mode switch ----------------
function setMode(on) {
  document.body.classList.toggle('lv-on', on);
  try { localStorage.setItem('lv_on', on ? '1' : '0'); } catch {}
  if (on) { enableInline(); decorateImages(document); }
  else {
    disableInline();
    document.querySelectorAll('[data-lv-was-hidden]').forEach(n => { if (n.classList.contains('shot-missing') || n.classList.contains('cover-missing')) n.setAttribute('hidden', ''); });
    if (active) { active.classList.remove('lv-active'); active = null; }
  }
}
$('#lvOn').addEventListener('change', ev => setMode(ev.target.checked));

// ---------------- boot ----------------
(async () => {
  try {
    manifest = await (await fetch(BASE + 'admin/manifest.json?t=' + Date.now())).json();
    gh = (manifest.config && manifest.config.github) || {};
    const stored = (() => { try { return localStorage.getItem('lv_on'); } catch { return null; } })();
    $('#lvOn').checked = stored !== '0';
    setMode($('#lvOn').checked);
    files = await listImages().catch(() => []);
    files.forEach(f => { images[f.name.replace(/\.[^.]+$/, '')] = f.name; });
    if (src.path) {
      const f = await getFile(src.path);
      if (f) { const p = parseFrontMatter(f.text); src.text = f.text; src.sha = f.sha; src.data = p.data; src.lines = p.body.split('\n'); }
    }
  } catch (x) { toast(x.message, true, 8000); }
})();
