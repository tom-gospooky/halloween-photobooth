class HalloweenPhotobooth {
    constructor() {
        this.video = document.getElementById('main-video');
        this.canvas = document.getElementById('glitch-canvas');
        this.overlay = document.getElementById('overlay');
        this.screenOverlay = document.getElementById('screen-overlay');
        this.loading = document.getElementById('loading');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');

        // Error handling
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;

        // Gallery elements
        this.videoGallery = document.getElementById('video-gallery');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.galleryBtn = document.getElementById('gallery-btn');
        this.galleryClose = document.getElementById('gallery-close');

        // Gallery controls
        this.refreshGalleryBtn = document.getElementById('refresh-gallery-btn');
        this.bulkSelectBtn = document.getElementById('bulk-select-btn');
        this.bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        this.selectAllBtn = document.getElementById('select-all-btn');
        this.cancelBulkBtn = document.getElementById('cancel-bulk-btn');
        this.thumbnailScale = document.getElementById('thumbnail-scale');
        this.scaleValue = document.getElementById('scale-value');

        // Playlist overlay
        this.playlistOverlay = document.getElementById('playlist-overlay');
        this.playlistToggle = document.getElementById('playlist-toggle');
        this.playlistCount = document.getElementById('playlist-count');
        this.playlistList = document.getElementById('playlist-list');

        this.isBulkMode = false;
        this.selectedVideos = new Set();
        this.disabledVideos = new Set();
        this.currentPlayingIndex = -1;

        // Admin elements (merged into settings panel)
        this.statsContent = document.getElementById('stats-content');
        this.resetInputBtn = document.getElementById('reset-input-btn');

        // Settings elements
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsClose = document.getElementById('settings-close');
        this.modelInfo = document.getElementById('model-info');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');

        // Simplified settings controls
        this.videoResolutionSelect = document.getElementById('video-resolution-select');
        this.videoDurationSelect = document.getElementById('video-duration-select');
        this.seedreamImageSizeSelect = document.getElementById('seedream-image-size-select');

        // Other controls
        this.fullscreenBtn = document.getElementById('fullscreen-btn');

        this.videoQueue = [];
        this.screensaverVideos = [];
        this.allVideos = [];
        this.currentVideoIndex = 0;
        this.isPlayingScreensaver = false;
        this.pollInterval = 5000; // 5 seconds

        // Video transition system
        this.videoTransition = null;
        this.isTransitioning = false;

        this.init();
    }
    
    async init() {
        try {
            console.log('🎮 Initializing Halloween Photobooth with GlitchMemories transition...');

            // Initialize video transition system
            this.videoTransition = new VideoGlitchTransition(this.video);
            this.canvas.style.display = 'none'; // Hide the old canvas

            await this.loadScreensaverVideos();
            await this.loadOutputVideos();
            this.startPolling();
            this.setupVideoEvents();
            this.setupUIEvents();
            this.updateStatus('Ready');
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.updateStatus('Error');
        }
    }

    setupUIEvents() {
        // Gallery events
        this.galleryBtn.addEventListener('click', () => this.showGallery());
        this.galleryClose.addEventListener('click', () => this.hideGallery());

        // Gallery control events
        this.refreshGalleryBtn.addEventListener('click', () => this.refreshGallery());
        this.bulkSelectBtn.addEventListener('click', () => this.enterBulkMode());
        this.bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteSelected());
        this.selectAllBtn.addEventListener('click', () => this.selectAllVideos());
        this.cancelBulkBtn.addEventListener('click', () => this.exitBulkMode());
        this.thumbnailScale.addEventListener('input', (e) => this.updateThumbnailScale(e.target.value));

        // Playlist events
        this.playlistToggle.addEventListener('click', () => this.togglePlaylist());

        // Admin actions (merged)
        this.resetInputBtn.addEventListener('click', () => this.resetInputProcessing());

        // Settings events
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.settingsClose.addEventListener('click', () => this.hideSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // Fullscreen event
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Close panels with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideGallery();
                this.hideSettings();
            } else if (e.key === 'h' || e.key === 'H') {
                this.toggleHideUI();
            }
        });

        // Close panels when clicking outside
        this.videoGallery.addEventListener('click', (e) => {
            if (e.target === this.videoGallery) {
                this.hideGallery();
            }
        });

        // (admin panel merged; no separate overlay handler)

        this.settingsPanel.addEventListener('click', (e) => {
            if (e.target === this.settingsPanel) {
                this.hideSettings();
            }
        });
    }
    
    async loadScreensaverVideos() {
        try {
            const response = await fetch('/api/screensaver');
            this.screensaverVideos = await response.json();
            console.log(`Loaded ${this.screensaverVideos.length} screensaver videos`);
        } catch (error) {
            console.error('Failed to load screensaver videos:', error);
        }
    }
    
    async loadOutputVideos() {
        try {
            const response = await fetch('/api/videos');
            const newVideos = await response.json();

            // Add new videos to all videos (avoiding duplicates)
            newVideos.forEach(video => {
                if (!this.allVideos.find(v => v.id === video.id)) {
                    this.allVideos.push(video);
                }
            });

            // Include screensaver videos in all videos
            this.screensaverVideos.forEach(video => {
                if (!this.allVideos.find(v => v.id === video.id)) {
                    this.allVideos.push(video);
                }
            });

            // Build active queue (excluding disabled videos)
            this.updateVideoQueue();
            this.updatePlaylist();

            console.log(`Total videos: ${this.allVideos.length}, Active in queue: ${this.videoQueue.length}`);

            if (this.videoQueue.length > 0) {
                // Hide empty state if showing
                this.hideEmptyState();

                if (this.video.paused || !this.video.src) {
                    // Start from the beginning of the playlist
                    this.currentVideoIndex = 0;
                    this.playNextVideo();
                }
            } else if (this.screensaverVideos.length === 0 && this.allVideos.length === 0) {
                // Show empty state if no videos at all
                this.hideLoading();
                this.showEmptyState();
            } else if (this.videoQueue.length === 0 && this.screensaverVideos.length > 0) {
                // Play screensaver if queue empty but screensaver videos exist
                this.playScreensaver();
            }
        } catch (error) {
            console.error('Failed to load output videos:', error);
        }
    }

    updateVideoQueue() {
        const oldQueue = [...this.videoQueue];
        this.videoQueue = this.allVideos.filter(video => !this.disabledVideos.has(video.id));

        // If queue changed, adjust currentVideoIndex
        if (this.currentVideoIndex >= this.videoQueue.length) {
            this.currentVideoIndex = 0;
        }

        // Reset playing index if current video is no longer in queue
        if (this.currentPlayingIndex !== -1) {
            const currentVideo = oldQueue[this.currentPlayingIndex];
            if (currentVideo && this.disabledVideos.has(currentVideo.id)) {
                this.currentPlayingIndex = -1;
            }
        }

        console.log(`Video queue updated: ${this.videoQueue.length} enabled videos`);
    }
    
    startPolling() {
        setInterval(async () => {
            await this.loadOutputVideos();
        }, this.pollInterval);
    }
    
    setupVideoEvents() {
        this.video.addEventListener('ended', () => {
            console.log('Video ended, playing next video...');
            this.playNextVideo();
        });

        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            this.consecutiveErrors++;

            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                console.error(`❌ ${this.consecutiveErrors} consecutive video errors. Stopping playback.`);
                this.hideLoading();
                this.showEmptyState();
                this.consecutiveErrors = 0;
                return;
            }

            console.log(`⚠️ Video error (${this.consecutiveErrors}/${this.maxConsecutiveErrors}), trying next video...`);
            this.playNextVideo();
        });

        this.video.addEventListener('loadstart', () => {
            this.showLoading();
        });

        this.video.addEventListener('canplay', () => {
            this.hideLoading();
            this.updateOverlayDimensions();

            // Update glitch transition system when video is ready (disabled for now)
            // if (this.glitchTransition && this.video.readyState >= 2) {
            //     this.glitchTransition.setCurrentVideo(this.video);
            // }
        });

        this.video.addEventListener('loadedmetadata', () => {
            this.updateOverlayDimensions();
        });

        // Handle next video preparation (disabled while fixing video playback)
        // this.video.addEventListener('timeupdate', () => {
        //     // Start preparing next video when current video has 3 seconds left
        //     if (this.video.duration && !isNaN(this.video.duration)) {
        //         const timeLeft = this.video.duration - this.video.currentTime;
        //         if (timeLeft <= 3 && timeLeft > 2.9 && !this.isTransitioning && !this.nextVideo) {
        //             console.log('⏰ Preparing next video - 3 seconds remaining');
        //             this.prepareNextVideo();
        //         }
        //     }
        // });

        // Update overlay on window resize
        window.addEventListener('resize', () => {
            this.updateOverlayDimensions();
        });
    }
    
    playNextVideo() {
        if (this.videoQueue.length === 0) {
            this.playScreensaver();
            return;
        }

        // Prioritize new videos if available
        if (this.isPlayingScreensaver && this.videoQueue.length > 0) {
            this.isPlayingScreensaver = false;
            this.currentVideoIndex = 0;
        }

        // Ensure currentVideoIndex is within bounds
        if (this.currentVideoIndex >= this.videoQueue.length) {
            this.currentVideoIndex = 0;
        }

        const video = this.videoQueue[this.currentVideoIndex];
        console.log(`🎬 Playing video ${this.currentVideoIndex + 1} of ${this.videoQueue.length}: ${video.name}`);

        // Play the current video
        this.playVideo(video);

        // Move to next video in queue for the NEXT time this is called
        const nextIndex = (this.currentVideoIndex + 1) % this.videoQueue.length;
        console.log(`📋 Next video will be index ${nextIndex + 1} of ${this.videoQueue.length}`);
        this.currentVideoIndex = nextIndex;

        // Shuffle queue when we complete a full cycle
        if (this.currentVideoIndex === 0 && this.videoQueue.length > 1) {
            console.log(`🔀 Completed full cycle, shuffling ${this.videoQueue.length} videos`);
            this.shuffleQueue();
        }
    }
    
    playScreensaver() {
        if (this.screensaverVideos.length === 0) {
            console.log('⚠️ No screensaver videos available');
            this.hideLoading();
            this.showEmptyState();
            return;
        }

        this.isPlayingScreensaver = true;
        const randomIndex = Math.floor(Math.random() * this.screensaverVideos.length);
        const video = this.screensaverVideos[randomIndex];
        this.playVideo(video);
        this.updateStatus('Screensaver Mode');
    }

    showEmptyState() {
        // Hide video and show empty state message
        this.video.style.display = 'none';
        this.loading.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="font-size: 48px; margin-bottom: 20px;">🎃</p>
                <p style="font-size: 24px; margin-bottom: 10px; color: #ff6b35;">No Videos Yet</p>
                <p style="font-size: 16px; color: #999;">Drop photos in the input folder to generate spooky videos!</p>
            </div>
        `;
        this.loading.classList.remove('hidden');
    }

    hideEmptyState() {
        this.video.style.display = 'block';
        this.loading.innerHTML = `<div class="spinner"></div><p>Generating spooky magic...</p>`;
    }
    
    async playVideo(videoData) {
        try {
            // Ensure video element is visible
            this.hideEmptyState();

            const videoUrl = `/api/video/${videoData.id}`;

            // If there's a current video playing, start GlitchMemories transition
            if (this.videoTransition && this.video.src && this.video.src !== videoUrl && !this.isTransitioning) {
                this.isTransitioning = true;

                // Start the GlitchMemories transition
                await this.videoTransition.startTransition(videoUrl);

                this.isTransitioning = false;
            }

            // Standard video playback
            this.video.src = videoUrl;
            await this.video.play();

            // Reset error counter on successful playback
            this.consecutiveErrors = 0;

            // Track current playing video for playlist display
            this.currentPlayingIndex = this.videoQueue.findIndex(v => v.id === videoData.id);
            this.updatePlaylist();

            if (!this.isPlayingScreensaver) {
                this.updateStatus(`Playing: ${videoData.name}`);
            }

            console.log('🎬 Now playing:', videoData.name);
        } catch (error) {
            console.error('Failed to play video:', error);
            this.consecutiveErrors++;

            // Stop if too many errors
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                console.error(`❌ ${this.consecutiveErrors} consecutive playback failures. Stopping.`);
                this.hideLoading();
                this.showEmptyState();
                this.consecutiveErrors = 0;
                return;
            }

            // Avoid infinite loop if there are no videos
            if (this.videoQueue.length > 0 || this.screensaverVideos.length > 0) {
                console.log(`⚠️ Playback error (${this.consecutiveErrors}/${this.maxConsecutiveErrors}), trying next video...`);
                setTimeout(() => this.playNextVideo(), 1000); // Small delay before retry
            } else {
                this.hideLoading();
                this.showEmptyState();
            }
        }
    }

    prepareNextVideo() {
        if (this.isTransitioning) return;

        // Get the next video that will be played
        let nextVideoData;
        if (this.videoQueue.length === 0) {
            if (this.screensaverVideos.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.screensaverVideos.length);
                nextVideoData = this.screensaverVideos[randomIndex];
            } else {
                return;
            }
        } else {
            const nextIndex = this.currentVideoIndex % this.videoQueue.length;
            nextVideoData = this.videoQueue[nextIndex];
        }

        // Create a hidden video element to preload the next video
        if (this.nextVideo) {
            this.nextVideo.remove();
        }

        this.nextVideo = document.createElement('video');
        this.nextVideo.style.position = 'absolute';
        this.nextVideo.style.opacity = '0';
        this.nextVideo.style.pointerEvents = 'none';
        this.nextVideo.style.zIndex = '-1';
        this.nextVideo.muted = true;
        this.nextVideo.src = `/api/video/${nextVideoData.id}`;

        document.body.appendChild(this.nextVideo);

        console.log('🎬 Preloading next video:', nextVideoData.name);
    }

    async startGlitchTransition(videoData) {
        if (!this.nextVideo || this.isTransitioning) return;

        this.isTransitioning = true;
        console.log('🔥 Starting horror glitch transition');

        // Load the next video if not already loaded
        if (this.nextVideo.readyState < 2) {
            await new Promise((resolve) => {
                this.nextVideo.addEventListener('canplay', resolve, { once: true });
            });
        }

        // Start the transition
        this.glitchTransition.startTransition(this.video, this.nextVideo);

        // Wait for transition to complete
        await new Promise((resolve) => {
            const checkTransition = () => {
                if (!this.glitchTransition.isTransitioning) {
                    resolve();
                } else {
                    setTimeout(checkTransition, 100);
                }
            };
            checkTransition();
        });

        // Swap the video sources
        const tempSrc = this.video.src;
        this.video.src = this.nextVideo.src;

        // Clean up
        this.nextVideo.remove();
        this.nextVideo = null;
        this.isTransitioning = false;

        console.log('✨ Horror glitch transition completed');
    }
    
    shuffleQueue() {
        for (let i = this.videoQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.videoQueue[i], this.videoQueue[j]] = [this.videoQueue[j], this.videoQueue[i]];
        }
        console.log('Video queue shuffled');
    }
    
    showLoading() {
        this.loading.classList.remove('hidden');
    }
    
    hideLoading() {
        this.loading.classList.add('hidden');
    }
    
    updateStatus(text) {
        this.statusText.textContent = text;
        // Auto-hide status after 3 seconds unless it's an error
        if (!text.includes('Error')) {
            setTimeout(() => {
                if (!this.statusIndicator.classList.contains('hidden')) {
                    this.statusIndicator.classList.add('hidden');
                }
            }, 3000);
        }
        this.statusIndicator.classList.remove('hidden');
    }

    // Gallery Methods
    showGallery() {
        this.videoGallery.classList.remove('hidden');
        this.populateGallery();
    }

    hideGallery() {
        this.videoGallery.classList.add('hidden');
    }

    populateGallery() {
        this.galleryGrid.innerHTML = '';

        this.allVideos.forEach((video, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = `video-thumbnail ${this.disabledVideos.has(video.id) ? 'disabled' : ''}`;
            thumbnail.dataset.videoId = video.id;

            // Use video as its own thumbnail
            thumbnail.innerHTML = `
                <div class="video-preview">
                    <video muted preload="metadata" poster="">
                        <source src="/api/video/${video.id}#t=0.5" type="video/mp4">
                    </video>
                    <div class="play-overlay">
                        <div class="play-icon">▶</div>
                    </div>
                </div>
                <div class="info">
                    <h3>${video.name}</h3>
                    <p>Size: ${this.formatFileSize(video.size)}</p>
                    <p>Created: ${new Date(video.created || video.createdTime).toLocaleDateString()}</p>
                </div>
                <div class="thumbnail-actions">
                    <button class="action-btn play-btn" title="Play">▶</button>
                    <button class="action-btn download-btn" title="Download">⬇</button>
                    <button class="action-btn ${this.disabledVideos.has(video.id) ? 'enable-btn' : 'disable-btn'}"
                            title="${this.disabledVideos.has(video.id) ? 'Enable' : 'Disable'}">
                        ${this.disabledVideos.has(video.id) ? '✓' : '⏸'}
                    </button>
                    <button class="action-btn delete-btn" title="Delete">🗑</button>
                </div>
                <div class="bulk-checkbox hidden">
                    <input type="checkbox" id="video-${index}" data-video-id="${video.id}">
                    <label for="video-${index}"></label>
                </div>
            `;

            // Add event listeners
            const playBtn = thumbnail.querySelector('.play-btn');
            const downloadBtn = thumbnail.querySelector('.download-btn');
            const disableBtn = thumbnail.querySelector('.disable-btn, .enable-btn');
            const deleteBtn = thumbnail.querySelector('.delete-btn');
            const videoPreview = thumbnail.querySelector('.video-preview');

            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playVideo(video);
                this.hideGallery();
                this.updateStatus(`Playing: ${video.name}`);
            });

            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadVideo(video.id);
            });

            disableBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleVideoDisabled(video.id);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteVideo(video.id);
            });

            videoPreview.addEventListener('click', () => {
                if (!this.isBulkMode) {
                    this.playVideo(video);
                    this.hideGallery();
                    this.updateStatus(`Playing: ${video.name}`);
                }
            });

            // Handle checkbox events
            const checkbox = thumbnail.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                this.handleVideoSelection(video.id, e.target.checked, thumbnail);
            });

            this.galleryGrid.appendChild(thumbnail);
        });
    }

    // Gallery Control Methods
    enterBulkMode() {
        this.isBulkMode = true;
        this.selectedVideos.clear();

        // Show/hide appropriate buttons
        this.bulkSelectBtn.classList.add('hidden');
        this.bulkDeleteBtn.classList.remove('hidden');
        this.selectAllBtn.classList.remove('hidden');
        this.cancelBulkBtn.classList.remove('hidden');

        // Show all checkboxes and add bulk mode class
        document.querySelectorAll('.video-thumbnail').forEach(thumb => {
            thumb.classList.add('bulk-mode');
            thumb.querySelector('.bulk-checkbox').classList.remove('hidden');
        });
    }

    exitBulkMode() {
        this.isBulkMode = false;
        this.selectedVideos.clear();

        // Show/hide appropriate buttons
        this.bulkSelectBtn.classList.remove('hidden');
        this.bulkDeleteBtn.classList.add('hidden');
        this.selectAllBtn.classList.add('hidden');
        this.cancelBulkBtn.classList.add('hidden');

        // Hide all checkboxes and remove bulk mode class
        document.querySelectorAll('.video-thumbnail').forEach(thumb => {
            thumb.classList.remove('bulk-mode', 'selected');
            thumb.querySelector('.bulk-checkbox').classList.add('hidden');
            thumb.querySelector('input[type="checkbox"]').checked = false;
        });
    }

    selectAllVideos() {
        document.querySelectorAll('.video-thumbnail input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
            const videoId = checkbox.dataset.videoId;
            const thumbnail = checkbox.closest('.video-thumbnail');
            this.handleVideoSelection(videoId, true, thumbnail);
        });
    }

    handleVideoSelection(videoId, isSelected, thumbnail) {
        if (isSelected) {
            this.selectedVideos.add(videoId);
            thumbnail.classList.add('selected');
        } else {
            this.selectedVideos.delete(videoId);
            thumbnail.classList.remove('selected');
        }

        // Update bulk delete button text
        const count = this.selectedVideos.size;
        this.bulkDeleteBtn.textContent = count > 0 ? `Delete Selected (${count})` : 'Delete Selected';
        this.bulkDeleteBtn.disabled = count === 0;
    }

    async bulkDeleteSelected() {
        if (this.selectedVideos.size === 0) return;

        const count = this.selectedVideos.size;
        if (!confirm(`Are you sure you want to delete ${count} selected video${count > 1 ? 's' : ''}?`)) {
            return;
        }

        try {
            this.bulkDeleteBtn.disabled = true;
            this.bulkDeleteBtn.textContent = 'Deleting...';

            const deletePromises = Array.from(this.selectedVideos).map(async (videoId) => {
                const response = await fetch(`/api/video/${videoId}`, {
                    method: 'DELETE'
                });
                return { videoId, success: response.ok };
            });

            const results = await Promise.all(deletePromises);
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            // Remove successful deletions from local arrays
            results.forEach(result => {
                if (result.success) {
                    this.videoQueue = this.videoQueue.filter(v => v.id !== result.videoId);
                    this.allVideos = this.allVideos.filter(v => v.id !== result.videoId);
                }
            });

            // Refresh gallery
            this.populateGallery();
            this.exitBulkMode();

            if (failed > 0) {
                this.updateStatus(`${successful} deleted, ${failed} failed`);
            } else {
                this.updateStatus(`${successful} video${successful > 1 ? 's' : ''} deleted`);
            }
        } catch (error) {
            console.error('Bulk delete failed:', error);
            this.updateStatus('Bulk delete failed');
        } finally {
            this.bulkDeleteBtn.disabled = false;
            this.bulkDeleteBtn.textContent = 'Delete Selected';
        }
    }

    updateThumbnailScale(value) {
        this.scaleValue.textContent = `${value}px`;
        document.documentElement.style.setProperty('--thumbnail-size', `${value}px`);
    }

    async refreshGallery() {
        this.refreshGalleryBtn.textContent = '🔄 Refreshing...';
        this.refreshGalleryBtn.disabled = true;

        try {
            await this.loadOutputVideos();
            this.populateGallery();
            this.updateStatus('Gallery refreshed');
        } catch (error) {
            console.error('Failed to refresh gallery:', error);
            this.updateStatus('Failed to refresh gallery');
        } finally {
            this.refreshGalleryBtn.textContent = '🔄 Refresh';
            this.refreshGalleryBtn.disabled = false;
        }
    }

    toggleVideoDisabled(videoId) {
        if (this.disabledVideos.has(videoId)) {
            this.disabledVideos.delete(videoId);
            this.updateStatus('Video enabled');
        } else {
            this.disabledVideos.add(videoId);
            this.updateStatus('Video disabled');
        }

        // Update video queue and refresh gallery
        this.updateVideoQueue();
        this.populateGallery();
        this.updatePlaylist();
    }

    // Playlist Methods
    togglePlaylist() {
        this.playlistOverlay.classList.toggle('collapsed');
        this.playlistOverlay.classList.toggle('expanded');
    }

    updatePlaylist() {
        const enabledVideos = this.videoQueue;
        this.playlistCount.textContent = `${enabledVideos.length} video${enabledVideos.length !== 1 ? 's' : ''}`;

        this.playlistList.innerHTML = '';

        enabledVideos.forEach((video, index) => {
            const playlistItem = document.createElement('div');
            playlistItem.className = `playlist-item ${index === this.currentPlayingIndex ? 'current' : ''}`;
            playlistItem.innerHTML = `
                <div class="playlist-number">${index + 1}</div>
                <div class="playlist-name">${video.name}</div>
                <div class="playlist-status">${index === this.currentPlayingIndex ? '▶' : ''}</div>
            `;

            playlistItem.addEventListener('click', () => {
                this.currentVideoIndex = index;
                this.playVideo(video);
            });

            this.playlistList.appendChild(playlistItem);
        });

        // Include disabled videos at the bottom
        const disabledVideos = this.allVideos.filter(video => this.disabledVideos.has(video.id));
        if (disabledVideos.length > 0) {
            const separator = document.createElement('div');
            separator.style.cssText = 'border-top: 1px solid rgba(255,107,53,0.3); margin: 10px 0; padding-top: 10px; font-size: 11px; opacity: 0.6; text-align: center;';
            separator.textContent = 'Disabled Videos';
            this.playlistList.appendChild(separator);

            disabledVideos.forEach((video, index) => {
                const playlistItem = document.createElement('div');
                playlistItem.className = 'playlist-item disabled';
                playlistItem.innerHTML = `
                    <div class="playlist-number">-</div>
                    <div class="playlist-name">${video.name}</div>
                    <div class="playlist-status">❌</div>
                `;
                this.playlistList.appendChild(playlistItem);
            });
        }
    }

    // Admin Methods (merged)
    async populateAdmin() { await this.populateSystemStats(); }

    async populateSystemStats() {
        try {
            const [statsResponse, statusResponse] = await Promise.all([
                fetch('/api/stats'),
                fetch('/api/status')
            ]);

            const stats = await statsResponse.json();
            const status = await statusResponse.json();

            // Intelligent data processing
            const processedCount = status.fileWatcher?.processedCount || 0;
            const isRunning = status.status === 'running';
            const fileWatcherActive = status.fileWatcher?.isRunning || false;

            // Format memory usage
            const memoryMB = stats.memory ? Math.round(stats.memory.heapUsed / 1024 / 1024) : 0;
            const memoryTotal = stats.memory ? Math.round(stats.memory.heapTotal / 1024 / 1024) : 0;

            // Color coding based on status
            const statusColor = isRunning ? 'text-green-500' : 'text-red-500';
            const watcherColor = fileWatcherActive ? 'text-green-500' : 'text-yellow-500';
            const modeColor = this.isPlayingScreensaver ? 'text-purple-500' : 'text-halloween-orange';

            // Queue health indicator
            const queueHealth = this.videoQueue.length > 0 ? 'text-green-500' : 'text-yellow-500';
            const queueText = this.videoQueue.length > 0 ? `${this.videoQueue.length} active` : 'Empty';

            this.statsContent.innerHTML = `
                <div class="bg-gray-700/50 rounded p-3 hover:bg-gray-700/70 transition-colors">
                    <div class="text-xs text-gray-400 mb-1">Total Videos</div>
                    <div class="text-lg font-semibold text-white">${this.allVideos.length}</div>
                    <div class="text-xs text-gray-500 mt-1">${this.disabledVideos.size} disabled</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3 hover:bg-gray-700/70 transition-colors">
                    <div class="text-xs text-gray-400 mb-1">Queue Status</div>
                    <div class="text-lg font-semibold ${queueHealth}">${queueText}</div>
                    <div class="text-xs text-gray-500 mt-1">${this.allVideos.length} total</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3 hover:bg-gray-700/70 transition-colors">
                    <div class="text-xs text-gray-400 mb-1">Current Mode</div>
                    <div class="text-lg font-semibold ${modeColor}">${this.isPlayingScreensaver ? '🌙 Screensaver' : '▶️ Playing'}</div>
                    <div class="text-xs text-gray-500 mt-1">${this.videoQueue.length > 0 ? `${this.currentVideoIndex + 1}/${this.videoQueue.length}` : '0/0'}</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3 hover:bg-gray-700/70 transition-colors">
                    <div class="text-xs text-gray-400 mb-1">Processed Files</div>
                    <div class="text-lg font-semibold text-white">${processedCount}</div>
                    <div class="text-xs text-gray-500 mt-1">from input folder</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3 hover:bg-gray-700/70 transition-colors">
                    <div class="text-xs text-gray-400 mb-1">System Status</div>
                    <div class="text-lg font-semibold ${statusColor}">${isRunning ? '✓ Running' : '✗ Stopped'}</div>
                    <div class="text-xs ${watcherColor} mt-1">${fileWatcherActive ? '👁️ Watching files' : '⚠️ Watcher inactive'}</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3 hover:bg-gray-700/70 transition-colors">
                    <div class="text-xs text-gray-400 mb-1">Uptime</div>
                    <div class="text-lg font-semibold text-white">${stats.uptime || 'Unknown'}</div>
                    <div class="text-xs text-gray-500 mt-1">${memoryMB}MB / ${memoryTotal}MB</div>
                </div>
            `;

            // Load input folder status
            await this.loadInputFolderStatus();

        } catch (error) {
            console.error('Failed to load system stats:', error);
            this.statsContent.innerHTML = `
                <div class="bg-gray-700/50 rounded p-3 col-span-2 text-center">
                    <div class="text-xs text-gray-400 mb-2">System Status</div>
                    <div class="text-lg font-semibold text-red-500">⚠️ Error Loading Stats</div>
                    <div class="text-xs text-gray-500 mt-2">Check console for details</div>
                </div>
            `;
        }
    }

    async loadInputFolderStatus() {
        try {
            const response = await fetch('/api/input-status');
            const data = await response.json();

            const inputFolderStats = document.getElementById('input-folder-stats');
            const inputFileList = document.getElementById('input-file-list');

            // Display summary
            const pending = data.statusCounts.pending || 0;
            const processing = data.statusCounts.processing || 0;
            const completed = data.statusCounts.completed || 0;

            inputFolderStats.innerHTML = `
                <div class="flex gap-4 text-xs">
                    <span><strong>Total:</strong> ${data.totalFiles}</span>
                    <span class="text-green-500"><strong>✓</strong> ${completed}</span>
                    <span class="text-yellow-500"><strong>⏳</strong> ${processing}</span>
                    <span class="text-gray-400"><strong>○</strong> ${pending}</span>
                </div>
            `;

            // Display file list
            if (data.files.length === 0) {
                inputFileList.innerHTML = `
                    <div class="text-center text-gray-500 py-4">
                        No images in input folder
                    </div>
                `;
            } else {
                inputFileList.innerHTML = data.files.map(file => {
                    const statusIcon = file.status === 'completed' ? '✓' :
                                     file.status === 'processing' ? '⏳' : '○';
                    const statusColor = file.status === 'completed' ? 'text-green-500' :
                                       file.status === 'processing' ? 'text-yellow-500' : 'text-gray-400';
                    const statusLabel = file.status === 'completed' ? 'Completed' :
                                       file.status === 'processing' ? 'Processing' : 'Pending';
                    const pillColor = file.status === 'completed' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                     file.status === 'processing' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 'text-gray-400 border-gray-500/30 bg-gray-500/10';

                    const stageMap = {
                        queued: 'Queued',
                        prompt: 'Prompt Generation',
                        image_edit: 'Image Editing',
                        video: 'Video Generation',
                        finalizing: 'Finalizing',
                        completed: 'Completed'
                    };
                    const stageText = stageMap[file.stage] || (file.status === 'processing' ? 'Processing' : '');

                    const processedTime = file.processedAt ?
                        new Date(file.processedAt).toLocaleString() : '-';

                    return `
                        <div class="bg-gray-700/30 rounded p-2 text-xs hover:bg-gray-700/50 transition-colors">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span class="${statusColor} font-bold">${statusIcon}</span>
                                    <span class="truncate text-white">${file.filename}</span>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <span class="px-2 py-0.5 rounded-full border ${pillColor}">${statusLabel}</span>
                                    <span class="text-gray-500">${file.sizeFormatted}</span>
                                </div>
                            </div>
                            ${file.status === 'processing' ? `
                                <div class="text-gray-400 mt-1 text-xs ml-6">
                                    Stage: <span class="text-white/90">${stageText}</span>
                                </div>
                            ` : ''}
                            ${file.status === 'completed' ? `
                                <div class="text-gray-500 mt-1 text-xs ml-6">
                                    Processed: ${processedTime}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Failed to load input folder status:', error);
        }
    }

    // Admin Actions

    downloadVideo(videoId) {
        const downloadUrl = `/api/video/${videoId}?download=true`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `video_${videoId}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async deleteVideo(videoId) {
        if (confirm('Are you sure you want to delete this video?')) {
            try {
                const response = await fetch(`/api/video/${videoId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // Remove from local arrays
                    this.videoQueue = this.videoQueue.filter(v => v.id !== videoId);
                    this.allVideos = this.allVideos.filter(v => v.id !== videoId);

                    // Refresh gallery if open
                    if (!this.videoGallery.classList.contains('hidden')) {
                        this.populateGallery();
                    }

                    // Refresh system stats if menu is open
                    if (!this.settingsPanel.classList.contains('hidden')) {
                        this.populateAdmin();
                    }

                    this.updateStatus('Video deleted');
                } else {
                    this.updateStatus('Failed to delete video');
                }
            } catch (error) {
                console.error('Delete failed:', error);
                this.updateStatus('Delete failed');
            }
        }
    }

    // Utility Methods
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    toggleHideUI() {
        document.body.classList.toggle('hide-ui');
    }

    updateOverlayDimensions() {
        if (!this.video.videoWidth || !this.video.videoHeight) {
            return;
        }

        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        const videoAspectRatio = this.video.videoWidth / this.video.videoHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let displayWidth, displayHeight;

        // Calculate actual video display dimensions with object-fit: contain
        if (videoAspectRatio > containerAspectRatio) {
            // Video is wider than container - width is constrained
            displayWidth = containerWidth;
            displayHeight = containerWidth / videoAspectRatio;
        } else {
            // Video is taller than container - height is constrained
            displayHeight = containerHeight;
            displayWidth = containerHeight * videoAspectRatio;
        }

        // Update overlay dimensions to match visible video area
        this.overlay.style.width = `${displayWidth}px`;
        this.overlay.style.height = `${displayHeight}px`;

        // Update screen overlay dimensions as well
        this.screenOverlay.style.width = `${displayWidth}px`;
        this.screenOverlay.style.height = `${displayHeight}px`;

        console.log(`Video dimensions: ${this.video.videoWidth}x${this.video.videoHeight}`);
        console.log(`Display dimensions: ${displayWidth}x${displayHeight}`);
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async resetInputProcessing() {
        if (!confirm('Are you sure you want to reset input processing? This will clear the history of processed images and treat all images in the input folder as new. This action cannot be undone.')) {
            return;
        }

        try {
            // Disable the button during the operation
            this.resetInputBtn.disabled = true;
            this.resetInputBtn.textContent = 'Resetting...';

            const response = await fetch('/api/admin/reset-input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok) {
                this.updateStatus('Input processing reset - monitoring progress...');
                // Start polling to show real-time updates
                if (this.resetPollingInterval) {
                    clearInterval(this.resetPollingInterval);
                }
                this.resetPollingInterval = setInterval(async () => {
                    await this.populateSystemStats();
                }, 2000); // Poll every 2 seconds

                // Refresh immediately
                await this.populateSystemStats();
            } else {
                this.updateStatus('Failed to reset input processing');
                console.error('Reset failed:', result.error);
            }
        } catch (error) {
            console.error('Reset input processing failed:', error);
            this.updateStatus('Reset failed - check console');
        } finally {
            // Re-enable the button
            this.resetInputBtn.disabled = false;
            this.resetInputBtn.textContent = 'Reset Input Processing';
        }
    }

    // Settings Panel Methods
    async showSettings() {
        this.settingsPanel.classList.remove('hidden');
        await this.loadSettings();
        await this.populateSystemStats();

        // Auto-refresh stats every 5 seconds while settings panel is open
        if (this.statsRefreshInterval) {
            clearInterval(this.statsRefreshInterval);
        }
        this.statsRefreshInterval = setInterval(async () => {
            if (!this.settingsPanel.classList.contains('hidden')) {
                await this.populateSystemStats();
            } else {
                clearInterval(this.statsRefreshInterval);
                this.statsRefreshInterval = null;
            }
        }, 5000);
    }

    hideSettings() {
        this.settingsPanel.classList.add('hidden');
        // Clear stats refresh interval when closing
        if (this.statsRefreshInterval) {
            clearInterval(this.statsRefreshInterval);
            this.statsRefreshInterval = null;
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();

            // Load simplified settings
            if (settings.resolution && this.videoResolutionSelect) {
                this.videoResolutionSelect.value = settings.resolution;
            }

            if (settings.duration && this.videoDurationSelect) {
                this.videoDurationSelect.value = String(settings.duration);
            }

            if (settings.seedreamImageSize && this.seedreamImageSizeSelect) {
                this.seedreamImageSizeSelect.value = settings.seedreamImageSize;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // Removed updateModelInfo - no longer needed with fixed model

    async saveSettings() {
        try {
            this.saveSettingsBtn.disabled = true;
            this.saveSettingsBtn.textContent = 'Saving...';

            const settings = {
                resolution: this.videoResolutionSelect.value,
                duration: this.videoDurationSelect.value,
                seedreamImageSize: this.seedreamImageSizeSelect.value
            };

            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.updateStatus('Settings saved successfully');
                this.hideSettings();
            } else {
                this.updateStatus('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.updateStatus('Failed to save settings');
        } finally {
            this.saveSettingsBtn.disabled = false;
            this.saveSettingsBtn.textContent = 'Save Settings';
        }
    }
}

// Initialize when DOM is loaded
let halloweenPhotobooth;
document.addEventListener('DOMContentLoaded', () => {
    halloweenPhotobooth = new HalloweenPhotobooth();
});
