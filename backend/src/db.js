'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// better-sqlite3 is synchronous and single-connection: every statement here
// runs to completion before the Node event loop can start another request.
// That's what makes the slot-conflict check in routes/bookings.js race-free
// without any extra locking — as long as the check-then-insert happens
// inside one synchronous db.transaction(), nothing can interleave.
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_start TEXT NOT NULL,
    slot_end TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT,
    locale TEXT NOT NULL DEFAULT 'de',
    status TEXT NOT NULL DEFAULT 'pending',
    confirm_token_hash TEXT NOT NULL,
    confirm_token_expires_at TEXT NOT NULL,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ip TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_slot_start ON bookings(slot_start);
  CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);

  CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'de',
    status TEXT NOT NULL DEFAULT 'pending',
    confirm_token_hash TEXT NOT NULL,
    confirm_token_expires_at TEXT NOT NULL,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ip TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);
`);

module.exports = db;
