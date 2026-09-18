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
    modelRequestSubjectPending: 'Bitte bestätigen Sie Ihre Modell-Anfrage bei Virtual Marketer',
    modelRequestSubjectConfirmed: 'Modell-Anfrage bestätigt — Virtual Marketer',
    modelRequestCustomerPending: (c) => `Guten Tag,\n\nvielen Dank für Ihre Anfrage zu einem Custom-KI-Modell für ${c.domain}.\n\nBitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link (gültig ${config.confirmTokenTtlHours} Stunden), damit wir Ihre Anfrage bearbeiten können:\n\n${c.confirmUrl}\n\nViele Grüße\nIhr Virtual Marketer Team`,
    modelRequestCustomerConfirmed: (c) => `Guten Tag,\n\nIhre Modell-Anfrage für ${c.domain} ist bestätigt. Wir prüfen die Angaben und melden uns mit einem Vorschlag bei Ihnen.\n\nViele Grüße\nIhr Virtual Marketer Team`,
    confirmPageTitle: 'Bestätigt',
    confirmPageBody: 'Vielen Dank, Ihre Anfrage wurde bestätigt.',
    confirmPageErrorTitle: 'Link ungültig oder abgelaufen',
    confirmPageErrorBody: 'Dieser Bestätigungslink ist ungültig, wurde bereits verwendet oder ist abgelaufen. Bitte stellen Sie Ihre Anfrage erneut.',
    backHome: 'Zurück zur Startseite',

    newsletterSubjectPending: 'Bitte bestätigen Sie Ihre Anmeldung zum Newsletter',
    newsletterSubjectConfirmed: 'Willkommen bei Der Agentic Brief',
    newsletterInternalPending: (n) => `Neue Newsletter-Anmeldung (unbestätigt)\n\nE-Mail: ${n.email}\n\nDie Adresse muss die E-Mail per Bestätigungslink verifizieren.`,
    newsletterInternalConfirmed: (n) => `Newsletter-Anmeldung bestätigt\n\nE-Mail: ${n.email}`,
    newsletterCustomerPending: (n) => `Hallo,\n\ndanke für Ihre Anmeldung zu Der Agentic Brief, dem Marketing-Newsletter von Virtual Marketer.\n\nBitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link (gültig ${config.confirmTokenTtlHours} Stunden):\n\n${n.confirmUrl}\n\nWenn Sie sich nicht angemeldet haben, ignorieren Sie diese Mail einfach, oder melden Sie sich direkt wieder ab:\n${n.unsubscribeUrl}\n\nViele Grüße\nIhr Virtual Marketer Team`,
    newsletterCustomerConfirmed: (n) => `Hallo,\n\nIhre Anmeldung zu Der Agentic Brief ist bestätigt. Sie erhalten ab jetzt regelmäßig Neuigkeiten rund um KI-gestütztes Marketing von Virtual Marketer.\n\nSie können sich jederzeit mit einem Klick wieder abmelden:\n${n.unsubscribeUrl}\n\nViele Grüße\nIhr Virtual Marketer Team`,
    newsletterUnsubscribedTitle: 'Abgemeldet',
    newsletterUnsubscribedBody: 'Sie wurden von Der Agentic Brief abgemeldet. Falls das ein Versehen war, können Sie sich jederzeit erneut anmelden.',
    // Shown by GET /unsubscribe, which only ASKS. The actual abmeldung
    // happens on the POST this page submits — see routes/newsletter.js for
    // why the link in the mail must not change anything on its own.
    newsletterUnsubscribeConfirmTitle: 'Newsletter abbestellen?',
    newsletterUnsubscribeConfirmBody:
      'Möchten Sie Der Agentic Brief wirklich abbestellen? Sie erhalten dann keine weiteren Ausgaben mehr.',
    newsletterUnsubscribeConfirmButton: 'Jetzt abmelden',

    whitepaperSubjectPending: 'Bitte bestätigen Sie Ihre Anfrage für das Whitepaper',
    whitepaperSubjectConfirmed: 'Ihr Whitepaper-Download — Virtual Marketer',
    whitepaperInternalPending: (w) => `Neue Whitepaper-Anfrage (unbestätigt)\n\nE-Mail: ${w.email}\nWhitepaper: ${w.slug}\nAuch Newsletter: ${w.newsletterOptIn ? 'Ja' : 'Nein'}\n\nDie Adresse muss die E-Mail per Bestätigungslink verifizieren.`,
    whitepaperInternalConfirmed: (w) => `Whitepaper-Anfrage bestätigt\n\nE-Mail: ${w.email}\nWhitepaper: ${w.slug}`,
    whitepaperCustomerPending: (w) => `Guten Tag,\n\nvielen Dank für Ihr Interesse an unserem Whitepaper. Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link (gültig ${config.confirmTokenTtlHours} Stunden), damit wir Ihnen den Download zusenden können:\n\n${w.confirmUrl}\n\nViele Grüße\nIhr Virtual Marketer Team`,
    whitepaperCustomerConfirmed: (w) => `Guten Tag,\n\nvielen Dank, Ihre E-Mail-Adresse ist bestätigt. Hier ist Ihr Download:\n\n${w.downloadUrl}\n${w.newsletterNote || ''}\nViele Grüße\nIhr Virtual Marketer Team`,
    whitepaperNewsletterNote: (n) => `\nSie erhalten außerdem ab sofort Der Agentic Brief, unseren Marketing-Newsletter. Abmelden können Sie sich jederzeit mit einem Klick:\n${n.unsubscribeUrl}\n`,
    whitepaperDownloadButtonLabel: 'Whitepaper herunterladen',
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
    modelRequestSubjectPending: 'Please confirm your model request to Virtual Marketer',
    modelRequestSubjectConfirmed: 'Model request confirmed — Virtual Marketer',
    modelRequestCustomerPending: (c) => `Hello,\n\nThanks for your request for a custom AI model for ${c.domain}.\n\nPlease confirm your email address via the link below (valid for ${config.confirmTokenTtlHours} hours) so we can process it:\n\n${c.confirmUrl}\n\nBest,\nThe Virtual Marketer Team`,
    modelRequestCustomerConfirmed: (c) => `Hello,\n\nYour model request for ${c.domain} is confirmed. We'll review the details and come back to you with a proposal.\n\nBest,\nThe Virtual Marketer Team`,
    confirmPageTitle: 'Confirmed',
    confirmPageBody: 'Thank you, your request has been confirmed.',
    confirmPageErrorTitle: 'Link invalid or expired',
    confirmPageErrorBody: 'This confirmation link is invalid, has already been used, or has expired. Please submit your request again.',
    backHome: 'Back to homepage',

    newsletterSubjectPending: 'Please confirm your newsletter subscription',
    newsletterSubjectConfirmed: 'Welcome to The Agent Report',
    newsletterInternalPending: (n) => `New newsletter signup (unconfirmed)\n\nEmail: ${n.email}\n\nThe address must verify via the confirmation link.`,
    newsletterInternalConfirmed: (n) => `Newsletter signup confirmed\n\nEmail: ${n.email}`,
    newsletterCustomerPending: (n) => `Hi,\n\nthanks for signing up for The Agent Report, Virtual Marketer's marketing newsletter.\n\nPlease confirm your email address via the link below (valid for ${config.confirmTokenTtlHours} hours):\n\n${n.confirmUrl}\n\nIf you didn't sign up, just ignore this email, or unsubscribe directly:\n${n.unsubscribeUrl}\n\nBest,\nThe Virtual Marketer Team`,
    newsletterCustomerConfirmed: (n) => `Hi,\n\nyour subscription to The Agent Report is confirmed. You'll now receive regular updates on AI-driven marketing from Virtual Marketer.\n\nYou can unsubscribe anytime with one click:\n${n.unsubscribeUrl}\n\nBest,\nThe Virtual Marketer Team`,
    newsletterUnsubscribedTitle: 'Unsubscribed',
    newsletterUnsubscribedBody: 'You have been unsubscribed from The Agent Report. If this was a mistake, you can subscribe again anytime.',
    // See the German block above: this page only asks; the POST it submits
    // is what actually unsubscribes.
    newsletterUnsubscribeConfirmTitle: 'Unsubscribe from the newsletter?',
    newsletterUnsubscribeConfirmBody:
      'Are you sure you want to unsubscribe from The Agent Report? You will not receive any further issues.',
    newsletterUnsubscribeConfirmButton: 'Unsubscribe now',

    whitepaperSubjectPending: 'Please confirm your whitepaper request',
    whitepaperSubjectConfirmed: 'Your whitepaper download — Virtual Marketer',
    whitepaperInternalPending: (w) => `New whitepaper request (unconfirmed)\n\nEmail: ${w.email}\nWhitepaper: ${w.slug}\nAlso newsletter: ${w.newsletterOptIn ? 'Yes' : 'No'}\n\nThe address must verify via the confirmation link.`,
    whitepaperInternalConfirmed: (w) => `Whitepaper request confirmed\n\nEmail: ${w.email}\nWhitepaper: ${w.slug}`,
    whitepaperCustomerPending: (w) => `Hello,\n\nthanks for your interest in our whitepaper. Please confirm your email address via the link below (valid for ${config.confirmTokenTtlHours} hours) so we can send you the download:\n\n${w.confirmUrl}\n\nBest,\nThe Virtual Marketer Team`,
    whitepaperCustomerConfirmed: (w) => `Hello,\n\nthanks, your email address is confirmed. Here is your download:\n\n${w.downloadUrl}\n${w.newsletterNote || ''}\nBest,\nThe Virtual Marketer Team`,
    whitepaperNewsletterNote: (n) => `\nYou've also been subscribed to The Agent Report, our marketing newsletter. You can unsubscribe anytime with one click:\n${n.unsubscribeUrl}\n`,
    whitepaperDownloadButtonLabel: 'Download whitepaper',
  },
};

function copy(locale) {
  return t[locale === 'en' ? 'en' : 'de'];
}

// `title`/`body` let a caller override the generic confirmed/error copy
// (e.g. the newsletter unsubscribe page, which is a success page but isn't
// "your request was confirmed"), and `extraHtml` inserts markup between the
// body text and the home button (e.g. the whitepaper download button).
// Every existing caller omits all three and gets the original generic page.
function confirmPageHtml({ locale, ok, homeHref, title, body, extraHtml }) {
  const c = copy(locale);
  const resolvedTitle = title || (ok ? c.confirmPageTitle : c.confirmPageErrorTitle);
  const resolvedBody = body || (ok ? c.confirmPageBody : c.confirmPageErrorBody);
  return `<!doctype html>
<html lang="${locale === 'en' ? 'en' : 'de'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${resolvedTitle} — Virtual Marketer</title>
<meta name="robots" content="noindex">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f1f1;margin:0;padding:40px 20px;color:#241417;}
  .card{max-width:480px;margin:60px auto;background:#fff;border:1px solid #e7dfe0;border-radius:14px;padding:40px 32px;text-align:center;}
  h1{font-size:22px;margin:0 0 12px;color:${ok ? '#94152b' : '#241417'};}
  p{color:#4a4143;line-height:1.6;}
  a.btn,button.btn{display:inline-block;margin-top:20px;padding:12px 26px;border-radius:8px;background:#94152b;color:#fff;text-decoration:none;font-weight:600;border:0;font-size:15px;font-family:inherit;cursor:pointer;}
  a.btn.secondary,button.btn.secondary{background:#fff;border:1px solid #94152b;color:#94152b;margin-left:8px;}
  form.vm-inline{display:inline;}
</style>
</head>
<body>
  <div class="card">
    <h1>${resolvedTitle}</h1>
    <p>${resolvedBody}</p>
    ${extraHtml || ''}
    <a class="btn${extraHtml ? ' secondary' : ''}" href="${homeHref}">${c.backHome}</a>
  </div>
</body>
</html>`;
}

module.exports = { copy, confirmPageHtml };
