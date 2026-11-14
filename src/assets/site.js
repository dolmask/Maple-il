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

  // accessibility menu
  var A = {};
  try { A = JSON.parse(localStorage.getItem('a11y') || '{}'); } catch (e) {}
  var root = document.documentElement;
  var sizes = ['', 'l', 'xl', 'xxl'];
  function a11yApply() {
    ['contrast', 'links', 'font', 'motion', 'spacing'].forEach(function (k) {
      root.classList.toggle('a11y-' + k, !!A[k]);
      var b = document.querySelector('[data-a11y="' + k + '"]');
      if (b) b.setAttribute('aria-pressed', A[k] ? 'true' : 'false');
    });
    if (A.size) root.dataset.size = A.size; else delete root.dataset.size;
    try { localStorage.setItem('a11y', JSON.stringify(A)); } catch (e) {}
  }
  var ap = $('#a11yPanel'), ao = $('#a11yOpen');
  if (ap && ao) {
    var closeA = function () { ap.hidden = true; ao.setAttribute('aria-expanded', 'false'); };
    ao.addEventListener('click', function () {
      ap.hidden = !ap.hidden; ao.setAttribute('aria-expanded', ap.hidden ? 'false' : 'true');
      if (!ap.hidden) ap.querySelector('button').focus();
    });
    ap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a11y],[data-a11y-close]'); if (!b) return;
      if (b.hasAttribute('data-a11y-close')) { closeA(); ao.focus(); return; }
      var k = b.dataset.a11y, i = sizes.indexOf(A.size || '');
      if (k === 'bigger') A.size = sizes[Math.min(sizes.length - 1, i + 1)];
      else if (k === 'smaller') A.size = sizes[Math.max(0, i - 1)];
      else if (k === 'reset') A = {};
      else A[k] = !A[k];
      a11yApply();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ap.hidden) { closeA(); ao.focus(); } });
    a11yApply();
  }

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
      if (e.key === 'Tab') {
        var f = layer.querySelectorAll('input, button, a[href]');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape') closeSearch();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = Math.max(0, Math.min(links.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
        links.forEach(function (a, i) { a.classList.toggle('is-sel', i === sel); });
        if (links[sel]) links[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && sel > -1 && links[sel]) { links[sel].click(); }
    });
  }

  // edit button: shown only to whoever is logged in to the admin in this browser
  try {
    var target = document.body.dataset.edit;
    if (target && localStorage.getItem('gh_token')) {
      var a = document.createElement('a');
      var view = target.indexOf('settings') === 0 ? '#/' + target : '#/edit/' + target;
      a.href = base + 'admin/' + view;
      a.className = 'edit-fab';
      a.textContent = 'עריכת העמוד';
      document.body.appendChild(a);
    }
  } catch (e) {}

  // reading progress + back to top
  var bar = document.getElementById('progressBar'), top = document.getElementById('toTop');
  var article = document.querySelector('.guide .prose');
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    var expF = document.getElementById('expFill'), expP = document.getElementById('expPct'), lu = document.getElementById('levelUp');
    if (expF && article) {
      var s0 = article.getBoundingClientRect().top + y - 80;
      var e0 = s0 + article.offsetHeight - window.innerHeight + 160;
      var p0 = Math.max(0, Math.min(1, (y - s0) / Math.max(1, e0 - s0)));
      expF.style.width = 'calc(' + (p0 * 100).toFixed(2) + '% - 4px)';
      expP.textContent = (p0 * 100).toFixed(2) + '%';
      if (p0 >= 0.995 && lu && !window.__lvShown) { window.__lvShown = true; lu.hidden = false; }
    }
    if (bar && article) {
      var start = article.getBoundingClientRect().top + y - 80;
      var end = start + article.offsetHeight - window.innerHeight + 160;
      var pct = Math.max(0, Math.min(1, (y - start) / Math.max(1, end - start)));
      bar.style.width = (pct * 100).toFixed(1) + '%';
    }
    if (top) top.hidden = y < 900;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (top) top.addEventListener('click', function () {
    window.scrollTo({ top: 0 });
    var h = document.querySelector('main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });

  var luBox = document.getElementById('levelUp');
  if (luBox) luBox.addEventListener('click', function (e) { if (e.target.closest('[data-close-lu]')) luBox.hidden = true; });

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
