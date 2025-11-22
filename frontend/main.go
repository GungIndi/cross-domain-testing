package main

import (
	"log"
	"net/http"
)

func main() {
	// Serve files from the "static" directory
	fs := http.FileServer(http.Dir("./static"))

	// Handle all requests by passing them to the file server
	http.Handle("/", fs)

	// Start the server on port 8000
	log.Println("Frontend server listening on http://localhost:8000 ...")
	err := http.ListenAndServe(":8000", nil)
	if err != nil {
		log.Fatal(err)
	}
}
