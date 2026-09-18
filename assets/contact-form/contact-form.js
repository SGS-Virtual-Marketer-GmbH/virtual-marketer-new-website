(function () {
  'use strict';

  // Lighthouse ("Form elements do not have associated labels") and a manual
  // keyboard/VoiceOver pass both flagged the same three things on this
  // widget: the <label>s here were plain text with no `for`, so nothing
  // associated them with their input; there was no consent checkbox at all
  // (the DE/EN privacy pages exist but nothing on this form referenced
  // them, and the site otherwise has no consent gate before it POSTs to
  // /api/contact); and there was one generic error message for the whole
  // form with no aria-live, so a screen reader user who submitted with a
  // field missing heard nothing at all.
  //
  // Fixed here rather than in the page generator: this <div id="vm-contact-
  // form"> is empty in the built HTML (see scripts/generate-contact-page.js)
  // — this file is what actually renders the form, at runtime, so it is the
  // only place labels/ids/consent can be attached to real elements.
  var COPY = {
    de: {
      name: 'Name', email: 'E-Mail', message: 'Nachricht',
      consentPre: 'Ich habe die ', consentLink: 'Datenschutzerklärung', consentPost:
        ' gelesen und bin damit einverstanden, dass meine Angaben zur Beantwortung dieser Anfrage verarbeitet werden.',
      privacyHref: '/datenschutzerklaerung/',
      submit: 'Nachricht senden', submitting: 'Wird gesendet…',
      successTitle: 'Fast geschafft', successBody: 'Wir haben Ihnen eine E-Mail geschickt. Bitte bestätigen Sie Ihre Nachricht über den Link darin — erst danach geht sie bei uns ein.',
      errGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
      errRate: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
      errName: 'Bitte geben Sie Ihren Namen an.',
      errEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
      errMessage: 'Bitte geben Sie eine Nachricht ein.',
      errConsent: 'Bitte bestätigen Sie die Datenschutzerklärung, um fortzufahren.',
      // A validation failure is not a server failure. Without this, an
      // empty name fell through to errGeneric ("Etwas ist schiefgelaufen"),
      // which tells the visitor the site is broken when in fact they just
      // missed a field — and, because the message is announced politely to
      // screen readers, it sent them looking for a problem that isn't there.
      errFields: 'Bitte füllen Sie Name, E-Mail-Adresse und Nachricht aus.',
    },
    en: {
      name: 'Name', email: 'Email', message: 'Message',
      consentPre: 'I have read the ', consentLink: 'privacy policy', consentPost:
        ' and agree that my details will be processed to answer this request.',
      privacyHref: '/en/privacy-policy/',
      submit: 'Send message', submitting: 'Sending…',
      successTitle: 'Almost there', successBody: "We've emailed you a confirmation link — your message only reaches us once you click it.",
      errGeneric: 'Something went wrong. Please try again.',
      errRate: 'Too many requests. Please try again later.',
      errName: 'Please enter your name.',
      errEmail: 'Please enter a valid email address.',
      errMessage: 'Please enter a message.',
      errConsent: 'Please confirm the privacy policy to continue.',
      // See the German block above.
      errFields: 'Please fill in your name, email address and message.',
    },
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /** A labeled field: <label for>, the input/textarea, and an inline error
   * paragraph wired via aria-describedby (empty until this field fails
   * validation, so it costs nothing when the visitor gets it right). */
  function field(id, labelText, input, errorText) {
    var errId = id + '-err';
    input.id = id;
    input.setAttribute('aria-describedby', errId);
    var err = el('p', { id: errId, class: 'vm-cf-err', 'aria-live': 'polite' });
    var wrap = el('div', { class: 'vm-cf-field' }, [
      el('label', { for: id, text: labelText }),
      input,
      err,
    ]);
    function setInvalid(invalid) {
      input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      wrap.classList.toggle('vm-cf-field-invalid', !!invalid);
      err.textContent = invalid ? errorText : '';
    }
    // Inline validation as the visitor leaves a field, not just on submit —
    // native constraint validation (required / type="email") already
    // covers format, this just surfaces it inline instead of only in the
    // browser's own (inconsistently accessible) bubble.
    // Only after the visitor has actually engaged with the field. Blurring
    // alone is not a mistake: tabbing from Name to Message, or clicking
    // into a field and back out to read something, used to light up every
    // required field they passed through and announce an error for each —
    // scolding someone for not yet having filled in a form they are still
    // filling in. A field counts as touched once it has received input;
    // submitting validates everything regardless (see the submit handler).
    var touched = false;
    input.addEventListener('input', function () {
      touched = true;
      if (input.getAttribute('aria-invalid') === 'true') setInvalid(!input.checkValidity());
    });
    input.addEventListener('blur', function () {
      if (touched || input.value !== '') setInvalid(!input.checkValidity());
    });
    return { wrap: wrap, setInvalid: setInvalid };
  }

  function mount(root) {
    var locale = root.getAttribute('data-locale') === 'en' ? 'en' : 'de';
    var t = COPY[locale];
    var uid = 'vm-cf-' + (root.getAttribute('data-locale') === 'en' ? 'en' : 'de');

    root.classList.add('vm-cf');

    var nameInput = el('input', { type: 'text', maxlength: '200', autocomplete: 'name', required: 'required' });
    var emailInput = el('input', { type: 'email', maxlength: '254', autocomplete: 'email', required: 'required' });
    var messageInput = el('textarea', { maxlength: '4000', required: 'required' });
    var consentInput = el('input', { type: 'checkbox', id: uid + '-consent', required: 'required' });

    var nameField = field(uid + '-name', t.name, nameInput, t.errName);
    var emailField = field(uid + '-email', t.email, emailInput, t.errEmail);
    var messageField = field(uid + '-message', t.message, messageInput, t.errMessage);

    var consentErrId = uid + '-consent-err';
    var consentErr = el('p', { id: consentErrId, class: 'vm-cf-err', 'aria-live': 'polite' });
    var consentLabel = el('label', { for: uid + '-consent', class: 'vm-cf-consent-label' }, [
      document.createTextNode(t.consentPre),
      el('a', { href: t.privacyHref, target: '_blank', rel: 'noopener', text: t.consentLink }),
      document.createTextNode(t.consentPost),
    ]);
    consentInput.setAttribute('aria-describedby', consentErrId);
    var consentWrap = el('div', { class: 'vm-cf-field vm-cf-consent' }, [consentInput, consentLabel, consentErr]);
    function setConsentInvalid(invalid) {
      consentInput.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      consentWrap.classList.toggle('vm-cf-field-invalid', !!invalid);
      consentErr.textContent = invalid ? t.errConsent : '';
    }
    consentInput.addEventListener('change', function () {
      if (consentInput.checked) setConsentInvalid(false);
    });

    // Status region: role/aria-live start as "status"/"polite" (success is
    // not urgent) and switch to "alert"/"assertive" only while showing an
    // error, so a screen reader interrupts for that but not for the calmer
    // confirmation message.
    var msg = el('div', { class: 'vm-cf-msg', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    function setMsg(text, isError) {
      msg.textContent = text;
      msg.className = isError ? 'vm-cf-msg error' : 'vm-cf-msg';
      msg.setAttribute('role', isError ? 'alert' : 'status');
      msg.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    }

    var submitBtn = el('button', { type: 'submit', class: 'vm-cf-btn', text: t.submit });

    var formEl = el('form', { novalidate: 'novalidate' }, [
      nameField.wrap, emailField.wrap, messageField.wrap, consentWrap,
      submitBtn, msg,
    ]);
    root.appendChild(formEl);

    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      setMsg('', false);

      var nameOk = nameInput.checkValidity();
      var emailOk = emailInput.checkValidity();
      var messageOk = messageInput.checkValidity();
      var consentOk = consentInput.checked;
      nameField.setInvalid(!nameOk);
      emailField.setInvalid(!emailOk);
      messageField.setInvalid(!messageOk);
      setConsentInvalid(!consentOk);

      if (!nameOk || !emailOk || !messageOk || !consentOk) {
        var firstInvalid = !nameOk ? nameInput : !emailOk ? emailInput : !messageOk ? messageInput : consentInput;
        firstInvalid.focus();
        setMsg(!consentOk && nameOk && emailOk && messageOk ? t.errConsent : t.errFields, true);
        return;
      }

      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      var message = messageInput.value.trim();
      submitBtn.disabled = true;
      submitBtn.textContent = t.submitting;
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `consent` is sent, not just checked in the browser: the API
        // records a consent version and timestamp for every submission, and
        // a consent record that only ever existed client-side proves
        // nothing later. The server rejects a body without it.
        body: JSON.stringify({ name: name, email: email, message: message, locale: locale, consent: true }),
      })
        .then(function (r) { return r.json().then(function (body) { return { status: r.status, body: body }; }); })
        .then(function (res) {
          if (res.status === 201) {
            showSuccess();
            return;
          }
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          setMsg(res.status === 429 ? t.errRate : t.errGeneric, true);
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          setMsg(t.errGeneric, true);
        });
    });

    function showSuccess() {
      root.innerHTML = '';
      var successMsg = el('div', { class: 'vm-cf-success', role: 'status', 'aria-live': 'polite' }, [
        el('svg', { width: '40', height: '40', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
        el('h3', { text: t.successTitle }),
        el('p', { text: t.successBody }),
      ]);
      root.appendChild(successMsg);
      // Built via createElementNS rather than innerHTML: self-closing tag
      // syntax ("<path/>") is not respected by the HTML parser for non-void
      // elements, so `svg.innerHTML = '<path.../><polyline.../>'` silently
      // nests the polyline inside the path instead of as its sibling.
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
    var root = document.getElementById('vm-contact-form');
    if (root) mount(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
