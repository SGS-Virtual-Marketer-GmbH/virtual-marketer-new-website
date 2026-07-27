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
