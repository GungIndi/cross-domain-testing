package main

import (
	"log"
	"net/http"
	"os"
)

// CORS middleware to allow all origins
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Range")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
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
	// Create a file server handler rooted in the 'videos_dash' directory
	fs := http.FileServer(http.Dir("./videos_dash"))

	// Wrap file server with CORS middleware and strip prefix
	http.Handle("/stream/", corsMiddleware(http.StripPrefix("/stream/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("DEBUG: Streaming request received for: %s", r.URL.Path)
		fs.ServeHTTP(w, r)
	}))))

	// Use PORT from environment or default to 8081
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Streaming Service starting on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Could not start server: %s\n", err)
	}
}