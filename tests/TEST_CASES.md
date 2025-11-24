# Cross-Domain Test Cases - Video Streaming Application

## Test Case Overview

This document contains detailed test cases for cross-domain testing of a minimal video streaming system. Each test case is designed to trigger issues in one domain and measure impacts across multiple domains.

---

## Test Case 1: Missing Segment Handling

**Test ID:** TC-CD-001  
**Test Name:** Missing Video Segment - Cross-Domain Impact  
**Priority:** High  
**Type:** Functional, Cross-Domain  
**Domains:** Application × Architecture × Environment  

### Objective
Verify that the system gracefully handles missing video segments and observe how the error propagates across application, architecture, and environment layers.

### Pre-conditions
1. All services running (Frontend: 8000, Catalog: 8080, Streaming: 8081)
2. Browser with DevTools open
3. Video files generated with DASH segments (2-second chunks)
4. At least one complete video available (e.g., video1 with 720p and 240p)

### Test Data
- Video: `video1`
- Target segment: `chunk-stream0-00005.m4s` (High quality, segment #5)
- Expected playback time to error: ~10 seconds (5 segments × 2 seconds)

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:8000` | Homepage loads successfully |
| 2 | Open Browser DevTools (F12) → Console & Network tabs | DevTools open and recording |
| 3 | Click "video1" button | Video starts loading |
| 4 | Verify initial playback | Video plays normally at 720p |
| 5 | **Delete segment file:**<br/>`rm apps/streaming-service/videos_dash/video1/chunk-stream0-00005.m4s` | File deleted from disk |
| 6 | Let video play to ~10 seconds | Video continues playing segments 1-4 |
| 7 | Observe at segment 5 request | Player attempts to fetch missing segment |
| 8 | Check Network tab | HTTP 404 error for `chunk-stream0-00005.m4s` |
| 9 | Check Console logs | `PLAYBACK_ERROR` event logged or buffering |
| 10 | Observe player behavior | Player either: <br/>- Skips to next segment<br/>- Shows buffering spinner<br/>- Switches to lower quality (240p) |
| 11 | Check streaming-service logs | 404 error logged in terminal |

### Expected Results

**Environment Domain:**
- Network layer: HTTP 404 response visible in DevTools Network tab
- Response time: < 50ms (fast failure)

**Architecture Domain:**
- Streaming service logs: `404 Not Found` error
- No service crash or hang
- Service continues serving other segments

**Application Domain:**
- Player does NOT crash or freeze
- One of the following behaviors:
  - Skips missing segment and continues
  - Buffers and retries 2-3 times
  - Custom ABR switches to 240p if errors persist
- Console shows: `PLAYBACK_ERROR` or similar event

### Pass Criteria
✅ Player does not crash  
✅ 404 error appears in Network tab  
✅ Error logged in streaming-service terminal  
✅ Video playback continues (skip or switch quality)  
✅ No infinite retry loop  

### Fail Criteria
❌ Player freezes permanently  
❌ Service crashes  
❌ Browser tab becomes unresponsive  
❌ Infinite retry storm (> 10 requests/second for same segment)  

### Post-conditions
Restore missing segment:
```bash
cd apps/streaming-service
ffmpeg -i videos/video1_high.mp4 -i videos/video1_low.mp4 \
  -map 0:v -map 1:v -map 0:a \
  -c:v copy -c:a aac -b:a 128k \
  -f dash -seg_duration 2 -use_template 1 -use_timeline 1 \
  -init_seg_name 'init-stream$RepresentationID$.m4s' \
  -media_seg_name 'chunk-stream$RepresentationID$-$Number%05d$.m4s' \
  videos_dash/video1/stream.mpd
```

### Notes
- This test simulates real-world CDN edge cache misses
- Demonstrates error propagation: File system → HTTP → Player
- Custom ABR should detect repeated failures and adapt

---

## Test Case 2: Network Latency Impact on ABR

**Test ID:** TC-CD-002  
**Test Name:** Environment Latency - Application ABR Response  
**Priority:** High  
**Type:** Performance, Cross-Domain  
**Domains:** Environment × Application  

### Objective
Verify that network latency from the environment layer correctly triggers quality switching in the application layer's Custom ABR logic.

### Pre-conditions
1. All services running
2. Chrome browser with DevTools
3. Console logs visible and recording
4. Video loaded and ready to play
5. Player in "Auto" mode (not manual quality selection)

### Test Data
- Video: `video1`
- Throttling profiles:
  - Baseline: No throttling
  - Test 1: Regular 3G (~750 kbps, 100ms latency)
  - Test 2: Slow 3G (~400 kbps, 200ms latency)

### Test Steps - Part 1: Baseline (No Throttling)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:8000` | Page loads |
| 2 | Open DevTools → Console & Network tabs | DevTools active |
| 3 | Click "video1" button | Video loads |
| 4 | Click "Auto" button | Auto mode enabled |
| 5 | Let video play for 10 seconds | Video plays smoothly |
| 6 | Monitor console logs | `[Stats] Quality: 0 (984 kbps)` <br/> `Speed: > 10000 kbps` |
| 7 | Check visual quality indicator | Shows "720p" in GREEN |

**Expected Baseline Results:**
- Quality: 720p (Index 0)
- Buffer: > 6 seconds
- Measured Speed: > 10,000 kbps
- No quality switches

### Test Steps - Part 2: Regular 3G Throttling

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8 | DevTools → Network → Set throttling to "Regular 3G" | Throttling applied (750 kbps) |
| 9 | Continue watching video | Speed drops in console logs |
| 10 | Wait up to 5 seconds | Buffer starts draining |
| 11 | Observe console logs | `Speed: ~750 kbps` <br/> `[Custom ABR] Attempting switch DOWN` |
| 12 | Verify quality switch | `[Custom ABR] Switching to ID: 1 (240p)` <br/> `Quality: 1 (159 kbps)` |
| 13 | Check visual indicator | Changes from GREEN to ORANGE |
| 14 | Observe video quality | Visibly lower resolution (240p) |
| 15 | Check buffer behavior | Buffer stabilizes at 2-4 seconds |

**Expected Throttled Results:**
- Quality switches from 0 → 1 (720p → 240p)
- Switch happens within 3 seconds of throttling
- Console shows: `[Custom ABR] Attempting switch DOWN. Speed: XXX < 3000`
- Visual indicator: GREEN → ORANGE
- Playing bitrate: 159 kbps

### Test Steps - Part 3: Return to Normal Speed

| Step | Action | Expected Result |
|------|--------|-----------------|
| 16 | DevTools → Network → Set to "No throttling" | Throttling removed |
| 17 | Continue watching | Speed increases in logs |
| 18 | Wait up to 5 seconds | `Speed: > 3500 kbps` |
| 19 | Observe console logs | `[Custom ABR] Attempting switch UP` <br/> `[Custom ABR] Switching to ID: 0 (720p)` |
| 20 | Check visual indicator | Changes from ORANGE back to GREEN |
| 21 | Observe video quality | Returns to high resolution |

**Expected Recovery Results:**
- Quality switches from 1 → 0 (240p → 720p)
- Switch happens within 3 seconds of unthrottling
- Buffer grows to > 10 seconds

### Pass Criteria
✅ Auto mode switches DOWN when speed < 3000 kbps  
✅ Switch happens within 3 seconds of throttle change  
✅ Console shows `[Custom ABR]` logs  
✅ Visual quality indicator updates correctly  
✅ Video continues playing without interruption  
✅ Auto mode switches UP when speed > 3500 kbps  

### Fail Criteria
❌ No quality switch despite low speed  
❌ Switch takes > 5 seconds  
❌ Player crashes during switch  
❌ Infinite switching loop  
❌ Visual indicator doesn't update  

### Metrics to Record
- Time from throttle to quality switch: `_____` seconds
- Buffer level at switch time: `_____` seconds
- Number of buffering events: `_____`
- Measured speed during throttle: `_____` kbps

### Notes
- Custom ABR thresholds: DOWN < 3000 kbps, UP > 3500 kbps
- 3-second cooldown prevents rapid switching
- Visual feedback helps users understand ABR behavior

---

## Test Case 3: Load Testing - Scalability

**Test ID:** TC-CD-003  
**Test Name:** Service Load - Architecture and Environment Scaling  
**Priority:** High  
**Type:** Load/Stress, Cross-Domain  
**Domains:** Architecture × Environment  

### Objective
Verify that the microservice architecture can handle concurrent user load and measure the impact on both service performance (architecture) and underlying infrastructure (environment).

### Pre-conditions
1. k6 installed (`brew install k6` or equivalent)
2. Streaming service deployed and accessible
3. Test video files ready
4. Monitoring tools ready (Cloud Console if using Cloud Run)

### Test Data
- Target URL: `http://localhost:8081/stream/video1/` (or Cloud Run URL)
- Load profile:
  - Virtual Users (VUs): 40
  - Duration: 20 seconds
  - Requests per VU: ~20-30 (every 1 second)
  - Total expected requests: ~800-1200

### k6 Test Script
Create file: `tests/load-test.js`

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 40,
  duration: "20s",
  thresholds: {
    http_req_duration: ["p(95)<3000"], // 95% requests < 3s
    http_req_failed: ["rate<0.1"],     // Error rate < 10%
  },
};

export default function () {
  // Request MPD manifest
  const mpdRes = http.get("http://localhost:8081/stream/video1/stream.mpd");
  check(mpdRes, {
    "MPD status is 200": (r) => r.status === 200,
  });

  // Request a video chunk (high quality)
  const chunkRes = http.get("http://localhost:8081/stream/video1/chunk-stream0-00001.m4s");
  check(chunkRes, {
    "Chunk status is 200": (r) => r.status === 200,
    "Chunk size > 0": (r) => r.body.length > 0,
  });

  sleep(1);
}
```

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure streaming service is running | Service responds to health check |
| 2 | Run baseline request<br/>`curl http://localhost:8081/stream/video1/stream.mpd` | Returns MPD successfully |
| 3 | Execute k6 load test<br/>`k6 run tests/load-test.js` | k6 starts, shows progress |
| 4 | Monitor k6 output in real-time | VUs ramping up, requests being made |
| 5 | Monitor service terminal logs | Request logs appearing |
| 6 | If using Cloud Run: Open Cloud Console → Metrics | Graphs updating |
| 7 | Wait for test completion (20s) | k6 finishes, shows summary |
| 8 | Review k6 summary output | Metrics displayed |

### Expected Results

**Architecture Domain - Service Behavior:**
- All requests return HTTP 200 (or < 1% errors)
- No service crashes
- Request logs show concurrent handling
- Average response time: < 500ms
- p95 response time: < 3000ms

**Environment Domain - Infrastructure:**
- **Local deployment:** CPU usage spike (50-90%)
- **Cloud Run deployment:**
  - Instance count increases from 1 to 2-5
  - Auto-scaling triggers within 10 seconds
  - CPU utilization: 60-80% per instance
  - Memory stable (< 90% usage)

### k6 Output Metrics to Validate

```
✓ MPD status is 200
✓ Chunk status is 200
✓ Chunk size > 0

checks.........................: 100.00% ✓ 2400  ✗ 0
data_received..................: XX MB   XX kB/s
data_sent......................: XX kB   XX B/s
http_req_blocked...............: avg=XXms min=XXms med=XXms max=XXms p(95)=XXms
http_req_duration..............: avg=XXms min=XXms med=XXms max=XXms p(95)<3000ms
http_req_failed................: 0.00%   ✓ 0     ✗ 800
http_reqs......................: 800     40/s
vus............................: 40      min=40  max=40
```

### Pass Criteria
✅ http_req_failed rate < 10%  
✅ http_req_duration p(95) < 3000ms  
✅ All checks pass (MPD 200, Chunk 200, Size > 0)  
✅ No service crashes during load  
✅ (Cloud Run) Auto-scaling occurs  

### Fail Criteria
❌ Error rate > 10%  
❌ p(95) latency > 3000ms  
❌ Service crashes or becomes unresponsive  
❌ (Cloud Run) No scaling despite high CPU  

### Post-Test Validation

1. **Check Service Health:**
   ```bash
   curl http://localhost:8081/stream/video1/stream.mpd
   ```
   Should still return 200 OK

2. **Verify No Resource Leaks:**
   - Memory usage returns to baseline
   - No zombie processes
   - File handles released

3. **Review Logs:**
   - No error messages
   - Request count matches k6 output

### Cloud Run Specific Metrics

If deployed to Google Cloud Run, verify:

| Metric | Baseline | Under Load | Pass Threshold |
|--------|----------|------------|----------------|
| **Instances** | 1 | 2-5 | Auto-scaled ✅ |
| **CPU (per instance)** | 5-10% | 60-80% | < 90% ✅ |
| **Memory (per instance)** | 50-100 MB | 100-200 MB | < 512 MB ✅ |
| **Request latency (p95)** | < 100ms | < 3000ms | < 3s ✅ |
| **Error rate** | 0% | < 10% | < 10% ✅ |

### Notes
- This test validates horizontal scaling capability
- Load pattern is simple but reveals bottlenecks
- Real-world load would include multiple videos and qualities
- Consider increasing VUs to 100+ for stress testing

---

## Test Execution Checklist

Before running any test:

- [ ] All services started (catalog, streaming, frontend)
- [ ] Browser DevTools configured
- [ ] Console logs visible
- [ ] Network tab recording
- [ ] Video files present and complete
- [ ] DASH segments generated (2-second chunks)
- [ ] Custom ABR thresholds set (3000/3500 kbps)
- [ ] Backup of video segments (in case of accidental deletion)

---

## Test Results Template

### Test Execution Record

**Date:** `_______________`  
**Tester:** `_______________`  
**Environment:** `[ ] Local  [ ] Cloud Run`  

| Test ID | Test Name | Status | Duration | Notes |
|---------|-----------|--------|----------|-------|
| TC-CD-001 | Missing Segment | ⬜ Pass ⬜ Fail | _____ | |
| TC-CD-002 | Network Latency | ⬜ Pass ⬜ Fail | _____ | |
| TC-CD-003 | Load Test | ⬜ Pass ⬜ Fail | _____ | |

### Issues Found

| Issue ID | Description | Severity | Domain | Status |
|----------|-------------|----------|--------|--------|
| | | | | |

### Cross-Domain Observations

Describe any interesting cross-domain interactions observed:

```
[Your observations here]
```

---

## Appendix: Quick Command Reference

### Start All Services
```bash
# Terminal 1 - Frontend
cd frontend && go run main.go

# Terminal 2 - Catalog
cd apps/video-catalog-service && go run main.go

# Terminal 3 - Streaming
cd apps/streaming-service && go run main.go
```

### Generate DASH Files
```bash
cd apps/streaming-service
ffmpeg -i videos/video1_high.mp4 -i videos/video1_low.mp4 \
  -map 0:v -map 1:v -map 0:a \
  -c:v copy -c:a aac -b:a 128k \
  -f dash -seg_duration 2 -use_template 1 -use_timeline 1 \
  -init_seg_name 'init-stream$RepresentationID$.m4s' \
  -media_seg_name 'chunk-stream$RepresentationID$-$Number%05d$.m4s' \
  videos_dash/video1/stream.mpd
```

### Run Load Test
```bash
k6 run tests/load-test.js
```

### Clean Up
```bash
# Stop all services (Ctrl+C in each terminal)
# Remove generated segments
rm -rf apps/streaming-service/videos_dash/*/
```
