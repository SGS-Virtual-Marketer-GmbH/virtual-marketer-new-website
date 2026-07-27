/**
 * Tailwind config for the two legacy pages that used to load the
 * cdn.tailwindcss.com Play CDN script at runtime (virtual-marketer-ai-services
 * and management). This produces a small, purged, locally-hosted stylesheet
 * instead — see scripts/build-tailwind-services.js / npm run build:tailwind.
 *
 * `content` points at the raw WordPress-scrape source files (outside this
 * repo, see scripts/build.js's SOURCE constant), not dist/, since dist/ is
 * regenerated from scratch on every build and the compiled CSS needs to
 * exist before/independently of that step.
 */
const SOURCE = '/home/fabian-stamminger/tmp_vm_scrape/virtual-marketer.de';

module.exports = {
  content: [
    `${SOURCE}/virtual-marketer-ai-services/index.html`,
    `${SOURCE}/management/index.html`,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
