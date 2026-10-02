#!/usr/bin/env bash
# One-time (idempotent) setup of everything the build pipeline needs in GCP:
# a private bucket, two service accounts with minimal roles, the scrape upload
# and the Cloud Scheduler job. Re-run it after changing ci/cloudbuild.json or
# the schedule: it updates the job in place.
#
#   bash ci/install.sh              create/update everything, scheduler job PAUSED
#   bash ci/install.sh --resume     same, and switch the scheduler on
#
# Needs: gcloud authenticated as an owner of the project.
set -euo pipefail
cd "$(dirname "$0")/.."
source ci/config.sh
SCRAPE_LOCAL="${VM_SOURCE_DIR:-/home/fabian-stamminger/tmp_vm_scrape/virtual-marketer.de}"
RUNTIME_SA="vm-website@${PROJECT}.iam.gserviceaccount.com"
G="--project ${PROJECT}"

echo "== bucket"
gcloud storage buckets describe "gs://${BUCKET}" $G >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://${BUCKET}" $G --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention

echo "== service accounts"
for sa in vm-site-builder vm-site-scheduler; do
  gcloud iam service-accounts describe "${sa}@${PROJECT}.iam.gserviceaccount.com" $G >/dev/null 2>&1 || \
    gcloud iam service-accounts create "$sa" $G --display-name "$sa"
done

echo "== roles (builder)"
bind() { gcloud "$@" --quiet >/dev/null; }
bind projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${BUILDER_SA}" --role roles/logging.logWriter --condition=None
bind projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${BUILDER_SA}" --role roles/run.developer --condition=None
bind storage buckets add-iam-policy-binding "gs://${BUCKET}" --member "serviceAccount:${BUILDER_SA}" --role roles/storage.objectAdmin
bind artifacts repositories add-iam-policy-binding cloud-run-source-deploy $G --location "$REGION" --member "serviceAccount:${BUILDER_SA}" --role roles/artifactregistry.repoAdmin
bind iam service-accounts add-iam-policy-binding "$RUNTIME_SA" $G --member "serviceAccount:${BUILDER_SA}" --role roles/iam.serviceAccountUser

echo "== roles (scheduler)"
bind projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${SCHEDULER_SA}" --role roles/cloudbuild.builds.editor --condition=None
bind iam service-accounts add-iam-policy-binding "$BUILDER_SA" $G --member "serviceAccount:${SCHEDULER_SA}" --role roles/iam.serviceAccountUser

echo "== scrape upload ($(find "$SCRAPE_LOCAL" -type f | wc -l) files)"
gcloud storage rsync --recursive "$SCRAPE_LOCAL" "gs://${BUCKET}/scrape/virtual-marketer.de" $G

echo "== scheduler job"
URI="https://cloudbuild.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/builds"
ARGS=(--project "$PROJECT" --location "$REGION" --schedule "$SCHEDULE" --time-zone "$SCHEDULE_TZ"
      --uri "$URI" --http-method POST --message-body-from-file ci/cloudbuild.json
      --headers "Content-Type=application/json"
      --oauth-service-account-email "$SCHEDULER_SA" --oauth-token-scope https://www.googleapis.com/auth/cloud-platform
      --attempt-deadline 180s --description "Builds and deploys virtual-marketer.de when a commit or a post date requires it (ci/cloudbuild.json)")
if gcloud scheduler jobs describe vm-site-build --project "$PROJECT" --location "$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http vm-site-build "${ARGS[@]}"
else
  gcloud scheduler jobs create http vm-site-build "${ARGS[@]}"
  gcloud scheduler jobs pause vm-site-build --project "$PROJECT" --location "$REGION"
fi
if [ "${1:-}" = "--resume" ]; then
  gcloud scheduler jobs resume vm-site-build --project "$PROJECT" --location "$REGION"
fi
gcloud scheduler jobs describe vm-site-build --project "$PROJECT" --location "$REGION" --format='value(state,schedule)'
