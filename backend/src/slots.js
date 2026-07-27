'use strict';

const config = require('./config');

const { tz, startHour, endHour, slotMinutes } = config.booking;

// All booking-window math is done via Intl against real UTC instants rather
// than constructing "local" Date objects by hand — Europe/Berlin's UTC
// offset changes twice a year (CET +1 / CEST +2) and Node's Date has no
// concept of a named timezone, only the *host machine's* local zone (which
// in a Docker container is usually UTC, not Berlin). This keeps the whole
// module correct regardless of what timezone the container runs in.

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: tz,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// Returns { weekday, year, month, day, hour, minute } for a UTC instant, as
// seen on a wall clock in `tz`.
function berlinParts(date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  // hour12:false formats midnight as "24" in some ICU builds — normalize.
  const hour = parts.hour === '24' ? 0 : parseInt(parts.hour, 10);
  return {
    weekday: parts.weekday, // "Mon".."Sun"
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
  };
}

// Given a Berlin-local calendar date (y, m, d — 1-indexed month) and the
// Berlin UTC offset in minutes on that date, returns the UTC Date for a
// given local hour/minute on that date.
function berlinOffsetMinutes(y, m, d) {
  // Noon is used as the reference instant deliberately: Germany's DST
  // transitions always happen at 02:00/03:00 local time on a Sunday, so by
  // noon the offset for the *entire rest of that day* — including this
  // site's whole 14:00-20:00 booking window — is already settled. Using
  // noon avoids the transition instant itself ever falling inside the
  // measurement.
  const noonUtcGuess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const local = berlinParts(noonUtcGuess);
  const localAsUtcMinutes = local.hour * 60 + local.minute;
  const guessUtcMinutes = 12 * 60;
  return localAsUtcMinutes - guessUtcMinutes; // e.g. +60 (CET) or +120 (CEST)
}

function berlinLocalToUtc(y, m, d, hour, minute) {
  const offset = berlinOffsetMinutes(y, m, d);
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0) - offset * 60000);
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function isWeekday(weekdayAbbrev) {
  const idx = WEEKDAY_INDEX[weekdayAbbrev];
  return idx >= 1 && idx <= 5;
}

// All valid slot start times (as UTC Date objects) for a Berlin-local
// calendar date string "YYYY-MM-DD". Empty array for weekends/invalid input.
function slotsForDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return [];
  const [, yStr, moStr, dStr] = m;
  const y = parseInt(yStr, 10), mo = parseInt(moStr, 10), d = parseInt(dStr, 10);

  // Validate the date is real (rejects e.g. 2026-02-30) and determine weekday.
  const noon = berlinLocalToUtc(y, mo, d, 12, 0);
  const parts = berlinParts(noon);
  if (parts.year !== y || parts.month !== mo || parts.day !== d) return [];
  if (!isWeekday(parts.weekday)) return [];

  const slots = [];
  for (let mins = startHour * 60; mins + slotMinutes <= endHour * 60; mins += slotMinutes) {
    const hour = Math.floor(mins / 60);
    const minute = mins % 60;
    slots.push(berlinLocalToUtc(y, mo, d, hour, minute));
  }
  return slots;
}

// Validates an arbitrary requested slot-start instant: must exactly match
// one of that day's generated slot boundaries, and must be in the future.
function isValidSlotStart(date) {
  if (Number.isNaN(date.getTime())) return false;
  if (date.getTime() <= Date.now()) return false;
  const parts = berlinParts(date);
  const dateStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return slotsForDate(dateStr).some((s) => s.getTime() === date.getTime());
}

function slotEndFor(slotStartDate) {
  return new Date(slotStartDate.getTime() + slotMinutes * 60000);
}

function formatBerlin(date, locale) {
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${fmt.format(date)} (${tz.replace('_', ' ')})`;
}

module.exports = { slotsForDate, isValidSlotStart, slotEndFor, formatBerlin, berlinParts };
