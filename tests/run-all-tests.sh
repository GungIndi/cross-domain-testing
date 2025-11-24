#!/bin/bash

# Main test runner for all cross-domain test scenarios
# Runs all three test cases in sequence

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;36m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "  Cross-Domain Test Suite"
echo "  Video Streaming Application"
echo "=========================================="
echo -e "${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}[PREREQUISITES]${NC} Checking test environment..."
echo ""

# Check if services are running
SERVICES_OK=true

if curl -s http://localhost:8000 > /dev/null; then
    echo -e "${GREEN}✓${NC} Frontend service (port 8000)"
else
    echo -e "${RED}✗${NC} Frontend service not running"
    SERVICES_OK=false
fi

if curl -s http://localhost:8080/videos > /dev/null; then
    echo -e "${GREEN}✓${NC} Catalog service (port 8080)"
else
    echo -e "${RED}✗${NC} Catalog service not running"
    SERVICES_OK=false
fi

if curl -s http://localhost:8081/stream/video1/stream.mpd > /dev/null; then
    echo -e "${GREEN}✓${NC} Streaming service (port 8081)"
else
    echo -e "${RED}✗${NC} Streaming service not running"
    SERVICES_OK=false
fi

if [ "$SERVICES_OK" = false ]; then
    echo ""
    echo -e "${RED}[ERROR]${NC} Not all services are running."
    echo ""
    echo "Please start services first:"
    echo "  Terminal 1: cd frontend && go run main.go"
    echo "  Terminal 2: cd apps/video-catalog-service && go run main.go"
    echo "  Terminal 3: cd apps/streaming-service && go run main.go"
    echo ""
    exit 1
fi

# Check for k6
if command -v k6 &> /dev/null; then
    echo -e "${GREEN}✓${NC} k6 installed"
else
    echo -e "${YELLOW}⚠${NC} k6 not installed (Scenario 3 will be skipped)"
    echo "  Install: https://k6.io/docs/getting-started/installation/"
fi

# Check for Node.js and Puppeteer
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js installed"
    
    if [ -d "node_modules/puppeteer" ]; then
        echo -e "${GREEN}✓${NC} Puppeteer installed"
    else
        echo -e "${YELLOW}⚠${NC} Puppeteer not installed (Scenario 2 will be skipped)"
        echo "  Install: npm install puppeteer"
    fi
else
    echo -e "${YELLOW}⚠${NC} Node.js not installed (Scenario 2 will be skipped)"
fi

echo ""
echo -e "${GREEN}All prerequisites met!${NC}"
echo ""

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ============================================================
# SCENARIO 1: Missing Segment
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  SCENARIO 1: Missing Segment Test"
echo "==========================================${NC}"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))

if bash tests/scenario1-missing-segment.sh; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}✓ Scenario 1: PASSED${NC}"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}✗ Scenario 1: FAILED${NC}"
fi

echo ""
read -p "Press Enter to continue to Scenario 2..."

# ============================================================
# SCENARIO 2: Network Latency / ABR
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  SCENARIO 2: Network Latency / ABR Test"
echo "==========================================${NC}"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))

if command -v node &> /dev/null && [ -d "node_modules/puppeteer" ]; then
    if node tests/scenario2-abr-test.js; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ Scenario 2: PASSED${NC}"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ Scenario 2: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Scenario 2: SKIPPED (missing dependencies)${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS - 1))
fi

echo ""
read -p "Press Enter to continue to Scenario 3..."

# ============================================================
# SCENARIO 3: Load Test
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  SCENARIO 3: Load Test"
echo "==========================================${NC}"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))

if command -v k6 &> /dev/null; then
    if k6 run tests/scenario3-load-test.js; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ Scenario 3: PASSED${NC}"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ Scenario 3: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Scenario 3: SKIPPED (k6 not installed)${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS - 1))
fi

# ============================================================
# FINAL SUMMARY
# ============================================================

echo ""
echo -e "${BLUE}=========================================="
echo "  TEST SUITE SUMMARY"
echo "==========================================${NC}"
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    exit 1
fi
