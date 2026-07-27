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

module.exports = { generateToken, verifyToken, isExpired };
