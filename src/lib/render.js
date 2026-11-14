// תבניות העמודים — משותף לבנייה ולתצוגה המקדימה במערכת הניהול, כך שהעיצוב תמיד זהה.
import { renderMarkdown, escapeHtml, readingTime, bidiText } from './markdown.js';
import { ICONS, CLASS_INFO } from './icons.js';

const e = escapeHtml;
const t = s => escapeHtml(bidiText(s ?? ''));

export function url(ctx, path = '') {
  return (ctx.base || '/') + path.replace(/^\//, '');
}

export function guideUrl(ctx, slug) { return url(ctx, `guides/${slug}/`); }
export function categoryUrl(ctx, id) { return url(ctx, `category/${id}/`); }

function img(ctx, src) {
  if (!src) return '';
  return /^https?:\/\//.test(src) ? src : url(ctx, src.replace(/^\//, ''));
}

// מילוי פרטים מההגדרות בעמודים (למשל פרטי רכז הנגישות): {{a11y.email}}
function fillTokens(ctx, body) {
  return body.replace(/\{\{(a11y)\.([a-zA-Z]+)\}\}/g, (m, grp, key) => {
    const v = ((ctx.config.accessibility || {})[key] || '').trim();
    return v || '(יעודכן בקרוב)';
  });
}

function catOf(ctx, id) {
  return ctx.config.categories.find(c => c.id === id) || { id, name: id, icon: 'book', desc: '' };
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- ads ----------
export function adSlot(ctx, kind) {
  const ads = ctx.config.ads || {};
  if (!ads.enabled || !ads.client) {
    return ctx.preview ? `<div class="ad ad-${kind} ad-placeholder" aria-hidden="true">מקום לפרסומת</div>` : '';
  }
  const slot = (ads.slots || {})[kind] || '';
  const fmt = kind === 'sidebar' ? 'data-ad-format="vertical"' : 'data-ad-format="auto" data-full-width-responsive="true"';
  return `<div class="ad ad-${kind}"><span class="ad-label">פרסומת</span><ins class="adsbygoogle" style="display:block" data-ad-client="${e(ads.client)}"${slot ? ` data-ad-slot="${e(slot)}"` : ''} ${fmt}></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
}

// ---------- layout ----------
export function layout(ctx, { title, description = '', path = '', body, active = '', jsonld = null, noindex = false, edit = 'settings', hud = null, scripts = '' }) {
  const c = ctx.config;
  const fullTitle = title ? `${title} | ${c.siteName}` : `${c.siteName} — ${c.tagline}`;
  const canonical = c.siteUrl ? c.siteUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '') : '';
  const ads = c.ads || {};
  const nav = c.categories.filter(x => x.nav).map(cat =>
    `<a href="${categoryUrl(ctx, cat.id)}"${active === cat.id ? ' aria-current="page"' : ''}>${e(cat.short || cat.name)}</a>`).join('');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(fullTitle)}</title>
<meta name="description" content="${e(description || c.description)}">
${canonical ? `<link rel="canonical" href="${e(canonical)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="${jsonld ? 'article' : 'website'}">
<meta property="og:locale" content="he_IL">
<meta property="og:site_name" content="${e(c.siteName)}">
<meta property="og:title" content="${e(title || c.siteName)}">
<meta property="og:description" content="${e(description || c.description)}">
${canonical ? `<meta property="og:url" content="${e(canonical)}">` : ''}
<meta name="theme-color" content="#0A1430">
<link rel="icon" href="${url(ctx, 'assets/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Suez+One&family=Assistant:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${url(ctx, 'assets/style.css')}${ctx.version ? '?v=' + ctx.version : ''}">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;var a=JSON.parse(localStorage.getItem('a11y')||'{}');for(var k in a){if(k==='size')document.documentElement.dataset.size=a[k];else if(a[k])document.documentElement.classList.add('a11y-'+k)}}catch(e){}</script>
${ads.enabled && ads.client && !ctx.preview ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${e(ads.client)}" crossorigin="anonymous"></script>` : ''}
${c.analyticsId && !ctx.preview ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(c.analyticsId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${e(c.analyticsId)}');</script>` : ''}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body data-edit="${e(edit)}"${hud ? ' class="has-hud"' : ''}>
<a class="skip" href="#main">דלג לתוכן</a>
<div class="progress" aria-hidden="true"><span id="progressBar"></span></div>
<header class="top">
  <div class="moon" aria-hidden="true"></div>
  <div class="hills" aria-hidden="true"></div>
  <div class="top-bar wrap">
    <a class="brand" href="${url(ctx)}" aria-label="${e(c.siteName)}, לדף הבית">
      <span class="brand-leaf">${ICONS.leaf}</span>
      <span class="brand-text"><strong>${e(c.siteName)}</strong><small>${e(c.tagline)}</small></span>
    </a>
    <button class="searchbar" id="searchOpen" type="button" aria-label="חיפוש מדריך">${ICONS.search}<span>חיפוש מדריך, מפה או מקצוע</span><kbd aria-hidden="true">/</kbd></button>
    <div class="bar-tools">
      <button class="icon-btn" id="a11yOpen" type="button" aria-label="תפריט נגישות" aria-expanded="false" aria-controls="a11yPanel">${ICONS.access}</button>
      <button class="icon-btn" id="themeToggle" type="button" aria-label="מעבר בין מצב יום ללילה"><span class="i-moon">${ICONS.moon}</span><span class="i-sun">${ICONS.sun}</span></button>
      <button class="icon-btn menu-btn" id="menuToggle" type="button" aria-label="תפריט קטגוריות" aria-expanded="false" aria-controls="mainNav">${ICONS.menu}</button>
    </div>
  </div>
  <nav class="catnav" id="mainNav" aria-label="קטגוריות">
    <div class="wrap catnav-in">
      <a href="${url(ctx, 'guides/')}"${active === 'all' ? ' aria-current="page"' : ''}>כל המדריכים</a>
      ${rankingOn(ctx) ? `<a href="${url(ctx, 'ranking/')}"${active === 'ranking' ? ' aria-current="page"' : ''}>דירוג</a>` : ''}
      ${nav}
    </div>
  </nav>
</header>
<div class="a11y-panel window" id="a11yPanel" role="dialog" aria-label="תפריט נגישות" hidden>
  <div class="window-bar"><span>נגישות</span><button class="a11y-x" type="button" data-a11y-close aria-label="סגירת תפריט הנגישות">✕</button></div>
  <div class="a11y-body">
    <div class="a11y-row" role="group" aria-label="גודל טקסט"><span>גודל טקסט</span><button type="button" data-a11y="smaller" aria-label="הקטנת טקסט">א-</button><button type="button" data-a11y="bigger" aria-label="הגדלת טקסט">א+</button></div>
    <button type="button" class="a11y-tog" data-a11y="contrast" aria-pressed="false">ניגודיות גבוהה</button>
    <button type="button" class="a11y-tog" data-a11y="links" aria-pressed="false">הדגשת קישורים</button>
    <button type="button" class="a11y-tog" data-a11y="font" aria-pressed="false">גופן קריא</button>
    <button type="button" class="a11y-tog" data-a11y="motion" aria-pressed="false">עצירת אנימציות</button>
    <button type="button" class="a11y-tog" data-a11y="spacing" aria-pressed="false">ריווח שורות</button>
    <button type="button" class="a11y-reset" data-a11y="reset">איפוס הגדרות</button>
    <a href="${url(ctx, 'accessibility/')}">הצהרת נגישות</a>
  </div>
</div>
<div class="search-layer" id="searchLayer" hidden>
  <div class="search-box" role="dialog" aria-modal="true" aria-label="חיפוש">
    <div class="search-field">${ICONS.search}<input id="searchInput" type="search" placeholder="חפשו מדריך, מקצוע, מפה או מפלצת…" autocomplete="off"><button class="search-close" id="searchClose" aria-label="סגירה">Esc</button></div>
    <ul class="search-results" id="searchResults"></ul>
  </div>
</div>
${adSlot(ctx, 'top')}
<main id="main">
${body}
</main>
<button class="totop" id="toTop" type="button" aria-label="חזרה לראש העמוד" hidden>↑</button>
${hud ? `<div class="hud" aria-hidden="true"><span class="hud-lv"><small>LV.</small>${e(hud.level || '?')}</span><span class="hud-name">${e(hud.name)}</span><span class="exp"><span class="exp-fill" id="expFill"></span><span class="exp-txt">EXP <b id="expPct">0.00%</b></span></span></div>
<div class="levelup" id="levelUp" role="status" hidden><strong>LEVEL UP!</strong><span>סיימתם את המדריך.</span>${hud.next ? `<a href="${hud.next.url}">למדריך הבא: ${t(hud.next.title)}</a>` : ''}<button type="button" data-close-lu aria-label="סגירה">✕</button></div>` : ''}
<footer class="foot">
  <div class="ground-top" aria-hidden="true"></div>
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand" href="${url(ctx)}"><span class="brand-leaf">${ICONS.leaf}</span><span class="brand-text"><strong>${e(c.siteName)}</strong></span></a>
      <p>${e(c.footerText || '')}</p>
    </div>
    <nav aria-label="קטגוריות">
      <h2>מדריכים</h2>
      ${c.categories.map(cat => `<a href="${categoryUrl(ctx, cat.id)}">${e(cat.short || cat.name)}</a>`).join('')}
    </nav>
    <nav aria-label="על האתר">
      <h2>האתר</h2>
      ${rankingOn(ctx) ? `<a href="${url(ctx, 'ranking/')}">דירוג השחקנים</a>` : ''}
      <a href="${url(ctx, 'about/')}">אודות</a>
      <a href="${url(ctx, 'accessibility/')}">הצהרת נגישות</a>
      <a href="${url(ctx, 'privacy/')}">מדיניות פרטיות</a>
      <a href="${url(ctx, 'copyright/')}">זכויות יוצרים ו-Nexon</a>
    </nav>
  </div>
  <div class="wrap legal">
    <p>MapleStory ו-MapleStory Classic World, וכל השמות, הדמויות, התמונות והסימנים המסחריים מהמשחק, הם קניינן של NEXON Korea Corporation ו-NEXON America Inc. כל הזכויות שמורות. מייפלורז הוא אתר מעריצים לא רשמי, שאינו קשור ל-Nexon, אינו ממומן על ידה ואינו מאושר על ידה.</p>
    <p><a href="${url(ctx, 'copyright/')}">זכויות יוצרים</a> · <a href="https://m.nexon.com/terms/716" target="_blank" rel="noopener">מדריך ה-IP של Nexon ליוצרי תוכן</a> · איורי מפלצות: © NEXON דרך <a href="https://maplestory.io" target="_blank" rel="noopener">maplestory.io</a>${c.attribution && c.attribution.text ? ` · ${c.attribution.url ? `<a href="${e(c.attribution.url)}" target="_blank" rel="noopener">${e(c.attribution.text)}</a>` : e(c.attribution.text)}` : ''}</p>
  </div>
</footer>
<script>window.SITE_BASE=${JSON.stringify(ctx.base || '/')};</script>
<script src="${url(ctx, 'assets/site.js')}${ctx.version ? '?v=' + ctx.version : ''}" defer></script>
${scripts}
</body>
</html>`;
}

// ---------- pieces ----------
function levelChip(level) {
  return level ? `<span class="lv">Lv ${e(level)}</span>` : '';
}

export function guideCard(ctx, g, { showCat = false } = {}) {
  const cat = catOf(ctx, g.category);
  const cls = g.cls && CLASS_INFO[g.cls];
  const fallback = ICONS[g.icon] || ICONS[cls?.icon] || ICONS[cat.icon] || ICONS.book;
  const icon = g.thumb ? `<img src="${e(img(ctx, g.thumb))}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove('has-img');this.remove()">${fallback}` : fallback;
  return `<li><a class="g-row${g.cls ? ' cls-' + e(g.cls) : ''}" href="${guideUrl(ctx, g.slug)}">
  <span class="g-icon${g.thumb ? ' has-img' : ''}" aria-hidden="true" data-thumb="${e(g.slug)}">${icon}</span>
  <span class="g-body">
    <span class="g-title">${t(g.title)}</span>
    ${g.summary ? `<span class="g-sum">${t(g.summary)}</span>` : ''}
  </span>
  <span class="g-meta">${levelChip(g.level)}${showCat ? `<span>${e(cat.short || cat.name)}</span>` : ''}</span>
</a></li>`;
}
const rowList = (ctx, list, opts) => `<ul class="g-list">${list.map(g => guideCard(ctx, g, opts)).join('')}</ul>`;

// ---------- guide page ----------
export function guidePage(ctx, g) {
  const { html, headings } = renderMarkdown(g.body, { base: ctx.base, autoAds: true, images: ctx.images, showMissingShots: ctx.preview });
  const withAds = html.replace(/<!--AD-->/g, () => adSlot(ctx, 'inArticle'));
  const cat = catOf(ctx, g.category);
  const siblings = ctx.guides.filter(x => x.category === g.category);
  const idx = siblings.findIndex(x => x.slug === g.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const related = (g.related || []).map(s => ctx.guides.find(x => x.slug === s)).filter(Boolean);
  const cls = g.cls && CLASS_INFO[g.cls];
  
  const toc = headings.filter(h => h.level === 2);
  const tocHtml = toc.length > 2 ? `<nav class="toc" aria-label="תוכן העניינים"><p class="toc-title">בעמוד הזה</p><ol>${toc.map(h => `<li><a href="#${h.id}">${t(h.text)}</a></li>`).join('')}</ol></nav>` : '';

  const body = `
<div class="wrap guide-layout">
  <article class="guide window${g.cls ? ' cls-' + e(g.cls) : ''}">
    <div class="window-bar quest-bar"><nav class="crumbs" aria-label="מיקום באתר"><a href="${url(ctx)}">ראשי</a><span aria-hidden="true">/</span><a href="${categoryUrl(ctx, cat.id)}">${e(cat.short || cat.name)}</a></nav>${g.level ? `<span class="lv">Lv ${e(g.level)}</span>` : ''}</div>
    <div class="guide-in">
    <header class="guide-head">
      <h1>${t(g.title)}</h1>
      ${g.summary ? `<p class="lede">${t(g.summary)}</p>` : ''}
      <div class="meta"><span>${readingTime(g.body)} דקות קריאה</span>${g.updated ? `<span>עודכן ${e(formatDate(g.updated))}</span>` : ''}</div>
    </header>
    ${g.cover ? `<figure class="cover" data-slot="cover" data-guide="${e(g.slug)}"><img src="${e(img(ctx, g.cover))}" alt="${e(g.coverAlt || '')}"></figure>` : `<figure class="cover cover-missing shot-missing" data-slot="cover" data-guide="${e(g.slug)}" hidden><div class="shot-frame"><span>באנר למדריך</span></div></figure>`}
    ${tocHtml ? `<details class="toc-mobile"><summary>תוכן העניינים <span>${toc.length} סעיפים</span></summary>${tocHtml}</details>` : ''}
    <div class="prose">
${withAds}
    </div>
    ${g.sources && g.sources.length ? `<p class="sources">מקורות: ${g.sources.map(s => `<a href="${e(s)}" target="_blank" rel="noopener nofollow">${e(s.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(', ')}. הנתונים נכונים לעדכון האחרון ועשויים להשתנות בעדכוני משחק.</p>` : ''}
    <nav class="pager" aria-label="המדריך הקודם והבא">
      ${prev ? `<a class="pg prev" href="${guideUrl(ctx, prev.slug)}"><small>→ הקודם</small><span>${t(prev.title)}</span></a>` : '<span></span>'}
      ${next ? `<a class="pg next" href="${guideUrl(ctx, next.slug)}"><small>הבא ←</small><span>${t(next.title)}</span></a>` : '<span></span>'}
    </nav>
    ${related.length ? `<section class="related" aria-labelledby="relH"><h2 id="relH">כדאי לקרוא גם</h2>${rowList(ctx, related)}</section>` : ''}
    </div>
  </article>
  <aside class="side" aria-label="ניווט במדריך">
    <div class="side-sticky">${tocHtml ? `<div class="window toc-window"><div class="window-bar"><span>בעמוד הזה</span></div>${tocHtml}</div>` : ''}${adSlot(ctx, 'sidebar')}</div>
  </aside>
</div>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.summary || '',
    inLanguage: 'he',
    dateModified: g.updated || undefined,
    author: { '@type': 'Organization', name: ctx.config.siteName },
  };
  return layout(ctx, { title: g.title, description: g.summary, path: `guides/${g.slug}/`, body, active: g.category, jsonld, edit: `guides/${g.slug}`, hud: { level: (g.level || '').split(/[–-]/)[0].replace(/\D/g, '') || '?', name: g.short || cat.short || cat.name, next: next ? { url: guideUrl(ctx, next.slug), title: next.title } : null } });
}

// ---------- home ----------
export function homePage(ctx) {
  const c = ctx.config;
  const byCat = id => ctx.guides.filter(g => g.category === id);
  const jobCards = Object.entries(CLASS_INFO).map(([key, info]) => {
    const g = ctx.guides.find(x => x.cls === key && x.category === 'jobs');
    const branches = ctx.guides.filter(x => x.cls === key && x.category === 'jobs2');
    const pic = (c.classImages || {})[key];
    return `<li class="job cls-${key}">
  <a class="job-main" href="${g ? guideUrl(ctx, g.slug) : '#'}">
    <span class="job-icon${pic ? ' has-img' : ''}" aria-hidden="true" data-class-img="${key}">${pic ? `<img src="${e(img(ctx, pic))}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove('has-img');this.remove()">${ICONS[info.icon]}` : ICONS[info.icon]}</span>
    <span class="job-name">${info.name} <span lang="en">${info.en}</span></span>
    <span class="job-facts">${info.stat} · ${info.town}</span>
  </a>
  ${branches.length ? `<p class="job-branches"><span class="sr-only">ענפים בג'וב השני: </span>${branches.map(b => `<a href="${guideUrl(ctx, b.slug)}">${e(b.short || b.title)}</a>`).join('')}</p>` : ''}
</li>`;
  }).join('');

  const journey = (c.journey || []).map(step => {
    const g = ctx.guides.find(x => x.slug === step.slug);
    if (!g) return '';
    return `<li><a href="${guideUrl(ctx, g.slug)}"><span class="lv">${e(step.lv)}</span><span>${e(step.label)}</span></a></li>`;
  }).join('');

  const cats = c.categories.filter(cat => cat.id !== 'jobs' && cat.id !== 'jobs2').map(cat => {
    const list = byCat(cat.id);
    if (!list.length) return '';
    return `<section class="cat-panel" aria-labelledby="cat-${cat.id}">
  <h3 id="cat-${cat.id}"><a href="${categoryUrl(ctx, cat.id)}"><span class="cat-ic" aria-hidden="true">${ICONS[cat.icon] || ''}</span>${e(cat.name)}</a><span class="count">${list.length}</span></h3>
  <ul>${list.map(g => `<li><a href="${guideUrl(ctx, g.slug)}">${t(g.short && g.category !== 'jobs2' ? g.title : g.title)}</a>${g.level ? `<span class="lv">${e(g.level)}</span>` : ''}</li>`).join('')}</ul>
</section>`;
  }).join('');

  const body = `
<section class="hero">
  <div class="wrap hero-in">
    <h1>${e(c.heroTitle)}</h1>
    <p>${e(c.heroText)}</p>
    <button class="hero-search" type="button" data-open-search>${ICONS.search}<span>חפשו מדריך, מפה או מקצוע…</span></button>
    ${renderMarkdown('[[shot home-hero | ' + (c.heroShotCaption || 'MapleStory Classic World') + ']]', { base: ctx.base, images: ctx.images, showMissingShots: false }).html}
  </div>
</section>
<section class="wrap block" aria-labelledby="jobsH">
  <div class="window">
    <div class="window-bar"><h2 id="jobsH">בחרו מקצוע</h2><small>ג'וב ראשון ב-Lv 10, ענף ב-Lv 30</small></div>
    <ul class="jobs">${jobCards}</ul>
  </div>
</section>
${journey ? `<section class="wrap block" aria-labelledby="startH"><div class="window"><div class="window-bar"><h2 id="startH">מתחילים כאן</h2><small>הסדר המומלץ לשחקן חדש</small></div><ol class="journey">${journey}</ol></div></section>` : ''}
<section class="wrap block" aria-labelledby="allH">
  <div class="block-head"><h2 id="allH">כל המדריכים</h2><a href="${url(ctx, 'guides/')}">לרשימה המלאה</a></div>
  <div class="catalog">${cats}</div>
</section>
${adSlot(ctx, 'inArticle')}`;
  return layout(ctx, { title: '', description: c.description, path: '', body, active: 'home' });
}

// ---------- category ----------
export function categoryPage(ctx, cat) {
  const list = ctx.guides.filter(g => g.category === cat.id);
  const body = `
<div class="wrap narrow page-pad">
  <nav class="crumbs" aria-label="מיקום באתר"><a href="${url(ctx)}">ראשי</a></nav>
  <header class="list-head"><h1>${e(cat.name)}</h1>${cat.desc ? `<p>${e(cat.desc)}</p>` : ''}</header>
  ${list.length ? rowList(ctx, list) : '<p class="empty">עוד אין כאן מדריכים. הראשון בדרך.</p>'}
</div>`;
  return layout(ctx, { title: cat.name, description: cat.desc, path: `category/${cat.id}/`, body, active: cat.id, edit: 'settings/categories' });
}

export function allGuidesPage(ctx) {
  const groups = ctx.config.categories.map(cat => {
    const list = ctx.guides.filter(g => g.category === cat.id);
    if (!list.length) return '';
    return `<section class="group" aria-labelledby="g-${cat.id}"><h2 id="g-${cat.id}"><a href="${categoryUrl(ctx, cat.id)}">${e(cat.name)}</a></h2>${rowList(ctx, list)}</section>`;
  }).join('');
  const body = `
<div class="wrap narrow page-pad">
  <nav class="crumbs" aria-label="מיקום באתר"><a href="${url(ctx)}">ראשי</a></nav>
  <header class="list-head"><h1>כל המדריכים</h1><p>${ctx.guides.length} מדריכים, מהאי מייפל ועד הג'וב השני.</p></header>
  ${groups}
</div>`;
  return layout(ctx, { title: 'כל המדריכים', description: 'רשימת כל המדריכים למייפל סטורי קלאסיק בעברית', path: 'guides/', body, active: 'all' });
}

export function staticPage(ctx, p) {
  const { html } = renderMarkdown(fillTokens(ctx, p.body), { base: ctx.base, images: ctx.images, showMissingShots: ctx.preview });
  const body = `
<div class="wrap narrow page-pad"><article class="guide">
  <nav class="crumbs" aria-label="מיקום באתר"><a href="${url(ctx)}">ראשי</a></nav>
  <header class="guide-head"><h1>${e(p.title)}</h1></header>
  <div class="prose">${html}</div>
</article></div>`;
  return layout(ctx, { title: p.title, description: p.summary || '', path: `${p.slug}/`, body, edit: `pages/${p.slug}` });
}

export function notFoundPage(ctx) {
  const body = `<section class="wrap narrow page-pad lost"><h1>הפורטל הזה לא מוביל לשום מקום</h1><p>העמוד שחיפשתם לא קיים, או שהועבר למקום אחר.</p><p class="row-btns"><a class="btn" href="${url(ctx)}">לדף הבית</a><button class="btn btn-ghost" type="button" data-open-search>חיפוש מדריך</button></p></section>`;
  return layout(ctx, { title: 'העמוד לא נמצא', body, noindex: true });
}

// ---------- ranking ----------
export function rankingOn(ctx) {
  return !!(ctx.config.ranking && ctx.config.ranking.enabled);
}

const MSIO = 'https://maplestory.io/api/gms/208.2.0/mob/';
function mobImg(id, cls = 'rank-mob') {
  if (!id) return '';
  return `<img class="${cls}" src="${MSIO}${encodeURIComponent(id)}/render/stand" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
}

function rankCredit(ctx) {
  return `<aside class="rank-credit" aria-label="מקור הנתונים">
  <p><strong>מקור הנתונים: <a href="https://classicrank.com" target="_blank" rel="noopener">ClassicRank</a>.</strong> את הנתונים אוספת קהילת ClassicRank מתוך המשחק, והם מתעדכנים אצלנו אוטומטית בערך כל חצי שעה. מייפלורז לא אוסף נתונים מהמשחק בעצמו.</p>
  <p>לא מופיעים או שהנתונים ישנים? ClassicRank מעדכנים דמויות שנראות בשוק החופשי (Free Market), מומלץ בערוץ 1. <a href="https://classicrank.com/Scan" target="_blank" rel="noopener">איך זה עובד</a>.</p>
  <p class="rank-credit-legal">תמונות הדמויות: ClassicRank. איורי המפלצות: © NEXON, דרך <a href="https://maplestory.io" target="_blank" rel="noopener">maplestory.io</a>. MapleStory Classic World © NEXON Korea Corp. <a href="${url(ctx, 'copyright/')}">זכויות יוצרים</a></p>
</aside>`;
}

const RANK_TABS = [
  ['overall', 'כללי', 'לפי רמה'],
  ['fame', 'פרסום', 'לפי Fame'],
  ['class', 'מקצוע', 'לפי מקצוע'],
  ['islander', 'אי ההתחלה', 'מתחילים שלא עזבו את האי'],
  ['permanent', 'מתחילים לנצח', 'נשארו Beginner'],
  ['israel', 'ישראלים', 'בקרוב'],
];

export function rankingPage(ctx) {
  const r = ctx.config.ranking || {};
  const mobs = r.mobs || {};
  const familyOpts = [['', 'כל המקצועות'], ['warrior', 'לוחם'], ['magician', 'קוסם'], ['bowman', 'קשת'], ['thief', 'גנב'], ['beginner', 'מתחיל']]
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const tabs = RANK_TABS.map(([id, label, hint], i) =>
    `<button type="button" class="rank-tab" data-tab="${id}" aria-pressed="${i === 0}"${id === 'israel' ? ' data-soon' : ''}><span>${label}</span><small>${hint}</small></button>`).join('');

  const body = `
<div class="wrap page-pad rank-page">
  <nav class="crumbs" aria-label="מיקום באתר"><a href="${url(ctx)}">ראשי</a></nav>
  <header class="rank-head">
    <div>
      <h1>דירוג השחקנים</h1>
      <p>כל השחקנים של MapleStory Classic World לפי רמה, Fame ומקצוע. אפשר לסנן, לחפש לפי שם ולשתף קישור לכל תצוגה.</p>
    </div>
    <div class="rank-mobs" aria-hidden="true">${mobImg(mobs.overall)}</div>
  </header>
  <dl class="rank-stats" id="rankStats">
    <div><dt>שחקנים מדורגים</dt><dd data-stat="total">…</dd></div>
    <div><dt>מוצגים כאן</dt><dd data-stat="shown">…</dd></div>
    <div><dt>רמה ממוצעת</dt><dd data-stat="avgLevel">…</dd></div>
    <div><dt>Fame ממוצע</dt><dd data-stat="avgFame">…</dd></div>
    <div><dt>עודכן</dt><dd data-stat="updated">…</dd></div>
  </dl>
  <section class="window rank-window" aria-labelledby="rankTitle">
    <div class="window-bar"><h2 id="rankTitle">דירוג כללי</h2><small id="rankSub">לפי רמה</small></div>
    <div class="rank-tabs" role="group" aria-label="סוג הדירוג">${tabs}</div>
    <form class="rank-filters is-collapsed" id="rankFilters" role="search" aria-label="סינון הדירוג">
      <label class="rf rf-q"><span>חיפוש לפי שם</span><input type="search" name="q" autocomplete="off" placeholder="שם הדמות" dir="auto"></label>
      <button type="button" class="btn btn-ghost rf-toggle" id="rfToggle" aria-expanded="false" aria-controls="rankFilters">סינונים <span id="rfCount"></span></button>
      <label class="rf"><span>מקצוע</span><select name="family">${familyOpts}</select></label>
      <label class="rf"><span>ענף</span><select name="job"><option value="">כל הענפים</option></select></label>
      <label class="rf"><span>דרגה</span><select name="tier"><option value="">הכול</option><option value="0">מתחיל</option><option value="1">ג'וב ראשון</option><option value="2">ג'וב שני</option></select></label>
      <fieldset class="rf rf-range"><legend>רמה</legend><input type="number" name="min" min="1" max="200" inputmode="numeric" aria-label="מרמה" placeholder="מ-"><span aria-hidden="true">–</span><input type="number" name="max" min="1" max="200" inputmode="numeric" aria-label="עד רמה" placeholder="עד"></fieldset>
      <div class="rf rf-checks">
        <label class="chk"><input type="checkbox" name="true" value="1"><span>דירוג אמיתי</span></label>
        <label class="chk"><input type="checkbox" name="verified" value="1"><span>רק מאומתים</span></label>
      </div>
      <button type="reset" class="btn btn-ghost rf-reset">איפוס</button>
      <p class="rf-note" id="trueNote">חיפוש לפי שם מלא מוצא כל שחקן ב-ClassicRank, גם מחוץ לרשימה. "דירוג אמיתי" מסתיר דמויות שסומנו שם כבוטים.</p>
    </form>
    <p class="rank-live" id="rankLive" aria-live="polite"></p>
    <div id="rankSoon" class="rank-soon" hidden>
      ${mobImg(mobs.israel, 'rank-soon-mob')}
      <h3>דירוג השחקנים הישראלים: בקרוב</h3>
      <p>בקרוב תוכלו לרשום כאן את הדמות שלכם, עם צילום מסך מהמשחק, ולהופיע בדירוג של הקהילה הישראלית, כולל גילדות וג'אמפ קווסטים.</p>
    </div>
    <ol class="podium" id="rankPodium" aria-label="שלושת הראשונים"></ol>
    <div class="rank-table-wrap">
      <table class="rank-table" id="rankTable">
        <caption class="sr-only" id="rankCaption">דירוג השחקנים</caption>
        <thead><tr><th scope="col">#</th><th scope="col">דמות</th><th scope="col">מקצוע</th><th scope="col">רמה</th><th scope="col">Fame</th><th scope="col" class="col-seen">נבדק</th></tr></thead>
        <tbody><tr><td colspan="6" class="rank-msg">טוען את הדירוג…</td></tr></tbody>
      </table>
    </div>
    <nav class="rank-pager" id="rankPager" aria-label="עמודי הדירוג"></nav>
  </section>
  ${rankCredit(ctx)}
  <noscript><p class="empty">כדי לראות את הדירוג צריך להפעיל JavaScript בדפדפן.</p></noscript>
</div>
<script>window.RANK_CFG=${JSON.stringify({ pageSize: r.pageSize || 25, mobs })};</script>`;
  return layout(ctx, {
    title: 'דירוג השחקנים',
    description: 'דירוג כל השחקנים במייפל סטורי קלאסיק (MapleStory Classic World) לפי רמה, Fame ומקצוע, בעברית. סינון לפי ענף, דרגה וטווח רמות.',
    path: 'ranking/', body, active: 'ranking', edit: 'settings',
    scripts: `<script type="module" src="${url(ctx, 'assets/ranking.js')}${ctx.version ? '?v=' + ctx.version : ''}"></script>`,
  });
}

export function playerPage(ctx) {
  const r = ctx.config.ranking || {};
  const body = `
<div class="wrap narrow page-pad rank-page">
  <nav class="crumbs" aria-label="מיקום באתר"><a href="${url(ctx)}">ראשי</a><span aria-hidden="true">/</span><a href="${url(ctx, 'ranking/')}">דירוג</a></nav>
  <article class="window player" id="playerCard" aria-live="polite">
    <div class="window-bar"><h1 class="player-bar-title">פרופיל שחקן</h1></div>
    <div class="player-in"><p class="rank-msg">טוען…</p></div>
  </article>
  ${rankCredit(ctx)}
</div>
<script>window.RANK_CFG=${JSON.stringify({ pageSize: r.pageSize || 25, mobs: r.mobs || {}, player: true })};</script>`;
  return layout(ctx, {
    title: 'פרופיל שחקן', description: 'פרופיל שחקן בדירוג מייפל סטורי קלאסיק', path: 'ranking/player/', body, active: 'ranking', noindex: true,
    scripts: `<script type="module" src="${url(ctx, 'assets/ranking.js')}${ctx.version ? '?v=' + ctx.version : ''}"></script>`,
  });
}
