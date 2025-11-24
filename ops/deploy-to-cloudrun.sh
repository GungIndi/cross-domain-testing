#!/bin/bash

# Deploy all services to Google Cloud Run
# Run this script to deploy the entire video streaming application

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
IMAGE_PREFIX="gcr.io/${PROJECT_ID}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;36m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "  Cloud Run Deployment Script"
echo "=========================================="
echo -e "${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${YELLOW}⚠ gcloud CLI not installed${NC}"
    echo "Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${YELLOW}[CONFIG]${NC} Using Project: ${PROJECT_ID}"
echo -e "${YELLOW}[CONFIG]${NC} Using Region: ${REGION}"
echo ""

# Confirm project
read -p "Is this correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set GCP_PROJECT_ID and GCP_REGION environment variables"
    echo "Example: export GCP_PROJECT_ID=my-project"
    exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo ""
echo -e "${YELLOW}[SETUP]${NC} Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
echo -e "${GREEN}✓ APIs enabled${NC}"

# ============================================================
# 1. Build and Push Images
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  Building and Pushing Images"
echo "==========================================${NC}"
echo ""

# Frontend
echo -e "${YELLOW}[BUILD]${NC} Building frontend image..."
cd frontend
gcloud builds submit --tag ${IMAGE_PREFIX}/frontend:latest .
cd ..
echo -e "${GREEN}✓ Frontend image built${NC}"

# Catalog Service
echo -e "${YELLOW}[BUILD]${NC} Building catalog service image..."
cd apps/video-catalog-service
gcloud builds submit --tag ${IMAGE_PREFIX}/catalog-service:latest .
cd ../..
echo -e "${GREEN}✓ Catalog service image built${NC}"

# Streaming Service
echo -e "${YELLOW}[BUILD]${NC} Building streaming service image..."
cd apps/streaming-service
gcloud builds submit --tag ${IMAGE_PREFIX}/streaming-service:latest .
cd ../..
echo -e "${GREEN}✓ Streaming service image built${NC}"

# ============================================================
# 2. Deploy to Cloud Run
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  Deploying to Cloud Run"
echo "==========================================${NC}"
echo ""

# Deploy Streaming Service (most important for autoscaling test)
echo -e "${YELLOW}[DEPLOY]${NC} Deploying streaming service..."
gcloud run deploy streaming-service \
  --image ${IMAGE_PREFIX}/streaming-service:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "PORT=8080"

STREAMING_URL=$(gcloud run services describe streaming-service \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo -e "${GREEN}✓ Streaming service deployed${NC}"
echo -e "  URL: ${STREAMING_URL}"

# Deploy Catalog Service
echo ""
echo -e "${YELLOW}[DEPLOY]${NC} Deploying catalog service..."
gcloud run deploy catalog-service \
  --image ${IMAGE_PREFIX}/catalog-service:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --timeout 60 \
  --set-env-vars "PORT=8080"

CATALOG_URL=$(gcloud run services describe catalog-service \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo -e "${GREEN}✓ Catalog service deployed${NC}"
echo -e "  URL: ${CATALOG_URL}"

# Deploy Frontend
echo ""
echo -e "${YELLOW}[DEPLOY]${NC} Deploying frontend service..."
gcloud run deploy frontend \
  --image ${IMAGE_PREFIX}/frontend:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 60 \
  --set-env-vars "PORT=8080,CATALOG_URL=${CATALOG_URL},STREAMING_URL=${STREAMING_URL}"

FRONTEND_URL=$(gcloud run services describe frontend \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo -e "${GREEN}✓ Frontend service deployed${NC}"
echo -e "  URL: ${FRONTEND_URL}"

# ============================================================
# 3. Update Frontend Config
# ============================================================

echo ""
echo -e "${YELLOW}[NOTE]${NC} Update frontend app.js with Cloud Run URLs:"
echo ""
echo "CATALOG_URL: ${CATALOG_URL}"
echo "STREAMING_URL: ${STREAMING_URL}"
echo ""

# ============================================================
# 4. Summary
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo -e "${GREEN}Service URLs:${NC}"
echo ""
echo "Frontend:  ${FRONTEND_URL}"
echo "Catalog:   ${CATALOG_URL}"
echo "Streaming: ${STREAMING_URL}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Test the application:"
echo "   curl ${STREAMING_URL}/stream/video1/stream.mpd"
echo ""
echo "2. Run load test:"
echo "   BASE_URL=${STREAMING_URL} k6 run tests/scenario3-load-test.js"
echo ""
echo "3. Monitor autoscaling:"
echo "   https://console.cloud.google.com/run/detail/${REGION}/streaming-service/metrics?project=${PROJECT_ID}"
echo ""
echo "4. View logs:"
echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=streaming-service\" --limit 50"
echo ""

# Save URLs to file
cat > deployment-urls.txt <<EOF
Frontend URL: ${FRONTEND_URL}
Catalog URL: ${CATALOG_URL}
Streaming URL: ${STREAMING_URL}
Project: ${PROJECT_ID}
Region: ${REGION}
Deployed: $(date)
EOF

echo -e "${GREEN}✓ URLs saved to deployment-urls.txt${NC}"
echo ""
