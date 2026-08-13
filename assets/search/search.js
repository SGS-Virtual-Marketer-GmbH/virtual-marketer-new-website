(function () {
  'use strict';

  /**
   * Site-wide search — no LLM, no network round trip after the first fetch.
   *
   * The index (scripts/build-search-index.js) is a small, flat JSON array of
   * {t: title, e: excerpt, u: url, y: type}. Matching is the exact fold-and-
   * substring approach the blog archive's own in-page search already uses
   * (scripts/lib/blog-index.js, searchScript()): lowercase, collapse German
   * umlauts to their ASCII form, then every query word must appear as a
   * substring of the title+excerpt text. Every keystroke is a filter over an
   * array of ~250 short strings already sitting in memory — there is nothing
   * here slow enough to need debouncing for correctness, only to avoid
   * re-rendering the DOM on every single keystroke of a fast typist.
   *
   * ONE INDEX FETCH, THEN NOTHING BUT MEMORY
   *
   * The index for the visitor's language loads once, on first focus of the
   * search input — not on page load, so a visitor who never opens search
   * never pays for it — and is cached in a module-level variable for the
   * rest of the page's life. Every trigger on the page (there is one per
   * header) shares that same cached index and opens the same panel.
   *
   * ACCESSIBILITY
   *
   * Follows the WAI-ARIA combobox pattern: the input carries
   * role="combobox" and aria-expanded, the results list is
   * role="listbox"/"option", ArrowUp/ArrowDown move a visually and
   * programmatically (aria-activedescendant) highlighted option, Enter
   * navigates to it, Escape closes and returns focus to the input.
   */

  var COPY = {
    de: {
      placeholder: 'Suchen…',
      openLabel: 'Suche öffnen',
      closeLabel: 'Suche schließen',
      empty: 'Keine Ergebnisse.',
      hint: 'Blogartikel, Lösungen und Seiten durchsuchen',
      typeLabel: { blog: 'Blog', solution: 'Lösung', page: 'Seite' },
    },
    en: {
      placeholder: 'Search…',
      openLabel: 'Open search',
      closeLabel: 'Close search',
      empty: 'No results.',
      hint: 'Search blog posts, solutions and pages',
      typeLabel: { blog: 'Blog', solution: 'Solution', page: 'Page' },
    },
  };

  var MAX_RESULTS = 8;
  var cache = {}; // lang -> Promise<docs[]>

  function fold(s) {
    return (s || '')
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Bolds the matched query terms inside a string. Purely cosmetic — the
   * match itself already happened in fold-space, this just helps a reader's
   * eye land on why a result came up.
   */
  function highlight(text, terms) {
    var safe = escapeHtml(text);
    if (!terms.length) return safe;
    var re = new RegExp('(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function loadIndex(lang) {
    if (!cache[lang]) {
      cache[lang] = fetch('/assets/search/index.' + lang + '.json')
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (docs) {
          docs.forEach(function (d) { d._h = fold(d.t + ' ' + d.e); });
          return docs;
        })
        .catch(function () { return []; });
    }
    return cache[lang];
  }

  function search(docs, query) {
    var terms = fold(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    var hits = docs.filter(function (d) {
      return terms.every(function (t) { return d._h.indexOf(t) !== -1; });
    });
    // Title hits first — a query that matches the title is almost always
    // what the visitor meant, even if a dozen other pages mention the word
    // somewhere in their excerpt too.
    hits.sort(function (a, b) {
      var at = fold(a.t).indexOf(terms[0]) !== -1 ? 0 : 1;
      var bt = fold(b.t).indexOf(terms[0]) !== -1 ? 0 : 1;
      return at - bt;
    });
    return { hits: hits.slice(0, MAX_RESULTS), terms: terms };
  }

  /**
   * One shared panel, any number of trigger buttons.
   *
   * A page can carry more than one visible header at once — the legacy
   * Elementor theme keeps a `.header-desktop` and a `.header-mobile` in the
   * DOM simultaneously and shows one via CSS media query, and the trigger
   * has to be reachable from whichever one is actually visible. Duplicating
   * the whole panel (and its own fetch of the index) per trigger would work
   * but wastes memory and, worse, could desync into two independent search
   * sessions on one page. Every `.vm-search-toggle` on the page instead
   * opens the single `#vm-search-panel`, wherever in the DOM that toggle
   * happens to live.
   */
  function init() {
    var lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    var toggles = document.querySelectorAll('.vm-search-toggle');
    var panel = document.getElementById('vm-search-panel');
    if (!toggles.length || !panel) return;

    var input = panel.querySelector('.vm-search-input');
    var list = panel.querySelector('.vm-search-results');
    var closeBtn = panel.querySelector('.vm-search-close');
    if (!input || !list) return;

    var L = COPY[lang];
    var docs = null;
    var active = -1; // index into the currently rendered <li> set
    var lastToggle = toggles[0];

    function setExpanded(value) {
      toggles.forEach(function (t) { t.setAttribute('aria-expanded', value ? 'true' : 'false'); });
    }

    function open(fromToggle) {
      lastToggle = fromToggle || lastToggle;
      panel.hidden = false;
      setExpanded(true);
      input.focus();
      if (!docs) {
        loadIndex(lang).then(function (d) { docs = d; });
      }
    }
    function close() {
      panel.hidden = true;
      setExpanded(false);
      active = -1;
      input.setAttribute('aria-activedescendant', '');
    }

    function render() {
      var result = docs ? search(docs, input.value) : { hits: [], terms: [] };
      var hits = result.hits || [];
      active = -1;
      input.setAttribute('aria-activedescendant', '');

      if (!fold(input.value)) {
        list.innerHTML = '';
        list.hidden = true;
        return;
      }
      list.hidden = false;
      if (!hits.length) {
        list.innerHTML = '<li class="vm-search-empty" role="presentation">' + escapeHtml(L.empty) + '</li>';
        return;
      }
      list.innerHTML = hits
        .map(function (d, i) {
          return (
            '<li role="option" id="vm-search-opt-' + i + '" class="vm-search-result">' +
            '<a href="' + escapeHtml(d.u) + '" tabindex="-1">' +
            '<span class="vm-search-type">' + escapeHtml(L.typeLabel[d.y] || d.y) + '</span>' +
            '<strong>' + highlight(d.t, result.terms) + '</strong>' +
            (d.e ? '<span class="vm-search-excerpt">' + highlight(d.e, result.terms) + '</span>' : '') +
            '</a></li>'
          );
        })
        .join('');
    }

    function moveActive(delta) {
      var options = list.querySelectorAll('.vm-search-result');
      if (!options.length) return;
      active = (active + delta + options.length) % options.length;
      options.forEach(function (li, i) { li.classList.toggle('is-active', i === active); });
      input.setAttribute('aria-activedescendant', options[active].id);
      options[active].querySelector('a').scrollIntoView({ block: 'nearest' });
    }

    toggles.forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        if (panel.hidden) open(toggle);
        else close();
      });
    });
    if (closeBtn) closeBtn.addEventListener('click', close);

    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(render, 60);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        close();
        lastToggle.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === 'Enter' && active !== -1) {
        e.preventDefault();
        var opts = list.querySelectorAll('.vm-search-result a');
        if (opts[active]) window.location.href = opts[active].getAttribute('href');
      }
    });

    // Panel is a fixed-position overlay with its own backdrop, so "click
    // outside" means anywhere that is not the box itself — the backdrop is
    // part of `panel`, so this checks against `.vm-search-box`, not `panel`.
    panel.addEventListener('click', function (e) {
      if (!e.target.closest('.vm-search-box')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
