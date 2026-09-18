'use strict';

// Fails fast on missing required config instead of silently sending no
// mail / accepting bookings nobody at the company ever finds out about.
// Never logs the actual values of anything secret (SMTP_PASS).
const REQUIRED = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'NOTIFY_TO'];

function requireEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. Copy backend/.env.example to backend/.env and fill in real values (see that file for where each one comes from).`);
  }
}

requireEnv();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'https://virtual-marketer.de').replace(/\/$/, ''),

  // Both left undefined by default on purpose. On Cloud Run the Firestore
  // client picks up the project from the metadata server and the default
  // database, which is what production should use — hardcoding a project id
  // here would make the container refuse to run anywhere else. The env vars
  // exist for local runs and for the emulator, which needs *a* project id
  // even though it never authenticates against a real one.
  firestore: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID || undefined,
    databaseId: process.env.FIRESTORE_DATABASE_ID || undefined,
    // Prefix applied to every collection name. Empty in production. The test
    // suite sets a unique throwaway prefix so it can exercise real Firestore
    // transactions — the thing the double-booking guard actually depends on
    // — without ever touching the live bookings collection.
    collectionPrefix: process.env.FIRESTORE_COLLECTION_PREFIX || '',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    from: process.env.SMTP_FROM,
  },
  notifyTo: process.env.NOTIFY_TO,

  booking: {
    tz: process.env.BOOKING_TZ || 'Europe/Berlin',
    startHour: parseInt(process.env.BOOKING_START_HOUR || '14', 10),
    endHour: parseInt(process.env.BOOKING_END_HOUR || '20', 10),
    slotMinutes: parseInt(process.env.BOOKING_SLOT_MINUTES || '30', 10),
  },
  confirmTokenTtlHours: parseInt(process.env.CONFIRM_TOKEN_TTL_HOURS || '48', 10),

  // Keys the HMAC that derives one-click unsubscribe links (see
  // src/tokens.js) without ever storing the token itself.
  //
  // Not in REQUIRED above, because REQUIRED applies everywhere and this
  // must keep working for local runs and the test suite without a secret.
  // It is required IN PRODUCTION though, and enforced here: the previous
  // version only warned, which meant a deploy where the Secret Manager
  // mount silently failed would come up healthy and serve forgeable
  // unsubscribe links — anyone able to guess a subscription id could
  // unsubscribe that person. A container that cannot read its secret
  // should refuse to start instead, so the bad revision never takes
  // traffic.
  //
  // Cloud Run always sets K_SERVICE, which is what "in production" means
  // here; NODE_ENV is honoured too but is not set on this service today.
  //
  // ROTATION IS A BREAKING CHANGE. The token is derived, never stored, so
  // changing this value invalidates every unsubscribe link already mailed
  // — recipients would land on "link invalid" with no way to opt out,
  // which is exactly the failure §7 UWG cares about. Only rotate with a
  // plan to re-mail, and never as a routine hygiene step.
  unsubscribeTokenSecret: (() => {
    if (process.env.UNSUBSCRIBE_TOKEN_SECRET) return process.env.UNSUBSCRIBE_TOKEN_SECRET;
    const inProduction = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === 'production';
    if (inProduction) {
      throw new Error(
        'UNSUBSCRIBE_TOKEN_SECRET is not set. It is required in production so one-click unsubscribe links cannot be forged. ' +
          'Wire it from Secret Manager (secret: vm-unsubscribe-token-secret) in deploy-service.yaml, and check the service account has roles/secretmanager.secretAccessor.'
      );
    }
    console.warn('[config] UNSUBSCRIBE_TOKEN_SECRET is not set — using an insecure development-only fallback. This is allowed for local runs and tests only; production refuses to start without a real secret.');
    return 'dev-only-insecure-unsubscribe-secret-do-not-use-in-production';
  })(),
};
