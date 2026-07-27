(function () {
  'use strict';

  var COPY = {
    de: {
      name: 'Name', email: 'E-Mail', message: 'Nachricht',
      submit: 'Nachricht senden', submitting: 'Wird gesendet…',
      successTitle: 'Fast geschafft', successBody: 'Wir haben Ihnen eine E-Mail geschickt. Bitte bestätigen Sie Ihre Nachricht über den Link darin — erst danach geht sie bei uns ein.',
      errGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
      errRate: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
      errFields: 'Bitte Name, E-Mail-Adresse und Nachricht angeben.',
    },
    en: {
      name: 'Name', email: 'Email', message: 'Message',
      submit: 'Send message', submitting: 'Sending…',
      successTitle: 'Almost there', successBody: "We've emailed you a confirmation link — your message only reaches us once you click it.",
      errGeneric: 'Something went wrong. Please try again.',
      errRate: 'Too many requests. Please try again later.',
      errFields: 'Please provide your name, email address and message.',
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

  function mount(root) {
    var locale = root.getAttribute('data-locale') === 'en' ? 'en' : 'de';
    var t = COPY[locale];

    root.classList.add('vm-cf');

    var nameInput = el('input', { type: 'text', maxlength: '200', autocomplete: 'name' });
    var emailInput = el('input', { type: 'email', maxlength: '254', autocomplete: 'email' });
    var messageInput = el('textarea', { maxlength: '4000' });
    var msg = el('div', { class: 'vm-cf-msg' });
    var submitBtn = el('button', { type: 'submit', class: 'vm-cf-btn', text: t.submit });

    var formEl = el('form', {}, [
      el('label', { text: t.name }), nameInput,
      el('label', { text: t.email }), emailInput,
      el('label', { text: t.message }), messageInput,
      submitBtn, msg,
    ]);
    root.appendChild(formEl);

    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      msg.textContent = '';
      msg.className = 'vm-cf-msg';
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      var message = messageInput.value.trim();
      if (!name || !email || !message) { msg.textContent = t.errFields; msg.className = 'vm-cf-msg error'; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = t.submitting;
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, message: message, locale: locale }),
      })
        .then(function (r) { return r.json().then(function (body) { return { status: r.status, body: body }; }); })
        .then(function (res) {
          if (res.status === 201) {
            showSuccess();
            return;
          }
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          if (res.status === 429) {
            msg.textContent = t.errRate; msg.className = 'vm-cf-msg error';
          } else {
            msg.textContent = t.errGeneric; msg.className = 'vm-cf-msg error';
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = t.submit;
          msg.textContent = t.errGeneric; msg.className = 'vm-cf-msg error';
        });
    });

    function showSuccess() {
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'vm-cf-success' }, [
        el('svg', { width: '40', height: '40', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
        el('h3', { text: t.successTitle }),
        el('p', { text: t.successBody }),
      ]));
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
