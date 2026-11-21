import test from 'node:test';
import assert from 'node:assert/strict';
import { gearIds, gearUrl, outfitFromUrl } from '../src/lib/gear.js';
import { buildCharacterData } from '../src/lib/character-data.js';

const ITEMS = { 'Steel Igor': 1472005, 'Meba': 1472007, 'Adamantium Guards': 1472010, 'Kandine': 1472013, 'Cass': 1332009, 'Gladius': 1302008, 'Battle Axe': 1412006, 'Black Duo': 1082031, 'Blue Robe': 1050003, 'Brown Hat': 1002038, 'Shield X': 1092002, 'Pants Y': 1060099 };
const row = (a, line) => ({ a, b: a, line });
const W = (rows, heading = 'נשקים') => ({ kind: 'weapons', heading, head: '', sep: '', rows });
const D = {
  classes: {
    beginner: { outfit: [2000, 12000, 20000, 30000, 1040002, 1060002, 1072001] },
    thief: { guide: 'thief', outfit: [2000, 12000, 20000, 30000, 1040011, 1060001, 1072001, 1332000] },
    warrior: { guide: 'warrior', outfit: [2000, 12000, 20000, 30000, 1040009, 1060009, 1002003, 1072001, 1302000] },
    magician: { guide: 'magician', outfit: [2000, 12000, 20000, 30000, 1050003, 1072001, 1372000] },
  },
  tables: {
    thief: [W([row(15, '| 15 | Cass |'), row(20, '| 20 | Steel Igor | Black Duo |'), row(25, '| 25 | Meba |')])],
    assassin: [W([row(30, '| 30 | Adamantium Guards |'), row(35, '| 35 | Kandine |')])],
    warrior: [W([row(30, '| 30 | Battle Axe / Gladius | Shield X |')])],
    magician: [W([row(20, '| 20 | Pants Y |'), row(30, '| 30 | Blue Robe | Brown Hat |')])],
  },
};
const slot = (ids, s) => ids.filter(i => Math.floor(i / 10000) === s);

test('outfitFromUrl reads item ids from a maplestory.io character URL', () => {
  const u = 'https://maplestory.io/api/character/%7B%22itemId%22%3A2000%2C%22version%22%3A%22208.2.0%22%7D%2C%7B%22itemId%22%3A1302000%7D/stand1/0';
  assert.deepEqual(outfitFromUrl(u), [2000, 1302000]);
  assert.deepEqual(outfitFromUrl(''), []);
});

test('weapon follows the level: highest row at or below it', () => {
  assert.deepEqual(slot(gearIds(D, { cls: 'thief', lv: 22, branch: '' }, ITEMS), 147), [1472005]);
  assert.deepEqual(slot(gearIds(D, { cls: 'thief', lv: 29, branch: '' }, ITEMS), 147), [1472007]);
  assert.deepEqual(slot(gearIds(D, { cls: 'thief', lv: 74, branch: 'assassin' }, ITEMS), 147), [1472013]);
});

test('only one weapon, of the branch weapon type', () => {
  const ids = gearIds(D, { cls: 'thief', lv: 22, branch: 'bandit' }, ITEMS);
  const weapons = ids.filter(i => i >= 1300000 && i < 1500000);
  assert.deepEqual(weapons, [1332009]); // שודד: פגיון, לא טופר
});

test('armor from the tables replaces the base outfit by slot; the base fills the rest', () => {
  const ids = gearIds(D, { cls: 'thief', lv: 22, branch: '' }, ITEMS);
  assert.deepEqual(slot(ids, 108), [1082031]);
  assert.deepEqual(slot(ids, 104), [1040011]);
  assert.ok(ids.includes(2000) && ids.includes(30000));
});

test('an overall replaces top and pants', () => {
  const ids = gearIds(D, { cls: 'magician', lv: 30, branch: '' }, ITEMS);
  assert.deepEqual(slot(ids, 105), [1050003]);
  assert.deepEqual(slot(ids, 106), []);
  assert.deepEqual(slot(ids, 100), [1002038]);
});

test('below the first row the base outfit stays; beginners keep the base', () => {
  assert.deepEqual(gearIds(D, { cls: 'thief', lv: 10, branch: '' }, ITEMS), D.classes.thief.outfit);
  assert.deepEqual(gearIds(D, { cls: 'beginner', lv: 8, branch: '' }, ITEMS), D.classes.beginner.outfit);
});

test('first weapon in the row wins; shield only with a one-handed weapon', () => {
  const ids = gearIds(D, { cls: 'warrior', lv: 30, branch: '' }, ITEMS);
  assert.deepEqual(ids.filter(i => i >= 1300000 && i < 1500000), [1302008]); // חרב יד אחת (ברירת המחדל של לוחם)
  assert.deepEqual(slot(ids, 109), [1092002]);
});

test('gearUrl uses the two-handed pose for two-handed weapons', () => {
  assert.match(gearUrl([2000, 1302000]), /\/stand1\/0\?/);
  assert.match(gearUrl([2000, 1412006]), /\/stand2\/0\?/);
  assert.match(gearUrl([2000]), /^https:\/\/maplestory\.io\/api\/character\/%7B%22itemId%22%3A2000/);
});

test('character data carries each class base outfit', () => {
  const u = 'https://maplestory.io/api/character/%7B%22itemId%22%3A2000%7D%2C%7B%22itemId%22%3A1302000%7D/stand1/0';
  const d = buildCharacterData({ classImages: { warrior: u } }, [], { warrior: { name: 'לוחם' } });
  assert.deepEqual(d.classes.warrior.outfit, [2000, 1302000]);
  assert.deepEqual(d.classes.beginner.outfit.slice(0, 4), [2000, 12000, 20000, 30000]);
});

test('a row with a men / women choice takes the first body item and skips women-only items', () => {
  const items = { 'Blue Plain Robe': 1050009, 'Yellow Arianne': 1041026, 'Red Skirt': 1061001, 'Hardwood Wand': 1372006 };
  const d = { classes: { magician: { guide: 'magician', outfit: [2000, 1040002, 1060002, 1372000] } },
    tables: { magician: [W([row(15, '| 15 | Hardwood Wand | Blue Plain Robe (גברים) / Yellow Arianne (נשים) |')])] } };
  const ids = gearIds(d, { cls: 'magician', lv: 15, branch: '' }, items);
  assert.deepEqual(slot(ids, 105), [1050009]);
  assert.deepEqual(slot(ids, 104), []);
  assert.deepEqual(slot(ids, 106), []);
  const d2 = { ...d, tables: { magician: [W([row(15, '| 15 | Yellow Arianne / Red Skirt |')])] } };
  const ids2 = gearIds(d2, { cls: 'magician', lv: 15, branch: '' }, items);
  assert.deepEqual(slot(ids2, 104), [1040002]);
  assert.deepEqual(slot(ids2, 106), [1060002]);
});
