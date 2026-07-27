(function () {
  'use strict';

  var COPY = {
    de: {
      title: 'Termin auswählen', sub: 'Montag bis Freitag, 14:00–20:00 Uhr (MEZ/MESZ)',
      loading: 'Lade verfügbare Termine…', empty: 'Für diesen Tag sind aktuell keine Termine frei.',
      selected: 'Ausgewählt: ', name: 'Name', email: 'E-Mail', company: 'Firma (optional)', message: 'Nachricht (optional)',
      submit: 'Termin anfragen', submitting: 'Wird gesendet…',
      successTitle: 'Fast geschafft', successBody: 'Wir haben Ihnen eine E-Mail geschickt. Bitte bestätigen Sie den Termin über den Link darin — erst danach ist er fest reserviert.',
      errGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.', errTaken: 'Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.',
      errRate: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.', errFields: 'Bitte Name und E-Mail-Adresse angeben.',
    },
    en: {
      title: 'Pick a time', sub: 'Monday to Friday, 2–8pm (CET/CEST)',
      loading: 'Loading available times…', empty: 'No open slots on this day.',
      selected: 'Selected: ', name: 'Name', email: 'Email', company: 'Company (optional)', message: 'Message (optional)',
      submit: 'Request this slot', submitting: 'Sending…',
      successTitle: 'Almost there', successBody: "We've emailed you a confirmation link — the slot is only firmly reserved once you click it.",
      errGeneric: 'Something went wrong. Please try again.', errTaken: 'That slot was just taken. Please pick another.',
      errRate: 'Too many requests. Please try again later.', errFields: 'Please provide your name and email address.',
    },
  };

  function berlinDateParts(date) {
    var fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });
    var parts = {};
    fmt.formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
    return parts;
  }

  function isoDate(parts) { return parts.year + '-' + parts.month + '-' + parts.day; }

  function nextBusinessDays(count) {
    var days = [];
    var cursor = new Date();
    var guardMax = count * 3 + 10; // weekends + safety margin
    for (var i = 0; i < guardMax && days.length < count; i++) {
      var d = new Date(cursor.getTime() + i * 86400000);
      var parts = berlinDateParts(d);
      if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(parts.weekday) !== -1) {
        days.push({ iso: isoDate(parts), label: dayLabel(d) });
      }
    }
    return days;
  }

  function dayLabel(date) {
    return new Intl.DateTimeFormat(undefined, { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);
  }

  function timeLabel(iso) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  function fullLabel(iso, locale) {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

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
    var state = { selectedDate: null, selectedSlot: null, slots: [] };

    root.classList.add('vm-bw');
    var header = el('div', {}, [el('h3', { text: t.title }), el('p', { class: 'vm-bw-sub', text: t.sub })]);
    var daysRow = el('div', { class: 'vm-bw-days' });
    var slotsWrap = el('div', { class: 'vm-bw-slots' });
    var form = buildForm();
    root.appendChild(header);
    root.appendChild(daysRow);
    root.appendChild(slotsWrap);
    root.appendChild(form.node);

    var days = nextBusinessDays(8);
    days.forEach(function (day, idx) {
      var btn = el('button', { type: 'button', class: 'vm-bw-day' + (idx === 0 ? ' active' : ''), text: day.label });
      btn.addEventListener('click', function () { selectDay(day.iso, btn); });
      daysRow.appendChild(btn);
    });
    if (days.length) selectDay(days[0].iso, daysRow.querySelector('.vm-bw-day'));

    function selectDay(iso, btn) {
      Array.prototype.forEach.call(daysRow.children, function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      state.selectedDate = iso;
      state.selectedSlot = null;
      form.hide();
      loadSlots(iso);
    }

    function loadSlots(iso) {
      slotsWrap.innerHTML = '';
      slotsWrap.appendChild(el('div', { class: 'vm-bw-loading', text: t.loading }));
      fetch('/api/bookings/availability?date=' + encodeURIComponent(iso))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          slotsWrap.innerHTML = '';
          var open = (data.slots || []).filter(function (s) { return s.available; });
          if (!open.length) {
            slotsWrap.appendChild(el('div', { class: 'vm-bw-empty', text: t.empty }));
            return;
          }
          (data.slots || []).forEach(function (s) {
            var b = el('button', { type: 'button', class: 'vm-bw-slot', text: timeLabel(s.start) });
            if (!s.available) { b.disabled = true; }
            else {
              b.addEventListener('click', function () {
                Array.prototype.forEach.call(slotsWrap.children, function (c) { c.classList.remove('active'); });
                b.classList.add('active');
                state.selectedSlot = s.start;
                form.show(s.start);
              });
            }
            slotsWrap.appendChild(b);
          });
        })
        .catch(function () {
          slotsWrap.innerHTML = '';
          slotsWrap.appendChild(el('div', { class: 'vm-bw-msg error', text: t.errGeneric }));
        });
    }

    function buildForm() {
      var wrap = el('div', { class: 'vm-bw-form' });
      var selectedLine = el('div', { class: 'vm-bw-selected' });
      var nameInput = el('input', { type: 'text', maxlength: '200', autocomplete: 'name' });
      var emailInput = el('input', { type: 'email', maxlength: '254', autocomplete: 'email' });
      var companyInput = el('input', { type: 'text', maxlength: '200', autocomplete: 'organization' });
      var messageInput = el('textarea', { maxlength: '2000' });
      var msg = el('div', { class: 'vm-bw-msg' });
      var submitBtn = el('button', { type: 'submit', class: 'vm-bw-btn', text: t.submit });

      var formEl = el('form', {}, [
        selectedLine,
        el('label', { text: t.name }), nameInput,
        el('label', { text: t.email }), emailInput,
        el('label', { text: t.company }), companyInput,
        el('label', { text: t.message }), messageInput,
        submitBtn, msg,
      ]);
      wrap.appendChild(formEl);

      formEl.addEventListener('submit', function (ev) {
        ev.preventDefault();
        msg.textContent = '';
        msg.className = 'vm-bw-msg';
        var name = nameInput.value.trim();
        var email = emailInput.value.trim();
        if (!name || !email) { msg.textContent = t.errFields; msg.className = 'vm-bw-msg error'; return; }
        submitBtn.disabled = true;
        submitBtn.textContent = t.submitting;
        fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name, email: email, company: companyInput.value.trim() || undefined,
            message: messageInput.value.trim() || undefined, locale: locale, slotStart: state.selectedSlot,
          }),
        })
          .then(function (r) { return r.json().then(function (body) { return { status: r.status, body: body }; }); })
          .then(function (res) {
            submitBtn.disabled = false;
            submitBtn.textContent = t.submit;
            if (res.status === 201) {
              showSuccess();
            } else if (res.status === 409) {
              msg.textContent = t.errTaken; msg.className = 'vm-bw-msg error';
              loadSlots(state.selectedDate);
              form.hide();
            } else if (res.status === 429) {
              msg.textContent = t.errRate; msg.className = 'vm-bw-msg error';
            } else {
              msg.textContent = t.errGeneric; msg.className = 'vm-bw-msg error';
            }
          })
          .catch(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = t.submit;
            msg.textContent = t.errGeneric; msg.className = 'vm-bw-msg error';
          });
      });

      function show(iso) {
        selectedLine.textContent = t.selected + fullLabel(iso, locale);
        wrap.classList.add('active');
      }
      function hide() { wrap.classList.remove('active'); }

      return { node: wrap, show: show, hide: hide };
    }

    function showSuccess() {
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'vm-bw-success' }, [
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
    var root = document.getElementById('vm-booking-widget');
    if (root) mount(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
