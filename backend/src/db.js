'use strict';

/**
 * Firestore data layer for bookings and contact submissions.
 *
 * This used to be better-sqlite3 against a file on a mounted volume. That
 * does not survive Cloud Run: instances are ephemeral and scale to zero, so
 * a local SQLite file is thrown away on every scale-down, and Cloud Run's
 * only persistent volume option is a Cloud Storage FUSE mount, which cannot
 * give SQLite the file locking and fsync semantics WAL mode requires. The
 * choice was between paying for a Cloud SQL instance that never scales to
 * zero and moving to a serverless store; Firestore's free tier covers this
 * workload (a handful of bookings a day against 20k writes/day) at no cost
 * and scales to zero with the service.
 *
 * The one thing that had to survive the move is the double-booking
 * guarantee. Under better-sqlite3 it came for free from the driver being
 * synchronous and single-connection: a check-then-insert wrapped in
 * db.transaction() could not interleave with another request because the
 * event loop could not run in between. Firestore is neither synchronous nor
 * single-connection, so that reasoning does not transfer at all — the
 * guarantee is re-established explicitly with runTransaction(), which reads
 * the slot inside the transaction and aborts and retries if a concurrent
 * writer touched the same documents. Same invariant, enforced by the
 * database rather than by the shape of the runtime.
 *
 * The conflict check reads every booking for the slot and filters in JS
 * rather than expressing "confirmed OR (pending AND not expired)" as a
 * Firestore query. A disjunction across two fields needs a composite index
 * that has to be deployed alongside the code, and a slot only ever holds a
 * couple of documents, so the filter is cheaper to operate and impossible
 * to get silently wrong at deploy time.
 *
 * Document fields keep the snake_case names the SQL schema used, so the
 * route handlers and email templates did not have to be renamed field by
 * field during the port.
 */

const { Firestore } = require('@google-cloud/firestore');
const config = require('./config');

const firestore = new Firestore({
  projectId: config.firestore.projectId,
  databaseId: config.firestore.databaseId,
  ignoreUndefinedProperties: true,
});

const prefix = config.firestore.collectionPrefix;
const bookingsCol = firestore.collection(`${prefix}bookings`);
const contactsCol = firestore.collection(`${prefix}contact_submissions`);
const modelRequestsCol = firestore.collection(`${prefix}model_requests`);

function withId(doc) {
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/** A slot is taken by a confirmed booking, or by a pending one still in date. */
function blocksSlot(booking, nowIso) {
  if (booking.status === 'confirmed') return true;
  return booking.status === 'pending' && booking.confirm_token_expires_at > nowIso;
}

/**
 * Housekeeping only. Correctness never depends on this having run — the
 * conflict check already treats an expired pending booking as free — it just
 * keeps `status` truthful for anyone reading the collection directly.
 */
async function sweep(col, nowIso) {
  // Only the inequality is expressed as a query; `status` is filtered in JS.
  // Combining an equality and an inequality on two different fields is
  // exactly the shape Firestore requires a composite index for, and that
  // index would have to be created out of band before this code could run —
  // a deploy-time failure mode for what is only a cosmetic tidy-up. A range
  // on a single field rides the automatic index instead.
  const snap = await col.where('confirm_token_expires_at', '<', nowIso).limit(500).get();
  const stale = snap.docs.filter((d) => d.data().status === 'pending');
  if (!stale.length) return 0;

  const batch = firestore.batch();
  stale.forEach((d) => batch.update(d.ref, { status: 'expired' }));
  await batch.commit();
  return stale.length;
}

const bookings = {
  async isSlotTaken(slotStartIso, nowIso) {
    const snap = await bookingsCol.where('slot_start', '==', slotStartIso).get();
    return snap.docs.some((d) => blocksSlot(d.data(), nowIso));
  },

  /**
   * Reserves a slot if free. Returns the new document id, or null if the
   * slot was taken. The read and the write are one Firestore transaction, so
   * two simultaneous requests for the same slot cannot both succeed —
   * whichever loses the contention is retried and then sees the winner's
   * document.
   */
  async reserveSlot(row) {
    const nowIso = new Date().toISOString();
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(bookingsCol.where('slot_start', '==', row.slot_start));
      if (snap.docs.some((d) => blocksSlot(d.data(), nowIso))) return null;

      const ref = bookingsCol.doc();
      tx.create(ref, { ...row, status: 'pending', confirmed_at: null, created_at: nowIso });
      return ref.id;
    });
  },

  /**
   * Same-email flood guard. Filtered in JS on purpose: an (email, created_at)
   * range query needs a composite index, while an equality query on email
   * alone rides Firestore's automatic single-field index. The limit keeps a
   * pathological address from pulling an unbounded read.
   */
  async countRecentByEmail(email, sinceIso) {
    const snap = await bookingsCol.where('email', '==', email).limit(200).get();
    return snap.docs.filter((d) => d.data().created_at > sinceIso).length;
  },

  async getById(id) {
    if (!id) return null;
    return withId(await bookingsCol.doc(id).get());
  },

  /**
   * Confirms a pending booking. Returns false if it was already confirmed,
   * expired or gone — the transaction is what makes a double-clicked
   * confirmation link resolve to exactly one state change.
   */
  async confirm(id, nowIso) {
    return firestore.runTransaction(async (tx) => {
      const ref = bookingsCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists || doc.data().status !== 'pending') return false;
      tx.update(ref, { status: 'confirmed', confirmed_at: nowIso });
      return true;
    });
  },

  sweepExpired(nowIso) {
    return sweep(bookingsCol, nowIso);
  },
};

const contacts = {
  async create(row) {
    const nowIso = new Date().toISOString();
    const ref = contactsCol.doc();
    await ref.create({ ...row, status: 'pending', confirmed_at: null, created_at: nowIso });
    return ref.id;
  },

  async countRecentByEmail(email, sinceIso) {
    const snap = await contactsCol.where('email', '==', email).limit(200).get();
    return snap.docs.filter((d) => d.data().created_at > sinceIso).length;
  },

  async getById(id) {
    if (!id) return null;
    return withId(await contactsCol.doc(id).get());
  },

  async confirm(id, nowIso) {
    return firestore.runTransaction(async (tx) => {
      const ref = contactsCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists || doc.data().status !== 'pending') return false;
      tx.update(ref, { status: 'confirmed', confirmed_at: nowIso });
      return true;
    });
  },

  sweepExpired(nowIso) {
    return sweep(contactsCol, nowIso);
  },
};

/**
 * Custom-model requests, replacing the Google Form the page used to embed.
 *
 * Deliberately the same shape as `contacts`: create, rate-limit by email,
 * double opt-in confirm, sweep. The payload differs — a model request carries
 * roughly twenty fields across two branches — but the lifecycle is identical,
 * and a second lifecycle would be a second thing to get wrong.
 *
 * The branch-specific answers live in a nested `details` object rather than as
 * twenty top-level columns. Firestore does not care, and it keeps the document
 * readable: someone opening it sees which branch was taken and only the fields
 * that branch actually has.
 */
const modelRequests = {
  async create(row) {
    const nowIso = new Date().toISOString();
    const ref = modelRequestsCol.doc();
    await ref.create({ ...row, status: 'pending', confirmed_at: null, created_at: nowIso });
    return ref.id;
  },

  async countRecentByEmail(email, sinceIso) {
    const snap = await modelRequestsCol.where('email', '==', email).limit(200).get();
    return snap.docs.filter((d) => d.data().created_at > sinceIso).length;
  },

  async getById(id) {
    if (!id) return null;
    return withId(await modelRequestsCol.doc(id).get());
  },

  async confirm(id, nowIso) {
    return firestore.runTransaction(async (tx) => {
      const ref = modelRequestsCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists || doc.data().status !== 'pending') return false;
      tx.update(ref, { status: 'confirmed', confirmed_at: nowIso });
      return true;
    });
  },

  sweepExpired(nowIso) {
    return sweep(modelRequestsCol, nowIso);
  },
};

module.exports = { firestore, bookings, contacts, modelRequests };
