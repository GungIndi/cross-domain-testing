#!/bin/bash

# Cleanup all Cloud Run deployments and images

set -e

PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"

echo "=========================================="
echo "  Cloud Run Cleanup"
echo "=========================================="
echo ""
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

read -p "This will DELETE all services and images. Continue? (yes/no) " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Delete services
echo ""
echo "[DELETE] Removing Cloud Run services..."

gcloud run services delete frontend \
  --region ${REGION} \
  --platform managed \
  --quiet 2>/dev/null || echo "  Frontend not found"

gcloud run services delete catalog-service \
  --region ${REGION} \
  --platform managed \
  --quiet 2>/dev/null || echo "  Catalog not found"

gcloud run services delete streaming-service \
  --region ${REGION} \
  --platform managed \
  --quiet 2>/dev/null || echo "  Streaming not found"

# Delete images
echo ""
echo "[DELETE] Removing container images..."

gcloud container images delete gcr.io/${PROJECT_ID}/frontend:latest \
  --quiet 2>/dev/null || echo "  Frontend image not found"

gcloud container images delete gcr.io/${PROJECT_ID}/catalog-service:latest \
  --quiet 2>/dev/null || echo "  Catalog image not found"

gcloud container images delete gcr.io/${PROJECT_ID}/streaming-service:latest \
  --quiet 2>/dev/null || echo "  Streaming image not found"

echo ""
echo "✓ Cleanup complete!"
echo ""
