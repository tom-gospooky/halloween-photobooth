class HalloweenPhotobooth {
    constructor() {
        this.video = document.getElementById('main-video');
        this.canvas = document.getElementById('glitch-canvas');
        this.overlay = document.getElementById('overlay');
        this.screenOverlay = document.getElementById('screen-overlay');
        this.loading = document.getElementById('loading');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');

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

        // Admin elements
        this.adminPanel = document.getElementById('admin-panel');
        this.adminBtn = document.getElementById('admin-btn');
        this.adminClose = document.getElementById('admin-close');
        this.statsContent = document.getElementById('stats-content');
        this.resetInputBtn = document.getElementById('reset-input-btn');

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

        // Admin events
        this.adminBtn.addEventListener('click', () => this.showAdmin());
        this.adminClose.addEventListener('click', () => this.hideAdmin());
        this.resetInputBtn.addEventListener('click', () => this.resetInputProcessing());

        // Fullscreen event
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Close panels with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideGallery();
                this.hideAdmin();
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

        this.adminPanel.addEventListener('click', (e) => {
            if (e.target === this.adminPanel) {
                this.hideAdmin();
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

            if (this.videoQueue.length > 0 && (this.video.paused || !this.video.src)) {
                // Start from the beginning of the playlist
                this.currentVideoIndex = 0;
                this.playNextVideo();
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
        if (this.screensaverVideos.length === 0) return;
        
        this.isPlayingScreensaver = true;
        const randomIndex = Math.floor(Math.random() * this.screensaverVideos.length);
        const video = this.screensaverVideos[randomIndex];
        this.playVideo(video);
        this.updateStatus('Screensaver Mode');
    }
    
    async playVideo(videoData) {
        try {
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

            // Track current playing video for playlist display
            this.currentPlayingIndex = this.videoQueue.findIndex(v => v.id === videoData.id);
            this.updatePlaylist();

            if (!this.isPlayingScreensaver) {
                this.updateStatus(`Playing: ${videoData.name}`);
            }

            console.log('🎬 Now playing:', videoData.name);
        } catch (error) {
            console.error('Failed to play video:', error);
            this.playNextVideo();
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

    // Admin Methods
    showAdmin() {
        this.adminPanel.classList.remove('hidden');
        this.populateAdmin();
    }

    hideAdmin() {
        this.adminPanel.classList.add('hidden');
    }

    async populateAdmin() {
        await this.populateSystemStats();
    }

    async populateSystemStats() {
        try {
            const [statsResponse, statusResponse] = await Promise.all([
                fetch('/api/stats'),
                fetch('/api/status')
            ]);

            const stats = await statsResponse.json();
            const status = await statusResponse.json();

            // Get processed files count from status
            const processedCount = status.fileWatcher?.processedCount || 0;

            this.statsContent.innerHTML = `
                <div class="stats-item">
                    <h4>Total Videos</h4>
                    <p>${this.allVideos.length} videos</p>
                </div>
                <div class="stats-item">
                    <h4>Queue Status</h4>
                    <p>${this.videoQueue.length} videos in queue</p>
                </div>
                <div class="stats-item">
                    <h4>Current Mode</h4>
                    <p>${this.isPlayingScreensaver ? 'Screensaver' : 'Playing Queue'}</p>
                </div>
                <div class="stats-item">
                    <h4>Processed Files</h4>
                    <p>${processedCount} files processed</p>
                </div>
                <div class="stats-item">
                    <h4>System Status</h4>
                    <p>${stats.status || 'Running'}</p>
                </div>
                <div class="stats-item">
                    <h4>Uptime</h4>
                    <p>${stats.uptime || 'Unknown'}</p>
                </div>
            `;
        } catch (error) {
            this.statsContent.innerHTML = `
                <div class="stats-item">
                    <h4>System Status</h4>
                    <p>Error loading stats</p>
                </div>
            `;
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

                    // Refresh admin panel if open
                    if (!this.adminPanel.classList.contains('hidden')) {
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
                this.updateStatus('Input processing reset successfully');
                // Refresh admin panel to show updated stats
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
}

// Initialize when DOM is loaded
let halloweenPhotobooth;
document.addEventListener('DOMContentLoaded', () => {
    halloweenPhotobooth = new HalloweenPhotobooth();
});