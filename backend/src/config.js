'use strict';

// Fails fast on missing required config instead of silently sending no
// mail / accepting bookings nobody at the company ever finds out about.
// Never logs the actual values of anything secret (SMTP_PASS).
const REQUIRED = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'NOTIFY_TO'];

function requireEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. Copy backend/.env.example to backend/.env and fill in real values (see that file for where each one comes from).`);
  }
}

requireEnv();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  dbPath: process.env.DB_PATH || '/data/virtual-marketer.sqlite3',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'https://virtual-marketer.de').replace(/\/$/, ''),

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    from: process.env.SMTP_FROM,
  },
  notifyTo: process.env.NOTIFY_TO,

  booking: {
    tz: process.env.BOOKING_TZ || 'Europe/Berlin',
    startHour: parseInt(process.env.BOOKING_START_HOUR || '14', 10),
    endHour: parseInt(process.env.BOOKING_END_HOUR || '20', 10),
    slotMinutes: parseInt(process.env.BOOKING_SLOT_MINUTES || '30', 10),
  },
  confirmTokenTtlHours: parseInt(process.env.CONFIRM_TOKEN_TTL_HOURS || '48', 10),
};
