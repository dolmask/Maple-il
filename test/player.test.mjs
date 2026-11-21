import test from 'node:test';
import assert from 'node:assert/strict';
import { REFRESH_MS, normalizePlayer, toMe, needsRefresh, effectiveLevel, levelGain, unlocks } from '../src/lib/player.js';
import { buildCharacterData } from '../src/lib/character-data.js';

const NOW = Date.parse('2026-11-21T12:00:00Z');
const classes = {
  beginner: { first: 10 },
  thief: { first: 10, guide: 'thief', branches: [{ slug: 'assassin' }, { slug: 'bandit' }] },
  magician: { first: 8, guide: 'magician', branches: [{ slug: 'cleric' }] },
};

test('normalizePlayer reads wrapped and flat API bodies', () => {
  const p = normalizePlayer({ data: { name: 'Snail', level: 47, job: 'Assassin', photo: 'https://x/p.png' } }, NOW);
  assert.deepEqual(p, { name: 'Snail', display: 'Snail', level: 47, job: 'Assassin', photo: 'https://x/p.png', checked: new Date(NOW).toISOString() });
  const f = normalizePlayer({ name: 'snail', display_name: 'Snail', level: '12', job: 'Thief' }, NOW);
  assert.equal(f.display, 'Snail');
  assert.equal(f.level, 12);
  assert.equal(f.photo, '');
});

test('normalizePlayer rejects bodies without a character', () => {
  for (const b of [{ data: [] }, null, undefined, '<html>', { name: 'x' }, { name: 'x', level: 'abc' }, { data: null }, []]) {
    assert.equal(normalizePlayer(b, NOW), null, JSON.stringify(b));
  }
  assert.equal(normalizePlayer({ name: 'x', level: 3, photo: 'http://x' }, NOW).photo, '');
  assert.equal(normalizePlayer({ name: '  Snail ', level: 3 }, NOW).name, 'Snail');
});

test('toMe maps job to class and branch', () => {
  assert.deepEqual(toMe({ job: 'Assassin', level: 47 }, classes), { cls: 'thief', lv: 47, branch: 'assassin' });
  assert.deepEqual(toMe({ job: 'Thief', level: 20 }, classes), { cls: 'thief', lv: 20, branch: '' });
  assert.equal(toMe({ job: 'Beginner', level: 5 }, classes).cls, 'beginner');
  assert.equal(toMe({ job: 'Dark Knight', level: 80 }, classes).cls, null);
  assert.equal(toMe({ job: 'Hunter', level: 40 }, classes).cls, null); // משפחה שלא קיימת בנתונים
});

test('needsRefresh after 30 minutes or without a check time', () => {
  assert.equal(REFRESH_MS, 30 * 60 * 1000);
  assert.equal(needsRefresh({ checked: new Date(NOW - 29 * 60e3).toISOString() }, NOW), false);
  assert.equal(needsRefresh({ checked: new Date(NOW - 31 * 60e3).toISOString() }, NOW), true);
  assert.equal(needsRefresh({}, NOW), true);
  assert.equal(needsRefresh({ checked: 'garbage' }, NOW), true);
});

test('effectiveLevel takes the higher level', () => {
  assert.equal(effectiveLevel(50, { level: 48 }), 50);
  assert.equal(effectiveLevel(45, { level: 48 }), 48);
  assert.equal(effectiveLevel(undefined, { level: 48 }), 48);
});

test('levelGain only when the level went up', () => {
  assert.deepEqual(levelGain(47, 50), { from: 47, to: 50 });
  assert.equal(levelGain(50, 50), null);
  assert.equal(levelGain(51, 50), null);
  assert.equal(levelGain(undefined, 50), null);
});

const row = (a, b, line) => ({ a, b, line });
const D = {
  classes,
  journey: [{ lv: 'Lv 21', label: 'קבוצה ראשונה: KPQ', slug: 'kerning-party-quest' }, { lv: 'Lv 1–70', label: 'מפות', slug: 'training-spots' }],
  guides: [
    { slug: 'forgotten-hollow', title: 'Forgotten Hollow', range: [39, 50], cls: '', cat: 'quests' },
    { slug: 'cleric', title: 'קלריק', range: [30, 70], cls: 'magician', cat: 'jobs2' },
    { slug: 'kerning-party-quest', title: 'KPQ', range: [21, 30], cls: '', cat: 'party' },
  ],
  tables: {
    assassin: [{ kind: 'weapons', heading: 'טפרים', head: '| רמה | טפר |', sep: '|---|---|', rows: [row(30, 30, '| 30 | Meba |'), row(35, 35, '| 35 | Garnier |')] }],
    thief: [{ kind: 'weapons', heading: 'פגיונות', head: '| רמה | פגיון |', sep: '|---|---|', rows: [row(20, 20, '| 20 | Cass |')] }],
  },
};
const thief = { cls: 'thief', branch: 'assassin' };

test('unlocks lists milestones first', () => {
  const u = unlocks(D, thief, 29, 31);
  assert.equal(u[0].type, 'milestone');
  assert.equal(u[0].slug, 'second-job-advancement');
  assert.ok(u.some(x => x.type === 'item' && x.line === '| 30 | Meba |'));
});

test('unlocks caps at three and is empty without a gain', () => {
  assert.equal(unlocks(D, thief, 20, 60).length, 3);
  assert.deepEqual(unlocks(D, thief, 47, 47), []);
});

test('unlocks counts a row only when its level was crossed', () => {
  assert.ok(unlocks(D, thief, 34, 35).some(x => x.line === '| 35 | Garnier |'));
  assert.ok(!unlocks(D, thief, 35, 36).some(x => x.line === '| 35 | Garnier |'));
});

test('unlocks skips other classes guides and uses first job before 30', () => {
  const u = unlocks(D, { cls: 'thief', branch: '' }, 19, 22);
  assert.ok(u.some(x => x.type === 'item' && x.line === '| 20 | Cass |'));
  assert.ok(u.some(x => x.type === 'milestone' && x.slug === 'kerning-party-quest'));
  assert.ok(!unlocks(D, thief, 29, 30).some(x => x.slug === 'cleric'));
  assert.ok(unlocks(D, { cls: 'magician', branch: '' }, 7, 8).some(x => x.slug === 'choosing-a-class'));
});

test('buildCharacterData passes the journey through', () => {
  const journey = [{ lv: 'Lv 1', label: 'x', slug: 'y' }];
  assert.deepEqual(buildCharacterData({ journey }, [], {}).journey, journey);
});
