// בניית האתר: node build.mjs  →  התיקייה dist/ מוכנה להעלאה.
// אין תלויות חיצוניות. נתיב הבסיס נלקח מ-BASE_PATH (מוגדר אוטומטית ב-GitHub Actions) או מ-site.config.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter, listShots } from './src/lib/markdown.js';
import { homePage, guidePage, categoryPage, allGuidesPage, staticPage, notFoundPage } from './src/lib/render.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

let base = process.env.BASE_PATH ?? config.basePath ?? '/';
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL;

function readDir(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(f => f.endsWith('.md')).map(f => {
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(full, f), 'utf8'));
    return { slug: data.slug || f.replace(/\.md$/, ''), ...data, body, file: `${dir}/${f}` };
  });
}

const catOrder = Object.fromEntries(config.categories.map((c, i) => [c.id, i]));
const guides = readDir('content/guides')
  .filter(g => !g.draft)
  .sort((a, b) =>
    (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99) ||
    (a.order ?? 50) - (b.order ?? 50) ||
    String(a.title).localeCompare(String(b.title), 'he'));
const pages = readDir('content/pages');

// תמונות שהועלו: שם בלי סיומת → שם הקובץ (לצילומי המסך)
const imgDir = path.join(ROOT, 'content/images');
const images = {};
if (fs.existsSync(imgDir)) for (const f of fs.readdirSync(imgDir)) {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f)) images[f.replace(/\.[^.]+$/, '')] = f;
}
const ctx = { config, base, guides, images, version: Date.now().toString(36) };

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function copyDir(src, dest) {
  const s = path.join(ROOT, src);
  if (!fs.existsSync(s)) return;
  fs.cpSync(s, path.join(OUT, dest), { recursive: true });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

copyDir('src/assets', 'assets');
copyDir('src/lib', 'assets/lib');
copyDir('src/admin', 'admin');
copyDir('content/images', 'images');
copyDir('content/guides', 'admin/content/guides');
copyDir('content/pages', 'admin/content/pages');

write('index.html', homePage(ctx));
write('guides/index.html', allGuidesPage(ctx));
for (const g of guides) write(`guides/${g.slug}/index.html`, guidePage(ctx, g));
for (const c of config.categories) write(`category/${c.id}/index.html`, categoryPage(ctx, c));
for (const p of pages) write(`${p.slug}/index.html`, staticPage(ctx, p));
write('404.html', notFoundPage(ctx));
write('.nojekyll', '');

// search index
const strip = s => s.replace(/[#*`>|:\[\]()!{}_-]+/g, ' ').replace(/\s+/g, ' ');
write('search-index.json', JSON.stringify(guides.map(g => ({
  t: g.title,
  s: g.summary || '',
  c: (config.categories.find(c => c.id === g.category) || {}).name || '',
  l: g.level || '',
  u: `guides/${g.slug}/`,
  k: (g.keywords || []).join(' '),
  h: (g.body.match(/^#{2,3} .+$/gm) || []).map(h => h.replace(/^#+ /, '')).join(' | '),
  b: strip(g.body).slice(0, 4000),
}))));

// manifest for the admin
write('admin/manifest.json', JSON.stringify({
  built: new Date().toISOString(),
  config,
  guides: guides.map(({ body, ...meta }) => ({ ...meta, shots: listShots(body) })),
  pages: pages.map(({ body, ...meta }) => meta),
  siteShots: [{ name: 'home-hero', caption: 'צילום מסך גדול לדף הבית, ליד הכותרת', where: 'דף הבית' }],
}, null, 1));

// SEO files
const siteUrl = (config.siteUrl || '').replace(/\/$/, '');
if (siteUrl) {
  const urls = ['', 'guides/', ...guides.map(g => `guides/${g.slug}/`), ...config.categories.map(c => `category/${c.id}/`), ...pages.map(p => `${p.slug}/`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => {
    const g = guides.find(x => `guides/${x.slug}/` === u);
    return `  <url><loc>${siteUrl}/${u}</loc>${g && g.updated ? `<lastmod>${g.updated}</lastmod>` : ''}</url>`;
  }).join('\n')}\n</urlset>\n`);
}
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: ${base}admin/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
if (config.ads && config.ads.client) {
  write('ads.txt', `google.com, ${config.ads.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
}
if (config.customDomain) write('CNAME', config.customDomain + '\n');

console.log(`✔ נבנו ${guides.length} מדריכים, ${pages.length} עמודים, ${config.categories.length} קטגוריות → dist/ (base: ${base})`);
