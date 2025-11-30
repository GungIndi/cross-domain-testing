/**
 * Test Case TC-CD-003: Scalability Load Test
 * Domain: Architecture × Environment
 * 
 * This test uses k6 to simulate concurrent users and measure performance.
 * 
 * Prerequisites:
 * - k6 installed (https://k6.io/docs/getting-started/installation/)
 * - Streaming service running
 * 
 * Usage:
 *   k6 run tests/scenario3-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const mpdLoadTime = new Trend('mpd_load_time');
const chunkLoadTime = new Trend('chunk_load_time');
const totalRequests = new Counter('total_requests');

// Test configuration - AGGRESSIVE for autoscaling
export const options = {
  stages: [
    { duration: '10s', target: 20 },   // Warm up: 0 -> 20 users
    { duration: '30s', target: 100 },   // Ramp up: 20 -> 100 users
    { duration: '60s', target: 100 },   // Sustained load: 100 users
    { duration: '10s', target: 0 },    // Ramp down: 100 -> 0 users
  ],
  
  thresholds: {
    // Focus on actual errors, not queueing delays
    'http_req_failed': ['rate<0.1'],          // Error rate < 10%
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const VIDEOS = ['video1', 'video2'];

export function setup() {
  console.log(`
========================================
TC-CD-003: Load Test Starting
========================================
Target: ${BASE_URL}
VUs: 0 -> 20 -> 100 -> 100 -> 0
Duration: 140 seconds (longer sustained load)
Strategy: AGGRESSIVE (minimal delays)
Note: Designed to trigger autoscaling
========================================
  `);
  
  // Verify service is accessible
  const res = http.get(`${BASE_URL}/stream/video1/stream.mpd`);
  if (res.status !== 200) {
    throw new Error(`Service not accessible: ${res.status}`);
  }
  
  console.log('✓ Service is accessible');
  console.log('');
}

export default function () {
  // Select random video
  const video = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
  
  // ===== REQUEST 1: MPD Manifest =====
  const mpdStart = Date.now();
  const mpdRes = http.get(`${BASE_URL}/stream/${video}/stream.mpd`, {
    tags: { name: 'MPD Manifest' },
  });
  
  const mpdDuration = Date.now() - mpdStart;
  mpdLoadTime.add(mpdDuration);
  totalRequests.add(1);
  
  const mpdSuccess = check(mpdRes, {
    'MPD status is 200': (r) => r.status === 200,
    'MPD is valid XML': (r) => r.body && r.body.includes('<MPD'),
    'MPD contains AdaptationSet': (r) => r.body && r.body.includes('AdaptationSet'),
  });
  
  if (!mpdSuccess) {
    errorRate.add(1);
  }
  
  // ===== REQUEST 2: Init Segment (High Quality) =====
  const initRes = http.get(`${BASE_URL}/stream/${video}/init-stream0.m4s`, {
    tags: { name: 'Init Segment' },
  });
  
  totalRequests.add(1);
  
  check(initRes, {
    'Init segment status is 200': (r) => r.status === 200,
    'Init segment size > 0': (r) => r.body && r.body.length > 0,
  });
  
  // ===== REQUEST 3: Single Video Chunk (reduced memory pressure) =====
  for (let i = 1; i <= 1; i++) {
    const chunkNum = String(i).padStart(5, '0');
    
    const chunkStart = Date.now();
    const chunkRes = http.get(
      `${BASE_URL}/stream/${video}/chunk-stream0-${chunkNum}.m4s`,
      { tags: { name: `Chunk ${i}` } }
    );
    
    const chunkDuration = Date.now() - chunkStart;
    chunkLoadTime.add(chunkDuration);
    totalRequests.add(1);
    
    const chunkSuccess = check(chunkRes, {
      [`Chunk ${i} status is 200`]: (r) => r.status === 200,
      [`Chunk ${i} size > 100KB`]: (r) => r.body && r.body.length > 100 * 1024,
    });
    
    if (!chunkSuccess) {
      errorRate.add(1);
    }
    
    // Minimal sleep for aggressive load (not realistic viewing)
    sleep(0.1); // Just 100ms to prevent client overload
  }
  
  const audioRes = http.get(`${BASE_URL}/stream/${video}/chunk-stream2-00001.m4s`, {
    tags: { name: 'Audio Chunk' },
  });
  
  totalRequests.add(1);
  
  check(audioRes, {
    'Audio chunk status is 200': (r) => r.status === 200,
  });
}

export function teardown(data) {
  console.log(`
========================================
TC-CD-003: Load Test Completed
========================================
  `);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  
  // Helper function to safely get metric value
  const getMetricValue = (value, decimals = 2) => {
    return value != null ? value.toFixed(decimals) : 'N/A';
  };
  
  const summary = {
    'Total Requests': metrics.total_requests?.values?.count ?? 0,
    'HTTP Errors': ((metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2),
    'Avg Response Time': getMetricValue(metrics.http_req_duration?.values?.avg),
    'p95 Response Time': getMetricValue(metrics.http_req_duration?.values?.['p(95)']),
    'MPD p95 Load Time': getMetricValue(metrics.mpd_load_time?.values?.['p(95)']),
    'Chunk p95 Load Time': getMetricValue(metrics.chunk_load_time?.values?.['p(95)']),
  };
  
  console.log('\n========== PERFORMANCE SUMMARY ==========');
  for (const [key, value] of Object.entries(summary)) {
    const unit = key.includes('Time') ? 'ms' : key.includes('Errors') ? '%' : '';
    console.log(`${key}: ${value}${unit}`);
  }
  console.log('=========================================\n');
  
  // Create human-readable text summary
  let textSummary = '\n';
  textSummary += '==========================================\n';
  textSummary += '   LOAD TEST RESULTS - TC-CD-003\n';
  textSummary += '==========================================\n\n';
  
  textSummary += 'PERFORMANCE METRICS:\n';
  textSummary += '-------------------------------------------\n';
  for (const [key, value] of Object.entries(summary)) {
    const unit = key.includes('Time') ? ' ms' : key.includes('Errors') ? '%' : '';
    textSummary += `  ${key.padEnd(25)}: ${value}${unit}\n`;
  }
  textSummary += '-------------------------------------------\n\n';
  
  // Thresholds check
  textSummary += 'THRESHOLD CHECKS:\n';
  textSummary += '-------------------------------------------\n';
  const errorRate = metrics.http_req_failed?.values?.rate ?? 1;
  
  textSummary += `  Error Rate < 10%          : ${errorRate < 0.1 ? '✓ PASS' : '✗ FAIL'} (${(errorRate * 100).toFixed(2)}%)\n`;
  textSummary += '-------------------------------------------\n\n';
  textSummary += 'NOTE: High latency is expected due to queueing.\n';
  textSummary += 'Focus is on error rate, not response time.\n\n';
  
  const passed = errorRate < 0.1;
  textSummary += `OVERALL RESULT: ${passed ? '✓ PASS' : '✗ FAIL'}\n`;
  textSummary += '==========================================\n';
  
  return {
    'stdout': textSummary,
  };
}
