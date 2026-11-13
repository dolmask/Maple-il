(function () {
  var base = window.SITE_BASE || '/';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // theme
  var tt = $('#themeToggle');
  if (tt) tt.addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  });

  // mobile menu
  var mt = $('#menuToggle'), nav = $('#mainNav');
  if (mt && nav) mt.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    mt.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // search
  var layer = $('#searchLayer'), input = $('#searchInput'), results = $('#searchResults');
  var index = null, sel = -1, lastFocus = null;
  function load() {
    if (index) return Promise.resolve(index);
    return fetch(base + 'search-index.json').then(function (r) { return r.json(); }).then(function (d) { index = d; return d; });
  }
  function openSearch() {
    lastFocus = document.activeElement;
    layer.hidden = false; document.body.style.overflow = 'hidden';
    input.focus(); load().then(function () { render(input.value); });
  }
  function closeSearch() {
    layer.hidden = true; document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s).toLowerCase().replace(/[֑-ׇ'"׳״]/g, ''); }
  function hl(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  function render(q) {
    if (!index) return;
    var terms = norm(q).split(/\s+/).filter(Boolean);
    var list;
    if (!terms.length) list = index.slice(0, 8).map(function (d) { return { d: d, s: 0 }; });
    else {
      list = index.map(function (d) {
        var t = norm(d.t), s = norm(d.s), h = norm(d.h + ' ' + d.k + ' ' + d.c), b = norm(d.b);
        var score = 0;
        for (var i = 0; i < terms.length; i++) {
          var w = terms[i], hit = 0;
          if (t.indexOf(w) > -1) hit += 10;
          if (s.indexOf(w) > -1) hit += 4;
          if (h.indexOf(w) > -1) hit += 3;
          if (b.indexOf(w) > -1) hit += 1;
          if (!hit) return null;
          score += hit;
        }
        return { d: d, s: score };
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
    }
    sel = -1;
    results.innerHTML = list.length ? list.map(function (r) {
      return '<li><a href="' + base + r.d.u + '"><strong>' + hl(r.d.t, terms) + '\u200F</strong><small>' + esc(r.d.c) + (r.d.l ? ' · Lv ' + esc(r.d.l) : '') + '</small></a></li>';
    }).join('') : '<li class="none">לא נמצאו מדריכים. נסו מילה אחרת, למשל שם של מפה או מקצוע (גם באנגלית).</li>';
  }
  if (layer) {
    document.querySelectorAll('#searchOpen, [data-open-search]').forEach(function (b) { b.addEventListener('click', openSearch); });
    $('#searchClose').addEventListener('click', closeSearch);
    layer.addEventListener('click', function (e) { if (e.target === layer) closeSearch(); });
    input.addEventListener('input', function () { render(input.value); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && layer.hidden && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
      if (layer.hidden) return;
      var links = results.querySelectorAll('a');
      if (e.key === 'Escape') closeSearch();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = Math.max(0, Math.min(links.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
        links.forEach(function (a, i) { a.classList.toggle('is-sel', i === sel); });
        if (links[sel]) links[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && sel > -1 && links[sel]) { links[sel].click(); }
    });
  }

  // TOC highlight
  var tocLinks = document.querySelectorAll('.side .toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          if (current) current.classList.remove('is-current');
          current = map[en.target.id]; if (current) current.classList.add('is-current');
        }
      });
    }, { rootMargin: '0px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var h = document.getElementById(id); if (h) io.observe(h); });
  }
  // close mobile toc after click
  document.querySelectorAll('.toc-mobile a').forEach(function (a) {
    a.addEventListener('click', function () { a.closest('details').open = false; });
  });
})();
