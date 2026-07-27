# virtual-marketer-api

Booking + contact-form API for virtual-marketer.de. Reverse-proxied at `/api/*`
by nginx in production (`docker/nginx.conf`) and by `server.js` in local dev
(always proxies `/api/*` to `http://127.0.0.1:4000` — see the comment there).

## Setup

```
cd backend
npm install
cp .env.example .env   # fill in real SMTP credentials — never commit this file
node src/server.js
```

Required env vars are documented in `.env.example`. The process fails fast
at startup if any are missing (`src/config.js`). SMTP connectivity is
verified once at startup and logged (never logs the password).

`src/app.js` exports the configured Express app with no `.listen()` call;
`src/server.js` is the thin entrypoint that calls `.listen()` and starts the
housekeeping sweep. This split exists so the test suite can drive the real
app in-process over real HTTP without binding the actual configured port.

## Tests

```
cd backend
npm test
```

Uses Node's built-in test runner (`node --test`, no extra dependency).
Covers: timezone/DST edge cases in `src/slots.js` (including the days
immediately after Germany's spring-forward/fall-back transitions), token
generation/verification/expiry (`src/tokens.js`), input validation and
email normalization (`src/validate.js`), and — the most important one — a
true-concurrency integration test that fires 10 simultaneous real HTTP
requests at the same slot and asserts exactly one gets `201` and the other
nine get `409`, proving the double-booking guard holds under actual
concurrent load, not just by reading the code.

## Data model

SQLite (`better-sqlite3`, file at `DB_PATH`), two tables: `bookings`,
`contact_submissions`. Both follow the same lifecycle: `pending` (just
submitted, confirmation email sent) -> `confirmed` (clicked the link) or
`expired` (link expired, never clicked). The row is written to the database
immediately on submission — before any email is sent — so the business
always has a record even if the visitor never confirms (per the "always
capture the email address" requirement).

## Booking rules

Mon–Fri, 14:00–20:00 Europe/Berlin, 30-minute slots (all configurable via
env — see `.env.example`). `src/slots.js` does all the timezone math against
real UTC instants via `Intl`, not the container's local clock.

Double-booking is prevented by `routes/bookings.js`'s `reserveSlot`
transaction: the "is this slot free" check and the insert happen inside one
synchronous `better-sqlite3` transaction, which is race-free because
`better-sqlite3` is synchronous and Node is single-threaded — no other
request's handler can run in the middle of that transaction. A slot counts
as taken if there's a `confirmed` booking, or a `pending` one whose
confirmation window hasn't expired — so an abandoned, unconfirmed booking
automatically frees the slot back up once its token expires (default 48h),
with no cleanup job required for correctness.

## Email verification (OTP-via-link, not a code)

Every booking/contact submission gets a 256-bit random token
(`src/tokens.js`); only its SHA-256 hash is stored. The raw token goes out
inside a confirmation *link* in the email
(`GET /bookings/confirm?id=&token=` or `/contact/confirm?...`), never as a
short code. Clicking it is the only way to confirm — there's no code entry
field anywhere. Confirmation is rate-limited (`src/rateLimit.js`, per-IP
limits are env-overridable — see `.env.example`) and the same-email flood
guard in each route caps how many pending requests one address can
generate in 24h, so the flow can't be used to spam confirmation emails at
an arbitrary third party. Email addresses are lowercased before storage
and before the flood-guard lookup, so `Foo@X.com` and `foo@x.com` can't be
used to get two independent budgets against the same real inbox.

Rate limiting only holds if the client's real IP reaches this service
correctly: nginx overwrites (not appends to) `X-Forwarded-For` with its own
`$remote_addr` (`docker/nginx.conf`), and this app trusts exactly that one
hop (`app.set('trust proxy', 1)` in `src/app.js`) — trusting `true` (every
hop) would let a client set its own `X-Forwarded-For` and get a fresh
rate-limit bucket on every request.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/bookings/availability?date=YYYY-MM-DD` | Which of that day's slots are already taken |
| POST | `/bookings` | `{name, email, company?, message?, locale?, slotStart}` -> 201 / 409 (slot taken) / 429 |
| GET | `/bookings/confirm?id=&token=` | Confirmation link target — returns an HTML landing page |
| POST | `/contact` | `{name, email, message, locale?}` -> 201 / 429 |
| GET | `/contact/confirm?id=&token=` | Same pattern as bookings |
| GET | `/health` | Liveness check |

No `resend-confirmation` endpoint exists yet (out of scope for the first
pass) — if a link expires, the visitor just submits a new request for a
(now-freed) slot.

## What's NOT included (by design, not oversight)

- IMAP / inbound mail monitoring — this service only ever sends mail.
- Cancellation/rescheduling of a confirmed booking.
- An admin UI for viewing bookings — the business is notified by email on
  every new/confirmed booking and contact request, which serves as the
  record for now.
