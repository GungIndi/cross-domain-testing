package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

// CORS middleware to allow all origins
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "3600")
		
		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func main() {
	// Serve dynamic config with environment variables
	http.HandleFunc("/config.js", func(w http.ResponseWriter, r *http.Request) {
		catalogURL := os.Getenv("CATALOG_URL")
		if catalogURL == "" {
			catalogURL = "http://localhost:8080" // Default for local development
		}
		
		w.Header().Set("Content-Type", "application/javascript")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		fmt.Fprintf(w, "window.CATALOG_URL = '%s';\n", catalogURL)
	})

	// Serve files from the "static" directory with CORS
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", corsMiddleware(fs))

	// Use PORT from environment or default to 8000
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Frontend server listening on port %s...\n", port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal(err)
	}
}
