// אייקונים מקוריים (SVG) — משותף לאתר ולמערכת הניהול
const wrap = (p, vb = '0 0 32 32') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${p}</svg>`;

export const ICONS = {
  leaf: wrap('<path d="M16 2l2.6 5.4 4.6-2-1 5.6 5.8-.6-3.2 4.4 4.2 2.4-5.6 1.8 1.4 4.6-5.2-1.8L17 29h-2l-.6-7.2-5.2 1.8 1.4-4.6-5.6-1.8 4.2-2.4-3.2-4.4 5.8.6-1-5.6 4.6 2z" fill="currentColor"/>'),
  sword: wrap('<path d="M24.5 3.5h4v4L14 22l-4-4z" fill="currentColor"/><path d="M7 17.5l7.5 7.5-2 2-2.2-2.2-3.8 3.8-2.6-2.6 3.8-3.8L5.5 20z" fill="currentColor" opacity=".75"/>'),
  wand: wrap('<path d="M5 27l14-14 2.5 2.5-14 14z" fill="currentColor" opacity=".75"/><path d="M22.5 3l1.4 4.1L28 8.5l-4.1 1.4L22.5 14l-1.4-4.1L17 8.5l4.1-1.4z" fill="currentColor"/>'),
  bow: wrap('<path d="M7 3c11 2 20 11 22 22l-2.6.5C24.6 15.7 16.3 7.4 6.5 5.6z" fill="currentColor"/><path d="M6.4 5.2l20.4 20.4" stroke="currentColor" stroke-width="1.4" fill="none" opacity=".7"/><path d="M4 28L22 10l1.4 1.4L5.4 29.4z" fill="currentColor" opacity=".75"/><path d="M22 6.5l3.5 0 0 3.5-2 2-3.5-3.5z" fill="currentColor"/>'),
  claw: wrap('<path d="M16 3l3.2 9.8L29 16l-9.8 3.2L16 29l-3.2-9.8L3 16l9.8-3.2z" fill="currentColor"/><circle cx="16" cy="16" r="2.6" fill="var(--ic-hole, #fff)"/>'),
  map: wrap('<path d="M3 7l8-3 10 3 8-3v21l-8 3-10-3-8 3z" fill="currentColor" opacity=".3"/><path d="M11 4v21M21 7v21" stroke="currentColor" stroke-width="2"/><path d="M3 7l8-3 10 3 8-3v21l-8 3-10-3-8 3z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>'),
  scroll: wrap('<path d="M8 5h17a3 3 0 010 6h-2v13a4 4 0 01-4 4H7a3 3 0 010-6h1z" fill="currentColor" opacity=".3"/><path d="M8 22V5h17a3 3 0 010 6h-2v13a4 4 0 01-4 4H7a3 3 0 010-6h12a3 3 0 003 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M12 11h7M12 15h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  party: wrap('<circle cx="10" cy="11" r="4" fill="currentColor"/><circle cx="22" cy="11" r="4" fill="currentColor" opacity=".7"/><path d="M2 26c0-5 3.6-8 8-8s8 3 8 8z" fill="currentColor"/><path d="M14 26c0-5 3.6-8 8-8s8 3 8 8z" fill="currentColor" opacity=".7"/>'),
  coin: wrap('<circle cx="16" cy="16" r="12" fill="currentColor" opacity=".3"/><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 11h6a3 3 0 010 6h-5a3 3 0 000 6h7M16 8v3M16 23v2" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>'),
  book: wrap('<path d="M4 6c4-1.5 8-1.5 12 1v20c-4-2.5-8-2.5-12-1z" fill="currentColor" opacity=".35"/><path d="M28 6c-4-1.5-8-1.5-12 1v20c4-2.5 8-2.5 12-1z" fill="currentColor"/>'),
  boot: wrap('<path d="M9 3h9v12l9 5v5H5v-6l4-2z" fill="currentColor"/><path d="M5 25h22v3H5z" fill="currentColor" opacity=".6"/>'),
  search: wrap('<circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="3" fill="none"/><path d="M20 20l7 7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  menu: wrap('<path d="M5 9h22M5 16h22M5 23h22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  access: wrap('<circle cx="16" cy="5.5" r="3.2" fill="currentColor"/><path d="M5 10.5l11 2 11-2M16 12.5v7l-5 9M16 19.5l5 9" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  moon: wrap('<path d="M19 3a13 13 0 1 0 10 19A11 11 0 0 1 19 3z" fill="currentColor"/>'),
  sun: wrap('<circle cx="16" cy="16" r="6" fill="currentColor"/><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
};

export const CLASS_INFO = {
  warrior: { name: 'לוחם', en: 'Warrior', icon: 'sword', town: 'פריון (Perion)', stat: 'STR', color: 'var(--c-warrior)' },
  magician: { name: 'קוסם', en: 'Magician', icon: 'wand', town: 'אלינייה (Ellinia)', stat: 'INT', color: 'var(--c-magician)' },
  bowman: { name: 'קשת', en: 'Bowman', icon: 'bow', town: 'הניסיס (Henesys)', stat: 'DEX', color: 'var(--c-bowman)' },
  thief: { name: 'גנב', en: 'Thief', icon: 'claw', town: 'קרנינג סיטי (Kerning City)', stat: 'LUK', color: 'var(--c-thief)' },
};
