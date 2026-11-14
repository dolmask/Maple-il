import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rankingPage, playerPage, homePage } from '../src/lib/render.js';

const config = JSON.parse(fs.readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const ctx = { config, base: '/Maple-il/', guides: [], images: {} };

test('ranking page: shell, credit, accessible table, module script', () => {
  const html = rankingPage(ctx);
  assert.match(html, /<html lang="he" dir="rtl">/);
  assert.match(html, /href="https:\/\/classicrank\.com"/);
  assert.match(html, /id="rankTable"/);
  assert.match(html, /<caption/);
  assert.match(html, /id="rankLive"[^>]*aria-live="polite"/);
  assert.match(html, /<script type="module" src="\/Maple-il\/assets\/ranking\.js/);
  assert.match(html, /data-tab="overall"[^>]*aria-pressed="true"/);
  assert.match(html, /maplestory\.io/);
  assert.match(html, /<a href="\/Maple-il\/ranking\/" aria-current="page">[\s\S]*?דירוג<\/span><\/a>/);
});

test('player page: shell, credit, noindex', () => {
  const html = playerPage(ctx);
  assert.match(html, /id="playerCard"/);
  assert.match(html, /href="https:\/\/classicrank\.com"/);
  assert.match(html, /name="robots" content="noindex"/);
});

test('ranking link appears in nav on other pages without aria-current', () => {
  const html = homePage(ctx);
  assert.match(html, /<a href="\/Maple-il\/ranking\/"><span class="sn-ic"[\s\S]*?דירוג<\/span><\/a>/);
});
