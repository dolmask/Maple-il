// נתוני הדירוג: מיפוי מקצועות, דחיסה, סינון, מיון ועימוד.
// משותף לבנייה (Node) ולדפדפן (assets/lib/ranking-data.js). בלי תלויות.

export const FAMILIES = {
  warrior: { he: 'לוחם', en: 'Warrior', icon: 'sword' },
  magician: { he: 'קוסם', en: 'Magician', icon: 'wand' },
  bowman: { he: 'קשת', en: 'Bowman', icon: 'bow' },
  thief: { he: 'גנב', en: 'Thief', icon: 'claw' },
  beginner: { he: 'מתחיל', en: 'Beginner', icon: 'leaf' },
  other: { he: 'אחר', en: 'Other', icon: 'user' },
};

// he: השם בעברית כמו במדריכים. guide: ה-slug של המדריך, אם יש.
export const JOBS = {
  'Beginner': { he: 'מתחיל', family: 'beginner', tier: 0, guide: 'beginners-guide' },
  'Warrior': { he: 'לוחם', family: 'warrior', tier: 1, guide: 'warrior' },
  'Fighter': { he: 'פייטר', family: 'warrior', tier: 2, guide: 'fighter' },
  'Page': { he: "פייג'", family: 'warrior', tier: 2, guide: 'page' },
  'Spearman': { he: 'ספירמן', family: 'warrior', tier: 2, guide: 'spearman' },
  'Magician': { he: 'קוסם', family: 'magician', tier: 1, guide: 'magician' },
  'Wizard (Fire/Poison)': { he: 'קוסם אש/רעל', family: 'magician', tier: 2, guide: 'fp-wizard' },
  'Wizard (Ice/Lightning)': { he: 'קוסם קרח/ברק', family: 'magician', tier: 2, guide: 'il-wizard' },
  'Cleric': { he: 'קלריק', family: 'magician', tier: 2, guide: 'cleric' },
  'Bowman': { he: 'קשת', family: 'bowman', tier: 1, guide: 'bowman' },
  'Hunter': { he: 'צייד', family: 'bowman', tier: 2, guide: 'hunter' },
  'Crossbowman': { he: 'קשת צולבת', family: 'bowman', tier: 2, guide: 'crossbowman' },
  'Thief': { he: 'גנב', family: 'thief', tier: 1, guide: 'thief' },
  'Assassin': { he: 'מתנקש', family: 'thief', tier: 2, guide: 'assassin' },
  'Bandit': { he: 'שודד', family: 'thief', tier: 2, guide: 'bandit' },
};

export const TIER_LABEL = ['מתחיל', "ג'וב ראשון", "ג'וב שני", "ג'וב שלישי"];

const ALIASES = {
  'f/p wizard': 'Wizard (Fire/Poison)', 'fp wizard': 'Wizard (Fire/Poison)', 'fire/poison wizard': 'Wizard (Fire/Poison)',
  'i/l wizard': 'Wizard (Ice/Lightning)', 'il wizard': 'Wizard (Ice/Lightning)', 'ice/lightning wizard': 'Wizard (Ice/Lightning)',
  'archer': 'Bowman', 'swordsman': 'Warrior',
};
const lower = Object.fromEntries(Object.keys(JOBS).map(k => [k.toLowerCase(), k]));

export function canonicalJob(job) {
  const s = String(job ?? '').trim();
  const l = s.toLowerCase();
  return lower[l] || ALIASES[l] || s;
}

export function jobInfo(job) {
  const en = canonicalJob(job);
  const j = JOBS[en];
  if (j) return { en, ...j };
  return { en: en || '?', he: en || 'לא ידוע', family: 'other', tier: null, guide: null };
}

export const FIELDS = ['name', 'display_name', 'level', 'job', 'job_tier', 'family', 'beginner_type', 'fame',
  'overall_rank', 'job_rank', 'fame_rank', 'photo', 'verified', 'claimed', 'botting',
  'first_seen', 'last_checked', 'level_updated', 'profile_url'];

export function packRows(chars) {
  return { fields: FIELDS.slice(), rows: chars.map(c => FIELDS.map(f => (c[f] === undefined ? null : c[f]))) };
}

export function unpackRows({ fields = FIELDS, rows = [] } = {}) {
  return rows.map(r => {
    const o = {};
    fields.forEach((f, i) => { o[f] = r[i] === undefined ? null : r[i]; });
    return o;
  });
}

const num = v => (v === '' || v === null || v === undefined || isNaN(+v) ? null : +v);
const norm = s => String(s ?? '').trim().toLowerCase();

function tierOf(r) {
  const t = num(r.job_tier);
  return t !== null ? t : jobInfo(r.job).tier;
}
function btype(r) { return norm(r.beginner_type); }

// opts: { tab: overall|fame|class|islander|permanent, family, job, tier, min, max, q, verified, trueRank }
export function filterRows(rows, opts = {}) {
  const tab = opts.tab || 'overall';
  let min = num(opts.min), max = num(opts.max);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const tier = num(opts.tier);
  const q = norm(opts.q);
  const job = opts.job ? canonicalJob(opts.job) : '';

  const out = rows.filter(r => {
    if (opts.trueRank && r.botting) return false;
    if (opts.verified && !r.verified) return false;
    if (tab === 'islander' && btype(r) !== 'islander') return false;
    if (tab === 'permanent' && !/^perm/.test(btype(r))) return false;
    if (opts.family && jobInfo(r.job).family !== opts.family) return false;
    if (job && canonicalJob(r.job) !== job) return false;
    if (tier !== null && tierOf(r) !== tier) return false;
    if (min !== null && (r.level ?? 0) < min) return false;
    if (max !== null && (r.level ?? 0) > max) return false;
    if (q && !norm(r.name).includes(q) && !norm(r.display_name).includes(q)) return false;
    return true;
  });

  const byRank = (a, b) => (a.overall_rank || 1e9) - (b.overall_rank || 1e9) || String(a.name).localeCompare(String(b.name));
  if (tab === 'fame') out.sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0) || (b.level ?? 0) - (a.level ?? 0) || byRank(a, b));
  else out.sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || byRank(a, b));
  return out.map((r, i) => ({ ...r, pos: i + 1 }));
}

export function paginate(rows, page, size = 25) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  let p = Math.floor(num(page) ?? 1);
  if (p < 1) p = 1;
  if (p > pages) p = pages;
  return { page: p, pages, items: rows.slice((p - 1) * size, p * size) };
}

export function findPlayer(rows, name) {
  const n = norm(name);
  if (!n) return null;
  return rows.find(r => norm(r.name) === n) || null;
}

export function summarize(rows) {
  if (!rows.length) return { count: 0, avgLevel: 0, avgFame: 0 };
  const sum = k => rows.reduce((s, r) => s + (+r[k] || 0), 0);
  const r1 = x => Math.round(x * 10) / 10;
  return { count: rows.length, avgLevel: r1(sum('level') / rows.length), avgFame: r1(sum('fame') / rows.length) };
}
