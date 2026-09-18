(function () {
  'use strict';

  /**
   * Newsletter signup — "Der Agentic Brief" (DE) / "The Agent Report" (EN).
   *
   * Mounts on every `[data-vm-newsletter]` root found in the page (a page can
   * carry more than one instance — e.g. a blog post gets both the sitewide
   * footer widget and its own end-of-article one — so ids are namespaced by
   * variant rather than assumed unique per page).
   *
   * Talks to POST /api/newsletter: {email, consent, locale} -> 202
   * {status:'pending'} always (the API is deliberately enumeration-safe: a
   * brand-new address, an already-pending one and an already-confirmed one
   * all get the identical response, so the UI must not imply otherwise).
   * Errors: 400 invalid_input, 400 consent_required, 429 too_many_requests.
   *
   * Same architecture as assets/contact-form/contact-form.js and
   * assets/booking-widget/booking-widget.js: vanilla JS, el() builder,
   * fetch() straight to the API, visible loading state, success state
   * replaces the form, errors surface in an aria-live region so a screen
   * reader announces them without moving focus.
   */

  var COPY = {
    de: {
      emailLabel: 'E-Mail-Adresse',
      emailPlaceholder: 'dein.name@unternehmen.de',
      consentHtml: 'Ich habe die <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> gelesen und bin einverstanden, dass Virtual Marketer meine E-Mail-Adresse nutzt, um mir <em>Der Agentic Brief</em> zuzuschicken. Ich kann mich jederzeit mit einem Klick abmelden.',
      submit: 'Anmelden (kostenlos)',
      submitting: 'Wird gesendet…',
      successTitle: 'Fast geschafft',
      successBody: 'Wir haben Ihnen eine E-Mail geschickt — bitte bestätigen Sie Ihre Anmeldung über den Link darin.',
      errGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
      errRate: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
      errEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
      errConsent: 'Bitte bestätigen Sie die Datenschutzerklärung.',
      variants: {
        compact: { heading: 'Der Agentic Brief', sub: 'Wöchentlich: Agenten-Fallstudien &amp; Guides. Kostenlos, jederzeit abbestellbar.' },
        inline: { heading: 'Der Agentic Brief — kostenlos jede Woche', sub: 'Agenten-Fallstudien, Schritt-für-Schritt-Guides, Wettbewerbsnews. Fünf Minuten pro Woche, mittwochs.' },
        index: { heading: 'Keine Ausgabe verpassen', sub: 'Der Agentic Brief: eine Fallstudie, ein How-To, eine Neuigkeit — jede Woche direkt ins Postfach.' },
      },
    },
    en: {
      emailLabel: 'Email address',
      emailPlaceholder: 'you@company.com',
      consentHtml: 'I have read the <a href="/en/privacy-policy/">Privacy Policy</a> and agree that Virtual Marketer may use my email address to send me <em>The Agent Report</em>. I can unsubscribe anytime with one click.',
      submit: 'Subscribe (free)',
      submitting: 'Sending…',
      successTitle: 'Almost there',
      successBody: "We've emailed you — please confirm your subscription via the link inside.",
      errGeneric: 'Something went wrong. Please try again.',
      errRate: 'Too many requests. Please try again later.',
      errEmail: 'Please provide a valid email address.',
      errConsent: 'Please accept the privacy policy.',
      variants: {
        compact: { heading: 'The Agent Report', sub: 'Weekly agent case studies &amp; guides. Free, unsubscribe anytime.' },
        inline: { heading: 'The Agent Report — free, every week', sub: 'Agent case studies, step-by-step guides, competitor news. Five minutes a week, Wednesdays.' },
        index: { heading: "Don't miss an issue", sub: 'The Agent Report: one case study, one how-to, one news item — straight to your inbox, every week.' },
      },
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
    var variant = root.getAttribute('data-variant') || 'compact';
    var t = COPY[locale];
    var v = t.variants[variant] || t.variants.compact;
    var uid = 'vm-nl-' + variant;

    root.classList.add('vm-nl');
    root.classList.add('vm-nl--' + variant);

    // The "compact" variant (mounted in the footer of every page) used to be
    // a bare <h4>. On a page whose own content never reaches h2/h3 before
    // the footer (e.g. /kontakt/: <h1> then straight to this widget), that
    // is a heading-order violation — h1 -> h4 skips two levels. <h2> can
    // never cause that failure (a jump back down to h2 from any deeper
    // level is not a skip, and h1 -> h2 is sequential), so every variant now
    // uses a heading-order-safe tag; the look is kept via the
    // `vm-nl-heading` class instead of a tag selector, so it does not change
    // per variant.
    var heading = document.createElement(variant === 'compact' ? 'h2' : 'h3');
    heading.className = 'vm-nl-heading';
    heading.innerHTML = v.heading;
    var sub = el('p', { class: 'vm-nl-sub', html: v.sub });

    var emailId = uid + '-email';
    var consentId = uid + '-consent';
    var msgId = uid + '-msg';

    var emailInput = el('input', {
      type: 'email', id: emailId, name: 'email', required: 'required', maxlength: '254',
      autocomplete: 'email', inputmode: 'email', placeholder: t.emailPlaceholder,
    });
    var emailField = el('div', { class: 'vm-nl-field' }, [
      el('label', { class: 'vm-nl-label', for: emailId, text: t.emailLabel }),
      emailInput,
    ]);

    // Honeypot — a field real visitors never see or fill; any value in it
    // means the submission is a bot (see backend/src/validate.js:honeypotTriggered).
    var hpInput = el('input', {
      type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off',
      'aria-hidden': 'true',
    });
    var hpWrap = el('div', { class: 'vm-nl-hp' }, [hpInput]);

    var consentInput = el('input', { type: 'checkbox', id: consentId, name: 'consent', required: 'required' });
    var consentWrap = el('div', { class: 'vm-nl-consent' }, [
      consentInput,
      el('label', { for: consentId, html: t.consentHtml }),
    ]);

    var msg = el('div', { class: 'vm-nl-msg', id: msgId, role: 'status', 'aria-live': 'polite' });
    var submitBtn = el('button', { type: 'submit', class: 'vm-nl-btn', text: t.submit });

    var formEl = el('form', { novalidate: 'novalidate' }, [
      emailField, hpWrap, consentWrap, submitBtn, msg,
    ]);

    root.appendChild(heading);
    root.appendChild(sub);
    root.appendChild(formEl);

    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      msg.textContent = '';
      msg.className = 'vm-nl-msg';

      var email = emailInput.value.trim();
      if (!email || emailInput.validity.typeMismatch) {
        msg.textContent = t.errEmail; msg.className = 'vm-nl-msg error';
        emailInput.focus();
        return;
      }
      if (!consentInput.checked) {
        msg.textContent = t.errConsent; msg.className = 'vm-nl-msg error';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = t.submitting;

      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          consent: consentInput.checked === true,
          locale: locale,
          website: hpInput.value,
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; }); })
        .then(function (res) {
          if (res.status === 202 || res.status === 201) {
            showSuccess();
            return;
          }
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          if (res.status === 429) {
            msg.textContent = t.errRate; msg.className = 'vm-nl-msg error';
          } else if (res.body && res.body.error === 'consent_required') {
            msg.textContent = t.errConsent; msg.className = 'vm-nl-msg error';
          } else {
            msg.textContent = t.errGeneric; msg.className = 'vm-nl-msg error';
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          msg.textContent = t.errGeneric; msg.className = 'vm-nl-msg error';
        });
    });

    function showSuccess() {
      root.innerHTML = '';
      var successMsg = el('div', { class: 'vm-nl-msg ok', role: 'status', 'aria-live': 'polite' }, [
        el('strong', { text: t.successTitle }),
        el('p', { text: t.successBody, style: 'margin:4px 0 0;font-weight:400;' }),
      ]);
      root.appendChild(successMsg);
    }
  }

  function init() {
    var roots = document.querySelectorAll('[data-vm-newsletter]');
    for (var i = 0; i < roots.length; i++) mount(roots[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
