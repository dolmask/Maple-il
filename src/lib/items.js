// איורי חפצים מ-maplestory.io: שם החפץ (באנגלית, כפי שמופיע במדריכים) → מזהה החפץ במשחק.
// נוסף רק חפץ שהמזהה שלו ידוע בוודאות; חפץ שלא כאן פשוט מוצג בלי איור.
export const ITEM_BASE = 'https://maplestory.io/api/gms/208.2.0/item/';
export const ITEMS = {
  'Red Potion': 2000000,
  'Orange Potion': 2000001,
  'White Potion': 2000002,
  'Blue Potion': 2000003,
  'Elixir': 2000004,
  'Power Elixir': 2000005,
  'Mana Elixir': 2000006,
  'Meat': 2010001,
  'Lemon': 2010004,
  'Fried Chicken': 2020001,
  'Subi': 2070000,
  'Wolbi': 2070001,
  'Mokbi': 2070002,
  'Kumbi': 2070003,
};

const names = Object.keys(ITEMS).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const RE = new RegExp(`(?<![A-Za-z])(${names.join('|')})(?![A-Za-z])`, 'g');
const SKIP = /^(a|h[1-6]|code|pre|button|script|style|summary|kbd)$/i;

export function itemIcon(id) {
  return `<img class="item-ic" src="${ITEM_BASE}${id}/icon" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
}

// מוסיף איור לפני כל שם חפץ בטקסט (לא בתוך קישורים, כותרות וקוד)
export function addItemIcons(html) {
  const parts = html.split(/(<[^>]+>)/);
  const stack = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) {
      const m = p.match(/^<(\/?)([a-zA-Z0-9]+)/);
      if (!m || /\/>$/.test(p) || /^(br|img|hr|input|meta|link)$/i.test(m[2])) continue;
      if (m[1]) { const k = stack.lastIndexOf(m[2].toLowerCase()); if (k >= 0) stack.length = k; }
      else stack.push(m[2].toLowerCase());
    } else if (p && !stack.some(t => SKIP.test(t))) {
      parts[i] = p.replace(RE, (n) => `<span class="item">${itemIcon(ITEMS[n])}${n}</span>`);
    }
  }
  return parts.join('');
}
