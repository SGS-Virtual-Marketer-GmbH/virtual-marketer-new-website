'use strict';

const crypto = require('crypto');
const config = require('./config');

// Confirmation is a LINK, not a code: we generate a high-entropy random
// token, email the raw value inside a URL, and store only its SHA-256 hash.
// A leaked/dumped database can't be used to forge confirmations, and the
// token is far too large to brute-force through the rate-limited confirm
// endpoint.
function generateToken() {
  const raw = crypto.randomBytes(32).toString('base64url'); // 256 bits
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + config.confirmTokenTtlHours * 3600000).toISOString();
  return { raw, hash, expiresAt };
}

function verifyToken(rawToken, storedHash) {
  if (!rawToken || !storedHash) return false;
  const candidateHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isExpired(expiresAtIso) {
  return new Date(expiresAtIso).getTime() <= Date.now();
}

// One-click unsubscribe (TMG §7 / UWG) needs a link that keeps working for
// as long as the subscription exists — potentially years, across every
// weekly issue — not just for one confirmation window. Storing yet another
// random token's hash would mean every mail that wants to embed a working
// link has to either keep re-reading and re-hashing a raw value it no
// longer has (it was only ever in the one email it was minted for), or
// rotate it, which breaks every older mail's link the moment a newer one is
// sent. An HMAC keyed to a server-side secret sidesteps both problems: the
// same input (the record's id) always reproduces the same token, so it
// never has to be stored at all and stays valid in every mail ever sent for
// that record — until the secret itself is rotated, which is an explicit,
// rare operational action, not a side effect of sending another email.
function unsubscribeToken(id) {
  return crypto.createHmac('sha256', config.unsubscribeTokenSecret).update(String(id)).digest('base64url');
}

function verifyUnsubscribeToken(id, token) {
  if (!id || !token) return false;
  const expected = Buffer.from(unsubscribeToken(id));
  const given = Buffer.from(String(token));
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

module.exports = { generateToken, verifyToken, isExpired, unsubscribeToken, verifyUnsubscribeToken };
