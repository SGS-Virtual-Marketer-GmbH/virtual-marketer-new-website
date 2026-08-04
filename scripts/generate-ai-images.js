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

/**
 * Model gallery for the try-on demo's "choose a model" step.
 *
 * These replace four abstract gradient circles labelled A-D, which told a
 * visitor nothing about what the feature does. A real gallery is also the
 * honest representation of the product: choosing a fit model is the actual
 * step, so the picker should look like the thing it stands for.
 *
 * Deliberately spread across ethnicity, gender and age, and each face is
 * described distinctly enough that no two read as the same person — a row of
 * near-identical models would defeat the point of a gallery. Framed as
 * head-and-shoulders portraits because the picker renders them as circles,
 * where a full-body shot would crop to an unrecognisable torso.
 */

/**
 * Fashion model line-up for the try-on demo.
 *
 * Replaces the earlier six head-and-shoulders portraits. Two things changed:
 *
 *  1. They are full-body now, because the demo's result step has to show the
 *     chosen model wearing the chosen garment in the chosen scene — a
 *     cropped headshot cannot stand in for that.
 *  2. The line-up deliberately spans body types as well as ethnicity and
 *     gender — curvy, lean, athletic, tall, petite — because "you are not
 *     limited to the one model you could book" is the actual pitch, and six
 *     interchangeable slim models would contradict it on sight.
 *
 * Each model gets a distinct look rather than a shared uniform, so the row
 * reads as a casting board instead of a set of variations on one person.
 */
const FASHION_MODELS = [
  { id: 'ruby',  file: 'model-ruby-base.jpg',  pose: 'hand on hip, chin lifted, confident editorial stance',
    who: 'a striking woman in her mid twenties with long wavy copper-red hair and prominent freckles across her face and shoulders, fair skin, slim athletic build',
    look: 'a cream ribbed knit top and high-waisted wide-leg camel trousers with tan boots' },
  { id: 'nadia', file: 'model-nadia-base.jpg', pose: 'one hand in pocket, weight on one leg, relaxed powerful stance',
    who: 'a beautiful curvy Black woman in her late twenties with a voluminous natural afro, warm deep skin tone, full hourglass figure',
    look: 'a tailored emerald green jumpsuit with gold hoop earrings and heeled sandals' },
  { id: 'kai',   file: 'model-kai-base.jpg',   pose: 'arms crossed, shoulder angled to camera, cool streetwear attitude',
    who: 'a handsome East Asian man in his late twenties with an undercut hairstyle, lean sharp features, slim tall build',
    look: 'an oversized charcoal bomber jacket, black tapered trousers and white high-top sneakers' },
  { id: 'marco', file: 'model-marco-base.jpg', pose: 'relaxed beach stance, one hand running through hair, easy smile',
    who: 'a very attractive Mediterranean man in his early thirties with tousled dark hair, light stubble, tanned skin and a defined athletic beach physique',
    look: 'an open linen shirt over swim shorts, barefoot' },
  { id: 'lena',  file: 'model-lena-base.jpg',  pose: 'seated-height relaxed lean, hands clasped, soft approachable posture',
    who: 'a lovely petite Scandinavian woman in her early thirties with a short blonde bob and pale blue eyes, slender frame',
    look: 'a soft oversized grey cashmere sweater dress with white trainers' },
  { id: 'amara', file: 'model-amara-base.jpg', pose: 'walking stride toward camera, fabric in motion, runway energy',
    who: 'a glamorous South Asian woman in her late twenties with long glossy dark hair, warm brown skin, tall statuesque build',
    look: 'a flowing deep burgundy maxi dress with layered gold jewellery' },
];

/**
 * Scenes the demo lets a visitor drop a model into. Keys match the ids used
 * by the "choose a scene" step so the result lookup is a direct index rather
 * than a mapping table that can drift.
 */
const MODEL_SCENES = [
  { id: 'studio', desc: 'a clean professional photo studio with a warm off-white seamless backdrop and soft studio lighting' },
  { id: 'street', desc: 'a bright European city street with blurred shopfronts behind, natural daylight' },
  { id: 'cafe',   desc: 'a stylish café interior with warm wood, plants and soft daylight from a large window' },
];

const MODEL_STUDIO =
  'Full body visible from head to feet, standing on a plain light warm-grey seamless ' +
  'studio backdrop, soft even professional studio lighting, sharp focus, high-end ' +
  'fashion catalogue photography, vertical 3:4 framing.';

const DEMO_MODELS = [
  { file: 'demo-model-1.jpg', prompt: 'Head and shoulders studio portrait of a East Asian woman in her late twenties, long straight black hair, warm confident expression, clear skin, professional fashion model, plain light grey seamless studio background, soft even beauty lighting, facing camera.' },
  { file: 'demo-model-2.jpg', prompt: 'Head and shoulders studio portrait of a Black man in his early thirties, short cropped hair, neat short beard, strong jawline, calm confident expression, professional fashion model, plain light grey seamless studio background, soft even beauty lighting, facing camera.' },
  { file: 'demo-model-3.jpg', prompt: 'Head and shoulders studio portrait of a white woman in her mid twenties, shoulder-length wavy auburn hair, freckles, bright friendly expression, professional fashion model, plain light grey seamless studio background, soft even beauty lighting, facing camera.' },
  { file: 'demo-model-4.jpg', prompt: 'Head and shoulders studio portrait of a South Asian man in his late twenties, thick dark wavy hair, clean shaven, warm approachable smile, professional fashion model, plain light grey seamless studio background, soft even beauty lighting, facing camera.' },
  { file: 'demo-model-5.jpg', prompt: 'Head and shoulders studio portrait of a Latina woman in her early thirties, dark hair tied back, elegant high cheekbones, poised neutral expression, professional fashion model, plain light grey seamless studio background, soft even beauty lighting, facing camera.' },
  { file: 'demo-model-6.jpg', prompt: 'Head and shoulders studio portrait of a Middle Eastern man in his forties, salt and pepper hair, well groomed short beard, distinguished confident expression, professional fashion model, plain light grey seamless studio background, soft even beauty lighting, facing camera.' },
];

/** Backdrops for the demo's "choose a scene" step, and the final result shot. */
const DEMO_SCENES = [
  { file: 'demo-scene-studio.jpg', prompt: 'An empty professional photography studio backdrop, plain warm off-white seamless paper sweep, softbox lighting stands just out of frame, no people.' },
  { file: 'demo-scene-street.jpg', prompt: 'An empty European city street scene on a bright day, blurred shopfronts and pavement, shallow depth of field, no people in frame.' },
  { file: 'demo-scene-cafe.jpg', prompt: 'An empty stylish café interior with warm wood and soft daylight through a large window, an empty table in the foreground, no people.' },
];

const DEMO_RESULT = {
  file: 'demo-result.jpg',
  prompt:
    'Professional e-commerce on-model product photograph: a woman in her late twenties wearing ' +
    'an olive green quilted jacket over a white t-shirt and dark jeans, standing on a bright ' +
    'European city street, natural daylight, sharp focus on the garment, blurred street behind, ' +
    'full body visible, catalogue photography.',
};

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

/**
 * Normalises to a web-sized progressive JPEG plus a WebP sibling.
 *
 * Gallery portraits are additionally forced to a square. The model returns
 * whatever aspect it feels like — this set came back as four 480x860 portraits
 * and two 480x262 landscapes — and the picker renders them as circles, so an
 * un-normalised set crops inconsistently and slices the tops off heads.
 * sharp's `attention` strategy picks the crop window by visual salience, which
 * on a portrait against a plain backdrop reliably lands on the face; a plain
 * centre crop does not, because a head-and-shoulders shot puts the head well
 * above the middle of the frame.
 */
/**
 * Ownership and provenance metadata stamped into every generated file.
 *
 * Re-encoding through sharp drops incoming metadata, so these files shipped
 * with none at all — no author, no copyright, nothing identifying them as
 * Virtual Marketer assets once they leave the site.
 *
 * Note what is deliberately NOT done here: the AI-generated marking is added,
 * not removed. The product page itself states that from 2 August 2026 the EU
 * AI Act requires machine-readable marking of AI-generated images and that
 * Virtual Marketer labels them correctly — quietly stripping that marking off
 * the company's own marketing images would contradict both the regulation and
 * the claim printed next to them. Re-attributing authorship is a branding
 * change; erasing the synthetic-content disclosure would not be.
 */
function brandingMetadata() {
  return {
    exif: {
      IFD0: {
        Artist: 'SGS Virtual Marketer GmbH',
        Copyright: '© SGS Virtual Marketer GmbH — virtual-marketer.de',
        Software: 'Virtual Marketer',
        ImageDescription: 'AI-generated image produced with Virtual Marketer',
      },
    },
  };
}

async function save(buffer, file, width) {
  const target = path.join(OUT_DIR, file);
  const square = file.startsWith('demo-model-');
  const resize = square
    ? { width, height: width, fit: 'cover', position: sharp.strategy.attention }
    : { width, withoutEnlargement: true };

  const meta = brandingMetadata();
  await sharp(buffer).resize(resize).withMetadata(meta).jpeg({ quality: 82, progressive: true }).toFile(target);
  await sharp(buffer).resize(resize).withMetadata(meta).webp({ quality: 80 }).toFile(target.replace(/\.jpg$/, '.webp'));
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

  // --- Feature scenes, demo gallery, demo backdrops and result ------------
  const fashionBase = FASHION_MODELS.map((m) => ({
    file: m.file,
    prompt: `Full-body fashion photograph of ${m.who}, wearing ${m.look}, ${m.pose}. ${MODEL_STUDIO}`,
  }));

  for (const scene of [...SCENES, ...DEMO_MODELS, ...DEMO_SCENES, DEMO_RESULT, ...fashionBase]) {
    if (!wanted(scene.file)) continue;
    if (exists(scene.file) && !FORCE) { skipped++; continue; }
    process.stdout.write(`   ${scene.file} ... `);
    try {
      const img = await request(key, [{ text: `${scene.prompt} ${STYLE}` }]);
      // Gallery portraits render at ~150px in a circle, so a 1600px master is
      // pure waste on a page that already carries a dozen photographs.
      const kb = await save(img, scene.file, scene.file.startsWith('demo-model-') ? 480 : scene.file.startsWith('model-') ? 720 : 1600);
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

  // --- Per-model hover pose and scene variants ---------------------------
  // Both are conditioned on the model's own base frame rather than generated
  // from text. That is the whole point: a hover that swapped in a different
  // face, or a scene that changed the outfit, would read as a bug rather than
  // as the same model repositioned or relocated.
  for (const m of FASHION_MODELS) {
    const basePath = path.join(OUT_DIR, m.file);
    if (!fs.existsSync(basePath)) continue;
    const baseB64 = fs.readFileSync(basePath).toString('base64');
    const conditioned = async (file, instruction, width) => {
      if (!wanted(file)) return;
      if (exists(file) && !FORCE) { skipped++; return; }
      process.stdout.write(`   ${file} ... `);
      try {
        const img = await request(key, [
          { inlineData: { mimeType: 'image/jpeg', data: baseB64 } },
          { text: instruction },
        ]);
        const kb = await save(img, file, width);
        console.log(`${kb} KB`);
        made++;
      } catch (e) {
        console.log(`FAILED — ${e.message}`);
      }
    };

    await conditioned(
      `model-${m.id}-pose.jpg`,
      `Keep the exact same person, same face, same hair, same outfit, same studio background ` +
        `and same lighting as the reference image. Change ONLY the body pose to: ${m.pose}. ` +
        `Full body visible from head to feet. ${STYLE}`,
      720
    );

    for (const sc of MODEL_SCENES) {
      await conditioned(
        `model-${m.id}-${sc.id}.jpg`,
        `Keep the exact same person, same face, same hair and the exact same outfit as the ` +
          `reference image. Place them in ${sc.desc}. Full body visible from head to feet, ` +
          `photographed as an e-commerce on-model product shot. ${STYLE}`,
        900
      );
    }
  }

  console.log(`\n✅ ${made} image(s) generated, ${skipped} already present (use --force to regenerate)\n`);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
});
