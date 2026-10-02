#!/usr/bin/env bash
# Pulls the two things that live outside git: the scraped source site and the
# record of the last deploy.
set -euo pipefail
source /workspace/repo/ci/config.sh
gcloud storage cp "gs://${BUCKET}/state/last-build.json" /workspace/state.json 2>/dev/null || echo '{}' > /workspace/state.json
cat /workspace/state.json; echo
if [ -f /workspace/build.flag ]; then
  mkdir -p /workspace/scrape
  gcloud storage cp -r "gs://${BUCKET}/scrape/virtual-marketer.de" /workspace/scrape/
  echo "scrape files: $(find /workspace/scrape -type f | wc -l)"
fi
