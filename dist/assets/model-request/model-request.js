(function () {
  'use strict';

  /**
   * Custom-model request form.
   *
   * Replaces a Google Form that was embedded in a 1000x3000 iframe — which
   * meant a scrollbar inside the page, someone else's typography in the
   * middle of ours, and every applicant's domain, feed URLs and example
   * product copy going to a third party the privacy policy does not list.
   *
   * Every field of that form is here, branch for branch. The one structural
   * change is the three steps: the original asked all twenty questions on one
   * page, including the ten that do not apply to whichever branch you picked.
   * Splitting on the branch question means nobody is ever shown a field that
   * cannot apply to them.
   *
   * Progressive enhancement is not attempted. Without JavaScript the page
   * shows a mailto fallback instead (see generate-model-request-page.js) —
   * honest, and better than a form whose branch logic silently does nothing.
   */

  var COPY = {
    de: {
      steps: ['Kontakt', 'Art der Anfrage', 'Details'],
      next: 'Weiter', back: 'Zurück', submit: 'Anfrage senden', submitting: 'Wird gesendet…',

      email: 'E-Mail-Adresse', emailHint: 'An diese Adresse schicken wir die Bestätigung.',
      customerType: 'Sind Sie bereits Kunde?',
      customerExisting: 'Bestehender Kunde', customerNew: 'Neuer Kunde',
      domain: 'Domain', domainHint: 'z. B. audi.de',

      requestType: 'Was möchten Sie?',
      newModel: 'Neues Modell anfragen',
      newModelHint: 'Ein Modell, das es für Sie noch nicht gibt.',
      modifyModel: 'Bestehendes Modell anpassen',
      modifyModelHint: 'Ein Modell, das bereits für Sie läuft, soll etwas anders arbeiten.',

      language: 'Sprache des Modells',
      name: 'Beschreibender Name',
      nameHint: 'Dient der Wiedererkennung, z. B. „Produktbeschreibung Limousinen“.',
      modelName: 'Genauer Name des Modells',
      modelNameHint: 'Wie das Modell in Ihrem Konto heißt.',
      change: 'Beschreibung der gewünschten Anpassung',
      goal: 'Was soll das Modell erreichen?',
      goalHint: 'z. B. eine detaillierte Produktbeschreibung aus technischen Merkmalen, Titel und Kategorie erstellen.',
      exampleInput: 'Beispiel für einen idealen Input',
      exampleInputHint: 'z. B. Name: Audi A6 C7, Kategorie: Limousine, Technische Daten: 1.8 TFSI Ultra …',
      exampleOutput: 'Beispiel für einen idealen Output',
      exampleOutputHint: 'Schreiben Sie ein Ergebnis so, wie Sie es sich wünschen.',
      outputFormat: 'Ausgabeformat',
      sources: 'Statische Quellen (optional)',
      sourcesHint: 'URLs, kommagetrennt, die beim Training berücksichtigt werden sollen.',
      liveFeed: 'Live-Daten aus einem Feed?',
      liveFeedHint: 'Relevant z. B. für Chatbots oder hyperpersonalisierte E-Mails. Feed-URL eintragen oder leer lassen.',
      liveFeedNone: 'Nein, keine Live-Daten',

      successTitle: 'Fast geschafft',
      successBody: 'Wir haben Ihnen eine E-Mail geschickt. Bitte bestätigen Sie Ihre Anfrage über den Link darin — erst danach erreicht sie uns.',
      errGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
      errRate: 'Zu viele Anfragen von dieser Adresse. Bitte versuchen Sie es später erneut.',
      errFields: 'Bitte füllen Sie die markierten Pflichtfelder aus.',
      required: 'Pflichtfeld',
    },
    en: {
      steps: ['Contact', 'Request type', 'Details'],
      next: 'Continue', back: 'Back', submit: 'Send request', submitting: 'Sending…',

      email: 'Email address', emailHint: "We'll send the confirmation here.",
      customerType: 'Are you already a customer?',
      customerExisting: 'Existing customer', customerNew: 'New customer',
      domain: 'Domain', domainHint: 'e.g. audi.com',

      requestType: 'What would you like?',
      newModel: 'Request a new model',
      newModelHint: "A model that doesn't exist for you yet.",
      modifyModel: 'Adjust an existing model',
      modifyModelHint: 'A model already running for you should work differently.',

      language: 'Model language',
      name: 'Descriptive name',
      nameHint: 'For recognition, e.g. "Product description — saloons".',
      modelName: 'Exact model name',
      modelNameHint: 'As the model is named in your account.',
      change: 'Describe the adjustment you want',
      goal: 'What should the model achieve?',
      goalHint: 'e.g. write a detailed product description from technical attributes, title and category.',
      exampleInput: 'Example of an ideal input',
      exampleInputHint: 'e.g. Name: Audi A6 C7, Category: saloon, Specs: 1.8 TFSI Ultra …',
      exampleOutput: 'Example of an ideal output',
      exampleOutputHint: 'Write one result exactly as you would want it.',
      outputFormat: 'Output format',
      sources: 'Static sources (optional)',
      sourcesHint: 'Comma-separated URLs to take into account during training.',
      liveFeed: 'Live data from a feed?',
      liveFeedHint: 'Relevant for chatbots or hyper-personalised email. Enter a feed URL or leave empty.',
      liveFeedNone: 'No live data',

      successTitle: 'Almost there',
      successBody: "We've emailed you a confirmation link — your request only reaches us once you click it.",
      errGeneric: 'Something went wrong. Please try again.',
      errRate: 'Too many requests from this address. Please try again later.',
      errFields: 'Please complete the highlighted required fields.',
      required: 'Required',
    },
  };

  var LANGUAGES = ['DE', 'EN', 'FR', 'IT', 'ES', 'NL', 'PL', 'PT', 'DA', 'SV', 'NO', 'FI', 'RO', 'SL', 'DK', 'other'];
  var FORMATS = [['plain', 'Plain Text'], ['html', 'HTML'], ['json', 'JSON']];

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function field(labelText, control, hint, required) {
    var label = el('label', { class: 'vm-mr-field' }, [
      el('span', { class: 'vm-mr-label' }, [
        el('span', { text: labelText }),
        required ? el('span', { class: 'vm-mr-req', text: '*' }) : null,
      ]),
      control,
    ]);
    if (hint) label.appendChild(el('span', { class: 'vm-mr-hint', text: hint }));
    return label;
  }

  function radioGroup(name, options) {
    var wrap = el('div', { class: 'vm-mr-choices' });
    options.forEach(function (o) {
      var input = el('input', { type: 'radio', name: name, value: o.value });
      var card = el('label', { class: 'vm-mr-choice' }, [
        input,
        el('span', { class: 'vm-mr-choice-body' }, [
          el('strong', { text: o.label }),
          o.hint ? el('span', { text: o.hint }) : null,
        ]),
      ]);
      wrap.appendChild(card);
    });
    return wrap;
  }

  function valueOf(group, name) {
    var checked = group.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  function mount(root) {
    var locale = root.getAttribute('data-locale') === 'en' ? 'en' : 'de';
    var t = COPY[locale];
    root.classList.add('vm-mr');
    root.innerHTML = '';

    var state = { step: 0, requestType: '' };

    // ---- progress -------------------------------------------------------
    var progress = el('ol', { class: 'vm-mr-progress' });
    var stepNodes = t.steps.map(function (s, i) {
      var li = el('li', {}, [el('span', { class: 'vm-mr-dot', text: String(i + 1) }), el('span', { text: s })]);
      progress.appendChild(li);
      return li;
    });

    // ---- step 1 ---------------------------------------------------------
    var email = el('input', { type: 'email', maxlength: '254', autocomplete: 'email', required: 'required' });
    var domain = el('input', { type: 'text', maxlength: '253', autocomplete: 'url', placeholder: t.domainHint });
    var customer = radioGroup('vm-mr-customer', [
      { value: 'existing', label: t.customerExisting },
      { value: 'new', label: t.customerNew },
    ]);
    var step1 = el('div', { class: 'vm-mr-step' }, [
      field(t.email, email, t.emailHint, true),
      field(t.domain, domain, t.domainHint, true),
      field(t.customerType, customer, null, true),
    ]);

    // ---- step 2 ---------------------------------------------------------
    var reqType = radioGroup('vm-mr-type', [
      { value: 'new_model', label: t.newModel, hint: t.newModelHint },
      { value: 'modify_model', label: t.modifyModel, hint: t.modifyModelHint },
    ]);
    var step2 = el('div', { class: 'vm-mr-step' }, [field(t.requestType, reqType, null, true)]);

    // ---- step 3: shared + branch ---------------------------------------
    var language = el('select', {});
    LANGUAGES.forEach(function (l) { language.appendChild(el('option', { value: l, text: l === 'other' ? '…' : l })); });
    var name = el('input', { type: 'text', maxlength: '200' });
    var modelName = el('input', { type: 'text', maxlength: '200' });
    var change = el('textarea', { maxlength: '4000', rows: '4' });
    var goal = el('textarea', { maxlength: '2000', rows: '3' });
    var exampleInput = el('textarea', { maxlength: '4000', rows: '3' });
    var exampleOutput = el('textarea', { maxlength: '4000', rows: '4' });
    var outputFormat = el('select', {});
    FORMATS.forEach(function (f) { outputFormat.appendChild(el('option', { value: f[0], text: f[1] })); });
    var sources = el('input', { type: 'text', maxlength: '2000' });
    var liveFeed = el('input', { type: 'text', maxlength: '500', placeholder: t.liveFeedNone });

    var newOnly = el('div', {}, [
      field(t.language, language, null, true),
      field(t.name, name, t.nameHint, true),
    ]);
    var modifyOnly = el('div', {}, [
      field(t.modelName, modelName, t.modelNameHint, true),
      field(t.change, change, null, true),
    ]);
    var step3 = el('div', { class: 'vm-mr-step' }, [
      newOnly,
      modifyOnly,
      field(t.goal, goal, t.goalHint, true),
      field(t.exampleInput, exampleInput, t.exampleInputHint, true),
      field(t.exampleOutput, exampleOutput, t.exampleOutputHint, true),
      field(t.outputFormat, outputFormat, null, true),
      field(t.sources, sources, t.sourcesHint, false),
      field(t.liveFeed, liveFeed, t.liveFeedHint, false),
    ]);

    var steps = [step1, step2, step3];
    var msg = el('div', { class: 'vm-mr-msg' });
    var back = el('button', { type: 'button', class: 'vm-mr-btn vm-mr-btn-ghost', text: t.back });
    var next = el('button', { type: 'button', class: 'vm-mr-btn', text: t.next });
    var nav = el('div', { class: 'vm-mr-nav' }, [back, next]);

    var form = el('form', { novalidate: 'novalidate' }, [progress, step1, step2, step3, msg, nav]);
    root.appendChild(form);

    // ---- rendering ------------------------------------------------------
    function render() {
      steps.forEach(function (s, i) { s.hidden = i !== state.step; });
      stepNodes.forEach(function (n, i) {
        n.classList.toggle('is-current', i === state.step);
        n.classList.toggle('is-done', i < state.step);
      });
      back.hidden = state.step === 0;
      next.textContent = state.step === steps.length - 1 ? t.submit : t.next;
      newOnly.hidden = state.requestType !== 'new_model';
      modifyOnly.hidden = state.requestType !== 'modify_model';
      msg.textContent = '';
      msg.className = 'vm-mr-msg';
    }

    function fail(text) {
      msg.textContent = text;
      msg.className = 'vm-mr-msg is-error';
    }

    /** Marks empty required controls and returns whether the step is complete. */
    function validate() {
      var need = [];
      if (state.step === 0) need = [[email, email.value.indexOf('@') > 0], [domain, domain.value.trim()], [customer, valueOf(customer, 'vm-mr-customer')]];
      if (state.step === 1) need = [[reqType, valueOf(reqType, 'vm-mr-type')]];
      if (state.step === 2) {
        need = [[goal, goal.value.trim()], [exampleInput, exampleInput.value.trim()], [exampleOutput, exampleOutput.value.trim()]];
        if (state.requestType === 'new_model') need.push([name, name.value.trim()]);
        else need.push([modelName, modelName.value.trim()], [change, change.value.trim()]);
      }
      var ok = true;
      need.forEach(function (pair) {
        var bad = !pair[1];
        if (bad) ok = false;
        var host = pair[0].closest ? pair[0].closest('.vm-mr-field') : null;
        if (host) host.classList.toggle('is-invalid', bad);
      });
      if (!ok) fail(t.errFields);
      return ok;
    }

    function submit() {
      next.disabled = true;
      next.textContent = t.submitting;

      var payload = {
        locale: locale,
        email: email.value.trim(),
        domain: domain.value.trim(),
        customerType: valueOf(customer, 'vm-mr-customer'),
        requestType: state.requestType,
        goal: goal.value.trim(),
        exampleInput: exampleInput.value.trim(),
        exampleOutput: exampleOutput.value.trim(),
        outputFormat: outputFormat.value,
        sources: sources.value.trim(),
        liveFeed: liveFeed.value.trim(),
      };
      if (state.requestType === 'new_model') {
        payload.language = language.value;
        payload.name = name.value.trim();
      } else {
        payload.modelName = modelName.value.trim();
        payload.change = change.value.trim();
      }

      fetch('/api/model-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
        .then(function (res) {
          if (res.status === 201) {
            root.innerHTML = '';
            root.appendChild(el('div', { class: 'vm-mr-done' }, [
              el('h3', { text: t.successTitle }),
              el('p', { text: t.successBody }),
            ]));
            return;
          }
          next.disabled = false;
          next.textContent = t.submit;
          fail(res.status === 429 ? t.errRate : t.errGeneric);
        })
        .catch(function () {
          next.disabled = false;
          next.textContent = t.submit;
          fail(t.errGeneric);
        });
    }

    next.addEventListener('click', function () {
      if (!validate()) return;
      if (state.step === 1) state.requestType = valueOf(reqType, 'vm-mr-type');
      if (state.step === steps.length - 1) { submit(); return; }
      state.step++;
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    back.addEventListener('click', function () {
      if (state.step === 0) return;
      state.step--;
      render();
    });

    // Enter should advance rather than submit a half-filled form.
    form.addEventListener('submit', function (e) { e.preventDefault(); next.click(); });

    // Clear the invalid marker as soon as the reader fixes the field.
    form.addEventListener('input', function (e) {
      var host = e.target.closest && e.target.closest('.vm-mr-field');
      if (host) host.classList.remove('is-invalid');
    });
    form.addEventListener('change', function (e) {
      var host = e.target.closest && e.target.closest('.vm-mr-field');
      if (host) host.classList.remove('is-invalid');
    });

    render();
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-vm-model-request]'), mount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
