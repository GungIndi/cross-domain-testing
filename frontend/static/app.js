document.addEventListener('DOMContentLoaded', () => {
    console.log('[Frontend] MPD-parsing version loaded.');

    const videoPlayer = document.getElementById('videoPlayer');
    const videoButtonsContainer = document.getElementById('video-buttons');
    const qualityButtonsContainer = document.getElementById('quality-buttons');
    const nowPlayingEl = document.getElementById('now-playing-title');
    const errorMessageEl = document.getElementById('error-message');
    const currentQualityEl = document.getElementById('current-quality');
    const catalogURL = 'http://localhost:8080/videos';

    let dashPlayer = null;
    let currentVideoId = null;
    let manuallySelectedQuality = null; // Track user's manual quality selection

    function displayError(message) {
        errorMessageEl.textContent = `[ERROR] ${message}`;
        console.error(message);
    }

    function initializeDashPlayer(manifestURL, videoTitle) {
        if (dashPlayer) {
            dashPlayer.destroy();
        }
        try {
            dashPlayer = dashjs.MediaPlayer().create();
            dashPlayer.initialize(videoPlayer, manifestURL, true);
            nowPlayingEl.textContent = videoTitle;

            // Enable fast quality switching with optimized buffering for 2-second chunks
            dashPlayer.updateSettings({
                'streaming': {
                    'buffer': {
                        'fastSwitchEnabled': true,
                        'bufferTimeAtTopQuality': 6,        // 6 seconds = 3 chunks of 2s each
                        'bufferTimeAtTopQualityLongForm': 6,
                        'bufferToKeep': 4                   // Keep 4 seconds behind = 2 chunks
                    },
                    'abr': {
                        'autoSwitchBitrate': {
                            'video': true
                        },
                        'maxBitrate': { 'video': 5000 },    // Max 5Mbps
                        'minBitrate': { 'video': 100 }     // Min 100kbps
                    }
                }
            });

            dashPlayer.on(dashjs.MediaPlayer.events.PLAYBACK_ERROR, (e) => {
                if (e.error) displayError(`Playback Error: ${e.error.message}`);
            });

            // Listen for quality changes from any source (ABR, manual, seeking)
            dashPlayer.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
                if (e.mediaType === 'video') {
                    console.log(`Quality changed to index: ${e.newQuality}`);
                    updateActiveQualityButton(e.newQuality);
                    // Don't call updateQualityDisplay here - we'll do it manually on button clicks
                }
            });

            // Also listen for quality change requests
            dashPlayer.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (e) => {
                if (e.mediaType === 'video') {
                    console.log(`Quality change requested to index: ${e.newQuality}`);
                }
            });

            // The only thing we do now is parse the manifest ourselves
            parseManifestAndBuildQualityUI(manifestURL);

        } catch (e) {
            displayError(`Failed to initialize DASH player: ${e.message}`);
        }
    }

    async function parseManifestAndBuildQualityUI(manifestURL) {
        try {
            console.log(`Fetching manifest to build UI: ${manifestURL}`);
            const response = await fetch(manifestURL);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.statusText}`);
            }
            const manifestText = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(manifestText, "application/xml");

            const representations = Array.from(xmlDoc.querySelectorAll('Representation[mimeType^="video"]'));
            console.log(`Found ${representations.length} video representations in the manifest.`);

            qualityButtonsContainer.innerHTML = '';
            if (representations.length > 1) {
                const qualities = representations.map(rep => ({
                    id: rep.getAttribute('id'),
                    height: rep.getAttribute('height'),
                    bandwidth: rep.getAttribute('bandwidth')
                })).sort((a, b) => b.height - a.height); // Sort from high to low

                // Add Auto button
                const autoButton = document.createElement('button');
                autoButton.textContent = 'Auto';
                autoButton.dataset.qualityMode = 'auto';
                autoButton.onclick = () => {
                    if (!dashPlayer) return;
                    manuallySelectedQuality = null; // Clear manual selection
                    dashPlayer.updateSettings({ 'streaming': { 'abr': { 'autoSwitchBitrate': { 'video': true } } } });
                    document.querySelectorAll('#quality-buttons button').forEach(btn => btn.classList.remove('active'));
                    autoButton.classList.add('active');
                    updateQualityDisplay('Auto (adapting...)');
                };
                qualityButtonsContainer.appendChild(autoButton);

                // Add buttons for each quality
                qualities.forEach((quality, index) => {
                    const button = document.createElement('button');
                    button.textContent = `${quality.height}p`;
                    button.dataset.qualityId = quality.id;
                    button.dataset.qualityIndex = index;
                    button.onclick = () => {
                        if (!dashPlayer) return;
                        console.log(`User clicked quality: ${quality.height}p (id: ${quality.id}, index: ${index})`);
                        
                        // Track manual selection
                        manuallySelectedQuality = quality.id;
                        
                        // Disable auto bitrate switching
                        dashPlayer.updateSettings({ 'streaming': { 'abr': { 'autoSwitchBitrate': { 'video': false } } } });
                        
                        // Set the new quality
                        dashPlayer.setRepresentationForTypeById('video', quality.id);
                        
                        // Update UI immediately
                        document.querySelectorAll('#quality-buttons button').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        updateQualityDisplay(quality.height + 'p');
                    };
                    qualityButtonsContainer.appendChild(button);
                });

                // Set Auto as default active
                autoButton.classList.add('active');
                updateQualityDisplay('Auto (adapting...)');
                
                // No need for setTimeout - we update manually on clicks
            }
        } catch (error) {
            console.error('Failed to parse manifest and build UI:', error);
            displayError('Could not parse video manifest to get quality levels.');
        }
    }

    function updateQualityDisplay(qualityText) {
        if (!currentQualityEl) return;
        
        currentQualityEl.textContent = `Currently Playing: ${qualityText}`;
        
        // Color code based on quality
        if (qualityText.includes('720') || qualityText.includes('1080')) {
            currentQualityEl.style.color = '#4CAF50'; // Green for high
        } else if (qualityText.includes('240') || qualityText.includes('360')) {
            currentQualityEl.style.color = '#FF9800'; // Orange for low
        } else if (qualityText === 'Auto') {
            currentQualityEl.style.color = '#2196F3'; // Blue for auto
        } else {
            currentQualityEl.style.color = '#FFF'; // White for unknown
        }
    }

    function updateActiveQualityButton(qualityIndex) {
        // If user manually selected a quality, keep that button highlighted
        if (manuallySelectedQuality !== null) {
            const manualButton = document.querySelector(`#quality-buttons button[data-quality-id="${manuallySelectedQuality}"]`);
            if (manualButton && manualButton.classList.contains('active')) {
                console.log(`Keeping manually selected quality highlighted: ${manuallySelectedQuality}`);
                return; // Don't change the highlight
            }
        }
        
        // Remove active class from all buttons except Auto
        document.querySelectorAll('#quality-buttons button:not([data-quality-mode="auto"])').forEach(btn => btn.classList.remove('active'));
        
        // Find and activate the button matching the quality index
        // Try by index first (more reliable)
        let activeButton = document.querySelector(`#quality-buttons button[data-quality-index="${qualityIndex}"]`);
        
        // Fallback to ID if index doesn't work
        if (!activeButton) {
            activeButton = document.querySelector(`#quality-buttons button[data-quality-id="${qualityIndex}"]`);
        }
        
        if (activeButton) {
            activeButton.classList.add('active');
            console.log(`Updated active button to quality index: ${qualityIndex}`);
        } else {
            console.log(`Could not find button for quality index: ${qualityIndex}`);
        }
    }

    fetch(catalogURL)
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                displayError('No videos found in catalog.');
                return;
            }
            renderVideoButtons(data);
            if (data[0] && data[0].stream_url) {
                playVideo(data[0].id, data[0].stream_url, data[0].title);
            }
        })
        .catch(error => {
            displayError(`Could not load video catalog: ${error.message}`);
        });

    function renderVideoButtons(videoData) {
        videoButtonsContainer.innerHTML = '';
        videoData.forEach(video => {
            const button = document.createElement('button');
            button.textContent = video.title;
            button.dataset.videoId = video.id;
            button.onclick = () => playVideo(video.id, video.stream_url, video.title);
            videoButtonsContainer.appendChild(button);
        });
    }

    function playVideo(videoId, manifestURL, videoTitle) {
        if (currentVideoId === videoId) return;
        currentVideoId = videoId;
        document.querySelectorAll('#video-buttons button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.videoId === videoId);
        });
        initializeDashPlayer(manifestURL, videoTitle);
    }
});
