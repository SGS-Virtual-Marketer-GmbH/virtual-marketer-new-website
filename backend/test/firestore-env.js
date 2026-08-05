'use strict';

/**
 * Firestore test environment.
 *
 * The double-booking guard is the one behaviour in this service worth being
 * paranoid about, and since the move off better-sqlite3 it rests entirely on
 * Firestore's runTransaction contention detection (see src/db.js). An
 * in-memory fake would pass the concurrency assertions without exercising a
 * single line of that machinery, so these tests talk to Firestore for real.
 *
 * They do it in an isolated namespace: every run picks a unique collection
 * prefix, so the test documents never share a collection with live bookings,
 * and everything written is deleted again on exit. Two runs in parallel — or
 * a run against a project someone is also using — cannot collide.
 *
 * Where "real Firestore" points depends on the environment:
 *   - FIRESTORE_EMULATOR_HOST set  → the emulator, no credentials needed.
 *   - otherwise                    → the real project via Application
 *                                    Default Credentials.
 *
 * If neither is available the Firestore-backed tests skip rather than fail,
 * so `npm test` still runs the pure-logic suites (slots, tokens, validate)
 * on a machine with no gcloud login. Skipping is reported loudly — a silent
 * skip of the concurrency test would be worse than a red build.
 */

require('./env');

const crypto = require('node:crypto');

const prefix = `test_${crypto.randomBytes(6).toString('hex')}_`;
process.env.FIRESTORE_COLLECTION_PREFIX = prefix;
process.env.FIRESTORE_PROJECT_ID =
  process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'virtual-marketer-chat-bot';

/** Confirms Firestore is actually reachable before a suite relies on it. */
async function firestoreAvailable() {
  try {
    const { firestore } = require('../src/db');
    // Cheap round-trip that needs no data and creates nothing.
    await firestore.collection(`${prefix}ping`).limit(1).get();
    return true;
  } catch (err) {
    console.error(`\n[test] Firestore unreachable (${err.code || err.message}).`);
    console.error('[test] Firestore-backed tests will SKIP. Run `gcloud auth application-default login`,');
    console.error('[test] or set FIRESTORE_EMULATOR_HOST, to exercise them.\n');
    return false;
  }
}

/** Removes every document this run created. */
async function cleanup() {
  const { firestore } = require('../src/db');
  for (const name of [`${prefix}bookings`, `${prefix}contact_submissions`]) {
    const snap = await firestore.collection(name).get();
    if (snap.empty) continue;
    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

module.exports = { prefix, firestoreAvailable, cleanup };
