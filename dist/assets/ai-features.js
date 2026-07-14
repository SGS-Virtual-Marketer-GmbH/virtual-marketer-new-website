/**
 * Virtual Marketer — "Try it" text-generation preview widget.
 *
 * This is an illustrative, fully client-side preview — it composes a sample
 * product description from templates + the visitor's inputs so people get a
 * feel for tone/structure before booking a real demo. It intentionally does
 * NOT claim to call a live model, to keep the marketing claim honest; the
 * output area and CTA both say "Vorschau" and point to the real demo.
 */
(function () {
  'use strict';

  var TEMPLATES = [
    function (name, kind, tone) {
      return (
        '<strong>' + escapeHtml(name) + '</strong> – ' + kindPhrase(kind) + ', ' + toneOpener(tone) + '. ' +
        'Entwickelt für alle, die Wert auf ' + kindBenefit(kind) + ' legen. ' +
        'Jetzt entdecken und überzeugen lassen.'
      );
    },
    function (name, kind, tone) {
      return (
        toneOpener(tone) + ': <strong>' + escapeHtml(name) + '</strong> bringt ' + kindBenefit(kind) + ' in Ihren Alltag – ' +
        'als ' + kindPhrase(kind) + ', durchdacht bis ins Detail.'
      );
    },
    function (name, kind, tone) {
      return (
        'Warum <strong>' + escapeHtml(name) + '</strong>? Weil ' + kindPhrase(kind) + ' und ' + kindBenefit(kind) + ' hier zusammenkommen – ' +
        toneOpener(tone) + '.'
      );
    }
  ];

  function kindPhrase(kind) {
    var map = {
      mode: 'ein Kleidungsstück mit Charakter',
      technik: 'ein durchdachtes Technik-Produkt',
      haushalt: 'ein praktischer Helfer für den Alltag',
      beauty: 'ein Pflegeprodukt mit besonderer Wirkung',
      sonstiges: 'ein Produkt, das überzeugt'
    };
    return map[kind] || map.sonstiges;
  }

  function kindBenefit(kind) {
    var map = {
      mode: 'Qualität, Passform und Stil',
      technik: 'Zuverlässigkeit und einfache Bedienung',
      haushalt: 'Zeitersparnis und Komfort',
      beauty: 'sichtbare Ergebnisse und hochwertige Inhaltsstoffe',
      sonstiges: 'Qualität und Verlässlichkeit'
    };
    return map[kind] || map.sonstiges;
  }

  function toneOpener(tone) {
    var map = {
      sachlich: 'klar und auf den Punkt gebracht',
      emotional: 'ein Gefühl, das bleibt',
      werblich: 'jetzt entdecken, bevor es andere tun'
    };
    return map[tone] || map.sachlich;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function typeOut(el, html, done) {
    el.innerHTML = '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var full = tmp.textContent;
    var i = 0;
    var cursor = document.createElement('span');
    cursor.className = 'vmaf-cursor';

    var htmlSoFar = '';
    var tagBuffer = '';
    var chars = html.split('');
    var idx = 0;

    function step() {
      if (idx >= chars.length) {
        el.innerHTML = html;
        if (done) done();
        return;
      }
      // Fast-forward through tags so we don't chop them mid-way
      if (chars[idx] === '<') {
        var close = html.indexOf('>', idx);
        htmlSoFar += html.slice(idx, close + 1);
        idx = close + 1;
      } else {
        htmlSoFar += chars[idx];
        idx++;
      }
      el.innerHTML = htmlSoFar;
      el.appendChild(cursor);
      setTimeout(step, 10 + Math.random() * 12);
    }
    step();
  }

  function init() {
    var form = document.getElementById('vmaf-demo-form');
    if (!form) return;

    var output = document.getElementById('vmaf-demo-output');
    var nameInput = document.getElementById('vmaf-product-name');
    var kindSelect = document.getElementById('vmaf-product-kind');
    var toneSelect = document.getElementById('vmaf-product-tone');
    var button = form.querySelector('button');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (nameInput.value || 'Ihr Produkt').trim();
      var kind = kindSelect.value;
      var tone = toneSelect.value;

      var template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      var html = template(name, kind, tone);

      button.disabled = true;
      button.textContent = 'Generiere …';

      output.innerHTML = '<span class="vmaf-output-label">Vorschau-Text</span><span class="vmaf-placeholder"></span>';
      var target = output.querySelector('.vmaf-placeholder');

      setTimeout(function () {
        typeOut(target, html, function () {
          button.disabled = false;
          button.textContent = 'Neuen Text generieren';
        });
      }, 250);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
