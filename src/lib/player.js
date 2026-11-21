// התחברות עם שם הדמות: לוגיקה טהורה, משותפת ל-Node (בדיקות) ולדפדפן (assets/lib/player.js).
// בלי שרת: הדמות נשמרת בדפדפן בלבד, והנתונים מגיעים מ-ClassicRank.
import { jobInfo } from './ranking-data.js';
import { parseRange } from './character-data.js';

export const REFRESH_MS = 30 * 60 * 1000;

const isNum = v => v !== null && v !== '' && v !== undefined && typeof v !== 'object' && isFinite(+v);

// תשובת ה-API ({data:{…}} או אובייקט שטוח) → Player, או null אם אין בה דמות
export function normalizePlayer(body, now = Date.now()) {
  const c = body && typeof body === 'object' && !Array.isArray(body)
    ? (body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : body)
    : null;
  if (!c || typeof c.name !== 'string' || !c.name.trim() || !isNum(c.level)) return null;
  const name = c.name.trim();
  return {
    name,
    display: typeof c.display_name === 'string' && c.display_name.trim() ? c.display_name.trim() : name,
    level: Math.round(+c.level),
    job: typeof c.job === 'string' ? c.job : '',
    photo: typeof c.photo === 'string' && /^https:\/\//.test(c.photo) ? c.photo : '',
    checked: new Date(now).toISOString(),
  };
}

// Player → הבחירה של "הדמות שלי". cls=null כשהמקצוע לא מוכר לנו
export function toMe(player, classes) {
  const j = jobInfo(player.job);
  const C = classes[j.family];
  const cls = C ? j.family : null;
  const branch = C && j.guide && (C.branches || []).some(b => b.slug === j.guide) ? j.guide : '';
  return { cls, lv: player.level, branch };
}

export function needsRefresh(player, now = Date.now()) {
  const t = Date.parse(player && player.checked);
  return !isFinite(t) || now - t > REFRESH_MS;
}

export function effectiveLevel(manualLv, player) {
  return Math.max(+manualLv || 0, +player.level || 0);
}

export function levelGain(seenLevel, level) {
  return isNum(seenLevel) && level > +seenLevel ? { from: +seenLevel, to: level } : null;
}

// מה נפתח בין from (לא כולל) ל-to (כולל): אבני דרך, ציוד, מדריכים. עד 3.
export function unlocks(D, me, from, to) {
  if (!(to > from)) return [];
  const crossed = x => x != null && from < x && x <= to;
  const C = (D.classes || {})[me.cls] || {};
  const seen = new Set();
  const out = [];
  const add = u => { if (u.slug) { if (seen.has(u.slug)) return; seen.add(u.slug); } out.push(u); };

  const ms = [];
  if (me.cls && crossed(C.first || 10)) ms.push({ lv: C.first || 10, label: 'הגיע הזמן לבחור מקצוע', slug: 'choosing-a-class' });
  if (me.cls && me.cls !== 'beginner' && crossed(30)) ms.push({ lv: 30, label: "הג'וב השני", slug: 'second-job-advancement' });
  for (const j of D.journey || []) {
    const r = parseRange(j.lv);
    if (r && crossed(r[0])) ms.push({ lv: r[0], label: j.label, slug: j.slug });
  }
  ms.sort((a, b) => a.lv - b.lv).forEach(m => add({ type: 'milestone', label: m.label, slug: m.slug }));

  const src = to >= 30 && me.branch ? me.branch : C.guide;
  for (const t of ((D.tables || {})[src] || []).filter(t => t.kind === 'weapons')) {
    for (const r of t.rows) if (crossed(r.a)) add({ type: 'item', label: t.heading, head: t.head, sep: t.sep, line: r.line });
  }

  for (const g of D.guides || []) {
    if (!g.range || !crossed(g.range[0])) continue;
    if (g.cls && g.cls !== me.cls) continue;
    if (g.cat === 'jobs2' && g.cls && me.branch && g.slug !== me.branch) continue;
    add({ type: 'guide', label: g.title, slug: g.slug });
  }
  return out.slice(0, 3);
}
