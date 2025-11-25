# Video Catalog Service Dockerfile
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download || true

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o catalog-service main.go

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary and dash videos from builder
COPY --from=builder /app/videos_dash ./videos_dash
COPY --from=builder /app/catalog-service .

# Expose port (Cloud Run will override with PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/videos || exit 1

# Run
CMD ["./catalog-service"]
