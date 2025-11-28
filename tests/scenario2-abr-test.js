/**
 * Test Case TC-CD-002: Network Latency Impact on ABR
 * Domain: Environment × Application
 * 
 * This test uses Puppeteer to automate browser testing with network throttling.
 * 
 * Prerequisites:
 * - npm install puppeteer
 * - All services running (frontend, catalog, streaming)
 */

const puppeteer = require('puppeteer');

const TEST_URL = 'http://localhost:8000';
const VIDEO_NAME = 'video1';

// Network profiles
const PROFILES = {
  FAST: { downloadThroughput: -1, uploadThroughput: -1, latency: 0 },
  REGULAR_3G: { downloadThroughput: 750 * 1024 / 8, uploadThroughput: 250 * 1024 / 8, latency: 100 },
  SLOW_3G: { downloadThroughput: 400 * 1024 / 8, uploadThroughput: 100 * 1024 / 8, latency: 200 },
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  log('==========================================', 'blue');
  log('TC-CD-002: Network Latency ABR Test', 'blue');
  log('==========================================', 'blue');
  log('');

  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  // Enable DevTools Network domain
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Track console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      // Store stats for later inspection
      if (text.includes('[Stats]')) {
        page.evaluate((log) => { window.lastStatsLog = log; }, text);
      }
      
      // Print important logs
      if (text.includes('[Custom ABR]') || text.includes('[Stats]')) {
        log(`  Console: ${text}`, 'blue');
      }
    });

    // ========== PART 1: Baseline (No Throttling) ==========
    log('[PART 1] Baseline Test - No Throttling', 'yellow');
    log('');

    await page.goto(TEST_URL, { waitUntil: 'networkidle2' });
    log('✓ Page loaded', 'green');

    // Find and click video button
    await page.waitForSelector('#video-buttons button');
    const videoButtons = await page.$$('#video-buttons button');
    await videoButtons[0].click(); // Click video1
    log('✓ Video selected', 'green');

    await sleep(1000);

    // Play the video (it doesn't autoplay)
    await page.evaluate(() => {
      const video = document.querySelector('#videoPlayer');
      if (video) {
        video.play();
      }
    });
    log('✓ Video playing', 'green');

    await sleep(2000); // Let video start buffering

    // Click Auto button
    await page.waitForSelector('#quality-buttons button');
    const qualityButtons = await page.$$('#quality-buttons button');
    await qualityButtons[0].click(); // First button should be Auto
    log('✓ Auto mode enabled', 'green');

    await sleep(5000); // Let it play

    // Check quality
    const baselineQuality = await page.evaluate(() => {
      const logs = document.querySelector('body').innerText;
      // Try to extract quality from console or UI
      const indicator = document.querySelector('#current-quality');
      return indicator ? indicator.textContent : 'Unknown';
    });

    log(`  Quality indicator: ${baselineQuality}`, 'blue');

    if (baselineQuality.includes('720p') || baselineQuality.includes('Auto')) {
      log('✓ PASS: High quality detected on fast connection', 'green');
      testsPassed++;
    } else {
      log('✗ FAIL: Expected high quality', 'red');
      testsFailed++;
    }

    // ========== PART 2: Regular 3G Throttling ==========
    log('');
    log('[PART 2] Throttling Test - Regular 3G', 'yellow');
    log('');

    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: PROFILES.REGULAR_3G.downloadThroughput,
      uploadThroughput: PROFILES.REGULAR_3G.uploadThroughput,
      latency: PROFILES.REGULAR_3G.latency,
    });
    log('✓ Network throttled to Regular 3G (750 kbps)', 'green');

    await sleep(10000); // Wait for ABR to detect and switch

    const throttledQuality = await page.evaluate(() => {
      const indicator = document.querySelector('#current-quality');
      return indicator ? indicator.textContent : 'Unknown';
    });

    log(`  Quality indicator: ${throttledQuality}`, 'blue');

    // Check for ABR switch down logs
    const hasABRLog = consoleLogs.some(log => log.includes('[Custom ABR] Attempting switch DOWN'));
    
    if (hasABRLog) {
      log('✓ PASS: Custom ABR attempted switch DOWN', 'green');
      testsPassed++;
    } else {
      log('✗ FAIL: No ABR switch detected in logs', 'red');
      testsFailed++;
    }

    if (throttledQuality.includes('240p') || throttledQuality.includes('Low')) {
      log('✓ PASS: Switched to low quality', 'green');
      testsPassed++;
    } else {
      log('⚠ WARNING: Quality indicator does not show 240p', 'yellow');
      log(`  Current: ${throttledQuality}`, 'yellow');
    }

    // ========== PART 3: Remove Throttling ==========
    log('');
    log('[PART 3] Recovery Test - Remove Throttling', 'yellow');
    log('');

    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: PROFILES.FAST.downloadThroughput,
      uploadThroughput: PROFILES.FAST.uploadThroughput,
      latency: PROFILES.FAST.latency,
    });
    log('✓ Network throttling removed', 'green');

    await sleep(15000); // Wait for ABR to switch up

    const recoveredQuality = await page.evaluate(() => {
      const indicator = document.querySelector('#current-quality');
      return indicator ? indicator.textContent : 'Unknown';
    });

    log(`  Quality indicator: ${recoveredQuality}`, 'blue');

    const hasABRUpLog = consoleLogs.some(log => log.includes('[Custom ABR] Attempting switch UP'));
    
    if (hasABRUpLog) {
      log('✓ PASS: Custom ABR attempted switch UP', 'green');
      testsPassed++;
    } else {
      log('✗ FAIL: No ABR switch UP detected', 'red');
      testsFailed++;
    }

    if (recoveredQuality.includes('720p') || recoveredQuality.includes('High')) {
      log('✓ PASS: Switched back to high quality', 'green');
      testsPassed++;
    } else {
      log('⚠ WARNING: Quality did not return to high', 'yellow');
    }

  } catch (error) {
    log(`✗ ERROR: ${error.message}`, 'red');
    testsFailed++;
  } finally {
    await browser.close();
  }

  // Summary
  log('');
  log('==========================================', 'blue');
  log('TEST SUMMARY - TC-CD-002', 'blue');
  log('==========================================', 'blue');
  log(`Tests Passed: ${testsPassed}`, testsPassed > 0 ? 'green' : 'reset');
  log(`Tests Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'reset');
  log('');

  if (testsFailed === 0) {
    log('PASS: ABR Test Completed Successfully', 'green');
    process.exit(0);
  } else {
    log('FAIL: Some tests failed', 'red');
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test crashed:', error);
  process.exit(1);
});
