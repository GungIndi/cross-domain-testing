# Operations Scripts & Deployment Files

This directory contains all deployment and operations-related scripts for the video streaming application.

## Contents

- **`docker-compose.yml`** - Local Docker orchestration
- **`deploy-to-cloudrun.sh`** - Automated Cloud Run deployment
- **`cleanup-cloudrun.sh`** - Cloud Run resource cleanup
- **`test-docker-local.sh`** - Quick Docker testing script
- **`CLOUD_RUN_DEPLOYMENT.md`** - Complete deployment guide

## Quick Usage

Instead of running these scripts directly, use the **Makefile** in the project root:

```bash
# Deploy to Cloud Run
make deploy

# Test locally with Docker
make docker-test

# Clean up Cloud Run resources
make clean-cloudrun
```

See the root `Makefile` for all available commands.

## Manual Script Execution

If you prefer to run scripts directly:

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"

# Deploy to Cloud Run
./deploy-to-cloudrun.sh

# Test Docker locally
./test-docker-local.sh

# Cleanup
./cleanup-cloudrun.sh
```

## Docker Compose

Run all services locally:

```bash
docker-compose up --build
```

Or use the Makefile:

```bash
make demo
```
