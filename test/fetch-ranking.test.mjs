import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRanking } from '../scripts/fetch-ranking.mjs';

const json = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: k => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});
const ch = (name, level, fame = 0) => ({ name, level, fame, job: 'Hunter' });
const quiet = { log: () => {}, sleep: async () => {} };

test('free tier: pages level + fame, merges by name, stops at meta.next', async () => {
  const calls = [];
  const fetchImpl = async (u, init) => {
    calls.push({ u: String(u), init });
    const url = new URL(u);
    const sort = url.searchParams.get('sort'), page = +url.searchParams.get('page');
    if (sort === 'level') return json(page === 1
      ? { data: [ch('A', 50), ch('B', 40)], meta: { total: 1234, next: 'x' } }
      : { data: [ch('C', 30)], meta: { total: 1234, next: null } });
    return json({ data: [ch('B', 40, 9), ch('Z', 5, 8)], meta: { total: 1234, next: null } });
  };
  const out = await fetchRanking({ fetchImpl, key: '', source: 'https://cr.test/api/v1', ...quiet });
  assert.equal(out.meta.keyed, false);
  assert.equal(out.meta.total, 1234);
  assert.equal(out.meta.empty, false);
  const names = out.rows.map(r => r[0]).sort();
  assert.deepEqual(names, ['A', 'B', 'C', 'Z']);
  assert.ok(calls.every(c => /fields=all/.test(c.u) && /limit=50/.test(c.u)));
  assert.ok(calls.every(c => !c.init?.headers?.Authorization));
});

test('keyed: sends key header, larger pages, extra beginner lists, never leaks key', async () => {
  const seen = [];
  const fetchImpl = async (u, init) => {
    seen.push({ u: String(u), h: init?.headers || {} });
    const type = new URL(u).searchParams.get('type');
    if (type === 'islander') return json({ data: [{ ...ch('Isl', 9), beginner_type: 'islander' }], meta: { next: null } });
    if (type === 'permanent') return json({ data: [{ ...ch('Perm', 40), beginner_type: 'permanent' }], meta: { next: null } });
    return json({ data: [ch('A', 50)], meta: { total: 9, next: null } });
  };
  const out = await fetchRanking({ fetchImpl, key: 'SECRET123', source: 'https://cr.test/api/v1', ...quiet });
  assert.equal(out.meta.keyed, true);
  assert.ok(seen.some(s => /limit=500/.test(s.u)));
  assert.ok(seen.every(s => s.h.Authorization === 'Bearer SECRET123'));
  assert.ok(out.rows.some(r => r[0] === 'Isl') && out.rows.some(r => r[0] === 'Perm'));
  assert.ok(!JSON.stringify(out).includes('SECRET123'));
});

test('429 waits Retry-After and retries once', async () => {
  let n = 0; const waits = [];
  const fetchImpl = async () => (++n === 1 ? json({}, 429, { 'retry-after': '3' }) : json({ data: [ch('A', 1)], meta: { next: null } }));
  const out = await fetchRanking({ fetchImpl, key: '', source: 'https://cr.test/api/v1', log: () => {}, sleep: async ms => waits.push(ms) });
  assert.ok(waits.includes(3000));
  assert.equal(out.rows.length, 1);
});

test('total failure falls back to live data.json', async () => {
  const prev = { meta: { updated: '2026-11-14T00:00:00Z', total: 5, keyed: false, empty: false }, fields: ['name'], rows: [['Old']] };
  const fetchImpl = async u => {
    if (String(u).startsWith('https://site.test/')) return json(prev);
    throw new Error('network down');
  };
  const out = await fetchRanking({ fetchImpl, key: '', source: 'https://cr.test/api/v1', fallbackUrl: 'https://site.test/ranking/data.json', ...quiet });
  assert.equal(out.meta.stale, true);
  assert.deepEqual(out.rows, [['Old']]);
});

test('everything fails → empty dataset, no throw', async () => {
  const fetchImpl = async () => { throw new Error('nope'); };
  const out = await fetchRanking({ fetchImpl, key: '', source: 'https://cr.test/api/v1', fallbackUrl: 'https://site.test/x.json', ...quiet });
  assert.equal(out.meta.empty, true);
  assert.deepEqual(out.rows, []);
});
