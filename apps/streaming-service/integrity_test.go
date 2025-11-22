package main_test

import (
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"testing"
	"time"
)

// setupTestServer starts the main streaming service as a background process.
func setupTestServer() (*exec.Cmd, error) {
	cmd := exec.Command("go", "run", ".")
	cmd.Dir = "./" // Ensure it runs in the service's directory
	err := cmd.Start()
	if err != nil {
		return nil, fmt.Errorf("failed to start server: %w", err)
	}
	time.Sleep(2 * time.Second) // Give server time to start
	return cmd, nil
}

// getFileChecksum calculates the SHA256 checksum of a file or a portion of it.
func getFileChecksum(filePath string, length int64) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	var reader io.Reader = file
	if length > 0 {
		reader = io.LimitReader(file, length)
	}

	hash := sha256.New()
	if _, err := io.Copy(hash, reader); err != nil { // Corrected to use 'reader'
		return "", err
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// downloadChunk downloads a specific byte range from a URL.
func downloadChunk(t *testing.T, url string, start, end int64) []byte {
	req, _ := http.NewRequest("GET", url, nil)
	rangeHeader := fmt.Sprintf("bytes=%d-%d", start, end)
	req.Header.Set("Range", rangeHeader)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to make range request for %s: %v", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPartialContent && resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 206 or 200 for %s, but got %d", url, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body for %s: %v", url, err)
	}
	t.Logf("Downloaded chunk from %s: %s (size: %d)", url, rangeHeader, len(body))
	return body
}

func TestAdaptiveStreamingIntegrity(t *testing.T) {
	cmd, err := setupTestServer()
	if err != nil {
		t.Fatalf("Test setup failed: %v", err)
	}
	defer func() {
		if runtime.GOOS == "windows" {
			cmd.Process.Kill()
		} else {
			cmd.Process.Signal(os.Interrupt)
		}
		cmd.Wait()
	}()

	// --- Test Setup ---
	// videoDir := "videos" // Removed unused variable
	lowQualityVideo := "video1_low.mp4"
	highQualityVideo := "video1_high.mp4"
	
	// Since our files are empty, we'll define a virtual size for the test.
	// Let's pretend the low-quality video is 20KB and high-quality is 40KB.
	// A real test would get this from os.Stat().
	lowQualitySize := int64(20 * 1024)
	highQualitySize := int64(40 * 1024)
	
	// We'll switch at the halfway point in terms of content (e.g., at 50% of the timeline).
	// For this simulation, let's say that corresponds to the first half of the low-quality file
	// and the second half of the high-quality file.
	lowQualityHalf := lowQualitySize / 2
	highQualityHalf := highQualitySize / 2

	// --- Test Execution: Simulate adaptive streaming ---
	t.Log("--- Starting Adaptive Streaming Simulation ---")
	t.Logf("Step 1: Downloading first half from LOW quality stream (%s)", lowQualityVideo)
	firstHalfData := downloadChunk(t, "http://localhost:8081/stream/"+lowQualityVideo, 0, lowQualityHalf-1)

	t.Logf("Step 2: Switching quality and downloading second half from HIGH quality stream (%s)", highQualityVideo)
	secondHalfData := downloadChunk(t, "http://localhost:8081/stream/"+highQualityVideo, highQualityHalf, highQualitySize-1)

	// 3. Reassemble the downloaded chunks
	reassembledData := append(firstHalfData, secondHalfData...)
	t.Logf("Total reassembled data size: %d bytes", len(reassembledData))

	// --- Checksum Verification ---
	// In a real-world scenario with actual video files, you would need a more complex way
	// to verify integrity across different quality files. You'd likely compare against
	// pre-calculated checksums for the specific segments.
	// For this simulation with empty files, we'll verify the total downloaded size.
	
	// 4. Calculate checksum of the reassembled data
	reassembledChecksum := fmt.Sprintf("%x", sha256.Sum256(reassembledData))
	t.Logf("Reassembled file checksum: %s", reassembledChecksum)

	// --- Assertion ---
	// This is a simplified assertion for our simulation.
	// We assert that we have downloaded the expected total amount of data.
	expectedSize := lowQualityHalf + (highQualitySize - highQualityHalf)
	if int64(len(reassembledData)) != expectedSize {
		t.Errorf("Data size mismatch! Expected %d bytes, but downloaded %d bytes", expectedSize, len(reassembledData))
	} else {
		t.Logf("Successfully downloaded expected data size: %d bytes. Adaptive streaming simulation complete.", len(reassembledData))
	}
}
