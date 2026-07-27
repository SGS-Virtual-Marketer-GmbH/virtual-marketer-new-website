'use strict';

require('./env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail, normalizeEmail, cleanString, cleanOptionalString, cleanLocale } = require('../src/validate');

test('isValidEmail: accepts well-formed addresses', () => {
  assert.equal(isValidEmail('a@b.com'), true);
  assert.equal(isValidEmail('  a@b.com  '), true); // trimmed before test
  assert.equal(isValidEmail('first.last+tag@sub.example.co.uk'), true);
});

test('isValidEmail: rejects malformed addresses', () => {
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('a@b'), false); // no TLD
  assert.equal(isValidEmail('@b.com'), false);
  assert.equal(isValidEmail('a@'), false);
  assert.equal(isValidEmail('a b@c.com'), false); // embedded space
});

test('isValidEmail: rejects non-string / attacker-shaped input without throwing', () => {
  assert.equal(isValidEmail(undefined), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(123), false);
  assert.equal(isValidEmail({}), false);
  assert.equal(isValidEmail([]), false);
  assert.equal(isValidEmail(['a@b.com']), false);
});

test('isValidEmail: rejects addresses over the 254-char RFC cap', () => {
  const longLocal = 'a'.repeat(250);
  assert.equal(isValidEmail(`${longLocal}@b.com`), false);
});

test('normalizeEmail: lowercases and trims', () => {
  assert.equal(normalizeEmail('  Foo@EXAMPLE.com  '), 'foo@example.com');
});

test('normalizeEmail: two differently-cased addresses normalize identically (the flood-guard fix)', () => {
  assert.equal(normalizeEmail('Victim@Gmail.com'), normalizeEmail('victim@gmail.com'));
});

test('cleanString: rejects non-string, too-short, and too-long input', () => {
  assert.equal(cleanString(123), null);
  assert.equal(cleanString(''), null); // default min=1
  assert.equal(cleanString('  '.repeat(1)), null); // trims to empty
  assert.equal(cleanString('x'.repeat(2001)), null); // default max=2000
  assert.equal(cleanString('ok'), 'ok');
  assert.equal(cleanString('  padded  '), 'padded');
});

test('cleanOptionalString: missing/empty is valid (returns null, not an error)', () => {
  assert.equal(cleanOptionalString(undefined), null);
  assert.equal(cleanOptionalString(null), null);
  assert.equal(cleanOptionalString(''), null);
});

test('cleanOptionalString: rejects non-string and over-length, accepts valid', () => {
  assert.equal(cleanOptionalString(42), null);
  assert.equal(cleanOptionalString('x'.repeat(300), { max: 200 }), null);
  assert.equal(cleanOptionalString('  hello  '), 'hello');
});

test('cleanLocale: only "en" passes through, everything else defaults to "de"', () => {
  assert.equal(cleanLocale('en'), 'en');
  assert.equal(cleanLocale('de'), 'de');
  assert.equal(cleanLocale('fr'), 'de');
  assert.equal(cleanLocale(undefined), 'de');
  assert.equal(cleanLocale(null), 'de');
  assert.equal(cleanLocale(''), 'de');
});
