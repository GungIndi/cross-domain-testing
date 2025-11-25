package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

// Video represents the metadata for a video.
type Video struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	StreamURL string `json:"stream_url"`
}

// CORS middleware to allow all origins
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "3600")
		
		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next(w, r)
	}
}

func main() {
	// Get streaming service URL from environment or use localhost default
	streamingURL := os.Getenv("STREAMING_URL")
	if streamingURL == "" {
		streamingURL = "http://localhost:8081" // Default for local development
	}
	
	log.Printf("Using streaming service URL: %s", streamingURL)

	http.HandleFunc("/videos", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		videosDashDir := "./videos_dash"
		
		absPath, err := filepath.Abs(videosDashDir)
		if err != nil {
			log.Printf("ERROR: Could not get absolute path for %s: %v", videosDashDir, err)
		}
		log.Printf("DEBUG: Scanning for videos in directory: %s", absPath)

		videoDirs, err := os.ReadDir(videosDashDir)
		if err != nil {
			log.Printf("ERROR: reading video_dash directory '%s': %v", absPath, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		var videos []Video
		for i, dir := range videoDirs {
			if dir.IsDir() {
				videoTitle := dir.Name()
				video := Video{
					ID:        strconv.Itoa(i + 1),
					Title:     videoTitle,
					StreamURL: streamingURL + "/stream/" + videoTitle + "/stream.mpd",
				}
				videos = append(videos, video)
			}
		}

		log.Printf("DEBUG: Found %d videos. Responding with: %+v", len(videos), videos)

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(videos); err != nil {
			log.Printf("ERROR: Failed to encode videos to JSON: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	}))

	// Use PORT from environment or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Video Catalog Service starting on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Could not start server: %s\n", err)
	}
}
