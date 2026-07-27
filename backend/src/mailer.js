'use strict';

const nodemailer = require('nodemailer');
const config = require('./config');

const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.auth,
});

// Verified once at startup so a misconfigured mailbox fails loudly at boot
// instead of silently swallowing every booking/contact notification later.
// Never logs `error` verbatim if it might echo back auth details — SMTP
// libraries generally don't include the password in error messages, but the
// host/user are fine to log (they're not secret, just config).
transport.verify().then(
  () => console.log(`[mailer] SMTP connection OK (${config.smtp.host}:${config.smtp.port}, user ${config.smtp.auth.user})`),
  (err) => console.error(`[mailer] SMTP verification FAILED for ${config.smtp.host}:${config.smtp.port} — ${err.message}`)
);

function send({ to, subject, text, html }) {
  return transport.sendMail({ from: config.smtp.from, to, subject, text, html }).catch((err) => {
    // Swallow at the call site's discretion: callers decide whether a mail
    // failure should fail the HTTP request. Logged here either way so
    // delivery problems are visible in server logs.
    console.error(`[mailer] Failed to send "${subject}" to ${to}: ${err.message}`);
    throw err;
  });
}

module.exports = { send };
