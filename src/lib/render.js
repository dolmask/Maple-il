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
export function layout(ctx, { title, description = '', path = '', body, active = '', jsonld = null, noindex = false, edit = 'settings' }) {
  const c = ctx.config;
  const fullTitle = title ? `${title} | ${c.siteName}` : `${c.siteName} — ${c.tagline}`;
  const canonical = c.siteUrl ? c.siteUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '') : '';
  const ads = c.ads || {};
  const nav = c.categories.filter(x => x.nav).map(cat =>
    `<a href="${categoryUrl(ctx, cat.id)}" class="nav-link${active === cat.id ? ' is-active' : ''}">${ICONS[cat.icon] || ''}<span>${e(cat.short || cat.name)}</span></a>`).join('');

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
<meta name="theme-color" content="#5BB8EA">
<link rel="icon" href="${url(ctx, 'assets/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Assistant:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${url(ctx, 'assets/style.css')}${ctx.version ? '?v=' + ctx.version : ''}">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;var a=JSON.parse(localStorage.getItem('a11y')||'{}');for(var k in a){if(k==='size')document.documentElement.dataset.size=a[k];else if(a[k])document.documentElement.classList.add('a11y-'+k)}}catch(e){}</script>
${ads.enabled && ads.client && !ctx.preview ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${e(ads.client)}" crossorigin="anonymous"></script>` : ''}
${c.analyticsId && !ctx.preview ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(c.analyticsId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${e(c.analyticsId)}');</script>` : ''}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body data-edit="${e(edit)}">
<a class="skip" href="#main">דלג לתוכן</a>
<header class="sky">
  <div class="clouds" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
  <div class="bar wrap">
    <a class="brand" href="${url(ctx)}" aria-label="${e(c.siteName)} — דף הבית">
      <span class="brand-leaf">${ICONS.leaf}</span>
      <span class="brand-text"><strong>${e(c.siteName)}</strong><small>${e(c.tagline)}</small></span>
    </a>
    <div class="bar-tools">
      <button class="icon-btn" id="searchOpen" aria-label="חיפוש מדריך">${ICONS.search}</button>
      <button class="icon-btn" id="a11yOpen" aria-label="תפריט נגישות" aria-expanded="false" aria-controls="a11yPanel">${ICONS.access}</button>
      <button class="icon-btn" id="themeToggle" aria-label="מצב לילה / יום"><span class="i-moon">${ICONS.moon}</span><span class="i-sun">${ICONS.sun}</span></button>
      <button class="icon-btn menu-btn" id="menuToggle" aria-label="תפריט" aria-expanded="false" aria-controls="mainNav">${ICONS.menu}</button>
    </div>
  </div>
  <nav class="quickslots wrap" id="mainNav" aria-label="קטגוריות">
    <a href="${url(ctx, 'guides/')}" class="nav-link${active === 'all' ? ' is-active' : ''}">${ICONS.book}<span>כל המדריכים</span></a>
    ${nav}
  </nav>
  <div class="grass" aria-hidden="true"></div>
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
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <a class="brand brand-foot" href="${url(ctx)}"><span class="brand-leaf">${ICONS.leaf}</span><strong>${e(c.siteName)}</strong></a>
      <p>${e(c.footerText || '')}</p>
    </div>
    <nav aria-label="קישורי תחתית">
      ${c.categories.map(cat => `<a href="${categoryUrl(ctx, cat.id)}">${e(cat.name)}</a>`).join('')}
    </nav>
    <nav aria-label="על האתר">
      <a href="${url(ctx, 'about/')}">אודות</a>
      <a href="${url(ctx, 'privacy/')}">מדיניות פרטיות</a>
      <a href="${url(ctx, 'accessibility/')}">הצהרת נגישות</a>
      <a href="${url(ctx, 'copyright/')}">זכויות יוצרים ו-Nexon</a>
      <a href="${url(ctx, 'guides/')}">כל המדריכים</a>
    </nav>
  </div>
  <p class="wrap disclaimer">MapleStory ו-MapleStory Classic World, וכן כל השמות, הדמויות, התמונות, הסימנים המסחריים ושאר החומרים מהמשחק, הם קניינה של NEXON Korea Corporation ושל NEXON America Inc. כל הזכויות שמורות להן. מייפלורז הוא אתר מעריצים לא רשמי: הוא אינו קשור ל-Nexon, אינו ממומן על ידה ואינו מאושר על ידה. <a href="${url(ctx, 'copyright/')}">זכויות יוצרים</a> · <a href="https://m.nexon.com/terms/716" target="_blank" rel="noopener">מדריך ה-IP של Nexon ליוצרי תוכן</a>${c.attribution && c.attribution.text ? ` · ${c.attribution.url ? `<a href="${e(c.attribution.url)}" target="_blank" rel="noopener">${e(c.attribution.text)}</a>` : e(c.attribution.text)}` : ''}</p>
</footer>
<script>window.SITE_BASE=${JSON.stringify(ctx.base || '/')};</script>
<script src="${url(ctx, 'assets/site.js')}${ctx.version ? '?v=' + ctx.version : ''}" defer></script>
</body>
</html>`;
}

// ---------- pieces ----------
function levelChip(level) {
  return level ? `<span class="lv">Lv ${e(level)}</span>` : '';
}

export function guideCard(ctx, g) {
  const cat = catOf(ctx, g.category);
  const cls = g.cls && CLASS_INFO[g.cls];
  const icon = g.thumb ? `<img src="${e(img(ctx, g.thumb))}" alt="" loading="lazy">` : (ICONS[g.icon] || ICONS[cls?.icon] || ICONS[cat.icon] || ICONS.book);
  return `<a class="g-card${g.cls ? ' cls-' + e(g.cls) : ''}" href="${guideUrl(ctx, g.slug)}">
  <span class="g-icon${g.thumb ? ' has-img' : ''}">${icon}</span>
  <span class="g-body">
    <span class="g-title">${t(g.title)}</span>
    <span class="g-sum">${t(g.summary || '')}</span>
    <span class="g-meta">${levelChip(g.level)}<span>${e(cat.name)}</span></span>
  </span>
</a>`;
}

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
  const icon = ICONS[g.icon] || ICONS[cls?.icon] || ICONS[cat.icon] || ICONS.book;

  const toc = headings.filter(h => h.level === 2);
  const tocHtml = toc.length > 2 ? `<nav class="toc" aria-label="תוכן העניינים"><div class="toc-title">בעמוד הזה</div><ol>${toc.map(h => `<li><a href="#${h.id}">${t(h.text)}</a></li>`).join('')}</ol></nav>` : '';

  const body = `
<div class="wrap crumbs"><a href="${url(ctx)}">ראשי</a><span aria-hidden="true">‹</span><a href="${categoryUrl(ctx, cat.id)}">${e(cat.name)}</a></div>
<div class="wrap guide-layout">
  <article class="window guide${g.cls ? ' cls-' + e(g.cls) : ''}">
    ${g.cover ? `<div class="cover"><img src="${e(img(ctx, g.cover))}" alt="${e(g.coverAlt || '')}"></div>` : ''}
    <header class="guide-head">
      <span class="g-icon big">${icon}</span>
      <div>
        <h1>${t(g.title)}</h1>
        ${g.summary ? `<p class="lede">${t(g.summary)}</p>` : ''}
        <div class="meta">${levelChip(g.level)}<span>${readingTime(g.body)} דק׳ קריאה</span>${g.updated ? `<span>עודכן ${e(formatDate(g.updated))}</span>` : ''}</div>
      </div>
    </header>
    ${tocHtml ? `<details class="toc-mobile"><summary>תוכן העניינים</summary>${tocHtml}</details>` : ''}
    <div class="prose">
${withAds}
    </div>
    ${g.sources && g.sources.length ? `<p class="sources">הנתונים נאספו ונבדקו מול מקורות הקהילה, בין היתר: ${g.sources.map(s => `<a href="${e(s)}" target="_blank" rel="noopener nofollow">${e(s.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(', ')}. הערכים נכונים לעדכון האחרון ועשויים להשתנות בעדכוני משחק.</p>` : ''}
    <nav class="pager" aria-label="מדריכים סמוכים">
      ${prev ? `<a class="pg prev" href="${guideUrl(ctx, prev.slug)}"><small>הקודם</small><span>${t(prev.title)}</span></a>` : '<span></span>'}
      ${next ? `<a class="pg next" href="${guideUrl(ctx, next.slug)}"><small>הבא</small><span>${t(next.title)}</span></a>` : '<span></span>'}
    </nav>
  </article>
  <aside class="side">
    ${tocHtml ? `<div class="side-sticky">${tocHtml}${adSlot(ctx, 'sidebar')}</div>` : adSlot(ctx, 'sidebar')}
  </aside>
</div>
${related.length ? `<section class="wrap related"><h2 class="sec-title">כדאי לקרוא גם</h2><div class="card-grid">${related.map(r => guideCard(ctx, r)).join('')}</div></section>` : ''}`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.summary || '',
    inLanguage: 'he',
    dateModified: g.updated || undefined,
    author: { '@type': 'Organization', name: ctx.config.siteName },
  };
  return layout(ctx, { title: g.title, description: g.summary, path: `guides/${g.slug}/`, body, active: g.category, jsonld, edit: `guides/${g.slug}` });
}

// ---------- home ----------
export function homePage(ctx) {
  const c = ctx.config;
  const byCat = id => ctx.guides.filter(g => g.category === id);
  const jobCards = Object.entries(CLASS_INFO).map(([key, info]) => {
    const g = ctx.guides.find(x => x.cls === key && x.category === 'jobs');
    const branches = ctx.guides.filter(x => x.cls === key && x.category === 'jobs2');
    return `<div class="job cls-${key}">
  <a class="job-main" href="${g ? guideUrl(ctx, g.slug) : '#'}">
    <span class="job-icon${(c.classImages || {})[key] ? ' has-img' : ''}">${(c.classImages || {})[key] ? `<img src="${e(img(ctx, c.classImages[key]))}" alt="">` : ICONS[info.icon]}</span>
    <span class="job-name">${info.name}<small>${info.en}</small></span>
    <span class="job-facts"><span>${info.stat}</span><span>${info.town}</span></span>
  </a>
  ${branches.length ? `<div class="job-branches">${branches.map(b => `<a href="${guideUrl(ctx, b.slug)}">${e(b.short || b.title)}</a>`).join('')}</div>` : ''}
</div>`;
  }).join('');

  const journey = (c.journey || []).map(step => {
    const g = ctx.guides.find(x => x.slug === step.slug);
    if (!g) return '';
    return `<li><a href="${guideUrl(ctx, g.slug)}"><span class="j-lv">${e(step.lv)}</span><span class="j-t">${e(step.label)}</span></a></li>`;
  }).join('');

  const cats = c.categories.filter(cat => cat.id !== 'jobs' && cat.id !== 'jobs2').map(cat => {
    const list = byCat(cat.id);
    if (!list.length) return '';
    return `<section class="cat-block">
  <h2 class="sec-title"><a href="${categoryUrl(ctx, cat.id)}">${ICONS[cat.icon] || ''}${e(cat.name)}</a></h2>
  <div class="card-grid">${list.slice(0, 6).map(g => guideCard(ctx, g)).join('')}</div>
</section>`;
  }).join('');

  const latest = [...ctx.guides].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))).slice(0, 5);

  const body = `
<section class="hero wrap">
  <div class="hero-text">
    <h1>${e(c.heroTitle)}</h1>
    <p>${e(c.heroText)}</p>
    <button class="hero-search" type="button" data-open-search>${ICONS.search}<span>חפשו מדריך…</span></button>
    ${renderMarkdown('[[shot home-hero | ' + (c.heroShotCaption || 'MapleStory Classic World') + ']]', { base: ctx.base, images: ctx.images, showMissingShots: false }).html}
  </div>
  <div class="window jobs-window">
    <div class="window-bar"><span>בחרו מסלול</span><small>ג'וב ראשון ב-Lv 10, ג'וב שני ב-Lv 30</small></div>
    <div class="jobs">${jobCards}</div>
  </div>
</section>
${journey ? `<section class="wrap journey-wrap"><h2 class="sec-title">המסלול משחקן חדש ועד Lv 70</h2><ol class="journey">${journey}</ol></section>` : ''}
<div class="wrap home-cols">
  <div>${cats}</div>
  <aside class="side">
    <div class="window news">
      <div class="window-bar"><span>עודכנו לאחרונה</span></div>
      <ul>${latest.map(g => `<li><a href="${guideUrl(ctx, g.slug)}">${t(g.title)}</a><small>${e(formatDate(g.updated))}</small></li>`).join('')}</ul>
    </div>
    ${adSlot(ctx, 'sidebar')}
  </aside>
</div>`;
  return layout(ctx, { title: '', description: c.description, path: '', body, active: 'home' });
}

// ---------- category ----------
export function categoryPage(ctx, cat) {
  const list = ctx.guides.filter(g => g.category === cat.id);
  const body = `
<div class="wrap crumbs"><a href="${url(ctx)}">ראשי</a><span aria-hidden="true">‹</span><span>${e(cat.name)}</span></div>
<section class="wrap list-head"><h1>${ICONS[cat.icon] || ''}${e(cat.name)}</h1><p>${e(cat.desc || '')}</p></section>
<section class="wrap"><div class="card-grid">${list.map(g => guideCard(ctx, g)).join('') || '<p class="empty">עוד אין כאן מדריכים. הראשון בדרך.</p>'}</div></section>`;
  return layout(ctx, { title: cat.name, description: cat.desc, path: `category/${cat.id}/`, body, active: cat.id, edit: 'settings/categories' });
}

export function allGuidesPage(ctx) {
  const groups = ctx.config.categories.map(cat => {
    const list = ctx.guides.filter(g => g.category === cat.id);
    if (!list.length) return '';
    return `<section class="cat-block"><h2 class="sec-title"><a href="${categoryUrl(ctx, cat.id)}">${ICONS[cat.icon] || ''}${e(cat.name)}</a></h2><div class="card-grid">${list.map(g => guideCard(ctx, g)).join('')}</div></section>`;
  }).join('');
  const body = `
<div class="wrap crumbs"><a href="${url(ctx)}">ראשי</a><span aria-hidden="true">‹</span><span>כל המדריכים</span></div>
<section class="wrap list-head"><h1>${ICONS.book}כל המדריכים</h1><p>${ctx.guides.length} מדריכים, מהאי מייפל ועד הג'וב השני.</p></section>
<div class="wrap">${groups}</div>`;
  return layout(ctx, { title: 'כל המדריכים', description: 'רשימת כל המדריכים למייפל סטורי קלאסיק בעברית', path: 'guides/', body, active: 'all' });
}

export function staticPage(ctx, p) {
  const { html } = renderMarkdown(fillTokens(ctx, p.body), { base: ctx.base, images: ctx.images, showMissingShots: ctx.preview });
  const body = `
<div class="wrap crumbs"><a href="${url(ctx)}">ראשי</a><span aria-hidden="true">‹</span><span>${e(p.title)}</span></div>
<div class="wrap narrow"><article class="window guide"><header class="guide-head"><div><h1>${e(p.title)}</h1></div></header><div class="prose">${html}</div></article></div>`;
  return layout(ctx, { title: p.title, description: p.summary || '', path: `${p.slug}/`, body, edit: `pages/${p.slug}` });
}

export function notFoundPage(ctx) {
  const body = `<section class="wrap narrow lost"><div class="window"><div class="window-bar"><span>הפורטל הזה לא מוביל לשום מקום</span></div><div class="prose"><p>העמוד שחיפשתם לא קיים, או שהועבר. נסו את החיפוש, או חזרו לעיר.</p><p><a class="btn" href="${url(ctx)}">חזרה לדף הבית</a> <button class="btn btn-ghost" type="button" data-open-search>חיפוש מדריך</button></p></div></div></section>`;
  return layout(ctx, { title: 'העמוד לא נמצא', body, noindex: true });
}
