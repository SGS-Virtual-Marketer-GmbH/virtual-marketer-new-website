(function () {
  'use strict';

  /**
   * Gated whitepaper download form — mounts on #vm-whitepaper-form on the
   * /whitepaper/<slug>/ (DE) and /en/whitepaper/<slug>/ (EN) landing pages.
   *
   * Talks to POST /api/whitepaper: {email, name?, locale, slug, consent,
   * newsletterOptIn, website} -> 201 {id, status:'pending'}. The PDF is
   * NEVER handed over on this response — the API only emails a confirmation
   * link; the actual download link is inside the email the user gets after
   * clicking it (see backend/src/routes/whitepaper.js). The success message
   * here must say "check your inbox", not "here is your file", or it would
   * misrepresent a flow that is deliberately double-opt-in.
   *
   * Two SEPARATE consent checkboxes, both unticked by default:
   *   - privacy policy acknowledgement (required to submit at all)
   *   - "also subscribe me to the newsletter" (optional, its own consent,
   *     recorded under its own version/timestamp server-side) — bundling
   *     this into the first checkbox would not be lawful under GDPR.
   *
   * `slug` is fixed per mounted instance via the root's data-slug attribute
   * (the backend checks it against a closed allowlist — see
   * WHITEPAPER_ASSETS in backend/src/routes/whitepaper.js — so this must
   * match exactly: "agentic-marketing-2026").
   */

  var COPY = {
    de: {
      nameLabel: 'Name (optional)',
      namePlaceholder: 'Vorname Nachname',
      emailLabel: 'E-Mail-Adresse',
      emailPlaceholder: 'dein.name@unternehmen.de',
      consentHtml: 'Ich habe die <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> gelesen und bin einverstanden, dass Virtual Marketer meine Angaben nutzt, um mir das Whitepaper zuzusenden.',
      newsletterHtml: 'Ja, schickt mir zusätzlich <em>Der Agentic Brief</em> — den wöchentlichen Newsletter von Virtual Marketer. Jederzeit mit einem Klick abbestellbar.',
      submit: 'Whitepaper herunterladen',
      submitting: 'Wird gesendet…',
      successTitle: 'Fast geschafft',
      successBody: 'Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen gerade geschickt haben — danach erhalten Sie den Download-Link direkt per E-Mail.',
      errGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
      errRate: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
      errEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
      errConsent: 'Bitte bestätigen Sie die Datenschutzerklärung.',
    },
    en: {
      nameLabel: 'Name (optional)',
      namePlaceholder: 'First Last',
      emailLabel: 'Email address',
      emailPlaceholder: 'you@company.com',
      consentHtml: 'I have read the <a href="/en/privacy-policy/">Privacy Policy</a> and agree that Virtual Marketer may use my details to send me the whitepaper.',
      newsletterHtml: 'Yes, also send me <em>The Agent Report</em> — Virtual Marketer’s weekly newsletter. Unsubscribe anytime with one click.',
      submit: 'Download whitepaper',
      submitting: 'Sending…',
      successTitle: 'Almost there',
      successBody: "Please confirm your email address via the link we just sent you — you'll get the download link by email right after.",
      errGeneric: 'Something went wrong. Please try again.',
      errRate: 'Too many requests. Please try again later.',
      errEmail: 'Please provide a valid email address.',
      errConsent: 'Please accept the privacy policy.',
    },
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function mount(root) {
    var locale = root.getAttribute('data-locale') === 'en' ? 'en' : 'de';
    var slug = root.getAttribute('data-slug') || 'agentic-marketing-2026';
    var t = COPY[locale];

    root.classList.add('vm-wpf');

    var nameInput = el('input', { type: 'text', id: 'vm-wpf-name', name: 'name', maxlength: '200', autocomplete: 'name' });
    var emailInput = el('input', {
      type: 'email', id: 'vm-wpf-email', name: 'email', required: 'required', maxlength: '254',
      autocomplete: 'email', inputmode: 'email', placeholder: t.emailPlaceholder,
    });
    var hpInput = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    var consentInput = el('input', { type: 'checkbox', id: 'vm-wpf-consent', name: 'consent', required: 'required' });
    var newsletterInput = el('input', { type: 'checkbox', id: 'vm-wpf-newsletter', name: 'newsletterOptIn' });
    var msg = el('div', { class: 'vm-wpf-msg', role: 'status', 'aria-live': 'polite' });
    var submitBtn = el('button', { type: 'submit', class: 'vm-wpf-btn', text: t.submit });

    var formEl = el('form', { novalidate: 'novalidate' }, [
      el('div', { class: 'vm-wpf-field' }, [
        el('label', { class: 'vm-wpf-label', for: 'vm-wpf-name', text: t.nameLabel }),
        (function () { nameInput.setAttribute('placeholder', t.namePlaceholder); return nameInput; })(),
      ]),
      el('div', { class: 'vm-wpf-field' }, [
        el('label', { class: 'vm-wpf-label', for: 'vm-wpf-email', text: t.emailLabel }),
        emailInput,
      ]),
      el('div', { class: 'vm-wpf-hp' }, [hpInput]),
      el('div', { class: 'vm-wpf-consent' }, [
        consentInput,
        el('label', { for: 'vm-wpf-consent', html: t.consentHtml }),
      ]),
      el('div', { class: 'vm-wpf-consent' }, [
        newsletterInput,
        el('label', { for: 'vm-wpf-newsletter', html: t.newsletterHtml }),
      ]),
      submitBtn,
      msg,
    ]);
    root.appendChild(formEl);

    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      msg.textContent = '';
      msg.className = 'vm-wpf-msg';

      var email = emailInput.value.trim();
      if (!email || emailInput.validity.typeMismatch) {
        msg.textContent = t.errEmail; msg.className = 'vm-wpf-msg error';
        emailInput.focus();
        return;
      }
      if (!consentInput.checked) {
        msg.textContent = t.errConsent; msg.className = 'vm-wpf-msg error';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = t.submitting;

      fetch('/api/whitepaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: nameInput.value.trim() || undefined,
          locale: locale,
          slug: slug,
          consent: consentInput.checked === true,
          newsletterOptIn: newsletterInput.checked === true,
          website: hpInput.value,
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; }); })
        .then(function (res) {
          if (res.status === 201) {
            showSuccess();
            return;
          }
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          if (res.status === 429) {
            msg.textContent = t.errRate; msg.className = 'vm-wpf-msg error';
          } else if (res.body && res.body.error === 'consent_required') {
            msg.textContent = t.errConsent; msg.className = 'vm-wpf-msg error';
          } else {
            msg.textContent = t.errGeneric; msg.className = 'vm-wpf-msg error';
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          msg.textContent = t.errGeneric; msg.className = 'vm-wpf-msg error';
        });
    });

    function showSuccess() {
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'vm-wpf-success', role: 'status', 'aria-live': 'polite' }, [
        el('svg', { width: '40', height: '40', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
        el('h3', { text: t.successTitle }),
        el('p', { text: t.successBody }),
      ]));
      // createElementNS, not innerHTML: self-closing tag syntax is not
      // respected by the HTML parser for non-void SVG elements — see the
      // identical note in assets/contact-form/contact-form.js.
      var svg = root.querySelector('svg');
      var svgNS = 'http://www.w3.org/2000/svg';
      var pathEl = document.createElementNS(svgNS, 'path');
      pathEl.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14');
      var polylineEl = document.createElementNS(svgNS, 'polyline');
      polylineEl.setAttribute('points', '22 4 12 14.01 9 11.01');
      svg.appendChild(pathEl);
      svg.appendChild(polylineEl);
    }
  }

  function init() {
    var root = document.getElementById('vm-whitepaper-form');
    if (root) mount(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
