# Cross-Domain Test Scripts

This directory contains automated test scripts for all three cross-domain test scenarios.

## Quick Start

### 1. Install Prerequisites

```bash
# Install k6 (for Scenario 3)
# macOS:
brew install k6

# Linux:
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install Puppeteer (for Scenario 2)
npm install puppeteer
```

### 2. Start All Services

Before running tests, ensure all services are running:

```bash
# Terminal 1 - Frontend
cd frontend && go run main.go

# Terminal 2 - Catalog
cd apps/video-catalog-service && go run main.go

# Terminal 3 - Streaming
cd apps/streaming-service && go run main.go
```

### 3. Run All Tests

```bash
# Make scripts executable
chmod +x tests/*.sh

# Run all tests
./tests/run-all-tests.sh
```

Or run individual scenarios:

```bash
# Scenario 1: Missing Segment
./tests/scenario1-missing-segment.sh

# Scenario 2: ABR / Network Latency
node tests/scenario2-abr-test.js

# Scenario 3: Load Test
k6 run tests/scenario3-load-test.js
```

## Test Scenarios

### Scenario 1: Missing Segment (Bash)

**File:** `scenario1-missing-segment.sh`

**What it does:**
- Backs up video segments
- Deletes a specific segment
- Tests that 404 is returned
- Verifies adjacent segments still work
- Restores the segment
- Validates restoration

**Duration:** ~10 seconds

**Pass Criteria:**
- ✅ Missing segment returns HTTP 404
- ✅ Adjacent segments still return 200
- ✅ Service doesn't crash
- ✅ Segment restored successfully

---

### Scenario 2: ABR / Network Latency (Node.js + Puppeteer)

**File:** `scenario2-abr-test.js`

**What it does:**
- Launches headless browser
- Loads the video player
- Tests baseline (no throttling)
- Applies Regular 3G throttling
- Verifies quality switches DOWN
- Removes throttling
- Verifies quality switches UP

**Duration:** ~30 seconds

**Pass Criteria:**
- ✅ Starts at high quality (720p)
- ✅ Switches to low quality when throttled
- ✅ Console shows `[Custom ABR]` logs
- ✅ Switches back to high quality when unthrottled

**Note:** Set `headless: true` in the script for CI/CD environments.

---

### Scenario 3: Load Test (k6)

**File:** `scenario3-load-test.js`

**What it does:**
- Simulates 40 concurrent users
- Requests MPD manifests
- Downloads video chunks
- Measures performance metrics
- Validates response times

**Duration:** ~70 seconds

**Load Profile:**
1. Warm up: 0 → 10 users (10s)
2. Ramp up: 10 → 40 users (20s)
3. Sustain: 40 users (30s)
4. Ramp down: 40 → 0 users (10s)

**Pass Criteria:**
- ✅ HTTP error rate < 10%
- ✅ p95 response time < 3s
- ✅ MPD loads in < 1s (p95)
- ✅ Chunks load in < 2s (p95)

---

## Environment Variables

You can customize the test target:

```bash
# For Scenario 3 (k6)
BASE_URL=http://localhost:8081 k6 run tests/scenario3-load-test.js

# For Cloud Run deployment
BASE_URL=https://your-service.run.app k6 run tests/scenario3-load-test.js
```

## Troubleshooting

### Scenario 1 fails with "segment not found"

Make sure DASH files are generated:

```bash
cd apps/streaming-service
# Generate for video1
ffmpeg -i videos/video1_high.mp4 -i videos/video1_low.mp4 \
  -map 0:v -map 1:v -map 0:a \
  -c:v copy -c:a aac -b:a 128k \
  -f dash -seg_duration 2 -use_template 1 -use_timeline 1 \
  -init_seg_name 'init-stream$RepresentationID$.m4s' \
  -media_seg_name 'chunk-stream$RepresentationID$-$Number%05d$.m4s' \
  videos_dash/video1/stream.mpd
```

### Scenario 2 browser doesn't open

Install Puppeteer:

```bash
npm install puppeteer
```

If still fails, try:

```bash
npm install puppeteer --unsafe-perm=true --allow-root
```

### Scenario 3 reports high error rate

Check:
1. Are all services healthy?
2. Is the streaming service responding?
3. Try reducing VUs: Edit `scenario3-load-test.js` and change `target: 40` to `target: 10`

## CI/CD Integration

For GitHub Actions or similar:

```yaml
# .github/workflows/test.yml
name: Cross-Domain Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Go
        uses: actions/setup-go@v2
        with:
          go-version: 1.21
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: 18
      
      - name: Install k6
        run: |
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Install Puppeteer
        run: npm install puppeteer
      
      - name: Start Services
        run: |
          cd apps/video-catalog-service && go run main.go &
          cd apps/streaming-service && go run main.go &
          cd frontend && go run main.go &
          sleep 5
      
      - name: Run Tests
        run: ./tests/run-all-tests.sh
```

## Output

All tests output:
- ✅ Colored output (green = pass, red = fail, yellow = warning)
- Detailed step-by-step logs
- Summary at the end
- Exit code 0 (pass) or 1 (fail)

## Manual Testing

If you prefer manual testing, see `TEST_CASES.md` for detailed step-by-step instructions.
