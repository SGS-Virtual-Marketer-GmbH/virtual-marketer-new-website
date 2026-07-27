'use strict';

require('./env');
const test = require('node:test');
const assert = require('node:assert/strict');
const tokens = require('../src/tokens');

test('generateToken: produces a raw token whose hash verifyToken accepts', () => {
  const { raw, hash } = tokens.generateToken();
  assert.equal(tokens.verifyToken(raw, hash), true);
});

test('generateToken: raw token has real entropy (256 bits, base64url, no padding)', () => {
  const { raw } = tokens.generateToken();
  assert.ok(raw.length >= 40); // 32 bytes base64url-encoded is 43 chars
  assert.doesNotMatch(raw, /[+/=]/); // base64url, not standard base64
});

test('generateToken: expiresAt is set to roughly now + CONFIRM_TOKEN_TTL_HOURS', () => {
  const { expiresAt } = tokens.generateToken();
  const hoursFromNow = (new Date(expiresAt).getTime() - Date.now()) / 3600000;
  assert.ok(hoursFromNow > 47.9 && hoursFromNow < 48.1); // default TTL is 48h
});

test('verifyToken: rejects a wrong token against a real hash', () => {
  const { hash } = tokens.generateToken();
  const { raw: otherRaw } = tokens.generateToken();
  assert.equal(tokens.verifyToken(otherRaw, hash), false);
});

test('verifyToken: rejects safely (no throw) on empty/missing inputs', () => {
  assert.equal(tokens.verifyToken('', ''), false);
  assert.equal(tokens.verifyToken(null, null), false);
  assert.equal(tokens.verifyToken(undefined, undefined), false);
  assert.equal(tokens.verifyToken('sometoken', undefined), false);
});

test('verifyToken: rejects safely (no throw) on attacker-controlled length/format garbage', () => {
  // Not valid hex, wildly wrong length, huge input — timingSafeEqual would
  // throw on a length mismatch, so verifyToken must never reach it with
  // mismatched buffers.
  assert.doesNotThrow(() => tokens.verifyToken('x'.repeat(10_000_000), 'deadbeef'));
  assert.equal(tokens.verifyToken('not-hex-at-all!!', 'deadbeef'), false);
  assert.equal(tokens.verifyToken('', 'a'.repeat(64)), false);
});

test('isExpired: correctly distinguishes past and future ISO timestamps', () => {
  assert.equal(tokens.isExpired(new Date(Date.now() - 1000).toISOString()), true);
  assert.equal(tokens.isExpired(new Date(Date.now() + 3600000).toISOString()), false);
});

test('two calls to generateToken never produce the same raw token or hash', () => {
  const a = tokens.generateToken();
  const b = tokens.generateToken();
  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.hash, b.hash);
});
