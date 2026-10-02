#!/usr/bin/env bash
# Builds and deploys main right now, whether or not anything changed.
# Push your commits first: the pipeline always builds what is on GitHub main.
set -euo pipefail
cd "$(dirname "$0")/.."
source ci/config.sh
gcloud builds submit --no-source --config ci/cloudbuild.json --substitutions _FORCE=true \
  --project "$PROJECT" --region "$REGION"
