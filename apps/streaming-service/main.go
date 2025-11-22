package main

import (
	"log"
	"net/http"
)

func main() {
	// Create a file server handler rooted in the 'videos_dash' directory
	fs := http.FileServer(http.Dir("./videos_dash"))

	// Define a handler that strips the "/stream/" prefix and adds a CORS header
	http.Handle("/stream/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("DEBUG: Streaming request received for: %s", r.URL.Path)
		// Set CORS header to allow requests from any origin
		w.Header().Set("Access-Control-Allow-Origin", "*")
		// Strip the prefix so the file server sees the correct path
		http.StripPrefix("/stream/", fs).ServeHTTP(w, r)
	}))

	// Start the HTTP server on port 8081.
	log.Println("Streaming Service starting on port 8081...")
	if err := http.ListenAndServe(":8081", nil); err != nil {
		log.Fatalf("Could not start server: %s\n", err)
	}
}