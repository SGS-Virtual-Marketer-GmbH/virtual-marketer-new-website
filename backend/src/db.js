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
const newsletterCol = firestore.collection(`${prefix}newsletter_subscriptions`);
const whitepaperCol = firestore.collection(`${prefix}whitepaper_downloads`);

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

/**
 * Newsletter double opt-in with one-click unsubscribe.
 *
 * Same create/countRecentByEmail/getById/confirm/sweep shape as `contacts`,
 * plus a third terminal status, 'unsubscribed', reachable from either
 * 'pending' or 'confirmed'. Unsubscribing never deletes the document —
 * German law requires the operator to be able to prove consent existed
 * later, and deleting the record on unsubscribe would destroy exactly that
 * proof. The unsubscribe token itself is never stored (see
 * src/tokens.js's unsubscribeToken/verifyUnsubscribeToken — it's an HMAC of
 * the document id, verified without a stored secret-per-row), so there is
 * no `unsubscribe_token_hash` field here to manage or rotate.
 */
/**
 * How many confirmation mails a single address may be sent in 24 hours.
 *
 * The guard this feeds used to count DOCUMENTS created per address, which
 * never fired: a repeat signup for an address that is already pending goes
 * through `reissueToken`, which updates the existing document instead of
 * creating a second one, so the count sat at 1 no matter how many mails
 * went out. That made the per-address cap dead code and left a stranger's
 * inbox floodable with confirmation mail (the per-IP limiter is the only
 * other brake, and an attacker picks their own IPs).
 *
 * So the record now carries the timestamp of every confirmation mail it
 * caused, and the cap counts those. `create` seeds the list, `reissueToken`
 * appends to it.
 */
const MAX_CONFIRM_SENDS_PER_DAY = 5;
/** Kept per record so an attacked address cannot grow the document without bound. */
const CONFIRM_SENDS_KEPT = 20;

const newsletter = {
  async create(row) {
    const nowIso = new Date().toISOString();
    const ref = newsletterCol.doc();
    await ref.create({
      ...row,
      status: 'pending',
      created_at: nowIso,
      confirmed_at: null,
      unsubscribed_at: null,
      confirm_sends: [nowIso],
    });
    return ref.id;
  },

  /**
   * Confirmation mails sent to this address since `sinceIso`, across all of
   * its records.
   *
   * `confirm_sends` is read from the records the caller already fetched via
   * findByEmail rather than re-queried, so this costs nothing extra. Records
   * written before that field existed fall back to their creation time, so
   * one legacy document still counts as the one mail it did cause.
   */
  countRecentConfirmSends(records, sinceIso) {
    return records.reduce((total, r) => {
      if (Array.isArray(r.confirm_sends)) {
        return total + r.confirm_sends.filter((t) => t > sinceIso).length;
      }
      return total + (r.created_at > sinceIso ? 1 : 0);
    }, 0);
  },

  /**
   * Every record for an address, newest first. Lets a repeat POST be
   * idempotent (never creates a second pending/confirmed document for the
   * same address) without the caller ever learning which case applied —
   * see routes/newsletter.js, which returns the identical response for all
   * of them.
   */
  async findByEmail(email) {
    const snap = await newsletterCol.where('email', '==', email).limit(50).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  async getById(id) {
    if (!id) return null;
    return withId(await newsletterCol.doc(id).get());
  },

  async confirm(id, nowIso) {
    return firestore.runTransaction(async (tx) => {
      const ref = newsletterCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists || doc.data().status !== 'pending') return false;
      tx.update(ref, { status: 'confirmed', confirmed_at: nowIso });
      return true;
    });
  },

  /**
   * Rotates the confirm token on an existing pending record instead of
   * creating a second document — a re-submitted signup form ("I didn't get
   * the email") is the common case this avoids piling up duplicates for.
   *
   * Transactional, and it appends to `confirm_sends`, because that list is
   * what the per-address flood cap counts (see countRecentConfirmSends). A
   * plain update with arrayUnion would work for the append but could not
   * trim the list, so a hammered address would grow its document forever;
   * reading and rewriting the trimmed tail inside the transaction keeps it
   * bounded and keeps two concurrent signups from losing one another's
   * entry.
   */
  async reissueToken(id, { confirm_token_hash, confirm_token_expires_at }, nowIso = new Date().toISOString()) {
    await firestore.runTransaction(async (tx) => {
      const ref = newsletterCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists) return;
      const prior = Array.isArray(doc.data().confirm_sends) ? doc.data().confirm_sends : [];
      tx.update(ref, {
        confirm_token_hash,
        confirm_token_expires_at,
        confirm_sends: prior.concat(nowIso).slice(-CONFIRM_SENDS_KEPT),
      });
    });
  },

  /**
   * One-click unsubscribe. Idempotent by construction: a second click on an
   * already-processed link, or an old link from a much earlier mail, must
   * still land on a success page rather than an error, and a document once
   * 'unsubscribed' is never touched again (no revert, no delete).
   */
  async unsubscribe(id, nowIso) {
    return firestore.runTransaction(async (tx) => {
      const ref = newsletterCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists) return false;
      if (doc.data().status === 'unsubscribed') return true;
      tx.update(ref, { status: 'unsubscribed', unsubscribed_at: nowIso });
      return true;
    });
  },

  /**
   * Used when the whitepaper route's separate newsletter checkbox was
   * ticked: the whitepaper confirmation click already proved the address,
   * so this activates the subscription immediately instead of emailing a
   * second confirmation link to the same mailbox for the same purpose.
   * Still idempotent (never creates a duplicate active subscription) and
   * still records its own consent fields, passed in by the caller exactly
   * as captured at the moment the checkbox was ticked — not backfilled
   * with the confirmation-time timestamp, which would misstate when
   * consent was actually given. See routes/whitepaper.js.
   */
  async upsertConfirmed({ email, locale, ip, userAgent, consentVersion, consentTimestamp, source }) {
    const nowIso = new Date().toISOString();
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(newsletterCol.where('email', '==', email).limit(50));
      const confirmed = snap.docs.find((d) => d.data().status === 'confirmed');
      if (confirmed) return confirmed.id; // already an active subscriber — no duplicate

      // Adopt a pending record rather than creating a second one — but
      // REWRITE ITS CONSENT FIELDS, do not inherit them.
      //
      // A pending record proves nothing about who created it: anyone can
      // type any address into the newsletter form, and the record that
      // leaves behind carries THEIR ip, user agent, consent version and
      // timestamp. Flipping it to confirmed while keeping those fields
      // (which is what this did) stored a stranger's drive-by submission
      // as the GDPR proof of consent for a subscription the mailbox owner
      // actually granted here, seconds ago, by ticking the whitepaper's
      // newsletter box and clicking a link only they could receive.
      //
      // The consent that counts is the one this caller just witnessed, so
      // that is what gets written. The doc comment above always claimed
      // this; now the code does it.
      const pending = snap.docs.find((d) => d.data().status === 'pending');
      if (pending) {
        tx.update(pending.ref, {
          status: 'confirmed',
          confirmed_at: nowIso,
          locale,
          ip,
          user_agent: userAgent,
          consent_version: consentVersion,
          consent_timestamp: consentTimestamp,
          source: source || 'newsletter',
          // The pending token is spent by this adoption; leaving it live
          // would let the original confirmation mail still "confirm" a
          // subscription that is already active.
          confirm_token_hash: null,
          confirm_token_expires_at: null,
        });
        return pending.id;
      }

      // Re-subscribing after an unsubscribe reuses the same record too.
      //
      // Creating a fresh document instead (the previous behaviour) left
      // two rows for one address, one 'unsubscribed' and one 'confirmed'.
      // Every unsubscribe link ever mailed addresses a document id, so an
      // old link would mark the stale row unsubscribed — again — while the
      // new row kept the subscription live. The subscriber clicks
      // unsubscribe, sees a success page, and keeps receiving mail, which
      // is precisely the failure §7 UWG is about.
      //
      // The prior unsubscribe is not erased by the reuse: it is recorded
      // in `lifecycle` so the opt-out remains provable after the opt-in.
      const unsubscribed = snap.docs.find((d) => d.data().status === 'unsubscribed');
      if (unsubscribed) {
        const prior = Array.isArray(unsubscribed.data().lifecycle) ? unsubscribed.data().lifecycle : [];
        tx.update(unsubscribed.ref, {
          status: 'confirmed',
          confirmed_at: nowIso,
          unsubscribed_at: null,
          locale,
          ip,
          user_agent: userAgent,
          consent_version: consentVersion,
          consent_timestamp: consentTimestamp,
          source: source || 'newsletter',
          confirm_token_hash: null,
          confirm_token_expires_at: null,
          lifecycle: prior.concat({
            event: 'unsubscribed',
            at: unsubscribed.data().unsubscribed_at || null,
            superseded_at: nowIso,
          }),
        });
        return unsubscribed.id;
      }

      const ref = newsletterCol.doc();
      tx.create(ref, {
        email,
        locale,
        status: 'confirmed',
        created_at: nowIso,
        confirmed_at: nowIso,
        unsubscribed_at: null,
        confirm_token_hash: null,
        confirm_token_expires_at: null,
        ip,
        user_agent: userAgent,
        consent_version: consentVersion,
        consent_timestamp: consentTimestamp,
        source: source || 'newsletter',
      });
      return ref.id;
    });
  },

  sweepExpired(nowIso) {
    return sweep(newsletterCol, nowIso);
  },
};

/**
 * Whitepaper gated downloads. Same shape as `contacts` again — the only
 * addition is the `slug` field (validated against a closed allowlist in
 * routes/whitepaper.js, never a caller-supplied URL) and, when the
 * requester also ticked the separate newsletter checkbox, the
 * newsletter_opt_in fields the confirm handler reads to (idempotently)
 * activate a real newsletter subscription via `newsletter.upsertConfirmed`.
 */
const whitepaper = {
  async create(row) {
    const nowIso = new Date().toISOString();
    const ref = whitepaperCol.doc();
    await ref.create({ ...row, status: 'pending', created_at: nowIso, confirmed_at: null });
    return ref.id;
  },

  async countRecentByEmail(email, sinceIso) {
    const snap = await whitepaperCol.where('email', '==', email).limit(200).get();
    return snap.docs.filter((d) => d.data().created_at > sinceIso).length;
  },

  async getById(id) {
    if (!id) return null;
    return withId(await whitepaperCol.doc(id).get());
  },

  async confirm(id, nowIso) {
    return firestore.runTransaction(async (tx) => {
      const ref = whitepaperCol.doc(id);
      const doc = await tx.get(ref);
      if (!doc.exists || doc.data().status !== 'pending') return false;
      tx.update(ref, { status: 'confirmed', confirmed_at: nowIso });
      return true;
    });
  },

  sweepExpired(nowIso) {
    return sweep(whitepaperCol, nowIso);
  },
};

module.exports = { firestore, bookings, contacts, modelRequests, newsletter, whitepaper, MAX_CONFIRM_SENDS_PER_DAY };
