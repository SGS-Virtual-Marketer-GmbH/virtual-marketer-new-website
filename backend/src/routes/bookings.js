'use strict';

const express = require('express');
const { bookings } = require('../db');
const config = require('../config');
const slots = require('../slots');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const { isValidEmail, normalizeEmail, cleanString, cleanOptionalString, cleanLocale } = require('../validate');
const { submitLimiter, confirmLimiter, availabilityLimiter } = require('../rateLimit');

const router = express.Router();

// A slot counts as "taken" if there's a confirmed booking, or a pending one
// whose confirmation window hasn't expired yet. Expired-pending documents
// free the slot back up automatically — no separate cleanup job required for
// correctness (a periodic sweep in server.js just keeps `status` tidy for
// anyone looking at the data directly). See src/db.js for how the
// read-check-then-write stays race-free now that the store is Firestore.

// GET /api/bookings/availability?date=YYYY-MM-DD -> which of that day's
// slots are already taken, so the frontend calendar only offers free ones.
router.get('/availability', availabilityLimiter, async (req, res, next) => {
  try {
    const dateStr = String(req.query.date || '');
    const candidateSlots = slots.slotsForDate(dateStr);
    if (!candidateSlots.length) {
      return res.json({ date: dateStr, slots: [] });
    }
    const nowIso = new Date().toISOString();
    // One read per slot, issued in parallel — a day is 12 slots, and this
    // endpoint is the calendar's hot path, so serialising them would add a
    // dozen round-trips to every date change.
    const result = await Promise.all(
      candidateSlots.map(async (s) => ({
        start: s.toISOString(),
        available: !(await bookings.isSlotTaken(s.toISOString(), nowIso)),
      }))
    );
    res.json({ date: dateStr, slots: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings — create a pending booking, reserve the slot
// immediately (before any email I/O), then notify both sides.
router.post('/', submitLimiter, express.json({ limit: '10kb' }), async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = cleanString(body.name, { max: 200 });
    const email = isValidEmail(body.email) ? normalizeEmail(body.email) : null;
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
    if ((await bookings.countRecentByEmail(email, dayAgo)) >= 5) {
      return res.status(429).json({ error: 'too_many_requests', message: 'Too many booking requests for this email address in the last 24 hours.' });
    }

    const slotEnd = slots.slotEndFor(slotStart);
    const { raw, hash, expiresAt } = tokens.generateToken();

    const id = await bookings.reserveSlot({
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
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/confirm?id=&token= — the confirmation LINK target.
// Rendered as an HTML landing page since a human clicks this from their
// email client, not an API caller.
//
// `id` is a Firestore document id (an opaque string) rather than the SQLite
// autoincrement integer it used to be, so there is no parseInt guard here
// any more — an unknown id simply reads back as null and takes the same
// failure path as a wrong token.
router.get('/confirm', confirmLimiter, async (req, res, next) => {
  try {
    const id = String(req.query.id || '');
    const token = String(req.query.token || '');
    const booking = id ? await bookings.getById(id) : null;

    const fail = () =>
      res.status(400).send(
        confirmPageHtml({ locale: booking ? booking.locale : 'de', ok: false, homeHref: config.publicBaseUrl })
      );

    if (!booking || booking.status !== 'pending') return fail();
    if (tokens.isExpired(booking.confirm_token_expires_at)) return fail();
    if (!tokens.verifyToken(token, booking.confirm_token_hash)) return fail();

    // Transactional: a double-clicked link resolves to exactly one state
    // change, and the loser gets the error page rather than a second email.
    const changed = await bookings.confirm(id, new Date().toISOString());
    if (!changed) return fail();

    const slotFormatted = slots.formatBerlin(new Date(booking.slot_start), booking.locale);
    const c = copy(booking.locale);
    Promise.allSettled([
      mailer.send({ to: config.notifyTo, subject: `[Booking confirmed] ${c.bookingSubjectConfirmed}`, text: c.bookingInternalConfirmed({ name: booking.name, email: booking.email, company: booking.company, slotFormatted }) }),
      mailer.send({ to: booking.email, subject: c.bookingSubjectConfirmed, text: c.bookingCustomerConfirmed({ name: booking.name, slotFormatted }) }),
    ]);

    res.send(confirmPageHtml({ locale: booking.locale, ok: true, homeHref: config.publicBaseUrl }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
