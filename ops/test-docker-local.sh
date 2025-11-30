#!/bin/bash

# Quick local Docker testing before Cloud Run deployment

set -e

echo "=========================================="
echo "  Local Docker Testing"
echo "=========================================="
echo ""

# Build all images
echo "[BUILD] Building Docker images..."
docker compose build

echo ""
echo "[START] Starting services..."
docker compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 5

# Test each service
echo ""
echo "[TEST] Testing services..."

# Frontend
if curl -s http://localhost:8000 > /dev/null; then
    echo "✓ Frontend (8000): OK"
else
    echo "✗ Frontend (8000): FAILED"
fi

# Catalog
if curl -s http://localhost:8080/videos > /dev/null; then
    echo "✓ Catalog (8080): OK"
else
    echo "✗ Catalog (8080): FAILED"
fi

# Streaming
if curl -s http://localhost:8081/stream/video1/stream.mpd > /dev/null; then
    echo "✓ Streaming (8081): OK"
else
    echo "✗ Streaming (8081): FAILED"
fi

echo ""
echo "=========================================="
echo "Services are running!"
echo "=========================================="
echo ""
echo "Access the application:"
echo "  Frontend: http://localhost:8000"
echo "  Catalog:  http://localhost:8080/videos"
echo "  Streaming: http://localhost:8081/stream/video1/stream.mpd"
echo ""
echo "View logs:"
echo "  docker compose logs -f"
echo ""
echo "Stop services:"
echo "  docker compose down"
echo ""
