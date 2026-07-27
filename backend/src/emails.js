'use strict';

const config = require('./config');

const t = {
  de: {
    bookingSubjectPending: 'Bitte bestätigen Sie Ihren Termin bei Virtual Marketer',
    bookingSubjectConfirmed: 'Termin bestätigt — Virtual Marketer',
    bookingInternalPending: (b) => `Neue Terminanfrage (unbestätigt)\n\nName: ${b.name}\nE-Mail: ${b.email}\nFirma: ${b.company || '-'}\nNachricht: ${b.message || '-'}\nTermin: ${b.slotFormatted}\n\nDie Anfrage ist gespeichert. Der Interessent muss den Termin per Bestätigungslink in seiner E-Mail bestätigen.`,
    bookingInternalConfirmed: (b) => `Termin bestätigt\n\nName: ${b.name}\nE-Mail: ${b.email}\nFirma: ${b.company || '-'}\nTermin: ${b.slotFormatted}`,
    bookingCustomerPending: (b) => `Hallo ${b.name},\n\nvielen Dank für Ihre Terminanfrage bei Virtual Marketer für:\n\n${b.slotFormatted}\n\nBitte bestätigen Sie diesen Termin über den folgenden Link (gültig ${config.confirmTokenTtlHours} Stunden):\n\n${b.confirmUrl}\n\nErst nach Bestätigung ist der Termin für Sie fest reserviert.\n\nViele Grüße\nIhr Virtual Marketer Team`,
    bookingCustomerConfirmed: (b) => `Hallo ${b.name},\n\nIhr Termin ist bestätigt:\n\n${b.slotFormatted}\n\nWir melden uns rechtzeitig vorher bei Ihnen.\n\nViele Grüße\nIhr Virtual Marketer Team`,
    contactSubjectPending: 'Bitte bestätigen Sie Ihre Anfrage bei Virtual Marketer',
    contactSubjectConfirmed: 'Anfrage bestätigt — Virtual Marketer',
    contactInternalPending: (c) => `Neue Kontaktanfrage (unbestätigt)\n\nName: ${c.name}\nE-Mail: ${c.email}\nNachricht: ${c.message}\n\nDie Anfrage ist gespeichert. Der Absender muss die E-Mail-Adresse per Bestätigungslink verifizieren.`,
    contactInternalConfirmed: (c) => `Kontaktanfrage bestätigt\n\nName: ${c.name}\nE-Mail: ${c.email}\nNachricht: ${c.message}`,
    contactCustomerPending: (c) => `Hallo ${c.name},\n\nvielen Dank für Ihre Nachricht an Virtual Marketer. Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link (gültig ${config.confirmTokenTtlHours} Stunden), damit wir Ihnen antworten können:\n\n${c.confirmUrl}\n\nViele Grüße\nIhr Virtual Marketer Team`,
    contactCustomerConfirmed: (c) => `Hallo ${c.name},\n\nvielen Dank, Ihre E-Mail-Adresse ist bestätigt. Wir melden uns so schnell wie möglich bei Ihnen.\n\nViele Grüße\nIhr Virtual Marketer Team`,
    confirmPageTitle: 'Bestätigt',
    confirmPageBody: 'Vielen Dank, Ihre Anfrage wurde bestätigt.',
    confirmPageErrorTitle: 'Link ungültig oder abgelaufen',
    confirmPageErrorBody: 'Dieser Bestätigungslink ist ungültig, wurde bereits verwendet oder ist abgelaufen. Bitte stellen Sie Ihre Anfrage erneut.',
    backHome: 'Zurück zur Startseite',
  },
  en: {
    bookingSubjectPending: 'Please confirm your Virtual Marketer appointment',
    bookingSubjectConfirmed: 'Appointment confirmed — Virtual Marketer',
    bookingInternalPending: (b) => `New booking request (unconfirmed)\n\nName: ${b.name}\nEmail: ${b.email}\nCompany: ${b.company || '-'}\nMessage: ${b.message || '-'}\nSlot: ${b.slotFormatted}\n\nSaved. The requester must confirm via the link in their email.`,
    bookingInternalConfirmed: (b) => `Booking confirmed\n\nName: ${b.name}\nEmail: ${b.email}\nCompany: ${b.company || '-'}\nSlot: ${b.slotFormatted}`,
    bookingCustomerPending: (b) => `Hi ${b.name},\n\nThanks for requesting a demo with Virtual Marketer for:\n\n${b.slotFormatted}\n\nPlease confirm this appointment via the link below (valid for ${config.confirmTokenTtlHours} hours):\n\n${b.confirmUrl}\n\nThe slot is only firmly reserved once confirmed.\n\nBest,\nThe Virtual Marketer Team`,
    bookingCustomerConfirmed: (b) => `Hi ${b.name},\n\nYour appointment is confirmed:\n\n${b.slotFormatted}\n\nWe'll be in touch shortly before. \n\nBest,\nThe Virtual Marketer Team`,
    contactSubjectPending: 'Please confirm your request to Virtual Marketer',
    contactSubjectConfirmed: 'Request confirmed — Virtual Marketer',
    contactInternalPending: (c) => `New contact request (unconfirmed)\n\nName: ${c.name}\nEmail: ${c.email}\nMessage: ${c.message}\n\nSaved. The sender must verify their email via the confirmation link.`,
    contactInternalConfirmed: (c) => `Contact request confirmed\n\nName: ${c.name}\nEmail: ${c.email}\nMessage: ${c.message}`,
    contactCustomerPending: (c) => `Hi ${c.name},\n\nThanks for reaching out to Virtual Marketer. Please confirm your email address via the link below (valid for ${config.confirmTokenTtlHours} hours) so we can reply:\n\n${c.confirmUrl}\n\nBest,\nThe Virtual Marketer Team`,
    contactCustomerConfirmed: (c) => `Hi ${c.name},\n\nThanks, your email address is confirmed. We'll get back to you as soon as possible.\n\nBest,\nThe Virtual Marketer Team`,
    confirmPageTitle: 'Confirmed',
    confirmPageBody: 'Thank you, your request has been confirmed.',
    confirmPageErrorTitle: 'Link invalid or expired',
    confirmPageErrorBody: 'This confirmation link is invalid, has already been used, or has expired. Please submit your request again.',
    backHome: 'Back to homepage',
  },
};

function copy(locale) {
  return t[locale === 'en' ? 'en' : 'de'];
}

function confirmPageHtml({ locale, ok, homeHref }) {
  const c = copy(locale);
  const title = ok ? c.confirmPageTitle : c.confirmPageErrorTitle;
  const body = ok ? c.confirmPageBody : c.confirmPageErrorBody;
  return `<!doctype html>
<html lang="${locale === 'en' ? 'en' : 'de'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Virtual Marketer</title>
<meta name="robots" content="noindex">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f1f1;margin:0;padding:40px 20px;color:#241417;}
  .card{max-width:480px;margin:60px auto;background:#fff;border:1px solid #e7dfe0;border-radius:14px;padding:40px 32px;text-align:center;}
  h1{font-size:22px;margin:0 0 12px;color:${ok ? '#94152b' : '#241417'};}
  p{color:#4a4143;line-height:1.6;}
  a.btn{display:inline-block;margin-top:20px;padding:12px 26px;border-radius:8px;background:#94152b;color:#fff;text-decoration:none;font-weight:600;}
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="btn" href="${homeHref}">${c.backHome}</a>
  </div>
</body>
</html>`;
}

module.exports = { copy, confirmPageHtml };
