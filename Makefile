# Video Streaming Application - Makefile
# Cross-Domain Testing Demo

.PHONY: help build run test deploy clean docker

# Configuration
GCP_PROJECT_ID ?= your-project-id
GCP_REGION ?= us-central1
STREAMING_URL ?= http://localhost:8081

# Colors for output
BLUE := \033[1;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

##@ General

help: ## Display this help message
	@echo "$(BLUE)Video Streaming Application - Cross-Domain Testing$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(YELLOW)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install-deps: ## Install all dependencies (Node.js, k6, Puppeteer)
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 || (echo "$(YELLOW)Please install Node.js first$(NC)" && exit 1)
	@npm install puppeteer
	@echo "$(GREEN)✓ Puppeteer installed$(NC)"
	@command -v k6 >/dev/null 2>&1 || (echo "$(YELLOW)Please install k6: https://k6.io/docs/getting-started/installation/$(NC)")

run-frontend: ## Run frontend service on port 8000
	@echo "$(BLUE)Starting frontend service...$(NC)"
	@cd frontend && PORT=8000 go run main.go

run-catalog: ## Run catalog service on port 8080
	@echo "$(BLUE)Starting catalog service...$(NC)"
	@cd apps/video-catalog-service && PORT=8080 go run main.go

run-streaming: ## Run streaming service on port 8081
	@echo "$(BLUE)Starting streaming service...$(NC)"
	@cd apps/streaming-service && PORT=8081 go run main.go

build-frontend: ## Build frontend binary
	@cd frontend && go build -o bin/frontend main.go
	@echo "$(GREEN)✓ Frontend built$(NC)"

build-catalog: ## Build catalog binary
	@cd apps/video-catalog-service && go build -o bin/catalog-service main.go
	@echo "$(GREEN)✓ Catalog service built$(NC)"

build-streaming: ## Build streaming binary
	@cd apps/streaming-service && go build -o bin/streaming-service main.go
	@echo "$(GREEN)✓ Streaming service built$(NC)"

build-all: build-frontend build-catalog build-streaming ## Build all services
	@echo "$(GREEN)✓ All services built$(NC)"

##@ Docker

docker-build: ## Build all Docker images locally
	@echo "$(BLUE)Building Docker images...$(NC)"
	@docker compose -f ops/docker-compose.yml build
	@echo "$(GREEN)✓ Docker images built$(NC)"

docker-up: ## Start all services with Docker Compose
	@echo "$(BLUE)Starting services with Docker Compose...$(NC)"
	@docker compose -f ops/docker-compose.yml up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@echo "  Frontend:  http://localhost:8000"
	@echo "  Catalog:   http://localhost:8080"
	@echo "  Streaming: http://localhost:8081"

docker-down: ## Stop all Docker services
	@docker compose -f ops/docker-compose.yml down
	@echo "$(GREEN)✓ Services stopped$(NC)"

docker-logs: ## View Docker logs
	@docker compose -f ops/docker-compose.yml logs -f

docker-test: ## Build and test locally with Docker
	@chmod +x ops/test-docker-local.sh
	@ops/test-docker-local.sh

##@ Testing

test-all: ## Run all test scenarios
	@echo "$(BLUE)Running all test scenarios...$(NC)"
	@chmod +x tests/run-all-tests.sh
	@tests/run-all-tests.sh

test-missing-segment: ## Run Scenario 1: Missing Segment test
	@echo "$(BLUE)Running Scenario 1: Missing Segment$(NC)"
	@chmod +x tests/scenario1-missing-segment.sh
	@tests/scenario1-missing-segment.sh

test-abr: ## Run Scenario 2: ABR/Network Latency test
	@echo "$(BLUE)Running Scenario 2: Network Latency / ABR$(NC)"
	@node tests/scenario2-abr-test.js

test-load: ## Run Scenario 3: Load test with k6
	@echo "$(BLUE)Running Scenario 3: Load Test$(NC)"
	@k6 run tests/scenario3-load-test.js

test-load-cloud: ## Run load test against Cloud Run deployment
	@echo "$(BLUE)Running load test against Cloud Run$(NC)"
	@BASE_URL=$(STREAMING_URL) k6 run tests/scenario3-load-test.js

##@ Cloud Run Deployment

deploy: ## Deploy all services to Google Cloud Run
	@echo "$(BLUE)Deploying to Google Cloud Run...$(NC)"
	@chmod +x ops/deploy-to-cloudrun.sh
	@cd ops && GCP_PROJECT_ID=$(GCP_PROJECT_ID) GCP_REGION=$(GCP_REGION) ./deploy-to-cloudrun.sh

deploy-streaming: ## Deploy only streaming service to Cloud Run
	@echo "$(BLUE)Deploying streaming service...$(NC)"
	@cd apps/streaming-service && gcloud builds submit --tag gcr.io/$(GCP_PROJECT_ID)/streaming-service:latest .
	@gcloud run deploy streaming-service \
		--image gcr.io/$(GCP_PROJECT_ID)/streaming-service:latest \
		--platform managed \
		--region $(GCP_REGION) \
		--allow-unauthenticated \
		--port 8080 \
		--memory 512Mi \
		--cpu 1 \
		--min-instances 0 \
		--max-instances 10 \
		--concurrency 80

deploy-frontend: ## Deploy only frontend to Cloud Run
	@echo "$(BLUE)Deploying frontend...$(NC)"
	@cd frontend && gcloud builds submit --tag gcr.io/$(GCP_PROJECT_ID)/frontend:latest .
	@gcloud run deploy frontend \
		--image gcr.io/$(GCP_PROJECT_ID)/frontend:latest \
		--platform managed \
		--region $(GCP_REGION) \
		--allow-unauthenticated

deploy-catalog: ## Deploy only catalog service to Cloud Run
	@echo "$(BLUE)Deploying catalog service...$(NC)"
	@cd apps/video-catalog-service && gcloud builds submit --tag gcr.io/$(GCP_PROJECT_ID)/catalog-service:latest .
	@gcloud run deploy catalog-service \
		--image gcr.io/$(GCP_PROJECT_ID)/catalog-service:latest \
		--platform managed \
		--region $(GCP_REGION) \
		--allow-unauthenticated

cloud-logs: ## View Cloud Run logs for streaming service
	@gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=streaming-service" --limit 50

cloud-metrics: ## Open Cloud Run metrics in browser
	@echo "Opening Cloud Run metrics..."
	@open "https://console.cloud.google.com/run/detail/$(GCP_REGION)/streaming-service/metrics?project=$(GCP_PROJECT_ID)" || \
	xdg-open "https://console.cloud.google.com/run/detail/$(GCP_REGION)/streaming-service/metrics?project=$(GCP_PROJECT_ID)" || \
	echo "Please open: https://console.cloud.google.com/run/detail/$(GCP_REGION)/streaming-service/metrics?project=$(GCP_PROJECT_ID)"

##@ Cleanup

clean: ## Remove built binaries
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf frontend/bin apps/video-catalog-service/bin apps/streaming-service/bin
	@echo "$(GREEN)✓ Build artifacts removed$(NC)"

clean-docker: ## Remove Docker images and containers
	@echo "$(BLUE)Cleaning Docker resources...$(NC)"
	@docker compose -f ops/docker-compose.yml down -v
	@docker system prune -f
	@echo "$(GREEN)✓ Docker resources cleaned$(NC)"

clean-cloudrun: ## Delete all Cloud Run services and images
	@echo "$(BLUE)Cleaning Cloud Run resources...$(NC)"
	@chmod +x ops/cleanup-cloudrun.sh
	@cd ops && GCP_PROJECT_ID=$(GCP_PROJECT_ID) GCP_REGION=$(GCP_REGION) ./cleanup-cloudrun.sh

##@ Video Processing

generate-dash: ## Generate DASH files for all videos
	@echo "$(BLUE)Generating DASH files...$(NC)"
	@cd apps/streaming-service && \
	for video in videos/video*_high.mp4; do \
		base=$$(basename $$video _high.mp4); \
		echo "Processing $$base..."; \
		ffmpeg -i videos/$${base}_high.mp4 -i videos/$${base}_low.mp4 \
			-map 0:v -map 1:v -map 0:a \
			-c:v copy -c:a aac -b:a 128k \
			-f dash -seg_duration 2 -use_template 1 -use_timeline 1 \
			-init_seg_name 'init-stream$$RepresentationID$$.m4s' \
			-media_seg_name 'chunk-stream$$RepresentationID$$-$$Number%05d$$.m4s' \
			videos_dash/$$base/stream.mpd; \
	done
	@echo "$(GREEN)✓ DASH files generated$(NC)"

##@ Quick Commands

dev: ## Start all services for development (recommended)
	@echo "$(BLUE)Starting all services...$(NC)"
	@echo "$(YELLOW)Please run these in separate terminals:$(NC)"
	@echo "  Terminal 1: make run-frontend"
	@echo "  Terminal 2: make run-catalog"
	@echo "  Terminal 3: make run-streaming"

demo: docker-up ## Quick demo with Docker (all services)
	@echo "$(GREEN)✓ Demo environment ready!$(NC)"
	@echo ""
	@echo "Access the application at: http://localhost:8000"
	@echo "Run tests with: make test-all"
	@echo "Stop with: make docker-down"

status: ## Check service health
	@echo "$(BLUE)Checking service status...$(NC)"
	@echo -n "Frontend (8000):  "
	@curl -s http://localhost:8000 > /dev/null && echo "$(GREEN)✓ Running$(NC)" || echo "$(YELLOW)✗ Not running$(NC)"
	@echo -n "Catalog (8080):   "
	@curl -s http://localhost:8080/videos > /dev/null && echo "$(GREEN)✓ Running$(NC)" || echo "$(YELLOW)✗ Not running$(NC)"
	@echo -n "Streaming (8081): "
	@curl -s http://localhost:8081/stream/video1/stream.mpd > /dev/null && echo "$(GREEN)✓ Running$(NC)" || echo "$(YELLOW)✗ Not running$(NC)"

##@ Documentation

docs: ## View documentation
	@echo "$(BLUE)Available Documentation:$(NC)"
	@echo "  README.md                      - Project overview"
	@echo "  TEST_CASES.md                  - Test case specifications"
	@echo "  CROSS_DOMAIN_TEST_SCENARIOS.md - Testing strategy"
	@echo "  ops/CLOUD_RUN_DEPLOYMENT.md    - Cloud Run guide"
	@echo "  tests/README.md                - Test automation guide"

.DEFAULT_GOAL := help
