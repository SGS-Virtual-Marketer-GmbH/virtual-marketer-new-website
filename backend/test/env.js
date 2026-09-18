'use strict';

// config.js fails fast at require-time if these are missing (see its
// header comment) — tests never actually send mail, but every module that
// transitively requires config.js needs these set before the first
// require() anywhere in the suite.
process.env.SMTP_HOST = process.env.SMTP_HOST || 'test-smtp.invalid';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.SMTP_USER = process.env.SMTP_USER || 'test@example.com';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'test';
process.env.SMTP_FROM = process.env.SMTP_FROM || 'Test <test@example.com>';
process.env.NOTIFY_TO = process.env.NOTIFY_TO || 'notify@example.com';

// The Firestore client needs *a* project id even against the emulator, which
// never authenticates. test/with-emulator.sh sets both this and
// FIRESTORE_EMULATOR_HOST; the fallback here keeps a bare `node --test`
// from failing with a confusing credentials error instead of a clear one.
//
// `virtual-marketer-test` IS A PLACEHOLDER AND NOT A REAL PROJECT. That is
// deliberate — the default must never be the live project, or a bare
// `npm test` on a logged-in machine would write into production Firestore
// without anyone asking for it. The cost is that credentials alone are not
// enough: with ADC valid but this default in place, every Firestore-backed
// test still skips with PERMISSION_DENIED (gRPC code 7) on a project that
// does not exist, which reads like a broken login and is not one.
//
// To actually run those tests, pick one:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test      (no credentials, no live data)
//   FIRESTORE_PROJECT_ID=virtual-marketer-chat-bot npm test
//     (real project, after `gcloud auth application-default login`; every
//      run uses its own `test_<random>_` collection prefix and deletes it
//      on exit — see firestore-env.js)
process.env.FIRESTORE_PROJECT_ID = process.env.FIRESTORE_PROJECT_ID || 'virtual-marketer-test';
