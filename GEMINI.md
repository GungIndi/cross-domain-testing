# Simple Video Streaming App for Specialized Testing

This project demonstrates three distinct, specialized testing strategies in the context of a simple video streaming application built with a Go-based microservices architecture.


## 1. Architecture

The architecture is simplified to two core microservices written in Go:

*   **`video-catalog-service`**: A Go service that acts as the video catalog. It has a single API endpoint (`/videos`) that provides metadata about available videos.

*   **`streaming-service`**: A Go service responsible for the actual video streaming. It serves video files and supports HTTP Range Requests to simulate chunk-based streaming.

## 2. Technology Stack

*   **Backend**: Go (using the standard library for simplicity and performance)
*   **Containerization**: Docker
*   **Deployment**: Google Cloud Run
*   **Testing Tools**:
    *   Pact-Go (for Contract Testing)
    *   k6 (for Load Testing)
    *   Go's built-in testing library (for the custom integrity test)

## 3. The Three Specialized Testing Strategies

This is the core focus of the project.

### Strategy 1: Microservice Architecture Test (Contract Testing)

*   **Goal**: To ensure our microservices can evolve independently without breaking each other. We will test the API contract between our two services.
*   **Implementation**:
    1.  We will define a "consumer" relationship, where the `streaming-service` needs information from the `video-catalog-service`.
    2.  Using **Pact-Go**, we will write a test in the `streaming-service` (the consumer) that defines the exact JSON structure it expects from the `video-catalog-service`'s `/videos` endpoint. This generates a `pact` file (the contract).
    3.  The `video-catalog-service` (the provider) will then run a verification test against this `pact` file to guarantee it honors the contract.

### Strategy 2: Video Streaming Platform Test (Chunk-Based Integrity Test)

*   **Goal**: To verify the reliability of the video delivery mechanism, mimicking how a real video player works.
*   **Implementation**:
    1.  We will create a custom test for the `streaming-service` using Go's standard testing library.
    2.  This test will act as a client and make a series of **HTTP Range Requests** to download a video file in small, sequential chunks.
    3.  After all chunks are downloaded, the test will reassemble them in memory.
    4.  Finally, it will calculate a **SHA256 checksum** of the reassembled file and assert that it matches the checksum of the original file on disk, proving that the streaming delivery was flawless.

### Strategy 3: Cloud Environment Test (Scalability Load Test)

*   **Goal**: To test the auto-scaling capabilities of our specialized cloud environment (Google Cloud Run).
*   **Implementation**:
    1.  The `streaming-service` will be packaged as a Docker container and deployed to **Google Cloud Run**.
    2.  Using **k6**, we will write a script to simulate a sudden, massive traffic spike (e.g., 500+ virtual users trying to stream a video simultaneously).
    3.  We will execute the k6 script and observe the Google Cloud Run metrics, watching it automatically scale up the number of container instances to handle the load. The test results will report on performance and error rates under pressure.

# AI Assistant File Change Workflow

To ensure clarity, safety, and control over actions made by an AI assistant, the following workflow must be followed for any proposed modification to the codebase or when reading files.

## 1. Plan

Before making any changes, the AI assistant must present a clear and concise plan. This plan must include the following details:

*   **What to change:** A specific description of the files and code sections that will be modified. this also included the absolute path of the file.
*   **Purpose:** A clear explanation of the goal of the change (e.g., fixing a bug, adding a feature, improving performance).
*   **Risk:** An assessment of potential risks and side effects (e.g., breaking changes, performance degradation, security vulnerabilities).
*   **Why it's needed:** A justification for why the change is necessary or beneficial.
*   **What command need to run:** The list of specific linux command that need to run to make the change.

## 2. Approval

The user will review the plan. The AI assistant must wait for explicit approval from the user before proceeding with the implementation.

## 3. Execute

Once the plan is approved, the workflow can follow the usual AI practice, which AI assistant ask again about the change with the usual choice of Yes and editing, and after that AI assistant can proceed with executing the changes as described in the plan.

# File Reading Workflow

To ensure clarity and control over file reading actions, the following workflow must be followed:

## 1. Plan

Before reading any files, the AI assistant must present a clear and concise plan. This plan must include the following details:

*   **Files to read:** A specific description of the files to be read, including their absolute paths.
*   **Purpose:** A clear explanation of the goal of reading these files.
*   **Why it's needed:** A justification for why reading these files is necessary or beneficial.

## 2. Approval

The user will review the plan. The AI assistant must wait for explicit approval from the user before proceeding with reading the files.

## 3. Execute

Once the plan is approved, the AI assistant can proceed with reading the specified files.

# Command Execution Workflow

For any command that needs to be run in terminal. Even tho it's just a ls command, AI Assistant must first ask for permission and provide the following details:

* **The Command:** The exact command to be run.
* **Explanation:** A clear description of what the command does.
* **Why it's needed:** The specific reason this command is required to complete the current task.
* **What will be affected:** Any files, directories, or system states that will be created, modified, or deleted.

