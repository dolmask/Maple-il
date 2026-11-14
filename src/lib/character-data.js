// נתוני "הדמות שלי": נאספים מתוך המדריכים עצמם בזמן הבנייה, כך שכל עדכון במדריך מתעדכן גם כאן.
// כל טבלה במדריך שהעמודה הראשונה שלה היא רמה או טווח רמות הופכת לנתון שאפשר לסנן לפי הרמה של הדמות.

// "11–14" → [11,14], "15" → [15,15], "12+" → [12,200], "Lv 21–30" → [21,30]
export function parseRange(s) {
  const txt = String(s ?? '').replace(/\*|`/g, '');
  const m = txt.match(/(\d+)\s*(?:[–\-]\s*(\d+)|(\+))?/);
  if (!m) return null;
  const a = +m[1];
  const b = m[2] ? +m[2] : m[3] ? 200 : a;
  return a <= b ? [a, b] : [b, a];
}

// טבלה: מחזיר את כותרות העמודות והשורות, לכל שורה הטווח מהעמודה הראשונה
function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

const KINDS = [
  ['skills', /סדר (ה)?סקילים|תוכנית .*סקיל|^\d\. תוכנית/],
  ['ap', /סטטים|\bAP\b/],
  ['train', /מפות אימון|מקומות אימון/],
  ['weapons', /נשק|טפר|טופר|קשתות|ציוד|דרישות|כוכבים/],
];
function kindOf(heading) {
  for (const [k, re] of KINDS) if (re.test(heading)) return k;
  return '';
}

export function extractTables(body) {
  const lines = String(body || '').split('\n');
  const out = [];
  let h2 = '', h3 = '';
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const hm = L.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (hm) { if (hm[1] === '##') { h2 = hm[2]; h3 = ''; } else h3 = hm[2]; continue; }
    if (!/^\s*\|/.test(L) || !/^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) continue;
    const head = L, sep = lines[i + 1];
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const r = parseRange(splitRow(lines[j])[0]);
      rows.push({ a: r ? r[0] : null, b: r ? r[1] : null, line: lines[j] });
    }
    i = j - 1;
    const numeric = rows.filter(r => r.a != null).length;
    const h2Range = parseRange(h2.match(/Lv\s*[\d–\-+ ]+/)?.[0] || '');
    if (numeric < 2 && !h2Range) continue;
    const heading = h3 || h2;
    // טבלת דרישות נשק שנמצאת בתוך פרק הסטטים היא עדיין טבלת נשקים
    const byLevel = /^\s*\|\s*(רמה|רמות|Lv)/.test(head);
    const kind = !byLevel ? (h2Range ? 'spots' : '') : /טופר|פגיון|נדרש|W\.ATK/.test(head) ? 'weapons' : (kindOf(heading) || kindOf(h2));
    if (!kind) continue;
    out.push({ kind, heading, h2, h2Range, head, sep, rows });
  }
  return out;
}

const AVATAR = 'https://maplestory.io/api/character/';
const part = id => encodeURIComponent(JSON.stringify({ itemId: id, version: '208.2.0', region: 'GMS' }));
export const BEGINNER_IMG = AVATAR + [2000, 12000, 20000, 30000, 1040002, 1060002, 1072001].map(part).join('%2C') + '/stand1/0?showears=false&resize=2';

// מה נשלח לדפדפן בעמוד "הדמות שלי"
export function buildCharacterData(config, guides, CLASS_INFO) {
  const pick = g => ({
    slug: g.slug, title: g.title, short: g.short || '', cat: g.category, cls: g.cls || '',
    range: parseRange(g.level || '') || null, thumb: g.thumb || '',
  });
  const classes = {
    beginner: { name: 'מתחיל', img: BEGINNER_IMG, guide: 'beginners-guide', first: 10, town: { id: 104000000, pos: '50% 60%' } },
  };
  for (const [key, info] of Object.entries(CLASS_INFO)) {
    const g = guides.find(x => x.cls === key && x.category === 'jobs');
    classes[key] = {
      name: info.name, en: info.en, stat: info.stat,
      img: (config.classImages || {})[key] || '',
      guide: g ? g.slug : '',
      first: key === 'magician' ? 8 : 10,
      town: (config.towns || {})[key] || null,
      branches: guides.filter(x => x.cls === key && x.category === 'jobs2').map(b => ({ slug: b.slug, name: b.short || b.title, img: b.thumb || '' })),
    };
  }
  const tableGuides = guides.filter(g => g.cls || g.slug === 'training-spots');
  const tables = {};
  for (const g of tableGuides) {
    const t = extractTables(g.body).filter(x => x.kind || g.slug === 'training-spots');
    if (t.length) tables[g.slug] = t;
  }
  return { classes, guides: guides.map(pick), tables };
}
