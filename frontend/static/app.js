document.addEventListener('DOMContentLoaded', () => {
    console.log('[Frontend] MPD-parsing version loaded.');

    const videoPlayer = document.getElementById('videoPlayer');
    const videoButtonsContainer = document.getElementById('video-buttons');
    const qualityButtonsContainer = document.getElementById('quality-buttons');
    const nowPlayingEl = document.getElementById('now-playing-title');
    const errorMessageEl = document.getElementById('error-message');
    const currentQualityEl = document.getElementById('current-quality');
    const catalogURL = (window.CATALOG_URL || 'http://localhost:8080') + '/videos';

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
            dashPlayer.initialize(videoPlayer, manifestURL, false);
            nowPlayingEl.textContent = videoTitle;

            // Enable fast quality switching with optimized buffering for 2-second chunks
            dashPlayer.updateSettings({
                'streaming': {
                    'buffer': {
                        'fastSwitchEnabled': true,
                        'bufferTimeAtTopQualityLongForm': 2,
                        'bufferToKeep': 1
                    },
                    'abr': {
                        'autoSwitchBitrate': {
                            'video': false // handle ABR manually
                        },
                        'maxBitrate': { 'video': 5000 },
                        'minBitrate': { 'video': 100 },
                        'initialBitrate': { 'video': 100 },
                        'limitBitrateByPortal': false
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

            // Debug logging for ABR
            setInterval(() => {
                if (!dashPlayer) return;
                
                const activeStream = dashPlayer.getActiveStream();
                if (!activeStream) return; // Wait for stream to be active

                const streamInfo = activeStream.getStreamInfo();
                const dashMetrics = dashPlayer.getDashMetrics();
                const dashAdapter = dashPlayer.getDashAdapter();

                if (dashMetrics && streamInfo) {
                    const periodIdx = streamInfo.index;
                    const repSwitch = dashMetrics.getCurrentRepresentationSwitch('video', true);
                    const bufferLevel = dashMetrics.getCurrentBufferLevel('video', true);
                    const bitrate = repSwitch ? Math.round(dashAdapter.getBandwidthForRepresentation(repSwitch.to, periodIdx) / 1000) : 0;
                    
                    // Get instantaneous throughput from last request
                    let throughput = 0;
                    const lastRequest = dashMetrics.getCurrentHttpRequest('video');
                    
                    if (lastRequest && lastRequest.trace && lastRequest.trace.length > 0) {
                        // Find the last trace entry which typically contains the download completion info
                        const lastTrace = lastRequest.trace[lastRequest.trace.length - 1];
                        
                        // d = duration in ms, b = bytes
                        if (lastTrace.d > 0 && lastTrace.b && lastTrace.b.length > 0) {
                            const downloadTimeSeconds = lastTrace.d / 1000;
                            const bytes = lastTrace.b[0];
                            const bits = bytes * 8;
                            throughput = Math.round(bits / downloadTimeSeconds / 1000); // kbps
                        }
                    }

                    // Fallback to average if instant calc fails
                    if (throughput === 0) {
                        throughput = Math.round(dashPlayer.getAverageThroughput('video') / 1000) || 0;
                    }

                    const safetyFactor = 0.7;
                    const safeThroughput = Math.round(throughput * safetyFactor);
                    
                    console.log(`[Stats] Buffer: ${bufferLevel.toFixed(1)}s | Quality: ${repSwitch ? repSwitch.to : 'N/A'} (${bitrate} kbps) | Speed: ${throughput} kbps | Manual: ${manuallySelectedQuality}`);

                    // --- CUSTOM ABR LOGIC ---
                    // Only run if user hasn't manually selected a quality (Auto mode)
                    if (manuallySelectedQuality === null && repSwitch) {
                        const now = Date.now();
                        const currentQualityIndex = repSwitch.to;
                        
                        // Debug log
                        // console.log(`[Custom ABR Check] Manual: ${manuallySelectedQuality}, Index: ${currentQualityIndex}, Speed: ${throughput}, Cooldown: ${!window.lastSwitchTime || (now - window.lastSwitchTime > 3000)}`);

                        if (!window.lastSwitchTime || (now - window.lastSwitchTime > 3000)) { // 3s cooldown
                            
                            // Rule: Switch DOWN if speed < 3000 kbps
                            if (throughput > 0 && throughput < 3000 && currentQualityIndex == 0) {
                                console.log(`[Custom ABR] Attempting switch DOWN. Speed: ${throughput} < 3000`);
                                
                                // Find low quality ID from our buttons (since API is missing)
                                const buttons = Array.from(document.querySelectorAll('#quality-buttons button[data-quality-index]'));
                                // Sort by index (High=0, Low=1...)
                                buttons.sort((a, b) => parseInt(a.dataset.qualityIndex) - parseInt(b.dataset.qualityIndex));
                                
                                if (buttons.length > 1) {
                                    const lowQualityBtn = buttons[1]; // Index 1 is lower
                                    const lowQualityId = lowQualityBtn.dataset.qualityId;
                                    
                                    console.log(`[Custom ABR] Switching to ID: ${lowQualityId} (${lowQualityBtn.textContent})`);
                                    dashPlayer.setRepresentationForTypeById('video', lowQualityId);
                                    
                                    // FORCE UPDATE: Seek to current time to flush buffer and show new quality immediately
                                    dashPlayer.seek(videoPlayer.currentTime);
                                    
                                    window.lastSwitchTime = now;
                                    updateQualityDisplay('Auto (Switching Down...)');
                                } else {
                                    console.log('[Custom ABR] Could not find quality buttons to switch down');
                                }
                            }
                            
                            // Rule: Switch UP if speed > 3500 kbps
                            else if (throughput > 3500 && currentQualityIndex > 0) {
                                console.log(`[Custom ABR] Attempting switch UP. Speed: ${throughput} > 3500`);
                                
                                const buttons = Array.from(document.querySelectorAll('#quality-buttons button[data-quality-index]'));
                                buttons.sort((a, b) => parseInt(a.dataset.qualityIndex) - parseInt(b.dataset.qualityIndex));
                                
                                if (buttons.length > 0) {
                                    const highQualityBtn = buttons[0]; // Index 0 is highest
                                    const highQualityId = highQualityBtn.dataset.qualityId;
                                    
                                    console.log(`[Custom ABR] Switching to ID: ${highQualityId} (${highQualityBtn.textContent})`);
                                    dashPlayer.setRepresentationForTypeById('video', highQualityId);
                                    
                                    // FORCE UPDATE: Seek to current time to flush buffer and show new quality immediately
                                    dashPlayer.seek(videoPlayer.currentTime);
                                    
                                    window.lastSwitchTime = now;
                                    updateQualityDisplay('Auto (Switching Up...)');
                                }
                            }
                        }
                    } else {
                        // Log if skipping ABR due to manual selection
                        if (manuallySelectedQuality !== null) {
                             // console.log('[Custom ABR] Skipped: Manual quality selected');
                        }
                    }
                    // ------------------------
                }
            }, 1000);

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
