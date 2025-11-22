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

func main() {
	http.HandleFunc("/videos", func(w http.ResponseWriter, r *http.Request) {
		videosDashDir := "../streaming-service/videos_dash"
		
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
					StreamURL: "http://localhost:8081/stream/" + videoTitle + "/stream.mpd",
				}
				videos = append(videos, video)
			}
		}

		log.Printf("DEBUG: Found %d videos. Responding with: %+v", len(videos), videos)

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*") // Allow all CORS
		if err := json.NewEncoder(w).Encode(videos); err != nil {
			log.Printf("ERROR: Failed to encode videos to JSON: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	})

	log.Println("Video Catalog Service starting on port 8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Could not start server: %s\n", err)
	}
}
