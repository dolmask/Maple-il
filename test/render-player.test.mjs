import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { homePage, characterPage } from '../src/lib/render.js';

const config = JSON.parse(fs.readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const ctx = { config, base: '/Maple-il/', guides: [], images: {} };

test('every page has the login dialog, the toast and the player module', () => {
  const html = homePage(ctx);
  assert.match(html, /id="loginDialog"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="loginTitle"[^>]*hidden/);
  assert.match(html, /id="loginForm"[\s\S]*?name="name"[^>]*dir="auto"/);
  assert.match(html, /id="loginResult"[^>]*aria-live="polite"/);
  assert.match(html, /data-login-close/);
  assert.match(html, /id="loginDialog"[\s\S]*?href="https:\/\/classicrank\.com"[\s\S]*?<\/div>/);
  assert.match(html, /id="playerToast"[^>]*role="status"[^>]*hidden/);
  assert.match(html, /<script type="module" src="\/Maple-il\/assets\/player\.js/);
  assert.doesNotMatch(html.slice(html.indexOf('loginDialog')), /מאומת/);
});

test('character page has the linked-character line', () => {
  assert.match(characterPage(ctx), /id="charLink"[^>]*hidden/);
});

test('no login when the ranking is off', () => {
  const off = { ...ctx, config: { ...config, ranking: { ...config.ranking, enabled: false } } };
  const html = homePage(off);
  assert.doesNotMatch(html, /loginDialog|playerToast|assets\/player\.js/);
});
