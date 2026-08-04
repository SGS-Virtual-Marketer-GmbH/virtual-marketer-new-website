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
process.env.FIRESTORE_PROJECT_ID = process.env.FIRESTORE_PROJECT_ID || 'virtual-marketer-test';
