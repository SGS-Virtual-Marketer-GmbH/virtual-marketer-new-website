'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const slots = require('../slots');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const { isValidEmail, cleanString, cleanOptionalString, cleanLocale } = require('../validate');
const { submitLimiter, confirmLimiter, availabilityLimiter } = require('../rateLimit');

const router = express.Router();

// A slot counts as "taken" if there's a confirmed booking, or a pending one
// whose confirmation window hasn't expired yet. Expired-pending rows free
// the slot back up automatically — no separate cleanup job required for
// correctness (a periodic sweep in server.js just keeps `status` tidy for
// anyone looking at the DB directly).
const findConflict = db.prepare(`
  SELECT id FROM bookings
  WHERE slot_start = ?
    AND (status = 'confirmed' OR (status = 'pending' AND confirm_token_expires_at > ?))
  LIMIT 1
`);

const insertBooking = db.prepare(`
  INSERT INTO bookings (slot_start, slot_end, name, email, company, message, locale, status, confirm_token_hash, confirm_token_expires_at, ip)
  VALUES (@slot_start, @slot_end, @name, @email, @company, @message, @locale, 'pending', @confirm_token_hash, @confirm_token_expires_at, @ip)
`);

// Runs the read-check-then-write as one synchronous unit so no other
// request's handler can run in between (see the comment in db.js).
const reserveSlot = db.transaction((row) => {
  const conflict = findConflict.get(row.slot_start, new Date().toISOString());
  if (conflict) return null;
  const info = insertBooking.run(row);
  return info.lastInsertRowid;
});

const recentSubmissionsByEmail = db.prepare(`
  SELECT COUNT(*) AS n FROM bookings WHERE email = ? AND created_at > ?
`);

// GET /api/bookings/availability?date=YYYY-MM-DD -> which of that day's
// slots are already taken, so the frontend calendar only offers free ones.
router.get('/availability', availabilityLimiter, (req, res) => {
  const dateStr = String(req.query.date || '');
  const candidateSlots = slots.slotsForDate(dateStr);
  if (!candidateSlots.length) {
    return res.json({ date: dateStr, slots: [] });
  }
  const nowIso = new Date().toISOString();
  const result = candidateSlots.map((s) => {
    const taken = !!findConflict.get(s.toISOString(), nowIso);
    return { start: s.toISOString(), available: !taken };
  });
  res.json({ date: dateStr, slots: result });
});

// POST /api/bookings — create a pending booking, reserve the slot
// immediately (before any email I/O), then notify both sides.
router.post('/', submitLimiter, express.json({ limit: '10kb' }), async (req, res) => {
  const body = req.body || {};
  const name = cleanString(body.name, { max: 200 });
  const email = isValidEmail(body.email) ? body.email.trim() : null;
  const company = cleanOptionalString(body.company, { max: 200 });
  const message = cleanOptionalString(body.message, { max: 2000 });
  const locale = cleanLocale(body.locale);
  const slotStartRaw = typeof body.slotStart === 'string' ? body.slotStart : null;

  if (!name || !email || !slotStartRaw) {
    return res.status(400).json({ error: 'invalid_input', message: 'name, email and slotStart are required.' });
  }
  const slotStart = new Date(slotStartRaw);
  if (!slots.isValidSlotStart(slotStart)) {
    return res.status(400).json({ error: 'invalid_slot', message: 'That slot is not a valid Mon-Fri booking time in the future.' });
  }

  // Same-email flood guard: caps how many booking requests one address can
  // trigger confirmation emails for in 24h, independent of which IP is used.
  const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
  if (recentSubmissionsByEmail.get(email, dayAgo).n >= 5) {
    return res.status(429).json({ error: 'too_many_requests', message: 'Too many booking requests for this email address in the last 24 hours.' });
  }

  const slotEnd = slots.slotEndFor(slotStart);
  const { raw, hash, expiresAt } = tokens.generateToken();

  const id = reserveSlot({
    slot_start: slotStart.toISOString(),
    slot_end: slotEnd.toISOString(),
    name,
    email,
    company,
    message,
    locale,
    confirm_token_hash: hash,
    confirm_token_expires_at: expiresAt,
    ip: req.ip,
  });

  if (id === null) {
    return res.status(409).json({ error: 'slot_taken', message: 'This slot was just booked by someone else. Please pick another.' });
  }

  const slotFormatted = slots.formatBerlin(slotStart, locale);
  const confirmUrl = `${config.publicBaseUrl}/api/bookings/confirm?id=${id}&token=${raw}`;
  const c = copy(locale);

  // Slot is already reserved at this point regardless of whether mail
  // sending succeeds — a transient SMTP hiccup must never lose a booking.
  await Promise.allSettled([
    mailer.send({ to: config.notifyTo, subject: `[Booking] ${c.bookingSubjectPending}`, text: c.bookingInternalPending({ name, email, company, message, slotFormatted }) }),
    mailer.send({ to: email, subject: c.bookingSubjectPending, text: c.bookingCustomerPending({ name, slotFormatted, confirmUrl }) }),
  ]);

  res.status(201).json({ id, status: 'pending', slotStart: slotStart.toISOString() });
});

const getBooking = db.prepare('SELECT * FROM bookings WHERE id = ?');
const confirmBooking = db.prepare(`
  UPDATE bookings SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND status = 'pending'
`);

// GET /api/bookings/confirm?id=&token= — the confirmation LINK target.
// Rendered as an HTML landing page since a human clicks this from their
// email client, not an API caller.
router.get('/confirm', confirmLimiter, (req, res) => {
  const id = parseInt(req.query.id, 10);
  const token = String(req.query.token || '');
  const booking = Number.isInteger(id) ? getBooking.get(id) : null;

  const fail = () => res.status(400).send(confirmPageHtml({ locale: booking ? booking.locale : 'de', ok: false, homeHref: config.publicBaseUrl }));

  if (!booking || booking.status !== 'pending') return fail();
  if (tokens.isExpired(booking.confirm_token_expires_at)) return fail();
  if (!tokens.verifyToken(token, booking.confirm_token_hash)) return fail();

  const now = new Date().toISOString();
  const changed = confirmBooking.run(now, id);
  if (changed.changes !== 1) return fail(); // lost a race with itself (double-click) — fine, just show the error page

  const slotFormatted = slots.formatBerlin(new Date(booking.slot_start), booking.locale);
  const c = copy(booking.locale);
  Promise.allSettled([
    mailer.send({ to: config.notifyTo, subject: `[Booking confirmed] ${c.bookingSubjectConfirmed}`, text: c.bookingInternalConfirmed({ name: booking.name, email: booking.email, company: booking.company, slotFormatted }) }),
    mailer.send({ to: booking.email, subject: c.bookingSubjectConfirmed, text: c.bookingCustomerConfirmed({ name: booking.name, slotFormatted }) }),
  ]);

  res.send(confirmPageHtml({ locale: booking.locale, ok: true, homeHref: config.publicBaseUrl }));
});

module.exports = router;
