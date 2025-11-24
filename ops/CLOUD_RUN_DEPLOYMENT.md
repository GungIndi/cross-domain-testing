# Cloud Run Deployment Guide

This guide explains how to deploy the video streaming application to Google Cloud Run for autoscaling testing.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed: https://cloud.google.com/sdk/docs/install
3. **Docker** installed (for local testing)
4. **Project created** in Google Cloud Console

## Quick Start

### 1. Set Up Google Cloud Project

```bash
# Login to gcloud
gcloud auth login

# Set your project ID
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"

# Verify
gcloud config set project ${GCP_PROJECT_ID}
```

### 2. Test Locally with Docker (Optional)

```bash
# Make script executable
chmod +x test-docker-local.sh

# Build and run all services
./test-docker-local.sh

# Or manually with docker-compose
docker-compose up --build

# Test
curl http://localhost:8000
curl http://localhost:8080/videos
curl http://localhost:8081/stream/video1/stream.mpd

# Stop
docker-compose down
```

### 3. Deploy to Cloud Run

```bash
# Make deployment script executable
chmod +x deploy-to-cloudrun.sh

# Deploy all services
./deploy-to-cloudrun.sh
```

The script will:
- ✅ Enable required APIs
- ✅ Build Docker images using Cloud Build
- ✅ Deploy to Cloud Run with autoscaling
- ✅ Configure environment variables
- ✅ Output service URLs

## Cloud Run Configuration

### Streaming Service (Load Testing Target)

```yaml
Memory: 512 MB
CPU: 1
Min Instances: 0
Max Instances: 10
Concurrency: 80 requests/instance
Timeout: 300 seconds
```

**Autoscaling Behavior:**
- Scales from 0 → 10 instances based on load
- Each instance handles up to 80 concurrent requests
- New instances spin up within 5-10 seconds

### Catalog Service

```yaml
Memory: 256 MB
CPU: 1
Min Instances: 0
Max Instances: 5
Concurrency: 80
Timeout: 60 seconds
```

### Frontend Service

```yaml
Memory: 256 MB
CPU: 1
Min Instances: 0
Max Instances: 3
Concurrency: 80
Timeout: 60 seconds
```

## Testing Autoscaling

### Method 1: k6 Load Test

```bash
# Get streaming URL from deployment output
export STREAMING_URL="https://streaming-service-xxx.run.app"

# Run load test
BASE_URL=${STREAMING_URL} k6 run tests/scenario3-load-test.js
```

**What to observe:**
1. Open Cloud Console: https://console.cloud.google.com/run
2. Navigate to `streaming-service` → **Metrics** tab
3. Watch graphs during the test:
   - **Instance count** (should increase from 1 → 5-10)
   - **Request count** (should spike)
   - **Request latency** (should stay < 3s at p95)
   - **CPU utilization** (60-80% per instance)

### Method 2: Artillery (Alternative)

```bash
# Install artillery
npm install -g artillery

# Create test config
cat > load-test-artillery.yml <<EOF
config:
  target: "${STREAMING_URL}"
  phases:
    - duration: 60
      arrivalRate: 20
      name: "Sustained load"
scenarios:
  - name: "Stream video"
    flow:
      - get:
          url: "/stream/video1/stream.mpd"
      - get:
          url: "/stream/video1/chunk-stream0-00001.m4s"
EOF

# Run
artillery run load-test-artillery.yml
```

### Method 3: Apache Bench (Simple)

```bash
# 1000 requests, 50 concurrent
ab -n 1000 -c 50 "${STREAMING_URL}/stream/video1/chunk-stream0-00001.m4s"
```

## Monitoring

### Real-Time Metrics (Cloud Console)

1. Go to: https://console.cloud.google.com/run
2. Click `streaming-service`
3. Go to **Metrics** tab
4. Enable auto-refresh (30s interval)

### Command-Line Monitoring

```bash
# Watch instance count
watch -n 2 'gcloud run services describe streaming-service \
  --region ${GCP_REGION} \
  --platform managed \
  --format="value(status.traffic[0].latestRevision)"'

# View logs in real-time
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=streaming-service"

# Get metrics
gcloud monitoring time-series list \
  --filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count"' \
  --format=json
```

## Cost Estimate

**Free Tier (per month):**
- 2 million requests
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds

**Estimated costs for testing:**
- 1 hour of load testing: **< $0.50**
- Idle time: **$0** (scales to zero)

## Troubleshooting

### Issue: Container fails to start

**Check logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 100
```

**Common causes:**
- Port mismatch (ensure `PORT=8080` in Dockerfile)
- Missing files (video segments not copied)
- OOM (increase memory limit)

### Issue: 502 Bad Gateway

**Cause:** Service not responding in time

**Fix:**
```bash
# Increase timeout
gcloud run services update streaming-service \
  --timeout 300 \
  --region ${GCP_REGION}
```

### Issue: Cold start latency

**Cause:** Service scaled to zero

**Fix:**
```bash
# Set min instances to 1
gcloud run services update streaming-service \
  --min-instances 1 \
  --region ${GCP_REGION}
```

### Issue: Autoscaling not happening

**Check:**
1. Ensure `--max-instances` > 1
2. Verify concurrent requests exceed threshold
3. Check CPU/memory limits aren't too high

## Cleanup

### Delete Services

```bash
# Delete all Cloud Run services
gcloud run services delete frontend --region ${GCP_REGION} --quiet
gcloud run services delete catalog-service --region ${GCP_REGION} --quiet
gcloud run services delete streaming-service --region ${GCP_REGION} --quiet

# Delete container images
gcloud container images delete gcr.io/${GCP_PROJECT_ID}/frontend:latest --quiet
gcloud container images delete gcr.io/${GCP_PROJECT_ID}/catalog-service:latest --quiet
gcloud container images delete gcr.io/${GCP_PROJECT_ID}/streaming-service:latest --quiet
```

### Or use cleanup script:

```bash
chmod +x cleanup-cloudrun.sh
./cleanup-cloudrun.sh
```

## Advanced: Multi-Region Deployment

For even better autoscaling demos:

```bash
# Deploy to multiple regions
for REGION in us-central1 europe-west1 asia-southeast1; do
  gcloud run deploy streaming-service-${REGION} \
    --image gcr.io/${GCP_PROJECT_ID}/streaming-service:latest \
    --region ${REGION} \
    --allow-unauthenticated
done
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - id: auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
      
      - name: Deploy to Cloud Run
        run: ./deploy-to-cloudrun.sh
```

## Resources

- **Cloud Run Docs:** https://cloud.google.com/run/docs
- **Autoscaling:** https://cloud.google.com/run/docs/about-instance-autoscaling
- **Pricing:** https://cloud.google.com/run/pricing
- **Quotas:** https://cloud.google.com/run/quotas
