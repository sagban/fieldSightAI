#!/bin/bash
set -euo pipefail

# One-click GCP deployment script for FieldSight AI
# - Builds the React frontend
# - Deploys the FastAPI backend to Cloud Run using gcloud buildpacks
#
# Prerequisites:
# - gcloud CLI installed
# - You have run:
#     gcloud auth login
#     gcloud auth application-default login
#     gcloud config set project YOUR_PROJECT_ID
# - .env.local populated with GEMINI_API_KEY and GCP settings (see .env.example)

cd "$(dirname "$0")/.."

### Configuration (edit these for your project) ################################

PROJECT_ID="${PROJECT_ID:-your-gcp-project-id}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-fieldsight-ai}"
# Required for Agent 2 + File Search. Set here or in .env.local (loaded below).
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
# Optional: File Search store name. Can be a resource name or display_name
# (seed_stores.py will create and print this).
FILE_SEARCH_STORE_NAME="${FILE_SEARCH_STORE_NAME:-}"

###############################################################################

echo "📦 Building frontend..."
npm install
npm run build

# Copy built UI into backend so Cloud Run image (source=backend) can serve it
rm -rf backend/dist
cp -r dist backend/dist

# Load environment from .env.local if present
if [ -f ".env.local" ]; then
  echo "🔑 Loading environment from .env.local"
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | xargs -0 printf '%s\n' 2>/dev/null || grep -v '^#' .env.local | xargs)
else
  echo "⚠️  .env.local not found. Set GEMINI_API_KEY and other vars in this script or your shell."
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "⚠️  GEMINI_API_KEY is not set. Agent 2 and File Search will not work until you set it in Cloud Run."
  if [ -t 0 ]; then
    read -r -p "Continue deployment anyway? [y/N] " confirm
    if [[ ! "${confirm}" =~ ^[yY] ]]; then
      echo "Aborted."
      exit 1
    fi
  fi
fi

echo "🔐 Ensuring build service account has IAM permissions (storage + Cloud Build)..."
BUILD_SA="${PROJECT_ID}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/storage.admin" >/dev/null 2>&1 || true

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/cloudbuild.builds.builder" >/dev/null 2>&1 || true

echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run (region: ${REGION}, project: ${PROJECT_ID})..."

gcloud run deploy "${SERVICE_NAME}" \
  --source backend \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --session-affinity \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT:-$PROJECT_ID}" \
  --set-env-vars "GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-$REGION}" \
  --set-env-vars "FILE_SEARCH_STORE_NAME=${FILE_SEARCH_STORE_NAME}" \
  --set-env-vars "LIVE_MODEL=${LIVE_MODEL:-gemini-live-2.5-flash-native-audio}" \
  --set-env-vars "LIVE_SESSION_TIMEOUT_SECONDS=${LIVE_SESSION_TIMEOUT_SECONDS:-180}"

echo "✅ Deployment command finished."
echo "   Run: gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format='value(status.url)'"
echo "   to get the public URL."

