'use strict';

/**
 * Custom-model requests.
 *
 * Replaces the Google Form that /modell-anfragen/ used to embed in a
 * 1000x3000 iframe. Beyond looking like someone else's product in the middle
 * of the page, that embed sent every applicant's business details — domain,
 * feed URLs, example inputs and outputs, i.e. their product data and tone of
 * voice — to a third party the privacy policy does not list as a processor.
 *
 * The field set is a faithful port of that form, branch for branch, so
 * nothing the sales team relies on goes missing:
 *
 *   always        email, customer type, domain, request type
 *   new model     language, descriptive name, goal, example input,
 *                 example output, output format, sources, live feed
 *   existing      exact model name, requested change, goal, further example
 *                 input, further example output, output format, sources,
 *                 live feed
 *
 * Validation mirrors the branch: a field is only required if its branch was
 * chosen. Requiring all of both would reject every valid submission, and
 * requiring none would let an empty request through — this is the one place
 * where the two branches genuinely differ and the code has to know it.
 */

const express = require('express');
const { modelRequests } = require('../db');
const config = require('../config');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const {
  isValidEmail,
  normalizeEmail,
  cleanString,
  cleanOptionalString,
  cleanLocale,
} = require('../validate');
const { submitLimiter, confirmLimiter } = require('../rateLimit');

const router = express.Router();

/** Closed vocabularies, so a crafted POST cannot store arbitrary values. */
const CUSTOMER_TYPES = ['existing', 'new'];
const REQUEST_TYPES = ['new_model', 'modify_model'];
const OUTPUT_FORMATS = ['plain', 'html', 'json'];
const LANGUAGES = [
  'DA', 'DE', 'DK', 'EN', 'ES', 'FI', 'FR', 'IT',
  'NL', 'NO', 'PL', 'PT', 'RO', 'SV', 'SL', 'other',
];

function pick(value, allowed) {
  return allowed.includes(value) ? value : null;
}

/** Fields shared by both branches. */
function commonFields(body) {
  return {
    outputFormat: pick(body.outputFormat, OUTPUT_FORMATS),
    sources: cleanOptionalString(body.sources, { max: 2000 }),
    // "Nein" or a feed URL. Stored as given; the form offers both.
    liveFeed: cleanOptionalString(body.liveFeed, { max: 500 }),
    goal: cleanOptionalString(body.goal, { max: 2000 }),
  };
}

router.post('/', submitLimiter, express.json({ limit: '32kb' }), async (req, res, next) => {
  try {
    const body = req.body || {};

    const email = isValidEmail(body.email) ? normalizeEmail(body.email) : null;
    const customerType = pick(body.customerType, CUSTOMER_TYPES);
    const requestType = pick(body.requestType, REQUEST_TYPES);
    const domain = cleanString(body.domain, { max: 253 });
    const locale = cleanLocale(body.locale);

    if (!email || !customerType || !requestType || !domain) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'email, customerType, requestType and domain are required.',
      });
    }

    const common = commonFields(body);
    let details;

    if (requestType === 'new_model') {
      const language = pick(body.language, LANGUAGES);
      const name = cleanString(body.name, { max: 200 });
      const exampleInput = cleanString(body.exampleInput, { max: 4000 });
      const exampleOutput = cleanString(body.exampleOutput, { max: 4000 });

      if (!language || !name || !common.goal || !exampleInput || !exampleOutput || !common.outputFormat) {
        return res.status(400).json({
          error: 'invalid_input',
          message: 'language, name, goal, exampleInput, exampleOutput and outputFormat are required for a new model.',
        });
      }
      details = { ...common, language, name, exampleInput, exampleOutput };
    } else {
      const modelName = cleanString(body.modelName, { max: 200 });
      const change = cleanString(body.change, { max: 4000 });
      const exampleInput = cleanString(body.exampleInput, { max: 4000 });
      const exampleOutput = cleanString(body.exampleOutput, { max: 4000 });

      if (!modelName || !change || !exampleInput || !exampleOutput || !common.outputFormat) {
        return res.status(400).json({
          error: 'invalid_input',
          message: 'modelName, change, exampleInput, exampleOutput and outputFormat are required to modify a model.',
        });
      }
      details = { ...common, modelName, change, exampleInput, exampleOutput };
    }

    const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
    if ((await modelRequests.countRecentByEmail(email, dayAgo)) >= 5) {
      return res.status(429).json({
        error: 'too_many_requests',
        message: 'Too many model requests for this email address in the last 24 hours.',
      });
    }

    const { raw, hash, expiresAt } = tokens.generateToken();
    const id = await modelRequests.create({
      email,
      customer_type: customerType,
      request_type: requestType,
      domain,
      details,
      locale,
      confirm_token_hash: hash,
      confirm_token_expires_at: expiresAt,
      ip: req.ip,
    });

    const confirmUrl = `${config.publicBaseUrl}/api/model-requests/confirm?id=${id}&token=${raw}`;
    const c = copy(locale);

    // Same double opt-in as the contact form: nothing reaches the sales inbox
    // as "real" until the address is verified, so the endpoint cannot be used
    // to send mail in someone else's name.
    await Promise.allSettled([
      mailer.send({
        to: config.notifyTo,
        subject: `[Modell-Anfrage] ${domain} (${requestType})`,
        text: summaryText({ email, customerType, requestType, domain, details }),
      }),
      mailer.send({
        to: email,
        subject: c.modelRequestSubjectPending,
        text: c.modelRequestCustomerPending({ domain, confirmUrl }),
      }),
    ]);

    res.status(201).json({ id, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

/** Plain-text rendering for the internal notification. */
function summaryText({ email, customerType, requestType, domain, details }) {
  const lines = [
    'Neue Modell-Anfrage (unbestätigt)',
    '',
    `E-Mail:      ${email}`,
    `Kunde:       ${customerType === 'existing' ? 'Bestehender Kunde' : 'Neuer Kunde'}`,
    `Domain:      ${domain}`,
    `Art:         ${requestType === 'new_model' ? 'Neues Modell' : 'Bestehendes Modell anpassen'}`,
    '',
  ];
  for (const [k, v] of Object.entries(details)) {
    if (v) lines.push(`${k}:`, String(v), '');
  }
  lines.push('Die Anfrage ist gespeichert. Der Absender muss die E-Mail-Adresse per Bestätigungslink verifizieren.');
  return lines.join('\n');
}

router.get('/confirm', confirmLimiter, async (req, res, next) => {
  try {
    const { id, token } = req.query;
    const row = await modelRequests.getById(id);
    const locale = row ? row.locale : 'de';

    const ok =
      row &&
      row.status === 'pending' &&
      tokens.isFresh(row.confirm_token_expires_at) &&
      tokens.matches(token, row.confirm_token_hash) &&
      (await modelRequests.confirm(id, new Date().toISOString()));

    if (ok) {
      const c = copy(locale);
      await Promise.allSettled([
        mailer.send({
          to: config.notifyTo,
          subject: `[Modell-Anfrage bestätigt] ${row.domain}`,
          text: summaryText({
            email: row.email,
            customerType: row.customer_type,
            requestType: row.request_type,
            domain: row.domain,
            details: row.details || {},
          }),
        }),
        mailer.send({
          to: row.email,
          subject: c.modelRequestSubjectConfirmed,
          text: c.modelRequestCustomerConfirmed({ domain: row.domain }),
        }),
      ]);
    }

    res
      .status(ok ? 200 : 400)
      .type('html')
      .send(confirmPageHtml({ locale, ok, homeHref: locale === 'en' ? '/en/' : '/' }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
