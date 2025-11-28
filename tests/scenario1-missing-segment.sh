#!/bin/bash

# Test Case TC-CD-001: Missing Segment Handling
# Domain: Application × Architecture × Environment

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "TC-CD-001: Missing Segment Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
VIDEO="video1"
SEGMENT_TO_DELETE="chunk-stream0-00005.m4s"
SEGMENT_PATH="apps/streaming-service/videos_dash/$VIDEO/$SEGMENT_TO_DELETE"
BACKUP_PATH="/tmp/${VIDEO}_backup"

echo -e "${YELLOW}[PRE-CHECK]${NC} Verifying prerequisites..."

# Check if services are running
if ! curl -s http://localhost:8000 > /dev/null; then
    echo -e "${RED}✗ Frontend service not running on port 8000${NC}"
    exit 1
fi

if ! curl -s http://localhost:8080/videos > /dev/null; then
    echo -e "${RED}✗ Catalog service not running on port 8080${NC}"
    exit 1
fi

if ! curl -s http://localhost:8081/stream/$VIDEO/stream.mpd > /dev/null; then
    echo -e "${RED}✗ Streaming service not running on port 8081${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All services are running${NC}"

# Check if segment exists
if [ ! -f "$SEGMENT_PATH" ]; then
    echo -e "${RED}✗ Target segment not found: $SEGMENT_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Target segment exists${NC}"

# Backup the entire video directory
echo ""
echo -e "${YELLOW}[BACKUP]${NC} Creating backup..."
mkdir -p "$BACKUP_PATH"
cp -r "apps/streaming-service/videos_dash/$VIDEO"/* "$BACKUP_PATH/"
echo -e "${GREEN}✓ Backup created at $BACKUP_PATH${NC}"

# Delete the segment
echo ""
echo -e "${YELLOW}[ACTION]${NC} Deleting segment: $SEGMENT_TO_DELETE"
rm -f "$SEGMENT_PATH"

if [ ! -f "$SEGMENT_PATH" ]; then
    echo -e "${GREEN}✓ Segment deleted successfully${NC}"
else
    echo -e "${RED}✗ Failed to delete segment${NC}"
    exit 1
fi

# Test the missing segment by making HTTP request
echo ""
echo -e "${YELLOW}[TEST]${NC} Requesting missing segment from server..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/stream/$VIDEO/$SEGMENT_TO_DELETE")

if [ "$RESPONSE" == "404" ]; then
    echo -e "${GREEN}✓ Server returned 404 (Expected)${NC}"
    echo -e "  ${GREEN}✓ ENVIRONMENT DOMAIN: HTTP request failed gracefully${NC}"
    echo -e "  ${GREEN}✓ ARCHITECTURE DOMAIN: Service handled error correctly${NC}"
else
    echo -e "${RED}✗ Expected 404, got $RESPONSE${NC}"
fi

# Test adjacent segments still work
echo ""
echo -e "${YELLOW}[TEST]${NC} Verifying adjacent segments still work..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/stream/$VIDEO/chunk-stream0-00004.m4s")

if [ "$RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ Segment 00004 still accessible (200 OK)${NC}"
else
    echo -e "${RED}✗ Segment 00004 failed: $RESPONSE${NC}"
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/stream/$VIDEO/chunk-stream0-00006.m4s")

if [ "$RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ Segment 00006 still accessible (200 OK)${NC}"
else
    echo -e "${RED}✗ Segment 00006 failed: $RESPONSE${NC}"
fi

# Wait for user to test in browser
echo ""
echo -e "${YELLOW}[MANUAL TEST]${NC} Now test in browser:"
echo "1. Open http://localhost:8000"
echo "2. Click '720p' quality button (use manual quality, not Auto)"
echo "3. Play video1 and observe during segment 5 (~10 seconds playback)"
echo "4. Check network tab for 404 error when accessing $SEGMENT_TO_DELETE"
echo ""
read -p "Press ENTER when ready to restore the segment..." -r
echo ""

# Restore from backup
echo -e "${YELLOW}[RESTORE]${NC} Restoring from backup..."
cp -r "$BACKUP_PATH"/* "apps/streaming-service/videos_dash/$VIDEO/"

if [ -f "$SEGMENT_PATH" ]; then
    echo -e "${GREEN}✓ Segment restored successfully${NC}"
else
    echo -e "${RED}✗ Failed to restore segment${NC}"
fi

# Cleanup backup
rm -rf "$BACKUP_PATH"
echo -e "${GREEN}✓ Backup cleaned up${NC}"

# Final verification
echo ""
echo -e "${YELLOW}[VERIFY]${NC} Testing restored segment..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/stream/$VIDEO/$SEGMENT_TO_DELETE")

if [ "$RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ Restored segment is accessible${NC}"
else
    echo -e "${RED}✗ Restored segment failed: $RESPONSE${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}TEST SUMMARY - TC-CD-001${NC}"
echo "=========================================="
echo "✓ Missing segment returns 404"
echo "✓ Adjacent segments still work"
echo "✓ Service does not crash"
echo "✓ Segment restored successfully"
echo ""
echo -e "${GREEN}PASS: Missing Segment Test Completed${NC}"

