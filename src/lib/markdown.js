// מנוע Markdown קטן ללא תלויות — משותף לבנייה (Node) ולתצוגה המקדימה במערכת הניהול (דפדפן).
// תומך: כותרות, פסקאות, הדגשה, קישורים, תמונות, רשימות (כולל מקוננות), טבלאות,
// ציטוטים, קו מפריד, קוד, ותיבות מיוחדות בסגנון המשחק (:::tip / :::warning / :::info / :::npc / :::stats).

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------- Front matter ----------
export function parseFrontMatter(src) {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    data[mm[1]] = v;
  }
  return { data, body: text.slice(m[0].length) };
}

export function stringifyFrontMatter(data, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(x => JSON.stringify(String(x))).join(', ')}]`);
    else if (typeof v === 'number' || typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${JSON.stringify(String(v))}`);
  }
  lines.push('---', '');
  return lines.join('\n') + body.replace(/^\n+/, '');
}

// ---------- Inline ----------
function inline(text, opts) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  // images ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
    `<img src="${fixUrl(src, opts)}" alt="${alt}" loading="lazy">`);
  // links [text](href)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
    const ext = /^https?:\/\//.test(href);
    return `<a href="${fixUrl(href, opts)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  // level badge: {{lv 30}} / {{lv 30-70}}
  s = s.replace(/\{\{lv\s+([\d\-–+ ]+)\}\}/g, (_, l) => `<span class="lv">Lv ${l.trim()}</span>`);
  // keyboard: {{key Ctrl}}
  s = s.replace(/\{\{key\s+([^}]+)\}\}/g, (_, k) => `<kbd>${k.trim()}</kbd>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
  return s;
}

function fixUrl(url, opts) {
  const u = url.replace(/&amp;/g, '&');
  if (u.startsWith('/') && !u.startsWith('//')) return escapeHtml((opts.base || '') + u.slice(1));
  return escapeHtml(u);
}

// ---------- Blocks ----------
const CONTAINER_TITLES = {
  tip: 'טיפ',
  warning: 'זהירות',
  info: 'לידיעתך',
  npc: 'NPC',
  stats: 'נתונים',
};

export function renderMarkdown(src, opts = {}) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const headings = [];
  const usedIds = new Set();
  let h2count = 0;
  const html = renderBlocks(lines, opts, headings, usedIds, () => ++h2count);
  return { html, headings };
}

function uniqueId(text, used) {
  let base = slugify(text) || 'section';
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function renderBlocks(lines, opts, headings, usedIds, onH2) {
  const out = [];
  let i = 0;
  const isBlank = l => /^\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i++; continue; }

    // ad marker
    if (/^\s*\[\[ad\]\]\s*$/.test(line)) { out.push('<!--AD-->'); i++; continue; }

    // custom container
    let m = line.match(/^:::\s*(tip|warning|info|npc|stats)\s*(.*)$/);
    if (m) {
      const type = m[1];
      const title = m[2].trim();
      const inner = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) inner.push(lines[i++]);
      i++; // closing
      out.push(renderContainer(type, title, inner, opts, headings, usedIds, onH2));
      continue;
    }

    // fenced code
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre dir="ltr"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // heading
    m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (m) {
      const level = m[1].length;
      const text = m[2];
      const id = uniqueId(text, usedIds);
      if (level === 2) {
        const n = onH2();
        if (n === 3 && opts.autoAds) out.push('<!--AD-->');
      }
      if (level === 2 || level === 3) headings.push({ level, text: text.replace(/[*`]/g, ''), id });
      out.push(`<h${level} id="${id}">${inline(text, opts)}<a class="anchor" href="#${id}" aria-label="קישור לסעיף">#</a></h${level}>`);
      i++;
      continue;
    }

    // hr
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      out.push(renderTable(rows, opts));
      continue;
    }

    // blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderBlocks(buf, opts, [], usedIds, () => 0)}</blockquote>`);
      continue;
    }

    // list
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && buf.length))) {
        buf.push(lines[i++]);
      }
      out.push(renderList(buf, opts));
      continue;
    }

    // paragraph
    const buf = [];
    while (i < lines.length && !isBlank(lines[i]) &&
      !/^(#{1,4}\s|:::|```|\s*>|\s*\||\s*([-*+]|\d+[.)])\s+|\s*(-{3,}|\*{3,})\s*$|\s*\[\[ad\]\])/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    if (buf.length) out.push(`<p>${buf.map(l => inline(l.trim(), opts)).join('<br>')}</p>`);
    else i++;
  }
  return out.join('\n');
}

function renderContainer(type, title, inner, opts, headings, usedIds, onH2) {
  if (type === 'stats') {
    // lines of "key: value" → tooltip-style card
    const rows = inner.filter(l => l.trim()).map(l => {
      const k = l.indexOf(':');
      if (k === -1) return `<div class="stat-row stat-wide">${inline(l.trim(), opts)}</div>`;
      return `<div class="stat-row"><span class="stat-k">${inline(l.slice(0, k).trim(), opts)}</span><span class="stat-v">${inline(l.slice(k + 1).trim(), opts)}</span></div>`;
    }).join('');
    return `<aside class="box box-stats"><div class="box-title">${inline(title || CONTAINER_TITLES.stats, opts)}</div><div class="stat-grid">${rows}</div></aside>`;
  }
  const body = renderBlocks(inner, opts, [], usedIds, () => 0);
  const label = title || CONTAINER_TITLES[type];
  if (type === 'npc') {
    return `<aside class="box box-npc"><div class="npc-name">${inline(label, opts)}</div><div class="npc-text">${body}</div></aside>`;
  }
  return `<aside class="box box-${type}"><div class="box-title">${inline(label, opts)}</div>${body}</aside>`;
}

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

function renderTable(rows, opts) {
  const head = splitRow(rows[0]);
  const aligns = splitRow(rows[1]).map(c => c.endsWith(':') && c.startsWith(':') ? 'center' : '');
  const body = rows.slice(2).map(splitRow);
  const th = head.map((h, j) => `<th${aligns[j] ? ` style="text-align:${aligns[j]}"` : ''}>${inline(h, opts)}</th>`).join('');
  const tb = body.map(r => `<tr>${head.map((_, j) => `<td${aligns[j] ? ` style="text-align:${aligns[j]}"` : ''}>${inline(r[j] ?? '', opts)}</td>`).join('')}</tr>`).join('\n');
  const thead = head.every(h => !h) ? '' : `<thead><tr>${th}</tr></thead>`;
  return `<div class="table-wrap${thead ? '' : ' grid-table'}"><table>${thead}<tbody>${tb}</tbody></table></div>`;
}

function renderList(lines, opts) {
  // parse into tree based on indentation
  const items = [];
  for (const l of lines) {
    const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (m) items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
    else if (items.length) items[items.length - 1].text += ' ' + l.trim();
  }
  let pos = 0;
  function build(minIndent) {
    const ordered = items[pos].ordered;
    let html = ordered ? '<ol>' : '<ul>';
    while (pos < items.length && items[pos].indent >= minIndent) {
      const it = items[pos];
      if (it.indent > minIndent) { html = html.replace(/<\/li>$/, '') + build(it.indent) + '</li>'; continue; }
      pos++;
      let li = inline(it.text, opts);
      li = li.replace(/^\[ \]\s*/, '<span class="check" aria-hidden="true"></span>').replace(/^\[x\]\s*/i, '<span class="check on" aria-hidden="true"></span>');
      html += `<li>${li}</li>`;
    }
    return html + (ordered ? '</ol>' : '</ul>');
  }
  let html = '';
  while (pos < items.length) html += build(items[pos].indent);
  return html;
}

export function readingTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
