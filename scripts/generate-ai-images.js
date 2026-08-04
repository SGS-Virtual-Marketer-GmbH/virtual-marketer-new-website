#!/usr/bin/env node

/**
 * Photorealistic scene image generator.
 *
 * The feature pages were illustrated only with flat-vector heroes, which read
 * as decoration rather than evidence. These images add a photographic layer
 * showing the actual situation each feature is used in — a warehouse, a
 * studio, a marketing desk — alongside the existing graphics rather than
 * replacing them.
 *
 * NOT part of `npm run build`, deliberately. Generation costs money per image
 * and needs an API key, so a routine site rebuild must never trigger it. Run
 * it explicitly with `npm run images` when the manifest changes.
 *
 * Idempotent: an entry whose output file already exists is skipped. That
 * makes re-runs free and safe, and means adding one prompt regenerates one
 * image rather than all of them. Use --force to regenerate anyway.
 *
 * The try-on sequence is generated differently from the rest. Its whole point
 * is that it is the *same person* wearing different clothes, so the outfit
 * shots are conditioned on the base image (image-to-image) instead of being
 * generated from text alone — text-only prompts produce a different face
 * every time, which would make the demo meaningless.
 *
 * Brand rule (see CLAUDE.md): the engine used to produce these images is
 * never named anywhere on the site. It is an implementation detail of this
 * script, not product copy.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets/product-pages');
const MODEL = 'gemini-3.1-flash-image';
const FORCE = process.argv.includes('--force');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '');

// Shared photographic direction, appended to every prompt so the whole set
// looks like one commissioned shoot rather than sixteen unrelated stock photos.
const STYLE =
  'Photorealistic editorial commercial photography, natural available light, ' +
  'shallow depth of field, muted modern European colour palette with subtle ' +
  'warm tones, candid and un-posed, high detail, shot on a full-frame camera ' +
  'with a 35mm lens. No text overlays, no watermarks, no logos, no user ' +
  'interface mockups floating in the air.';

/**
 * One entry per feature page. `file` matches the page's slug so
 * generate-feature-pages.js can resolve it without a lookup table.
 */
const SCENES = [
  { file: 'produktfotos-ki-scene.jpg', prompt: 'A product photographer and a stylist reviewing clothing shots on a large monitor in a bright photo studio, garment rails and softbox lighting in the background, a mannequin to one side.' },
  { file: 'agenten-scene.jpg', prompt: 'A marketing manager at a standing desk reviewing campaign performance dashboards on two monitors in a modern open-plan office, sticky notes on a glass wall behind.' },
  { file: 'coding-api-scene.jpg', prompt: 'A software developer working in a code editor on a laptop in a quiet modern office, mechanical keyboard, coffee cup, second monitor showing terminal output, warm evening light.' },
  { file: 'feed-veredelung-scene.jpg', prompt: 'An e-commerce operations specialist checking a product catalogue spreadsheet on a laptop in a warehouse office, shelves of boxed retail products visible through a window behind.' },
  { file: 'texte-generieren-scene.jpg', prompt: 'A copywriter working on product descriptions at a wooden desk by a window, notebook and laptop, plants, calm focused atmosphere in a Scandinavian-style workspace.' },
  { file: 'bilder-generieren-scene.jpg', prompt: 'A creative designer reviewing a grid of marketing visuals on a large display in a design studio, colour swatches and printed samples on the desk.' },
  { file: 'videos-generieren-scene.jpg', prompt: 'A video editor working on a timeline in a darkened editing suite, colour-graded footage on the main monitor, subtle blue and warm key lighting.' },
  { file: 'seo-content-scene.jpg', prompt: 'A content strategist reviewing an article outline and search ranking charts on a laptop in a bright café-style office corner.' },
  { file: 'kampagnen-builder-scene.jpg', prompt: 'A small marketing team collaborating around a table covered in printed campaign concepts and storyboards, laptop open, engaged discussion, bright meeting room.' },
  { file: 'interne-verlinkung-scene.jpg', prompt: 'An SEO specialist studying a site structure diagram on a large monitor in a modern office, whiteboard with a link diagram sketched behind.' },
  { file: 'mail-generator-scene.jpg', prompt: 'A CRM manager reviewing an email newsletter draft on a laptop and a phone side by side at a clean desk, morning light through a window.' },
  { file: 'social-publisher-scene.jpg', prompt: 'A social media manager scheduling posts on a laptop with a content calendar visible, smartphone on a tripod nearby, bright creative workspace.' },
  { file: 'bulk-texte-scene.jpg', prompt: 'An e-commerce team lead reviewing a very large product spreadsheet on an ultrawide monitor, focused expression, modern office with warehouse visible behind glass.' },
  { file: 'ki-dateien-scene.jpg', prompt: 'A business analyst reviewing generated reports and presentation slides on a laptop in a bright meeting room, printed documents neatly stacked on the table.' },
  { file: 'feed-optimierung-scene.jpg', prompt: 'A retail merchandiser comparing product listings on a tablet while standing in a warehouse aisle, shelves of boxed goods on both sides.' },
  { file: 'chat-insights-scene.jpg', prompt: 'A customer service team lead reviewing conversation analytics charts on a monitor in a modern support office, headset resting on the desk.' },
];

/**
 * Virtual try-on sequence. The base shot is deliberately a neutral fitted
 * base layer rather than lingerie: that is what production try-on demos use,
 * it keeps the page appropriate for a B2B audience, and it demonstrates the
 * exact same before/after transformation.
 */
const TRYON_BASE = {
  file: 'tryon-base.jpg',
  prompt:
    'Full-body studio photograph of a female fashion fit model standing facing the camera ' +
    'in a plain neutral grey seamless studio background, wearing a simple fitted plain grey ' +
    'sleeveless base-layer top and plain fitted grey shorts, neutral relaxed pose with arms ' +
    'at her sides, even soft studio lighting, full body visible from head to feet, ' +
    'e-commerce fit-model reference photograph.',
};

const TRYON_LOOKS = [
  { file: 'tryon-look-1.jpg', prompt: 'Keep the exact same woman, same face, same hair, same body, same pose, same neutral grey studio background and same lighting. Now she is wearing a tailored navy blazer over a white blouse with matching navy trousers and simple heels. Full body visible, professional e-commerce on-model product photograph.' },
  { file: 'tryon-look-2.jpg', prompt: 'Keep the exact same woman, same face, same hair, same body, same pose, same neutral grey studio background and same lighting. Now she is wearing a casual outfit: an oversized beige knit sweater, blue straight-leg jeans and white sneakers. Full body visible, professional e-commerce on-model product photograph.' },
  { file: 'tryon-look-3.jpg', prompt: 'Keep the exact same woman, same face, same hair, same body, same pose, same neutral grey studio background and same lighting. Now she is wearing an elegant deep red midi dress with a thin belt and dark heeled sandals. Full body visible, professional e-commerce on-model product photograph.' },
];

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  // Falls back to the key the rest of this project's services already use,
  // so there is no second credential to rotate.
  return execFileSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', '--secret=vm-gemini-api-key', '--project=virtual-marketer-chat-bot'],
    { encoding: 'utf-8' }
  ).trim();
}

function request(key, parts) {
  const payload = JSON.stringify({ contents: [{ parts }] });
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${MODEL}:generateContent?key=${key}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    timeout: 300000,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        try {
          const parsed = JSON.parse(body);
          const out = (parsed.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
          if (!out) return reject(new Error('response contained no image'));
          resolve(Buffer.from(out.inlineData.data, 'base64'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.write(payload);
    req.end();
  });
}

/** Normalises to a web-sized progressive JPEG plus a WebP sibling. */
async function save(buffer, file, width) {
  const target = path.join(OUT_DIR, file);
  await sharp(buffer).resize({ width, withoutEnlargement: true }).jpeg({ quality: 82, progressive: true }).toFile(target);
  await sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(target.replace(/\.jpg$/, '.webp'));
  const kb = Math.round(fs.statSync(target).size / 1024);
  return kb;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const key = apiKey();
  if (!key) throw new Error('No API key: set GEMINI_API_KEY or grant access to secret vm-gemini-api-key.');

  console.log(`\n🎨 Generating photorealistic images (${MODEL})\n`);
  let made = 0;
  let skipped = 0;

  const wanted = (f) => !ONLY || f.includes(ONLY);
  const exists = (f) => fs.existsSync(path.join(OUT_DIR, f));

  // --- Feature scenes -----------------------------------------------------
  for (const scene of SCENES) {
    if (!wanted(scene.file)) continue;
    if (exists(scene.file) && !FORCE) { skipped++; continue; }
    process.stdout.write(`   ${scene.file} ... `);
    try {
      const img = await request(key, [{ text: `${scene.prompt} ${STYLE}` }]);
      const kb = await save(img, scene.file, 1600);
      console.log(`${kb} KB`);
      made++;
    } catch (e) {
      console.log(`FAILED — ${e.message}`);
    }
  }

  // --- Try-on sequence ----------------------------------------------------
  const basePath = path.join(OUT_DIR, TRYON_BASE.file);
  if (wanted(TRYON_BASE.file) || TRYON_LOOKS.some((l) => wanted(l.file))) {
    if (!fs.existsSync(basePath) || FORCE) {
      process.stdout.write(`   ${TRYON_BASE.file} ... `);
      const img = await request(key, [{ text: `${TRYON_BASE.prompt} ${STYLE}` }]);
      const kb = await save(img, TRYON_BASE.file, 1000);
      console.log(`${kb} KB`);
      made++;
    } else {
      skipped++;
    }

    // Condition each look on the base image so it is recognisably the same
    // model. Re-read from disk rather than reusing the in-memory buffer, so
    // the looks stay consistent across separate runs too.
    const baseJpeg = fs.readFileSync(basePath).toString('base64');
    for (const look of TRYON_LOOKS) {
      if (!wanted(look.file)) continue;
      if (exists(look.file) && !FORCE) { skipped++; continue; }
      process.stdout.write(`   ${look.file} ... `);
      try {
        const img = await request(key, [
          { inlineData: { mimeType: 'image/jpeg', data: baseJpeg } },
          { text: `${look.prompt} ${STYLE}` },
        ]);
        const kb = await save(img, look.file, 1000);
        console.log(`${kb} KB`);
        made++;
      } catch (e) {
        console.log(`FAILED — ${e.message}`);
      }
    }
  }

  console.log(`\n✅ ${made} image(s) generated, ${skipped} already present (use --force to regenerate)\n`);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
});
