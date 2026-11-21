// הדמות בעמוד "הדמות שלי" לובשת ציוד לפי הרמה: הנשק והשריון נלקחים מטבלאות הציוד במדריכים
// (השורה הגבוהה ביותר שהרמה כבר הגיעה אליה), ושאר הבגדים מהתלבושת הבסיסית של המקצוע.
// התמונה נבנית ב-maplestory.io מתוך מזהי הפריטים. משותף ל-Node ולדפדפן.

const AVATAR = 'https://maplestory.io/api/character/';
const part = id => encodeURIComponent(JSON.stringify({ itemId: id, version: '208.2.0', region: 'GMS' }));

// סוגי נשק לפי מקצוע/ענף (שלוש הספרות הראשונות של המזהה), לפי סדר עדיפות
const WEAPONS = {
  warrior: [130, 131, 132, 140, 141, 142], fighter: [130, 131, 140, 141], page: [132, 130, 142, 140], spearman: [143, 144],
  magician: [137, 138], 'fp-wizard': [137, 138], 'il-wizard': [137, 138], cleric: [137, 138],
  bowman: [145, 146], hunter: [145], crossbowman: [146],
  thief: [147, 133], assassin: [147], bandit: [133],
};
const ONE_HANDED = [130, 131, 132, 133, 137];
const TWO_HANDED = [140, 141, 142, 143, 144];
const ARMOR = [100, 104, 105, 106, 107, 108, 109];

const type = id => Math.floor(id / 10000);
// בגדים לנשים (104/105/106 עם 1 בספרה הרביעית): הדמות הבסיסית היא גבר
const womens = id => [104, 105, 106].includes(type(id)) && Math.floor(id / 1000) % 10 === 1;
const isWeapon = id => id >= 1300000 && id < 1500000;
const slotOf = id => (isWeapon(id) ? 'w' : String(type(id)));

export function outfitFromUrl(url) {
  return [...String(url || '').matchAll(/itemId%22%3A(\d+)/g)].map(m => +m[1]);
}

// מזהי פריטים שמופיעים בשורה, לפי הסדר שלהם בשורה (שם ארוך גובר על שם קצר שבתוכו)
function idsInLine(line, ITEMS, names) {
  const taken = [];
  for (const n of names) {
    let i = line.indexOf(n);
    while (i > -1) {
      const end = i + n.length;
      const free = !taken.some(t => i < t.end && end > t.i);
      const edge = !/[A-Za-z]/.test(line[i - 1] || '') && !/[A-Za-z]/.test(line[end] || '');
      if (free && edge) taken.push({ i, end, id: ITEMS[n] });
      i = line.indexOf(n, end);
    }
  }
  return taken.sort((a, b) => a.i - b.i).map(t => t.id).filter(id => id >= 1000000 && id < 2000000);
}

let namesCache = null;
export function gearIds(D, me, ITEMS) {
  const C = (D.classes || {})[me.cls] || {};
  const slots = new Map((C.outfit || []).map(id => [slotOf(id), id]));
  if (me.cls === 'beginner' || !C.guide) return [...slots.values()];
  if (!namesCache || namesCache.src !== ITEMS) namesCache = { src: ITEMS, names: Object.keys(ITEMS).sort((a, b) => b.length - a.length) };
  const names = namesCache.names;
  const wTypes = WEAPONS[me.branch] || WEAPONS[me.cls] || [];
  const srcs = [C.guide].concat(me.lv >= 30 && me.branch ? [me.branch] : []);
  const rows = srcs.flatMap(s => ((D.tables || {})[s] || []).filter(t => t.kind === 'weapons').flatMap(t => t.rows))
    .filter(r => r.a != null && r.a <= me.lv)
    .sort((a, b) => a.a - b.a);
  for (const r of rows) {
    const ids = idsInLine(r.line, ITEMS, names);
    const w = ids.filter(id => wTypes.includes(type(id))).sort((a, b) => wTypes.indexOf(type(a)) - wTypes.indexOf(type(b)))[0];
    if (w) slots.set('w', w);
    const seen = new Set();
    for (const id of ids) {
      const t = type(id);
      if (!ARMOR.includes(t) || womens(id)) continue;
      // חולצה ושמלה/גלימה הן אותו "גוף": בשורה עם כמה אפשרויות לוקחים רק את הראשונה
      const g = t === 104 || t === 105 ? 'body' : t;
      if (seen.has(g)) continue;
      seen.add(g);
      slots.set(String(t), id);
      if (t === 105) { slots.delete('104'); slots.delete('106'); }
      if (t === 104 || t === 106) slots.delete('105');
    }
  }
  const w = slots.get('w');
  if (slots.has('109') && !(w && ONE_HANDED.includes(type(w)))) slots.delete('109');
  return [...slots.values()];
}

export function gearUrl(ids) {
  const pose = ids.some(id => TWO_HANDED.includes(type(id))) ? 'stand2' : 'stand1';
  return AVATAR + ids.map(part).join('%2C') + `/${pose}/0?showears=false&resize=2`;
}
