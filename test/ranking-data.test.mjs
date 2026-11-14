import test from 'node:test';
import assert from 'node:assert/strict';
import { jobInfo, packRows, unpackRows, filterRows, paginate, findPlayer, summarize, FIELDS } from '../src/lib/ranking-data.js';

const mk = (name, level, job, extra = {}) => ({ name, level, job, fame: 0, overall_rank: 0, botting: false, verified: true, ...extra });

test('jobInfo maps known jobs to Hebrew and family', () => {
  const h = jobInfo('Hunter');
  assert.equal(h.he, 'צייד');
  assert.equal(h.family, 'bowman');
  assert.equal(h.guide, 'hunter');
  assert.equal(jobInfo('Wizard (Fire/Poison)').he, 'קוסם אש/רעל');
  assert.equal(jobInfo('Beginner').family, 'beginner');
});

test('jobInfo falls back for unknown jobs', () => {
  const d = jobInfo('Dark Knight');
  assert.equal(d.family, 'other');
  assert.equal(d.he, 'Dark Knight');
  assert.equal(d.guide, null);
  assert.equal(jobInfo(undefined).family, 'other');
});

test('pack/unpack round trip', () => {
  const chars = [mk('A', 10, 'Thief', { photo: 'x' }), mk('B', 20, 'Page')];
  const packed = packRows(chars);
  assert.deepEqual(packed.fields, FIELDS);
  const back = unpackRows(packed);
  assert.equal(back[0].name, 'A');
  assert.equal(back[0].photo, 'x');
  assert.equal(back[1].job, 'Page');
  assert.equal(back[1].photo, null);
});

test('filterRows: overall sorts by level, assigns pos, trueRank drops botters', () => {
  const rows = [mk('A', 30, 'Thief'), mk('B', 50, 'Page', { botting: true }), mk('C', 40, 'Cleric')];
  const all = filterRows(rows, { tab: 'overall' });
  assert.deepEqual(all.map(r => r.name), ['B', 'C', 'A']);
  assert.deepEqual(all.map(r => r.pos), [1, 2, 3]);
  const tr = filterRows(rows, { tab: 'overall', trueRank: true });
  assert.deepEqual(tr.map(r => r.name), ['C', 'A']);
  assert.equal(tr[0].pos, 1);
});

test('filterRows: fame tab, family, job, tier, query, verified', () => {
  const rows = [
    mk('Alpha', 30, 'Hunter', { fame: 5 }),
    mk('Beta', 35, 'Crossbowman', { fame: 9, verified: false }),
    mk('Gamma', 20, 'Bowman', { fame: 1 }),
    mk('Delta', 33, 'Page', { fame: 2 }),
  ];
  assert.deepEqual(filterRows(rows, { tab: 'fame' }).map(r => r.name), ['Beta', 'Alpha', 'Delta', 'Gamma']);
  assert.deepEqual(filterRows(rows, { tab: 'class', family: 'bowman' }).map(r => r.name), ['Beta', 'Alpha', 'Gamma']);
  assert.deepEqual(filterRows(rows, { tab: 'class', job: 'Hunter' }).map(r => r.name), ['Alpha']);
  assert.deepEqual(filterRows(rows, { tier: 1 }).map(r => r.name), ['Gamma']);
  assert.deepEqual(filterRows(rows, { q: 'ALP' }).map(r => r.name), ['Alpha']);
  assert.deepEqual(filterRows(rows, { verified: true }).map(r => r.name), ['Delta', 'Alpha', 'Gamma']);
});

test('filterRows: level range, swapped when min > max', () => {
  const rows = [mk('A', 10, 'Thief'), mk('B', 31, 'Thief'), mk('C', 45, 'Thief'), mk('D', 60, 'Thief')];
  assert.deepEqual(filterRows(rows, { min: 30, max: 50 }).map(r => r.name), ['C', 'B']);
  assert.deepEqual(filterRows(rows, { min: 50, max: 30 }).map(r => r.name), ['C', 'B']);
  assert.deepEqual(filterRows(rows, { min: '', max: '' }).length, 4);
});

test('filterRows: islander / permanent beginners via beginner_type', () => {
  const rows = [mk('A', 12, 'Beginner', { beginner_type: 'islander' }), mk('B', 40, 'Beginner', { beginner_type: 'permanent' }), mk('C', 50, 'Page')];
  assert.deepEqual(filterRows(rows, { tab: 'islander' }).map(r => r.name), ['A']);
  assert.deepEqual(filterRows(rows, { tab: 'permanent' }).map(r => r.name), ['B']);
});

test('paginate clamps page', () => {
  const rows = Array.from({ length: 60 }, (_, i) => i);
  assert.deepEqual(paginate(rows, 99), { page: 3, pages: 3, items: rows.slice(50) });
  assert.equal(paginate(rows, 'x').page, 1);
  assert.equal(paginate(rows, -4).page, 1);
  assert.equal(paginate([], 2).pages, 1);
  assert.equal(paginate(rows, 2, 25).items[0], 25);
});

test('findPlayer is case and space insensitive', () => {
  const rows = [mk('InsomniaLK', 50, 'Hunter')];
  assert.equal(findPlayer(rows, ' insomnialk ').name, 'InsomniaLK');
  assert.equal(findPlayer(rows, 'nobody'), null);
  assert.equal(findPlayer(rows, ''), null);
});

test('summarize', () => {
  const s = summarize([mk('A', 10, 'Thief', { fame: 2 }), mk('B', 21, 'Thief', { fame: 3 })]);
  assert.deepEqual(s, { count: 2, avgLevel: 15.5, avgFame: 2.5 });
  assert.deepEqual(summarize([]), { count: 0, avgLevel: 0, avgFame: 0 });
});
