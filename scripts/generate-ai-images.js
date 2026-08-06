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
/**
 * THE NAMES AND THE CAST ARE THE PRODUCT'S, NOT INVENTED HERE
 *
 * Product Staging ships ten preset models — NOA, SABRINA, AMARA, LENA, YUKI,
 * GRETA, ADAM, MALIK, JONAS, KEN — documented in
 * vm-customer-web-ui/docs/guides/vm-product-staging.md. The website used to
 * show six models of its own naming, so the line-up a visitor saw was not the
 * line-up they would find after signing up. These are the real ten.
 *
 * WHY THE CAST IS NOT TEN BEAUTIFUL TWENTY-FIVE-YEAR-OLDS
 *
 * The competitor research is unusually clear on this. SCAYLE Studios' own FAQ
 * concedes that "more diverse and everyday model appearances" are still in
 * beta, and carries a user asking for exactly that because the generated
 * models look too beautiful to sell to their customers. A shop selling to
 * forty-year-olds cannot use a cast of twenty-five-year-old size-6 models —
 * the clothes do not look like they will look.
 *
 * The product builds custom models from attribute chips including age and
 * body, so it can already do this; the preset cast should show it. GRETA is
 * in her fifties and plus-size, JONAS is an ordinary-build man in his
 * forties. That is a real differentiator against the field, and it is only
 * credible if the pictures show it.
 */
const FASHION_MODELS = [
  { id: 'noa',     file: 'model-noa-base.jpg',     pose: 'hands in pockets, square to camera, calm neutral stance',
    who: 'a striking androgynous model in their mid twenties with a sharp platinum-blonde crop, fair skin, lean frame',
    look: 'a boxy off-white shirt over straight black trousers and black loafers' },
  { id: 'sabrina', file: 'model-sabrina-base.jpg', pose: 'hand on hip, chin lifted, confident editorial stance',
    who: 'a beautiful Latina woman in her early thirties with long dark wavy hair, warm olive skin and a curvy hourglass figure',
    look: 'a rust-red wrap dress with tan heeled sandals' },
  { id: 'amara',   file: 'model-amara-base.jpg',   pose: 'walking stride toward camera, fabric in motion, runway energy',
    who: 'a glamorous Black woman in her late twenties with a voluminous natural afro, warm deep skin tone, tall statuesque build',
    look: 'a flowing deep burgundy maxi dress with layered gold jewellery' },
  { id: 'lena',    file: 'model-lena-base.jpg',    pose: 'relaxed lean, hands clasped, soft approachable posture',
    who: 'a lovely petite Scandinavian woman in her early thirties with a short blonde bob and pale blue eyes, slender frame',
    look: 'a soft oversized grey cashmere sweater dress with white trainers' },
  { id: 'yuki',    file: 'model-yuki-base.jpg',    pose: 'one shoulder angled to camera, arms loose, quiet poise',
    who: 'an elegant East Asian woman in her mid twenties with long straight black hair and clear porcelain skin, slim petite build',
    look: 'a pale blue oversized blazer over a white tee and cropped ecru trousers' },
  { id: 'greta',   file: 'model-greta-base.jpg',   pose: 'standing square, hands relaxed at her sides, warm open expression',
    who: 'a warm, attractive woman in her mid fifties with a silver-grey bob, soft laughter lines and a full plus-size figure, fair skin',
    look: 'a well-cut navy midi dress with a leather belt and low block heels' },
  { id: 'adam',    file: 'model-adam-base.jpg',    pose: 'arms crossed, weight on one leg, easy confidence',
    who: 'a handsome white man in his early thirties with short dark hair, light stubble and a defined athletic build',
    look: 'a charcoal crew-neck knit, dark indigo jeans and brown leather boots' },
  { id: 'malik',   file: 'model-malik-base.jpg',   pose: 'one hand in pocket, shoulder to camera, streetwear attitude',
    who: 'a striking Black man in his late twenties with short twists, deep skin tone and a broad muscular build',
    look: 'an oversized sand-coloured bomber jacket, black tapered trousers and white high-top sneakers' },
  { id: 'jonas',   file: 'model-jonas-base.jpg',   pose: 'standing naturally, hands at his sides, friendly unposed expression',
    who: 'a likeable white man in his mid forties with greying short hair, glasses and an ordinary everyday build with a slight belly',
    look: 'a mid-blue casual shirt worn untucked over chinos and suede sneakers' },
  { id: 'ken',     file: 'model-ken-base.jpg',     pose: 'hands in jacket pockets, chin level, composed editorial stance',
    who: 'a handsome East Asian man in his thirties with an undercut hairstyle, sharp features and a tall slim build',
    look: 'a stone-grey unstructured suit over a black tee and white minimal sneakers' },
];

/**
 * The one comparison that sells this product.
 *
 * Every competitor page leads with the finished on-model shot, which proves
 * nothing on its own — a good photograph is what a photographer sells too.
 * The argument only lands when the input is visible beside it, and the input
 * is deliberately unflattering: the creased, flat-lit packshot on a white
 * sweep that a warehouse phone actually produces. That is the picture a shop
 * recognises as their own.
 *
 * The on-model shot is conditioned on the flat lay rather than written from
 * a prompt, so it is demonstrably the same garment — same colour, same
 * buttons, same collar. A pair generated independently would be two nice
 * photographs of two different shirts, and the page would be making a claim
 * its own illustration quietly breaks.
 */
const BEFORE_AFTER = {
  before: {
    file: 'staging-before-flatlay.jpg',
    prompt:
      'A plain, unglamorous e-commerce packshot: a sage-green cotton button-down shirt laid ' +
      'flat on a plain white background, shot from directly above under flat even light. The ' +
      'shirt is visibly creased and wrinkled from packaging, the sleeves lie slightly unevenly, ' +
      'one collar point curls up. No model, no styling, no props, no shadows of interest — an ' +
      'ordinary catalogue photo taken quickly in a warehouse. Sharp focus, true colour, ' +
      'vertical 3:4 framing.',
  },
  after: {
    file: 'staging-after-onmodel.jpg',
    instruction:
      'Use the garment in the reference image exactly: the same sage-green cotton button-down ' +
      'shirt, the same colour, the same buttons, collar and pocket detail. Now show it worn by ' +
      'an attractive woman in her late twenties with long dark hair, styled well and pressed ' +
      'smooth, tucked into high-waisted cream trousers. She stands on a warm off-white seamless ' +
      'studio backdrop under soft professional lighting, relaxed confident stance, full body ' +
      'visible from head to feet. High-end e-commerce on-model product photograph, sharp focus, ' +
      'vertical 3:4 framing.',
  },
};

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

/**
 * Example outputs shown inside the animated product mockups. Those panes
 * rendered a blue-red CSS gradient behind a blur that "sharpened" — which
 * demonstrated a blur transition rather than the product. Each one is now
 * the kind of asset the feature actually produces.
 */
const DEMO_MOCKUPS = [
  { file: 'demo-imagegen-result.jpg', prompt: 'A dramatic advertising product photograph of a single running shoe on wet asphalt at dusk, reflections in the water, moody rim lighting, commercial campaign look.' },
  { file: 'demo-video-frame.jpg', prompt: 'A cinematic video still from a fashion brand advert: a coat swinging in slow motion on a city street at golden hour, motion blur at the edges, colour graded.' },
  { file: 'demo-email-hero.jpg', prompt: 'A clean e-mail newsletter header image for a lifestyle brand: a flat-lay of autumn apparel and accessories on a warm neutral background, soft daylight, generous empty space at the top for a headline.' },
  { file: 'demo-content-hero.jpg', prompt: 'A blog article hero image about e-commerce content strategy: an open laptop with a product page on screen beside a notebook and coffee on a bright desk, shot from above.' },
];

const DEMO_RESULT = {
  file: 'demo-result.jpg',
  prompt:
    'Professional e-commerce on-model product photograph: a woman in her late twenties wearing ' +
    'an olive green quilted jacket over a white t-shirt and dark jeans, standing on a bright ' +
    'European city street, natural daylight, sharp focus on the garment, blurred street behind, ' +
    'full body visible, catalogue photography.',
};

/**
 * The fit-model reference shot, and the looks derived from it.
 *
 * The reference photo is the one image on the Product Staging page that has a
 * job beyond decoration: it stands in for the single photo a shop would
 * actually upload, so it has to look like a real fit-model reference. That
 * means a skin-tight seamless base layer — the industry's standard garment
 * for the shot, because the whole point is that the silhouette is legible and
 * a subsequent garment can be fitted to it. The earlier version put the model
 * in loose sportswear, which hid exactly what the reference exists to record.
 *
 * POSES NOW VARY BETWEEN LOOKS
 *
 * They used to be pinned ("same pose" in every prompt) so that the set read
 * as one photo with the clothes swapped. Varying the pose is the stronger
 * demonstration — holding a face and a body across a *changed* pose is the
 * hard part, and a catalogue needs more than one stance anyway. The page copy
 * changed with it: it used to promise "gleiche Person, gleiche Pose", which
 * would now be a claim the pictures visibly contradict.
 *
 * Identity is still pinned hard in every prompt, because that is the claim
 * the demo does make, and it is conditioned on the base image rather than
 * generated from text (see the header) for the same reason.
 */
const TRYON_IDENTITY =
  'Keep the exact same woman: identical face, identical facial features and bone structure, ' +
  'identical hair colour and hairstyle, identical skin tone, identical body proportions and ' +
  'height. Same plain neutral grey seamless studio background, same soft even studio lighting. ' +
  'Full body visible from head to feet, sharp focus, high-end e-commerce on-model product ' +
  'photograph, vertical 3:4 framing.';

const TRYON_BASE = {
  file: 'tryon-base.jpg',
  prompt:
    'Full-body studio photograph of a strikingly beautiful professional female fashion fit ' +
    'model in her mid twenties, symmetrical features, defined cheekbones, clear skin, long ' +
    'dark hair smoothly pulled back off the face, toned athletic figure with a well-defined ' +
    'waist. She wears a skin-tight seamless heather-grey sleeveless base-layer top and ' +
    'matching skin-tight grey mid-thigh shorts, both following the body closely so the ' +
    'anatomical silhouette, waistline and hip line are clearly readable — the standard ' +
    'fit-model reference garment. Standing square to the camera on a plain neutral grey ' +
    'seamless studio background, arms relaxed at her sides, feet hip-width apart, barefoot, ' +
    'even soft studio lighting, full body visible from head to feet, sharp focus, high-end ' +
    'e-commerce fit-model reference photograph, vertical 3:4 framing.',
};

/**
 * Alternative reference shots, for choosing between.
 *
 * The reference photo is the one image on the page with a technical job: it
 * stands in for the fit-model shot a shop uploads, and the closer the garment
 * sits to the body the more of the silhouette a later generation has to work
 * from. The shipped version uses a fitted tank and shorts; these two go
 * further, to the seamless compression garments that fit models are actually
 * photographed in.
 *
 * Generated under their own names so the live reference is never overwritten
 * by an experiment — whichever is chosen gets copied over tryon-base.jpg
 * deliberately, and the looks regenerated from it.
 */
/**
 * Skin realism, and the layering a fit model actually wears.
 *
 * Two things were wrong with the first pass. The skin was the giveaway
 * airbrushed look — no pore texture, no tonal variation, an even plastic
 * sheen that reads as generated the moment you look at a forearm. And the
 * model wore nothing under the base layer, which no fit model does; a
 * reference shot with no bra structure under a compression top is a picture
 * of something that does not happen in a studio.
 *
 * The bra matters technically, not decoratively. A garment generated onto
 * this reference inherits what the reference records, so if the reference has
 * no undergarment lines the output has no idea they exist — and shoulder
 * straps and a band under a fitted top are among the most visible things in
 * real apparel photography. Getting them into the reference is what makes a
 * later on-model shot look photographed rather than rendered.
 *
 * The base layer stays opaque. The silhouette is carried by fit and fabric
 * tension — where the knit pulls, where it creases at the waist, where the
 * band sits — which is what a fit reference is for, and is also how these
 * garments photograph in reality.
 */
const TRYON_SKIN =
  'Absolutely photorealistic skin: visible pore texture, fine surface detail, natural subtle ' +
  'unevenness in tone, faint veins on the forearms and the backs of the hands, natural ' +
  'collarbone and shoulder anatomy, realistic knees, ankles and hands with correctly formed ' +
  'fingers. Unretouched editorial quality — no airbrushing, no skin smoothing, no glossy or ' +
  'plastic sheen, no waxy CGI look. Fine natural film grain, realistic studio light falloff ' +
  'and soft contact shadows where the body meets the floor.';

/**
 * What "anatomically correct" means in a fit reference, and what it does not.
 *
 * The useful signal is structure and fabric behaviour: collarbones and the
 * sternal notch, the ribcage under the knit, deltoid and quadriceps
 * definition, correctly built hands and knees and feet, and the places where
 * a compression garment actually deforms — creasing at the waist, the band
 * indenting the hip, seams tracking the body. That is what separates a
 * photograph from a render, and it is what a garment generated onto this
 * reference inherits.
 *
 * Body detail visible through the fabric is not part of that and is not
 * generated here. It would make the picture about the model rather than
 * about the fit, on a page selling catalogue automation to retailers, and
 * the silhouette it would supposedly demonstrate is already carried by the
 * fit itself. The knit stays opaque.
 */
const TRYON_ANATOMY =
  'Anatomically correct and specific: clearly defined collarbones and sternal notch, the ' +
  'ribcage subtly readable under the fabric, real deltoid and bicep definition in the ' +
  'shoulders and arms, quadriceps and calf definition in the legs, correctly structured knees ' +
  'and ankles, anatomically correct hands with five properly formed fingers, natural foot ' +
  'structure with visible tendons. The garment behaves like real compression knit: it creases ' +
  'slightly at the waist and at the hip crease, the waistband indents the skin very slightly, ' +
  'the seams track the body, and the fabric is fully opaque matte jersey with no transparency.';

const TRYON_BASE_VARIANTS = [
  {
    file: 'tryon-base-alt-a4.jpg',
    prompt:
      'Full-body studio photograph of a beautiful professional female fashion fit model in her ' +
      'mid twenties, symmetrical features, defined cheekbones, long dark hair smoothly pulled ' +
      'back into a low ponytail. Lean, strong, athletic physique with a clearly defined waist. ' +
      'She wears a single layer of opaque seamless matte heather-grey compression base layer — ' +
      'a sleeveless scoop-neck top and high-waisted mid-thigh compression shorts — in a ' +
      'second-skin fit, worn on its own with nothing layered over it. ' +
      `${TRYON_ANATOMY} ${TRYON_SKIN} ` +
      'Standing square to the camera on a plain neutral grey seamless studio background, arms ' +
      'relaxed slightly away from the body, feet hip-width apart, barefoot, neutral direct ' +
      'expression. Even soft professional studio lighting from slightly above that models the ' +
      'form and picks out the muscle structure, full body visible from head to feet, shot on a ' +
      'full-frame camera with an 85mm lens, high-end e-commerce fit-model reference ' +
      'photograph, vertical 3:4 framing.',
  },
  {
    file: 'tryon-base-alt-a2.jpg',
    prompt:
      'Full-body studio photograph of a beautiful professional female fashion fit model in her ' +
      'mid twenties, symmetrical features, defined cheekbones, long dark hair smoothly pulled ' +
      'back. Lean, toned athletic physique with visible muscle definition in the shoulders, ' +
      'arms and thighs, defined collarbones and a clearly defined waist. She wears a seamless ' +
      'matte heather-grey compression base layer — a sleeveless scoop-neck top and high-waisted ' +
      'mid-thigh compression shorts — in an opaque second-skin fit, with a grey seamless sports ' +
      'bra worn underneath whose shoulder straps and underband are clearly visible as garment ' +
      'lines through and beneath the top, exactly as a fit model is dressed in a real studio. ' +
      'The knit shows realistic fabric tension: slight creasing at the waist, the shorts band ' +
      'sitting on the hip, the fabric following the ribcage and hip line. ' +
      `${TRYON_SKIN} ` +
      'Standing square to the camera on a plain neutral grey seamless studio background, arms ' +
      'relaxed slightly away from the body, feet hip-width apart, barefoot. Even soft ' +
      'professional studio lighting that models the form, full body visible from head to feet, ' +
      'sharp focus, high-end e-commerce fit-model reference photograph, vertical 3:4 framing.',
  },
  {
    file: 'tryon-base-alt-a3.jpg',
    prompt:
      'Full-body studio photograph of a beautiful professional female fashion fit model in her ' +
      'late twenties, natural features, dark hair in a smooth low bun, a few loose strands. ' +
      'Athletic toned physique, defined collarbones, natural shoulder and arm musculature. She ' +
      'wears an opaque seamless matte grey compression base layer — a racerback sleeveless top ' +
      'and high-waisted mid-thigh compression shorts — over a grey seamless sports bra whose ' +
      'straps and underband read clearly as garment lines beneath the top, the way a fit model ' +
      'is actually dressed. Realistic fabric behaviour: the knit creases slightly at the waist ' +
      'and hip, the waistband indents very slightly, the seams follow the body. ' +
      `${TRYON_SKIN} ` +
      'Standing square to the camera on a plain warm-grey seamless studio background, arms at ' +
      'her sides, feet hip-width apart, barefoot, neutral direct expression. Soft large-source ' +
      'studio lighting from slightly above, full body visible from head to feet, shot on a ' +
      'full-frame camera with an 85mm lens, high-end e-commerce fit-model reference photograph, ' +
      'vertical 3:4 framing.',
  },
  {
    file: 'tryon-base-alt-a.jpg',
    prompt:
      'Full-body studio photograph of a strikingly beautiful professional female fashion fit ' +
      'model in her mid twenties, symmetrical features, defined cheekbones, clear skin, long ' +
      'dark hair smoothly pulled back. Lean, toned athletic physique with visible muscle ' +
      'definition in the shoulders, arms and legs and a clearly defined waist. She wears a ' +
      'seamless matte heather-grey compression base layer — a sleeveless scoop-neck top and ' +
      'high-waisted mid-thigh compression shorts — in a second-skin fit that follows the body ' +
      'closely, so the shoulder line, ribcage, waist, hip line and thigh contour all read ' +
      'clearly through the fabric. Standing square to the camera on a plain neutral grey ' +
      'seamless studio background, arms relaxed slightly away from the body, feet hip-width ' +
      'apart, barefoot. Even soft professional studio lighting that models the form, full body ' +
      'visible from head to feet, sharp focus, high-end e-commerce fit-model reference ' +
      'photograph, vertical 3:4 framing.',
  },
  {
    file: 'tryon-base-alt-b.jpg',
    prompt:
      'Full-body studio photograph of a strikingly beautiful professional female fashion fit ' +
      'model in her mid twenties, symmetrical features, clear skin, dark hair in a smooth low ' +
      'bun. Lean, toned athletic physique. She wears a one-piece seamless matte heather-grey ' +
      'compression bodysuit with long sleeves and full-length leggings, a true second-skin fit ' +
      'from wrist to ankle, so the complete body silhouette — shoulders, bust line, ribcage, ' +
      'waist, hips, thighs and calves — is legible through the fabric with no loose material ' +
      'anywhere. Standing square to the camera on a plain neutral grey seamless studio ' +
      'background, arms relaxed at her sides, feet hip-width apart, barefoot. Even soft ' +
      'professional studio lighting that models the form, full body visible from head to feet, ' +
      'sharp focus, high-end e-commerce fit-model reference photograph, vertical 3:4 framing.',
  },
];

const TRYON_LOOKS = [
  {
    file: 'tryon-look-1.jpg',
    prompt:
      `${TRYON_IDENTITY} Now she wears a sharply tailored navy trouser suit over a white silk ` +
      'blouse with pointed black heels. New pose: three-quarter turn to the camera, one hand ' +
      'in her trouser pocket, weight on the back leg, chin level, confident editorial stance.',
  },
  {
    file: 'tryon-look-2.jpg',
    prompt:
      `${TRYON_IDENTITY} Now she wears an oversized cream cable-knit sweater, blue straight-leg ` +
      'jeans and white leather sneakers. New pose: mid-stride walking towards the camera, ' +
      'one arm swinging, hair and fabric in slight motion, relaxed natural expression.',
  },
  {
    file: 'tryon-look-3.jpg',
    prompt:
      `${TRYON_IDENTITY} Now she wears an elegant deep red satin midi dress with a thin belt ` +
      'and dark strappy heeled sandals. New pose: standing tall with one hand on her hip, the ' +
      'other arm relaxed, shoulders angled, chin slightly lifted, poised runway stance.',
  },
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

  for (const scene of [...SCENES, ...DEMO_MODELS, ...DEMO_SCENES, DEMO_RESULT, ...DEMO_MOCKUPS, ...fashionBase]) {
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

  // Candidate reference shots. Text-only, and never written over the live
  // tryon-base.jpg — adopting one is a deliberate copy, not a side effect.
  for (const variant of TRYON_BASE_VARIANTS) {
    if (!wanted(variant.file)) continue;
    if (exists(variant.file) && !FORCE) { skipped++; continue; }
    process.stdout.write(`   ${variant.file} ... `);
    try {
      const img = await request(key, [{ text: `${variant.prompt} ${STYLE}` }]);
      const kb = await save(img, variant.file, 1000);
      console.log(`${kb} KB`);
      made++;
    } catch (e) {
      console.log(`FAILED — ${e.message}`);
    }
  }

  // Flat lay in, on-model out. The second is conditioned on the first so the
  // page's own illustration cannot contradict the claim it illustrates.
  const flatPath = path.join(OUT_DIR, BEFORE_AFTER.before.file);
  if (wanted(BEFORE_AFTER.before.file) || wanted(BEFORE_AFTER.after.file)) {
    if (!fs.existsSync(flatPath) || FORCE) {
      process.stdout.write(`   ${BEFORE_AFTER.before.file} ... `);
      // No STYLE here on purpose: the shared photographic direction asks for
      // editorial lighting and shallow depth of field, and this image has to
      // look like the opposite of that.
      const img = await request(key, [{ text: BEFORE_AFTER.before.prompt }]);
      const kb = await save(img, BEFORE_AFTER.before.file, 800);
      console.log(`${kb} KB`);
      made++;
    } else {
      skipped++;
    }

    if (wanted(BEFORE_AFTER.after.file) && (!exists(BEFORE_AFTER.after.file) || FORCE)) {
      process.stdout.write(`   ${BEFORE_AFTER.after.file} ... `);
      try {
        const img = await request(key, [
          { inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(flatPath).toString('base64') } },
          { text: BEFORE_AFTER.after.instruction },
        ]);
        const kb = await save(img, BEFORE_AFTER.after.file, 800);
        console.log(`${kb} KB`);
        made++;
      } catch (e) {
        console.log(`FAILED — ${e.message}`);
      }
    } else if (exists(BEFORE_AFTER.after.file)) {
      skipped++;
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
