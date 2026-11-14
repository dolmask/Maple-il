// משיכת נתוני הדירוג מ-ClassicRank בזמן הבנייה. בלי תלויות.
// בלי מפתח: עד 1,000 לפי רמה + עד 1,000 לפי Fame (30 בקשות לדקה).
// עם מפתח (CLASSICRANK_KEY, סוד ב-GitHub בלבד): עמודים של 500 עד maxRows, ורשימות מתחילים.
// לעולם לא זורק: אם המשיכה נכשלת, חוזר לנתונים שכבר באתר החי, ואם גם זה נכשל — מחזיר נתונים ריקים.
import { packRows } from '../src/lib/ranking-data.js';

const defaultSleep = ms => new Promise(r => setTimeout(r, ms));

export async function fetchRanking({
  fetchImpl = globalThis.fetch,
  key = process.env.CLASSICRANK_KEY || '',
  source = 'https://classicrank.com/api/v1',
  maxRows = 10000,
  delayMs,
  fallbackUrl = '',
  log = console.log,
  sleep = defaultSleep,
} = {}) {
  const keyed = !!key;
  const limit = keyed ? 500 : 50;
  const wait = delayMs ?? (keyed ? 600 : 2100);
  const headers = { Accept: 'application/json', 'User-Agent': 'maple-il-ranking (+https://github.com/dolmask/Maple-il)' };
  if (keyed) { headers.Authorization = `Bearer ${key}`; headers['X-API-Key'] = key; }

  let first = true;
  async function get(url) {
    if (!first) await sleep(wait);
    first = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetchImpl(url, { headers });
      if (res.status === 429 && attempt === 0) {
        const ra = parseInt(res.headers.get('retry-after') || '60', 10);
        log(`ClassicRank: 429, ממתין ${ra} שניות`);
        await sleep(ra * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return res.json();
    }
    throw new Error(`HTTP 429 ${url}`);
  }

  async function list(params, cap) {
    const out = [];
    let total = null;
    for (let page = 1; out.length < cap; page++) {
      const q = new URLSearchParams({ ...params, limit: String(limit), page: String(page), fields: 'all' });
      const body = await get(`${source}/characters?${q}`);
      const data = Array.isArray(body?.data) ? body.data : [];
      if (total === null && body?.meta?.total != null) total = body.meta.total;
      out.push(...data);
      if (!data.length || !body?.meta?.next) break;
    }
    return { rows: out.slice(0, cap), total };
  }

  const byName = new Map();
  const add = arr => { for (const c of arr) if (c && c.name && !byName.has(c.name.toLowerCase())) byName.set(c.name.toLowerCase(), c); };
  let total = null;
  const lists = keyed
    ? [[{ sort: 'level' }, maxRows], [{ sort: 'fame' }, Math.min(2000, maxRows)], [{ sort: 'level', type: 'islander' }, 2000], [{ sort: 'level', type: 'permanent' }, 2000]]
    : [[{ sort: 'level' }, 1000], [{ sort: 'fame' }, 1000]];

  for (const [params, cap] of lists) {
    try {
      const r = await list(params, cap);
      if (total === null) total = r.total;
      add(r.rows);
      log(`ClassicRank: ${new URLSearchParams(params)} → ${r.rows.length}`);
    } catch (err) {
      log(`ClassicRank: ${new URLSearchParams(params)} נכשל (${err.message})`);
    }
  }

  if (byName.size) {
    return { meta: { updated: new Date().toISOString(), total: total ?? byName.size, keyed, empty: false, source: 'https://classicrank.com' }, ...packRows([...byName.values()]) };
  }

  if (fallbackUrl) {
    try {
      const res = await fetchImpl(fallbackUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const prev = await res.json();
        if (prev && Array.isArray(prev.rows) && prev.rows.length) {
          log('ClassicRank לא זמין: משתמשים בנתונים הקודמים מהאתר החי');
          return { ...prev, meta: { ...prev.meta, stale: true } };
        }
      }
    } catch { /* ignore */ }
  }
  log('ClassicRank: אין נתונים, הדירוג יוצג ריק');
  return { meta: { updated: new Date().toISOString(), total: 0, keyed, empty: true, source: 'https://classicrank.com' }, ...packRows([]) };
}
