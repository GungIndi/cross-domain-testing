# Video Streaming Application - Cross-Domain Testing Demo

A minimal video streaming system demonstrating cross-domain testing strategies across Application, Architecture, and Environment layers.

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
make install-deps

# Or manually install
npm install puppeteer
brew install k6  # macOS
# apt-get install k6  # Linux
```

### 2. Run the Application

**Option A: Using Makefile (Recommended)**

```bash
# Start all services with Docker
make demo

# Or start individually in separate terminals
make run-frontend    # Terminal 1
make run-catalog     # Terminal 2
make run-streaming   # Terminal 3
```

**Option B: Manual Go**

```bash
# Terminal 1 - Frontend
cd frontend && go run main.go

# Terminal 2 - Catalog
cd apps/video-catalog-service && go run main.go

# Terminal 3 - Streaming
cd apps/streaming-service && go run main.go
```

### 3. Access the Application

Open your browser: **http://localhost:8000**

### 4. Run Tests

```bash
# Run all automated tests
make test-all

# Or run individually
make test-missing-segment    # Scenario 1
make test-abr                # Scenario 2
make test-load               # Scenario 3
```

## Architecture

```
┌─────────────────┐
│  Web Browser    │  ← Application Domain
│  (dash.js ABR)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Microservices                  │  ← Architecture Domain
│  • Frontend (8000)              │
│  • Catalog (8080)               │
│  • Streaming (8081)             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Cloud Run /    │  ← Environment Domain
│  Docker         │
└─────────────────┘
```

## Project Structure

```
demo-specialized-testing/
├── Makefile                    # All commands here!
├── README.md                   # This file
├── frontend/                   # Frontend service
│   ├── Dockerfile
│   ├── main.go
│   └── static/
│       ├── index.html
│       └── app.js
├── apps/
│   ├── video-catalog-service/  # Catalog API
│   │   ├── Dockerfile
│   │   └── main.go
│   └── streaming-service/      # Video streaming service
│       ├── Dockerfile
│       ├── main.go
│       ├── videos/             # Original videos
│       └── videos_dash/        # DASH segments
├── tests/                      # Automated test scripts
│   ├── README.md
|   ├── TEST_CASES.md           # Detailed test specifications
│   ├── scenario1-missing-segment.sh
│   ├── scenario2-abr-test.js
│   ├── scenario3-load-test.js
│   └── run-all-tests.sh
└── ops/                        # Deployment & operations
    ├── README.md
    ├── docker-compose.yml
    ├── deploy-to-cloudrun.sh
    ├── cleanup-cloudrun.sh
    └── CLOUD_RUN_DEPLOYMENT.md
```

## Makefile Commands

Run `make help` to see all available commands:

### Development
- `make run-frontend` - Start frontend service
- `make run-catalog` - Start catalog service
- `make run-streaming` - Start streaming service
- `make build-all` - Build all Go binaries
- `make status` - Check service health

### Docker
- `make demo` - Quick demo with Docker (recommended)
- `make docker-build` - Build Docker images
- `make docker-up` - Start all services
- `make docker-down` - Stop all services
- `make docker-logs` - View logs

### Testing
- `make test-all` - Run all test scenarios
- `make test-missing-segment` - Test missing segment handling
- `make test-abr` - Test ABR quality switching
- `make test-load` - Load test with k6

### Cloud Run
- `make deploy` - Deploy to Google Cloud Run
- `make deploy-streaming` - Deploy streaming service only
- `make cloud-logs` - View Cloud Run logs
- `make clean-cloudrun` - Delete Cloud Run resources

### Cleanup
- `make clean` - Remove build artifacts
- `make clean-docker` - Remove Docker resources

## Testing Scenarios

### Scenario 1: Missing Segment (Application × Architecture × Environment)

Tests error propagation when a video segment is missing.

```bash
make test-missing-segment
```

**Expected:** 404 error, player skips/buffers, service stays healthy.

### Scenario 2: Network Latency (Environment × Application)

Tests ABR quality switching under throttled network.

```bash
make test-abr
```

**Expected:** Quality switches from 720p → 240p when throttled, back to 720p when restored.

### Scenario 3: Scalability (Architecture × Environment)

Tests autoscaling under load (40 concurrent users).

```bash
make test-load
```

**Expected:** < 10% errors, p95 latency < 3s, service scales up.

## Cloud Run Deployment

### Prerequisites

1. Google Cloud account with billing
2. `gcloud` CLI installed
3. Set environment variables:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
```

### Deploy

```bash
# Deploy all services
make deploy GCP_PROJECT_ID=your-project-id

# Or use the script directly
cd ops && ./deploy-to-cloudrun.sh
```

### Test Autoscaling

```bash
# Run load test against Cloud Run
make test-load-cloud STREAMING_URL=https://streaming-service-xxx.run.app

# Monitor in Cloud Console
make cloud-metrics
```

See `ops/CLOUD_RUN_DEPLOYMENT.md` for detailed instructions.

## Technology Stack

- **Backend:** Go 1.21+
- **Frontend:** HTML5, JavaScript, dash.js
- **Video:** MPEG-DASH (2-second segments)
- **Containerization:** Docker
- **Cloud:** Google Cloud Run
- **Testing:** k6, Puppeteer, Bash

## Key Features

✅ **Custom ABR Logic** - Manual adaptive bitrate control  
✅ **Cross-Domain Testing** - Tests spanning multiple layers  
✅ **Automated Tests** - No manual browser interaction needed  
✅ **Docker Support** - Local testing with docker-compose  
✅ **Cloud Run Ready** - Autoscaling demonstration  
✅ **Comprehensive Docs** - Test cases, deployment guides  

## Documentation

- **[TEST_CASES.md](TEST_CASES.md)** - Detailed test case specifications
- **[ops/CLOUD_RUN_DEPLOYMENT.md](ops/CLOUD_RUN_DEPLOYMENT.md)** - Cloud deployment guide
- **[tests/README.md](tests/README.md)** - Test automation guide

## Troubleshooting

### Services not starting

```bash
# Check if ports are in use
lsof -i :8000
lsof -i :8080
lsof -i :8081

# Kill processes if needed
kill -9 <PID>
```

### Video segments missing

```bash
# Regenerate DASH files
make generate-dash
```

### Docker issues

```bash
# Reset Docker
make clean-docker
make docker-build
```

### Test failures

```bash
# Ensure all services are running
make status

# Check logs
make docker-logs
```

## Contributing

This is a demo project for educational purposes. Feel free to:
- Add more test scenarios
- Improve ABR algorithm
- Add more video qualities
- Enhance monitoring

## License

MIT License - Educational purposes

## Author

Cross-Domain Testing Demo Project

---

**Need help?** Run `make help` to see all available commands!
