'use strict';

require('./env');
const test = require('node:test');
const assert = require('node:assert/strict');
const slots = require('../src/slots');

// A Tuesday, far enough in the future that "must be in the future" checks
// never flake, during German summer time (CEST, UTC+2).
const SUMMER_WEEKDAY = '2026-08-04';
// A Tuesday during German winter time (CET, UTC+1).
const WINTER_WEEKDAY = '2027-01-05';
// Germany's 2027 spring-forward transition is Sunday 2027-03-28 02:00->03:00
// CET->CEST. The Monday right after it is the sharpest real-world edge case
// for the "compute the day's offset from a noon-UTC probe" technique in
// berlinOffsetMinutes().
const DAY_AFTER_SPRING_FORWARD = '2027-03-29';
// Germany's 2026 fall-back transition is Sunday 2026-10-25. Same edge case
// the other direction.
const DAY_AFTER_FALL_BACK = '2026-10-26';

test('slotsForDate: summer weekday produces 12 slots from 14:00 to 20:00 Berlin (CEST, UTC+2)', () => {
  const result = slots.slotsForDate(SUMMER_WEEKDAY);
  assert.equal(result.length, 12);
  assert.equal(result[0].toISOString(), '2026-08-04T12:00:00.000Z'); // 14:00 CEST
  assert.equal(result[result.length - 1].toISOString(), '2026-08-04T17:30:00.000Z'); // 19:30 CEST, last slot ending 20:00
});

test('slotsForDate: winter weekday produces 12 slots from 14:00 to 20:00 Berlin (CET, UTC+1)', () => {
  const result = slots.slotsForDate(WINTER_WEEKDAY);
  assert.equal(result.length, 12);
  assert.equal(result[0].toISOString(), '2027-01-05T13:00:00.000Z'); // 14:00 CET
  assert.equal(result[result.length - 1].toISOString(), '2027-01-05T18:30:00.000Z'); // 19:30 CET
});

test('slotsForDate: day right after DST spring-forward still computes correct CEST offset', () => {
  const result = slots.slotsForDate(DAY_AFTER_SPRING_FORWARD);
  assert.equal(result.length, 12);
  assert.equal(result[0].toISOString(), '2027-03-29T12:00:00.000Z'); // 14:00 CEST (+2)
});

test('slotsForDate: day right after DST fall-back still computes correct CET offset', () => {
  const result = slots.slotsForDate(DAY_AFTER_FALL_BACK);
  assert.equal(result.length, 12);
  assert.equal(result[0].toISOString(), '2026-10-26T13:00:00.000Z'); // 14:00 CET (+1)
});

test('slotsForDate: weekend returns no slots', () => {
  assert.deepEqual(slots.slotsForDate('2026-08-08'), []); // Saturday
  assert.deepEqual(slots.slotsForDate('2026-08-09'), []); // Sunday
});

test('slotsForDate: invalid/malformed date strings return no slots without throwing', () => {
  assert.deepEqual(slots.slotsForDate('not-a-date'), []);
  assert.deepEqual(slots.slotsForDate('2026-02-30'), []); // Feb 30 doesn't exist
  assert.deepEqual(slots.slotsForDate(''), []);
  assert.deepEqual(slots.slotsForDate(undefined), []);
  assert.deepEqual(slots.slotsForDate(null), []);
});

test('isValidSlotStart: accepts an exact generated slot boundary', () => {
  const [first] = slots.slotsForDate(SUMMER_WEEKDAY);
  assert.equal(slots.isValidSlotStart(first), true);
});

test('isValidSlotStart: rejects an off-grid time on an otherwise valid day', () => {
  // 14:05 Berlin — not aligned to the 30-min grid.
  assert.equal(slots.isValidSlotStart(new Date('2026-08-04T12:05:00.000Z')), false);
});

test('isValidSlotStart: rejects a time outside the booking window on a valid weekday', () => {
  assert.equal(slots.isValidSlotStart(new Date('2026-08-04T09:00:00.000Z')), false); // 11:00 CEST, too early
  assert.equal(slots.isValidSlotStart(new Date('2026-08-04T18:00:00.000Z')), false); // 20:00 CEST, window closed
});

test('isValidSlotStart: rejects a weekend slot even at a valid time-of-day', () => {
  assert.equal(slots.isValidSlotStart(new Date('2026-08-08T12:00:00.000Z')), false); // Saturday 14:00 CEST
});

test('isValidSlotStart: rejects a slot in the past', () => {
  assert.equal(slots.isValidSlotStart(new Date('2020-01-06T12:00:00.000Z')), false);
});

test('isValidSlotStart: rejects an invalid Date object without throwing', () => {
  assert.equal(slots.isValidSlotStart(new Date('not-a-real-date')), false);
});

test('slotEndFor: adds exactly the configured slot length', () => {
  const start = new Date('2026-08-04T12:00:00.000Z');
  const end = slots.slotEndFor(start);
  assert.equal((end.getTime() - start.getTime()) / 60000, 30);
});

test('formatBerlin: produces a non-empty, locale-appropriate string for both locales', () => {
  const d = new Date('2026-08-04T12:00:00.000Z');
  const de = slots.formatBerlin(d, 'de');
  const en = slots.formatBerlin(d, 'en');
  assert.ok(de.length > 0 && de !== en);
  assert.ok(en.length > 0);
});
