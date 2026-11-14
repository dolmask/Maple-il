// נתוני דוגמה מזויפים לבדיקה מקומית בלבד (RANKING_FIXTURE). לא נפרסים לאתר.
import fs from 'node:fs';
import { packRows, JOBS } from '../../src/lib/ranking-data.js';
const jobs = Object.keys(JOBS);
const syl = ['ka', 'zu', 'mi', 'lo', 'ra', 'ne', 'shi', 'to', 'va', 'el', 'dor', 'ix'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const chars = [];
for (let i = 0; i < 180; i++) {
  const name = (pick(syl) + pick(syl) + pick(syl)).replace(/^./, c => c.toUpperCase()) + (i % 3 ? '' : i);
  const job = i < 6 ? 'Beginner' : pick(jobs);
  const tier = JOBS[job].tier;
  const level = job === 'Beginner' ? 8 + Math.floor(rnd() * 30) : tier === 1 ? 10 + Math.floor(rnd() * 20) : 30 + Math.floor(rnd() * 58);
  const ago = Math.floor(rnd() * 5 * 86400e3);
  chars.push({
    name, display_name: name, level, job, job_tier: tier, family: JOBS[job].family,
    beginner_type: job === 'Beginner' ? (i % 2 ? 'islander' : 'permanent') : null,
    fame: Math.floor(rnd() * 40) - 3, overall_rank: 0, job_rank: 0, fame_rank: 0,
    photo: null, verified: rnd() > .2, claimed: rnd() > .7, botting: rnd() > .93,
    first_seen: new Date(Date.now() - 20 * 86400e3).toISOString(), last_checked: new Date(Date.now() - ago).toISOString(),
    level_updated: new Date(Date.now() - ago - 3600e3).toISOString(), profile_url: `https://classicrank.com/user/${name}`,
  });
}
chars.sort((a, b) => b.level - a.level).forEach((c, i) => (c.overall_rank = i + 1));
fs.writeFileSync(new URL('./ranking-sample.json', import.meta.url), JSON.stringify({ meta: { updated: new Date().toISOString(), total: 334082, keyed: false, empty: false, source: 'https://classicrank.com', fixture: true }, ...packRows(chars) }));
console.log('wrote', chars.length);
