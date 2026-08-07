# Moving off Cloud Run to Strato — evaluation

**Status:** assessment only. Nothing has been migrated.
**Date:** 2026-08-07

## The short version — measured, and the answer is no

**Do not move. It would cost roughly 30–100× more, not less.**

The Cloud Billing API is disabled on the project, so the invoice could not be
read directly. Usage was measured instead, from Cloud Monitoring, for the
`virtual-marketer-website` service over the 30 days to 7 August 2026:

| Metric | 30-day usage | Cloud Run free tier / month | Used |
|---|---|---|---|
| Requests | 31,758 | 2,000,000 | 1.6% |
| CPU allocation | 5,225 vCPU-s | 180,000 vCPU-s | 2.9% |
| Memory allocation | 2,603 GiB-s | 360,000 GiB-s | 0.7% |
| Egress | 0.26 GiB | — | — |

Everything sits inside the free tier. And ignoring the free tier completely —
paying full europe-west1 list price on every unit — the site costs:

```
CPU       5,225.3 vCPU-s  × $0.000024   = $0.125
Memory    2,602.7 GiB-s   × $0.0000025  = $0.007
Requests  0.0318 M        × $0.40       = $0.013
Egress    0.26 GiB        × ~$0.12      = $0.031
                                        ---------
                                          ≈ $0.18 / month
```

Plus a few cents of Artifact Registry for the images. Call it **under €0.25 a
month, worst case.** A Strato V-Server is €5–20 a month, so the move increases
hosting cost by a factor of 30 to 100 — before counting the 3–4 days of work
and the ongoing operations burden it transfers onto you.

### If the GCP bill looks large, this site is not why

`virtual-marketer-chat-bot` runs at least twelve Cloud Run services —
`denta-tec-chat`, `denta-tec-voice-agent`, `genic-ch`, `self-reliance-app`,
`australian-labradoodle-kaufen`, `virtual-marketer-ai-text-generator-2-0`,
`virtual-marketer-authenticator-service` and others — plus the AI API usage
behind the product. Those share one invoice with the marketing site.

Whatever that invoice says, the marketing website is a rounding error in it.
Moving the site to Strato would not measurably change it. If cost reduction is
the goal, the place to look is the AI API spend and the idle services, not
where 52 MB of static HTML is served from.

## Everything below was written before the usage was measured

It is kept because it is still the correct plan *if* the site ever has to move
for a reason other than cost — a customer contract requiring German hosting,
for example, which is a real possibility given the data-residency clause the
privacy policy already offers.

## What is actually running today

| Piece | What it is |
|---|---|
| `virtual-marketer-website` | nginx serving 52 MB of static files (98.5 MB image) |
| `virtual-marketer-api` | Express sidecar, reached over loopback — not publicly exposed |
| Firestore | Where bookings and contact submissions are stored |
| Secret Manager | SMTP credentials, `vm-gemini-api-key` |
| Cloud Run | TLS certificates, autoscaling, scale-to-zero, OS patching |
| 1blu | MX, DKIM, and the SMTP relay the API sends through |

The API's only dependencies are `express`, `express-rate-limit`, `nodemailer`
and `@google-cloud/firestore`. Node ≥ 18.

## The question that decides everything: which Strato product?

Strato sells three things and they are not interchangeable here.

### Shared hosting ("Webhosting") — **the backend cannot run**

PHP and MySQL, no root, no long-running Node process, no Docker. The static
site would serve fine. The booking form, the contact form and the double
opt-in flow would all stop working, because there is nowhere to run
`backend/src`.

Going this route means rewriting the backend in PHP against MySQL. That is a
rewrite of working, security-reviewed, test-covered code, and it would need
its own security review — the existing one does not transfer. Not recommended
unless the hosting is already paid for and the forms are genuinely optional.

### V-Server / VPS — **everything can run**

Root access, so Docker works and the existing images run essentially
unchanged. This is the only version of the move that is a migration rather
than a rewrite.

### Dedicated server — same as V-Server, more machine than this needs.

## What has to be built, on a V-Server

Assuming the V-Server branch, none of this is exotic, but none of it is free
either.

**1. TLS.** Cloud Run issues and renews certificates with no involvement.
On Strato: certbot plus a renewal timer, and a monitor for when renewal
fails — an expired certificate takes the whole site down and the failure mode
is silent until it is not.

**2. Firestore — the real decision.** Two options, and they are genuinely
different:

- *Keep Firestore.* Least work: the code does not change. But a service
  account key file now lives on the Strato box, which is a credential to
  protect that Cloud Run handled implicitly through workload identity. You
  also keep paying Google, add cross-provider latency to every write, and pay
  egress. The saving shrinks.
- *Move to Postgres or SQLite on the box.* Removes Google entirely, which is
  the only version where the bill genuinely goes to zero. But this repo
  already migrated *from* SQLite *to* Firestore deliberately, so it reverses a
  considered decision, and it introduces backups as something a human now owns.

**3. Deployment.** Today: `docker build` → push → `gcloud run services
replace`, with a version tag and a one-command rollback. On Strato this has to
be written — rsync over SSH, or Docker plus compose. Rollback has to be
designed rather than assumed.

**4. Secrets.** Secret Manager becomes an env file on disk, with file
permissions as the only thing protecting it.

**5. Everything Cloud Run was doing silently.** OS patching, nginx upgrades,
log rotation, disk monitoring, uptime alerting, backups, and absorbing traffic
spikes. A V-Server has a fixed ceiling where Cloud Run autoscales; a launch or
a crawl that would have cost a few cents in Cloud Run instead takes the site
down.

**6. nginx config.** `docker/nginx.conf` and `docker/security-headers.conf`
carry the security headers, the bot rules that still allow search crawlers,
and the WordPress query-string-in-filename handling. These transfer as-is on a
V-Server, and not at all on shared hosting.

## Rough effort

| Task | V-Server | Shared hosting |
|---|---|---|
| Static site across | half a day | half a day |
| TLS + renewal + monitoring | half a day | provided |
| Backend running | half a day (Docker) | **rewrite in PHP** |
| Firestore decision + any data migration | half a day to two days | two days+ |
| Deploy script + rollback | half a day | half a day |
| DNS cutover + verification | half a day | half a day |
| **Total** | **~3–4 days** | **~2 weeks, plus a new security review** |

## Recommendation

Do not start until two facts are in:

1. **The actual Cloud Run bill for a normal month.** Billing console →
   virtual-marketer-chat-bot. If it is under about €10, this move loses money
   once the ops time is counted.
2. **Which Strato product it is.** Shared hosting and a V-Server are different
   projects, not different sizes of the same project.

If it is a V-Server *and* the Cloud Run bill is meaningful, the move is
reasonable and takes about 3–4 days. The cleanest shape is: static site and
API in Docker on the V-Server, Postgres on the same box replacing Firestore,
certbot for TLS, and 1blu unchanged for mail.

If it is shared hosting, the honest recommendation is a split: serve the
static site from Strato and leave the API on Cloud Run. The API is tiny and
scales to zero, so it costs almost nothing on its own, and nothing has to be
rewritten.

## Do not cancel 1blu either way

MX, DKIM and the booking-confirmation SMTP relay (`smtp.1blu.de`, user
`b321726_0-ai-mailer`) all still live there. Mail is independent of where the
site is hosted.
