#!/usr/bin/env bash
# Rolls the new image out, smoke-tests it, and rolls back if it does not answer.
set -euo pipefail
source /workspace/repo/ci/config.sh
TAG="$(cat /workspace/tag)"
cd /workspace/repo

PREV=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.latestReadyRevisionName)')
echo "previous revision: $PREV"

sed "s#__WEBSITE_TAG__#${TAG}#g" deploy-service.yaml > /workspace/service.yaml
gcloud run services replace /workspace/service.yaml --region "$REGION" --project "$PROJECT"

URL="https://virtual-marketer.de"
ok=1
for p in / /blog/ /en/ /sitemap.xml /robots.txt; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --retry 3 --retry-delay 5 "${URL}${p}")
  echo "smoke ${p} -> ${code}"
  [ "$code" = "200" ] || ok=0
done

if [ "$ok" != "1" ]; then
  echo "SMOKE TEST FAILED, rolling back to ${PREV}"
  gcloud run services update-traffic "$SERVICE" --to-revisions "${PREV}=100" --region "$REGION" --project "$PROJECT"
  exit 1
fi

# Record what is live, so the next scheduled run can tell whether anything changed.
printf '{"commit":"%s","builtOn":"%s","tag":"%s"}\n' "$(cat /workspace/commit)" "$(cat /workspace/today)" "$TAG" > /workspace/new-state.json
gcloud storage cp /workspace/new-state.json "gs://${BUCKET}/state/last-build.json"

# Keep the registry small: the newest KEEP_IMAGES website images stay.
gcloud artifacts docker images list "$IMAGE_BASE" --include-tags --sort-by=~CREATE_TIME --format='value(version)' --project "$PROJECT" \
  | tail -n +$((KEEP_IMAGES + 1)) \
  | while read -r digest; do
      [ -n "$digest" ] && gcloud artifacts docker images delete "${IMAGE_BASE}@${digest}" --delete-tags --quiet --project "$PROJECT" || true
    done
echo "deployed ${TAG}"
