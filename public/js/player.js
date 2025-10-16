import { PlaylistStateStore, DEFAULT_PLAYLIST_SETTINGS } from './playlistStateStore.js';
import { VideoGlitchTransition } from './videoTransition.js';

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

        this.playlistStateStore = new PlaylistStateStore(window.localStorage);
        this.playlistState = this.playlistStateStore.setSchedulerState({
            started: false,
            paused: true,
            outputsSinceScreensaver: 0,
            screensaversInRow: 0
        });

        this.isBulkMode = false;
        this.selectedVideos = new Set();
        this.disabledVideos = new Set();
        this.currentPlayingIndex = -1;
        this.videoDurations = new Map();

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
        this.seedreamCustomSizeContainer = document.getElementById('seedream-custom-size');
        this.seedreamCustomWidthInput = document.getElementById('seedream-custom-width');
        this.seedreamCustomHeightInput = document.getElementById('seedream-custom-height');
        this.playbackRateInput = document.getElementById('playback-rate-input');
        this.playbackRateValue = document.getElementById('playback-rate-value');
        this.currentPlaybackRate = 1.0;

        this.screensaverEnabledToggle = document.getElementById('screensaver-enabled');
        this.screensaverOutputsInput = document.getElementById('screensaver-outputs');
        this.screensaverCountInput = document.getElementById('screensaver-count');

        // Other controls
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetPlaylistBtn = document.getElementById('reset-playlist-btn');

        this.videoQueue = [];
        this.screensaverVideos = [];
        this.allVideos = [];
        this.videoLookup = new Map();
        this.currentVideoIndex = 0;
        this.isPlayingScreensaver = false;
        this.currentVideoId = null;
        this.currentVideoIsScreensaver = false;
        this.currentScreensaverReason = 'fallback';
        this.currentScreensaverId = null;
        this.lastScreensaverId = null;
        this.currentOutputId = null;
        this.lastOutputId = null;
        this.durationLoaders = new Map();
        this.pollInterval = 5000; // 5 seconds

        // Video transition system
        this.videoTransition = null;
        this.isTransitioning = false;

        this.updateControlPanel();
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
            await this.loadSettings();
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

        // Playback controls
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startPlayback());
        }
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.pausePlayback());
        }
        if (this.resetPlaylistBtn) {
            this.resetPlaylistBtn.addEventListener('click', () => this.resetPlayback());
        }

        if (this.screensaverEnabledToggle) {
            this.screensaverEnabledToggle.addEventListener('change', () => this.updateScreensaverControlAvailability());
        }
        if (this.screensaverOutputsInput) {
            this.screensaverOutputsInput.addEventListener('input', () => this.clampScreensaverInputs());
        }
        if (this.screensaverCountInput) {
            this.screensaverCountInput.addEventListener('input', () => this.clampScreensaverInputs());
        }

        // Admin actions (merged)
        this.resetInputBtn.addEventListener('click', () => this.resetInputProcessing());

        // Settings events
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.settingsClose.addEventListener('click', () => this.hideSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        if (this.seedreamImageSizeSelect) {
            this.seedreamImageSizeSelect.addEventListener('change', () => this.updateSeedreamCustomVisibility());
        }
        if (this.playbackRateInput) {
            this.playbackRateInput.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) {
                    this.playbackRateValue.textContent = v.toFixed(1) + 'x';
                }
            });
        }

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

        this.updateScreensaverControlAvailability();
    }
    
    async loadScreensaverVideos() {
        try {
            const previousOrder = this.playlistState?.screensaver?.order || [];
            const response = await fetch('/api/screensaver');
            const screensaverData = await response.json();
            this.screensaverVideos = screensaverData
                .map(video => ({
                    ...video,
                    type: 'screensaver'
                }));

            this.sortScreensaverVideos();

            const screensaverOrder = this.screensaverVideos.map(video => video.id);
            this.playlistState = this.playlistStateStore.setScreensaverOrder(screensaverOrder);
            if (previousOrder.length === 0 || screensaverOrder.length === 0) {
                this.playlistState = this.playlistStateStore.setScreensaverIndex(0);
            }

            this.screensaverVideos.forEach(video => this.mergeVideoIntoAllVideos(video));
            this.buildVideoLookup();
            this.ensureDurations(this.screensaverVideos);

            console.log(`Loaded ${this.screensaverVideos.length} screensaver videos`);
        } catch (error) {
            console.error('Failed to load screensaver videos:', error);
        }
    }
    
    async loadOutputVideos() {
        try {
            const response = await fetch('/api/videos');
            const fetchedVideos = await response.json();
            const newVideos = fetchedVideos.map(video => ({
                ...video,
                type: 'output'
            }));

            newVideos.forEach(video => this.mergeVideoIntoAllVideos(video));
            this.buildVideoLookup();
            this.ensureDurations(newVideos);

            this.syncPlaylistState();

            // Build active queue (excluding disabled videos)
            this.updateVideoQueue();
            this.updatePlaylist();

            console.log(`Total videos: ${this.allVideos.length}, Active in queue: ${this.videoQueue.length}`);

            if (this.videoQueue.length > 0) {
                this.hideEmptyState();
                const autoAdvance = this.shouldAutoAdvance();

                if (autoAdvance) {
                    if (!this.currentVideoId && !this.currentVideoIsScreensaver) {
                        this.playNextVideo();
                    } else if (this.video && this.video.paused) {
                        this.video.play().catch((error) => {
                            console.warn('Failed to resume playback after refresh:', error);
                            this.playNextVideo();
                        });
                    }
                } else if (this.shouldAutoAdvance() && !this.currentVideoId && !this.currentVideoIsScreensaver && (!this.video || !this.video.src) && this.screensaverVideos.length > 0) {
                    this.playScreensaver('fallback');
                }
            } else if (this.screensaverVideos.length === 0 && this.allVideos.length === 0) {
                // Show empty state if no videos at all
                this.hideLoading();
                this.showEmptyState();
            } else if (this.shouldAutoAdvance() && this.videoQueue.length === 0 && this.screensaverVideos.length > 0) {
                // Play screensaver if queue empty but screensaver videos exist
                this.playScreensaver('fallback');
            }
        } catch (error) {
            console.error('Failed to load output videos:', error);
        }
    }

    syncPlaylistState() {
        const disabledSet = new Set(this.disabledVideos);
        const outputs = this.getOutputVideos();
        this.playlistState = this.playlistStateStore.syncOutputVideos(outputs, disabledSet);

        // Reconcile disabled set from persisted state (ensures stored preferences stick)
        const nextDisabled = new Set();
        Object.keys(this.playlistState.videoMeta).forEach(id => {
            const meta = this.playlistState.videoMeta[id];
            if (meta && meta.disabled) {
                nextDisabled.add(id);
            }
        });
        this.disabledVideos = nextDisabled;
        this.updateControlPanel();
    }

    updateControlPanel() {
        if (!this.startBtn || !this.pauseBtn || !this.resetPlaylistBtn) {
            return;
        }

        const scheduler = this.playlistState?.scheduler || {};
        const started = Boolean(scheduler.started);
        const paused = !started || scheduler.paused !== false;

        const startLabel = started && paused ? 'Resume Playlist' : 'Start Playlist';
        this.startBtn.disabled = started && !paused;
        this.startBtn.setAttribute('title', startLabel);
        this.startBtn.setAttribute('aria-label', startLabel);

        const pauseLabel = 'Pause Playlist';
        this.pauseBtn.disabled = !started || paused;
        this.pauseBtn.setAttribute('title', pauseLabel);
        this.pauseBtn.setAttribute('aria-label', pauseLabel);

        const resetLabel = 'Reset Playlist';
        this.resetPlaylistBtn.setAttribute('title', resetLabel);
        this.resetPlaylistBtn.setAttribute('aria-label', resetLabel);
    }

    updateScreensaverControlAvailability() {
        const enabled = this.screensaverEnabledToggle ? this.screensaverEnabledToggle.checked : true;
        [this.screensaverOutputsInput, this.screensaverCountInput].forEach((input) => {
            if (input) {
                input.disabled = !enabled;
            }
        });
    }

    clampScreensaverInputs() {
        const clampValue = (input, minimum = 0) => {
            if (!input) return;
            const value = Number(input.value);
            const clamped = Math.max(minimum, Number.isFinite(value) ? Math.floor(value) : 0);
            input.value = String(clamped);
        };
        clampValue(this.screensaverOutputsInput, 0);
        clampValue(this.screensaverCountInput, 0);
    }

    shouldAutoAdvance() {
        const scheduler = this.playlistState?.scheduler || {};
        return Boolean(scheduler.started) && scheduler.paused === false;
    }

    startPlayback() {
        const scheduler = this.playlistState?.scheduler || {};
        if (scheduler.started && scheduler.paused === false) {
            return;
        }

        this.playlistState = this.playlistStateStore.setSchedulerState({
            started: true,
            paused: false
        });
        this.updateControlPanel();

        if (this.video && this.video.src) {
            if (this.currentVideoIsScreensaver && this.video.paused && this.videoQueue.length === 0) {
                this.video.play().catch((error) => {
                    console.warn('Failed to resume screensaver playback:', error);
                    this.playNextVideo();
                });
                this.updateStatus('Screensaver Mode');
                return;
            }

            if (this.currentVideoId && this.video.paused) {
                this.video.play().then(() => {
                    const currentVideo = this.videoLookup.get(this.currentVideoId);
                    if (currentVideo) {
                        this.updateStatus(`Resumed: ${currentVideo.name}`);
                    } else {
                        this.updateStatus('Resumed playback');
                    }
                }).catch((error) => {
                    console.warn('Failed to resume video playback:', error);
                    this.playNextVideo();
                });
                return;
            }
        }

        this.playNextVideo();
    }

    pausePlayback() {
        const scheduler = this.playlistState?.scheduler || {};
        if (!scheduler.started || scheduler.paused === true) {
            return;
        }

        this.playlistState = this.playlistStateStore.setSchedulerState({
            started: true,
            paused: true
        });

        if (this.video) {
            try {
                this.video.pause();
            } catch (error) {
                console.warn('Failed to pause video playback:', error);
            }
        }

        this.updateControlPanel();

        if (this.currentVideoIsScreensaver) {
            this.updateStatus('Screensaver paused');
            return;
        }

        if (this.currentVideoId) {
            const currentVideo = this.videoLookup.get(this.currentVideoId);
            this.updateStatus(`Paused: ${currentVideo ? currentVideo.name : 'Playback'}`);
        } else {
            this.updateStatus('Playback paused');
        }
    }

    resetPlayback() {
        const outputs = this.getOutputVideos();
        this.playlistState = this.playlistStateStore.resetPlayback(outputs);

        this.disabledVideos = new Set(
            Object.keys(this.playlistState.videoMeta || {}).filter((id) => {
                const meta = this.playlistState.videoMeta[id];
                return meta && meta.disabled;
            })
        );

        const sortedOutputs = outputs.slice().sort((a, b) => this.getVideoTimestamp(a) - this.getVideoTimestamp(b));
        const screensavers = this.allVideos.filter(video => video.type === 'screensaver');
        this.allVideos = sortedOutputs.concat(screensavers);
        this.sortScreensaverVideos();
        this.playlistState = this.playlistStateStore.setScreensaverOrder(this.screensaverVideos.map(video => video.id));
        this.playlistState = this.playlistStateStore.setScreensaverIndex(0);
        this.buildVideoLookup();

        this.updateVideoQueue();
        this.currentVideoId = null;
        this.currentPlayingIndex = -1;
        this.currentVideoIndex = 0;
        this.isPlayingScreensaver = false;
        this.currentVideoId = null;
        this.currentVideoIsScreensaver = false;
        this.currentScreensaverReason = 'fallback';
        this.currentScreensaverId = null;
        this.currentOutputId = null;
        this.lastOutputId = null;
        this.lastScreensaverId = null;
        this.consecutiveErrors = 0;

        if (this.video) {
            try {
                this.video.pause();
            } catch (error) {
                console.warn('Failed to pause video during reset:', error);
            }
            this.video.removeAttribute('src');
            this.video.load();
        }

        this.updatePlaylist();
        this.updateControlPanel();

        if (this.screensaverVideos.length > 0 && this.shouldAutoAdvance()) {
            this.playScreensaver('fallback');
        } else {
            this.showEmptyState();
        }

        this.updateControlPanel();
        this.updateStatus('Playlist reset. Press ▶️ to start.');
    }

    getVideoTimestamp(video) {
        if (!video || !video.id) {
            return 0;
        }

        const meta = this.playlistState?.videoMeta?.[video.id];
        const candidates = [
            video.createdTime,
            video.created,
            meta?.createdTime,
            meta?.firstSeenAt
        ];

        for (const value of candidates) {
            if (!value) continue;
            const timestamp = new Date(value).getTime();
            if (!Number.isNaN(timestamp)) {
                return timestamp;
            }
        }

        return 0;
    }

    formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return '--:--';
        }
        const total = Math.max(0, Math.round(seconds));
        const minutes = Math.floor(total / 60);
        const secs = total % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    createDurationTag(videoId, variant = 'video') {
        const seconds = this.videoDurations.get(videoId);
        const label = this.formatDuration(seconds);
        const classes = ['playlist-tag', 'duration'];
        if (variant === 'screensaver') {
            classes.push('duration-screensaver');
        }
        return `<span class="${classes.join(' ')}">${label}</span>`;
    }

    ensureDurations(videos = []) {
        if (!Array.isArray(videos)) return;
        videos.forEach(video => {
            if (!video || !video.id) return;
            if (this.videoDurations.has(video.id)) return;
            if (this.durationLoaders.has(video.id)) return;
            this.loadDurationForVideo(video.id);
        });
    }

    loadDurationForVideo(videoId) {
        try {
            const videoEl = document.createElement('video');
            videoEl.preload = 'metadata';
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.style.position = 'absolute';
            videoEl.style.width = '1px';
            videoEl.style.height = '1px';
            videoEl.style.opacity = '0';

            const cleanup = () => {
                this.durationLoaders.delete(videoId);
                if (videoEl.parentNode) {
                    videoEl.parentNode.removeChild(videoEl);
                }
            };

            videoEl.addEventListener('loadedmetadata', () => {
                if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
                    this.videoDurations.set(videoId, videoEl.duration);
                    this.updatePlaylist();
                }
                cleanup();
            }, { once: true });

            videoEl.addEventListener('error', () => {
                cleanup();
            }, { once: true });

            videoEl.src = `/api/video/${videoId}`;
            this.durationLoaders.set(videoId, videoEl);
            document.body.appendChild(videoEl);
            videoEl.load();
        } catch (error) {
            console.warn('Failed to preload duration for', videoId, error);
        }
    }

    getVideoLabel(videoId) {
        if (!videoId) return '—';
        const video = this.videoLookup.get(videoId) || this.allVideos.find(v => v.id === videoId);
        return video ? video.name : '—';
    }

    formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '--';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${value.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
    }

    renderStatCard({ icon = '', title, value, valueClass = '', details = [] }) {
        const detailHtml = (details || [])
            .filter(Boolean)
            .map(line => `<div class="system-card-detail">${line}</div>`)
            .join('');
        const iconHtml = icon ? `<span class="system-card-icon">${icon}</span>` : '';
        return `
            <div class="system-card">
                <div class="system-card-header">${iconHtml}<span>${title}</span></div>
                <div class="system-card-value ${valueClass}">${value ?? '—'}</div>
                ${detailHtml}
            </div>
        `;
    }

    normalizeScreensaverPattern(pattern) {
        const raw = pattern || {};
        const enabled = raw.enabled !== false;
        const outputsPerBlock = Math.max(0, Math.floor(Number(raw.outputsPerBlock) || 0));
        const screensaversPerBlock = Math.max(0, Math.floor(Number(raw.screensaversPerBlock) || 0));

        return {
            enabled,
            outputsPerBlock,
            screensaversPerBlock
        };
    }

    getScreensaverPattern() {
        const stored = this.playlistState?.settings?.screensaverPattern;
        return this.normalizeScreensaverPattern(stored || DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);
    }

    applyScreensaverPattern(pattern, resetCounters = false) {
        const normalized = this.normalizeScreensaverPattern(pattern);
        this.playlistState = this.playlistStateStore.setSettings({
            screensaverPattern: normalized
        });
        if (resetCounters) {
            this.playlistState = this.playlistStateStore.setSchedulerState({
                outputsSinceScreensaver: 0,
                screensaversInRow: 0
            });
        }
        this.updateScreensaverControlAvailability();
        return normalized;
    }

    shouldPlayScreensaverNow() {
        const pattern = this.getScreensaverPattern();
        if (!pattern.enabled) return false;
        if (this.screensaverVideos.length === 0) return false;
        if (this.videoQueue.length === 0) return false;

        const scheduler = this.playlistState?.scheduler || {};
        const outputsSince = scheduler.outputsSinceScreensaver || 0;
        const screensaversInRow = scheduler.screensaversInRow || 0;

        if (pattern.screensaversPerBlock <= 0) {
            return false;
        }

        if (pattern.outputsPerBlock <= 0) {
            return screensaversInRow < pattern.screensaversPerBlock;
        }

        if (outputsSince >= pattern.outputsPerBlock) {
            return screensaversInRow < pattern.screensaversPerBlock;
        }

        return false;
    }

    getNextScreensaverVideo() {
        if (this.screensaverVideos.length === 0) {
            return null;
        }

        const availableIds = new Set(this.screensaverVideos.map(video => video.id));

        let order = (this.playlistState?.screensaver?.order || []).filter(id => availableIds.has(id));
        if (order.length !== availableIds.size) {
            order = this.screensaverVideos.map(video => video.id);
            this.playlistState = this.playlistStateStore.setScreensaverOrder(order);
        }

        let index = this.playlistState?.screensaver?.index || 0;
        if (index >= order.length) {
            index = 0;
            this.playlistState = this.playlistStateStore.setScreensaverIndex(index);
        }

        let attempts = order.length;
        let nextIndex = index;
        let selected = null;

        while (attempts > 0) {
            const candidateId = order[nextIndex];
            const candidate = this.videoLookup.get(candidateId);
            if (candidate) {
                selected = candidate;
                break;
            }
            nextIndex = (nextIndex + 1) % order.length;
            attempts--;
        }

        if (!selected) {
            selected = this.screensaverVideos[0];
            const freshOrder = this.screensaverVideos.map(video => video.id);
            this.playlistState = this.playlistStateStore.setScreensaverOrder(freshOrder);
            this.playlistState = this.playlistStateStore.setScreensaverIndex(freshOrder.length > 1 ? 1 : 0);
            return selected;
        }

        const orderLength = order.length;
        const nextPointer = orderLength > 0 ? (nextIndex + 1) % orderLength : 0;
        this.playlistState = this.playlistStateStore.setScreensaverIndex(nextPointer);

        return selected;
    }

    onOutputVideoCompleted(videoId) {
        this.playlistState = this.playlistStateStore.markVideoPlayed(videoId);
        const pattern = this.getScreensaverPattern();
        this.playlistState = this.playlistStateStore.recordOutputCompleted(pattern);
        this.currentVideoId = null;
        this.currentVideoIsScreensaver = false;
        this.currentScreensaverReason = 'fallback';
        this.lastOutputId = videoId;
        this.currentOutputId = null;
        this.currentScreensaverId = null;
        this.updatePlaylist();
    }

    getOutputVideos() {
        return this.allVideos.filter(video => !video.type || video.type !== 'screensaver');
    }

    mergeVideoIntoAllVideos(video) {
        const index = this.allVideos.findIndex(v => v.id === video.id);
        if (index !== -1) {
            this.allVideos[index] = { ...this.allVideos[index], ...video };
        } else {
            this.allVideos.push(video);
        }
        this.ensureDurations([video]);
    }

    buildVideoLookup() {
        this.videoLookup = new Map();
        this.allVideos.forEach(video => {
            this.videoLookup.set(video.id, video);
        });
    }

    sortScreensaverVideos() {
        this.screensaverVideos.sort((a, b) => {
            const nameA = (a?.name || a?.id || '').toLowerCase();
            const nameB = (b?.name || b?.id || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }
    
    updateVideoQueue() {
        const oldQueue = [...this.videoQueue];
        this.videoQueue = this.getOutputVideos().filter(video => !this.disabledVideos.has(video.id));

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
            const wasScreensaver = this.currentVideoIsScreensaver;
            const finishedId = this.currentVideoId;

            if (finishedId && !wasScreensaver) {
                this.onOutputVideoCompleted(finishedId);
            }

            if (wasScreensaver) {
                if (this.currentScreensaverReason === 'pattern') {
                    const pattern = this.getScreensaverPattern();
                    this.playlistState = this.playlistStateStore.recordScreensaverCompleted(pattern);
                }

                this.currentScreensaverReason = 'fallback';
                this.currentVideoIsScreensaver = false;
                if (this.currentScreensaverId) {
                    this.lastScreensaverId = this.currentScreensaverId;
                }
                this.currentScreensaverId = null;

                if (this.videoQueue.length === 0) {
                    this.playScreensaver('fallback');
                    return;
                }

                if (this.shouldAutoAdvance()) {
                    if (this.shouldPlayScreensaverNow()) {
                        this.playScreensaver('pattern');
                    } else {
                        this.playNextVideo();
                    }
                } else {
                    const reason = this.shouldPlayScreensaverNow() ? 'pattern' : 'fallback';
                    this.playScreensaver(reason);
                }
                return;
            }

            if (this.shouldAutoAdvance()) {
                this.playNextVideo();
            } else {
                console.log('Playback paused; awaiting manual restart.');
            }
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
            if (this.currentVideoIsScreensaver) {
                const reason = this.currentScreensaverReason === 'pattern' ? 'pattern' : 'fallback';
                if (this.currentScreensaverId) {
                    this.lastScreensaverId = this.currentScreensaverId;
                }
                this.currentScreensaverId = null;
                this.playScreensaver(reason);
            } else if (this.shouldAutoAdvance()) {
                this.playNextVideo();
            }
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
        if (!this.shouldAutoAdvance()) {
            console.log('Playlist paused; skipping auto advance.');
            return;
        }

        if (this.shouldPlayScreensaverNow()) {
            this.playScreensaver('pattern');
            return;
        }

        const outputsAvailable = this.videoQueue.length > 0;
        if (!outputsAvailable) {
            this.playScreensaver('fallback');
            return;
        }

        const nextVideoId = this.playlistStateStore.selectNextOutputId();
        this.playlistState = this.playlistStateStore.getState();

        if (!nextVideoId) {
            this.playScreensaver('fallback');
            return;
        }

        const video = this.videoLookup.get(nextVideoId);
        if (!video) {
            console.warn('Scheduled video not found in lookup:', nextVideoId);
            this.syncPlaylistState();
            this.updateVideoQueue();
            this.updatePlaylist();
            this.playScreensaver('fallback');
            return;
        }

        console.log(`🎬 Playing scheduled video: ${video.name} (ID: ${nextVideoId})`);
        this.playVideo(video, { isScreensaver: false });
    }
    
    playScreensaver(reason = 'fallback') {
        if (!this.shouldAutoAdvance()) {
            this.updateStatus('Paused');
            return;
        }

        if (reason === 'pattern') {
            const pattern = this.getScreensaverPattern();
            if (!pattern.enabled || pattern.screensaversPerBlock <= 0) {
                reason = 'fallback';
            }
        }

        if (this.screensaverVideos.length === 0) {
            console.log('⚠️ No screensaver videos available');
            this.hideLoading();
            this.showEmptyState();
            return;
        }

        let selectedVideo = this.getNextScreensaverVideo();
        if (!selectedVideo) {
            selectedVideo = this.screensaverVideos[0];
        }

        if (!selectedVideo) {
            console.warn('No screensaver video available after attempting selection.');
            return;
        }

        this.isPlayingScreensaver = true;
        this.currentVideoIsScreensaver = true;
        this.currentScreensaverReason = reason === 'pattern' ? 'pattern' : 'fallback';

        const statusMessage = this.currentScreensaverReason === 'pattern'
            ? 'Screensaver Break'
            : 'Screensaver Mode';
        this.updateStatus(statusMessage);

        this.playVideo(selectedVideo, { isScreensaver: true });
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
    
    async playVideo(videoData, options = {}) {
        const { isScreensaver = false } = options;

        try {
            // Ensure video element is visible
            this.hideEmptyState();

            const videoUrl = `/api/video/${videoData.id}`;

            this.isPlayingScreensaver = isScreensaver;
            this.currentVideoIsScreensaver = isScreensaver;
            if (isScreensaver) {
                if (this.currentScreensaverId && this.currentScreensaverId !== videoData.id) {
                    this.lastScreensaverId = this.currentScreensaverId;
                }
                this.currentVideoId = null;
                this.currentScreensaverId = videoData.id;
                this.currentOutputId = null;
            } else {
                if (this.currentOutputId && this.currentOutputId !== videoData.id) {
                    this.lastOutputId = this.currentOutputId;
                }
                this.currentVideoId = videoData.id;
                this.currentOutputId = videoData.id;
                this.currentVideoIndex = this.videoQueue.findIndex(v => v.id === videoData.id);
                this.currentScreensaverReason = 'fallback';
                this.currentScreensaverId = null;
            }

            // If there's a current video playing, start GlitchMemories transition
            if (this.videoTransition && this.video.src && this.video.src !== videoUrl && !this.isTransitioning) {
                this.isTransitioning = true;

                // Start the GlitchMemories transition
                await this.videoTransition.startTransition(videoUrl);

                this.isTransitioning = false;
            }

            // Standard video playback
            this.video.src = videoUrl;
            this.video.playbackRate = isScreensaver ? 1 : this.currentPlaybackRate;
            await this.video.play();

            // Reset error counter on successful playback
            this.consecutiveErrors = 0;

            const durationSeconds = Number.isFinite(this.video.duration) ? this.video.duration : null;
            if (durationSeconds && !isNaN(durationSeconds)) {
                this.videoDurations.set(videoData.id, durationSeconds);
            }

            // Track current playing video for playlist display
            this.currentPlayingIndex = this.videoQueue.findIndex(v => v.id === videoData.id);
            this.updatePlaylist();

            if (!isScreensaver) {
                this.updateStatus(`Playing: ${videoData.name}`);
            }

            console.log('🎬 Now playing:', videoData.name);
        } catch (error) {
            console.error('Failed to play video:', error);
            this.consecutiveErrors++;
            if (!isScreensaver && videoData && videoData.id) {
                this.playlistState = this.playlistStateStore.requeueOutput(videoData.id);
                this.currentVideoId = null;
                this.currentVideoIsScreensaver = false;
                this.currentScreensaverReason = 'fallback';
                this.currentOutputId = null;
                this.currentScreensaverId = null;
            }

            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                console.error(`❌ ${this.consecutiveErrors} consecutive playback failures. Stopping.`);
                this.hideLoading();
                this.showEmptyState();
                this.consecutiveErrors = 0;
                return;
            }

            const hasContent = this.videoQueue.length > 0 || this.screensaverVideos.length > 0;
            if (!hasContent) {
                this.hideLoading();
                this.showEmptyState();
                return;
            }

            console.log(`⚠️ Playback error (${this.consecutiveErrors}/${this.maxConsecutiveErrors}), trying next video...`);

            if (isScreensaver) {
                this.currentVideoIsScreensaver = false;
                const reason = this.currentScreensaverReason === 'pattern' ? 'pattern' : 'fallback';
                setTimeout(() => this.playScreensaver(reason), 1000);
            } else if (this.shouldAutoAdvance()) {
                setTimeout(() => {
                    if (this.shouldAutoAdvance()) {
                        this.playNextVideo();
                    }
                }, 1000);
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
            const currentIndex = this.videoQueue.findIndex(video => video.id === this.currentVideoId);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % this.videoQueue.length;
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

        this.getOutputVideos().forEach((video, index) => {
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
                    this.screensaverVideos = this.screensaverVideos.filter(v => v.id !== result.videoId);
                    if (this.currentOutputId === result.videoId) this.currentOutputId = null;
                    if (this.lastOutputId === result.videoId) this.lastOutputId = null;
                    if (this.currentScreensaverId === result.videoId) this.currentScreensaverId = null;
                    if (this.lastScreensaverId === result.videoId) this.lastScreensaverId = null;
                }
            });

            const removedCurrent = this.currentVideoId && results.some(result => result.success && result.videoId === this.currentVideoId);
            if (removedCurrent) {
                this.currentVideoId = null;
                this.currentPlayingIndex = -1;
                this.currentVideoIsScreensaver = false;
                this.isPlayingScreensaver = false;
                this.currentScreensaverReason = 'fallback';
                this.currentScreensaverId = null;
            }

            if (successful > 0) {
                this.sortScreensaverVideos();
                this.buildVideoLookup();
                this.playlistState = this.playlistStateStore.setScreensaverOrder(this.screensaverVideos.map(video => video.id));
                this.syncPlaylistState();
                this.updateVideoQueue();
                this.updatePlaylist();
                if (removedCurrent && this.video) {
                    try {
                        this.video.pause();
                    } catch (pauseError) {
                        console.warn('Failed to pause video after bulk deletion:', pauseError);
                    }
                    this.video.removeAttribute('src');
                    this.video.load();
                    if (this.shouldAutoAdvance()) {
                        this.playNextVideo();
                    }
                }
            }

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

        this.playlistState = this.playlistStateStore.setVideoDisabled(videoId, this.disabledVideos.has(videoId));
        this.syncPlaylistState();

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
        const screensaverList = document.getElementById('screensaver-list');
        if (screensaverList) {
            screensaverList.innerHTML = '';
        }
        const screensaverCountLabel = document.getElementById('screensaver-count');

        enabledVideos.forEach((video, index) => {
            const playlistItem = document.createElement('div');
            const isCurrent = this.currentOutputId === video.id;
            const isLast = !isCurrent && this.lastOutputId === video.id;
            const classes = ['playlist-item'];
            if (isCurrent) classes.push('current');
            if (isLast) classes.push('last-played');
            playlistItem.className = classes.join(' ');

            const meta = this.playlistState?.videoMeta?.[video.id] || {};
            const plays = meta.plays || 0;
            const badges = [];
            if (isCurrent) {
                badges.push('<span class="playlist-tag playing">Playing</span>');
            } else if (isLast) {
                badges.push('<span class="playlist-tag last">Last Played</span>');
            }
            if (plays === 0) {
                badges.push('<span class="playlist-tag new">NEW</span>');
            } else {
                badges.push(`<span class="playlist-tag">${plays} play${plays === 1 ? '' : 's'}</span>`);
            }
            badges.push(this.createDurationTag(video.id));
            const statusIcon = isCurrent ? '▶' : isLast ? '●' : '';
            playlistItem.innerHTML = `
                <div class="playlist-number">${index + 1}</div>
                <div class="playlist-info">
                    <div class="playlist-name">${video.name}</div>
                    <div class="playlist-meta">${badges.filter(Boolean).join(' ')}</div>
                </div>
                <div class="playlist-status">${statusIcon}</div>
            `;

            playlistItem.addEventListener('click', () => {
                this.currentVideoIndex = index;
                this.playVideo(video);
            });

            this.playlistList.appendChild(playlistItem);
        });

        if (this.screensaverVideos.length > 0) {
            if (screensaverCountLabel) {
                screensaverCountLabel.textContent = `${this.screensaverVideos.length} video${this.screensaverVideos.length !== 1 ? 's' : ''}`;
            }

            this.screensaverVideos.forEach((video) => {
                const playlistItem = document.createElement('div');
                const isCurrent = this.currentScreensaverId === video.id;
                const isLast = !isCurrent && this.lastScreensaverId === video.id;
                const classes = ['playlist-item', 'screensaver'];
                if (isCurrent) classes.push('current');
                if (isLast) classes.push('last-played');
                playlistItem.className = classes.join(' ');
                const badges = [
                    '<span class="playlist-tag screensaver">Screensaver</span>',
                    isCurrent ? '<span class="playlist-tag playing">Playing</span>' : (isLast ? '<span class="playlist-tag last">Last Played</span>' : ''),
                    this.createDurationTag(video.id, 'screensaver')
                ];
                const statusIcon = isCurrent ? '🌙' : isLast ? '☾' : '🌙';
                playlistItem.innerHTML = `
                    <div class="playlist-number">◎</div>
                    <div class="playlist-info">
                        <div class="playlist-name">${video.name}</div>
                        <div class="playlist-meta">${badges.filter(Boolean).join(' ')}</div>
                    </div>
                    <div class="playlist-status">${statusIcon}</div>
                `;

                playlistItem.addEventListener('click', () => {
                    this.playVideo(video, { isScreensaver: true });
                });

                if (screensaverList) {
                    screensaverList.appendChild(playlistItem);
                }
            });
        } else if (screensaverCountLabel) {
            screensaverCountLabel.textContent = '0 videos';
        }

        // Include disabled videos at the bottom
        const disabledVideos = this.allVideos.filter(video => this.disabledVideos.has(video.id));
        if (disabledVideos.length > 0) {
            const separator = document.createElement('div');
            separator.style.cssText = 'border-top: 1px solid rgba(255,107,53,0.3); margin: 10px 0; padding-top: 10px; font-size: 11px; opacity: 0.6; text-align: center;';
            separator.textContent = 'Disabled Videos';
            this.playlistList.appendChild(separator);

            disabledVideos.forEach((video) => {
                const playlistItem = document.createElement('div');
                playlistItem.className = 'playlist-item disabled';
                const meta = this.playlistState?.videoMeta?.[video.id] || {};
                const plays = meta.plays || 0;
                const badges = ['<span class="playlist-tag disabled">DISABLED</span>'];
                if (plays === 0) {
                    badges.push('<span class="playlist-tag new">NEW</span>');
                } else {
                    badges.push(`<span class="playlist-tag">${plays} play${plays === 1 ? '' : 's'}</span>`);
                }
                badges.push(this.createDurationTag(video.id));
                playlistItem.innerHTML = `
                    <div class="playlist-number">-</div>
                    <div class="playlist-info">
                        <div class="playlist-name">${video.name}</div>
                        <div class="playlist-meta">${badges.filter(Boolean).join(' ')}</div>
                    </div>
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

            const processedCount = status.fileWatcher?.processedCount || 0;
            const isRunning = status.status === 'running';
            const fileWatcherActive = status.fileWatcher?.isRunning || false;
            const memoryUsed = stats.memory?.heapUsed || 0;
            const memoryTotal = stats.memory?.heapTotal || 0;
            const uptime = stats.uptime || '—';

            const totalVideos = this.allVideos.length;
            const disabledVideos = this.disabledVideos.size;
            const totalOutputs = this.getOutputVideos().length;
            const queueActive = this.videoQueue.length;

            const currentOutputName = this.getVideoLabel(this.currentOutputId);
            const lastOutputName = this.getVideoLabel(this.lastOutputId);
            const currentScreensaverName = this.getVideoLabel(this.currentScreensaverId);
            const lastScreensaverName = this.getVideoLabel(this.lastScreensaverId);

            const isPlaying = this.video && !this.video.paused;
            const modeLabel = this.isPlayingScreensaver ? 'Screensaver' : (isPlaying ? 'Playing' : 'Paused');
            const modeIcon = this.isPlayingScreensaver ? '🌙' : (isPlaying ? '▶️' : '⏸');
            const modeColor = this.isPlayingScreensaver ? 'text-purple-400' : (isPlaying ? 'text-halloween-orange' : 'text-gray-300');

            const queueValue = queueActive > 0 ? `${queueActive} active` : 'Empty';
            const queueColor = queueActive > 0 ? 'text-green-400' : 'text-yellow-400';

            const statusColor = isRunning ? 'text-green-400' : 'text-red-400';
            const watcherText = fileWatcherActive ? 'Watching input' : 'Watcher inactive';
            const watcherColor = fileWatcherActive ? 'text-green-300' : 'text-yellow-400';

            const cards = [
                {
                    icon: '📼',
                    title: 'Total Videos',
                    value: totalVideos,
                    details: [
                        `${disabledVideos} disabled`,
                        `${this.screensaverVideos.length} screensavers`
                    ]
                },
                {
                    icon: '🧟',
                    title: 'Queue Status',
                    value: queueValue,
                    valueClass: queueColor,
                    details: [`${totalOutputs} outputs in library`]
                },
                {
                    icon: modeIcon,
                    title: 'Current Mode',
                    value: modeLabel,
                    valueClass: modeColor,
                    details: [
                        this.isPlayingScreensaver ? `Now: ${currentScreensaverName}` : `Now: ${currentOutputName}`,
                        queueActive > 0 ? `Position: ${this.currentVideoIndex + 1}/${queueActive}` : null
                    ]
                },
                {
                    icon: '🕒',
                    title: 'Recent Playback',
                    value: lastOutputName,
                    details: [`Screensaver: ${lastScreensaverName}`]
                },
                {
                    icon: '📁',
                    title: 'Processed Files',
                    value: processedCount,
                    details: ['from input folder']
                },
                {
                    icon: isRunning ? '✅' : '⚠️',
                    title: 'System Status',
                    value: isRunning ? 'Online' : 'Offline',
                    valueClass: statusColor,
                    details: [`<span class="${watcherColor}">${watcherText}</span>`]
                },
                {
                    icon: '⏱',
                    title: 'Uptime',
                    value: uptime,
                    details: [`${this.formatBytes(memoryUsed)} / ${this.formatBytes(memoryTotal)}`]
                }
            ];

            this.statsContent.innerHTML = `
                <div class="system-stats-grid">
                    ${cards.map(card => this.renderStatCard(card)).join('')}
                </div>
            `;

            // Load input folder status
            await this.loadInputFolderStatus();

        } catch (error) {
            console.error('Failed to load system stats:', error);
            this.statsContent.innerHTML = `
                <div class="system-stats-grid">
                    ${this.renderStatCard({
                        icon: '⚠️',
                        title: 'System Status',
                        value: 'Error loading stats',
                        valueClass: 'text-red-400',
                        details: ['Check console for details']
                    })}
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

            const deriveStatus = (file) => {
                if (!file) return 'pending';
                if (file.stage) {
                    if (file.stage === 'completed') return 'completed';
                    if (file.stage === 'queued') return 'pending';
                    return 'processing';
                }
                return file.status || 'pending';
            };

            const totals = data.files.reduce((acc, file) => {
                const status = deriveStatus(file);
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, { pending: 0, processing: 0, completed: 0 });

            inputFolderStats.innerHTML = `
                <div class="flex gap-4 text-xs">
                    <span><strong>Total:</strong> ${data.totalFiles}</span>
                    <span class="text-green-500"><strong>✓</strong> ${totals.completed || 0}</span>
                    <span class="text-yellow-500"><strong>⏳</strong> ${totals.processing || 0}</span>
                    <span class="text-gray-400"><strong>○</strong> ${totals.pending || 0}</span>
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
                    const derivedStatus = deriveStatus(file);
                    const statusIcon = derivedStatus === 'completed' ? '✓' :
                                     derivedStatus === 'processing' ? '⏳' : '○';
                    const statusColor = derivedStatus === 'completed' ? 'text-green-500' :
                                       derivedStatus === 'processing' ? 'text-yellow-500' : 'text-gray-400';
                    const statusLabel = derivedStatus === 'completed' ? 'Completed' :
                                       derivedStatus === 'processing' ? 'Processing' : 'Pending';
                    const pillColor = derivedStatus === 'completed' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                     derivedStatus === 'processing' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 'text-gray-400 border-gray-500/30 bg-gray-500/10';

                    const stageMap = {
                        queued: 'Queued',
                        prompt: 'Prompt Generation',
                        image_edit: 'Image Editing',
                        video: 'Video Generation',
                        finalizing: 'Finalizing',
                        completed: 'Completed'
                    };
                    const stageText = stageMap[file.stage] || (derivedStatus === 'processing' ? 'In Progress' : '');

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
                    const removedCurrent = this.currentVideoId === videoId;
                    this.videoQueue = this.videoQueue.filter(v => v.id !== videoId);
                    this.allVideos = this.allVideos.filter(v => v.id !== videoId);
                    this.screensaverVideos = this.screensaverVideos.filter(v => v.id !== videoId);
                    if (this.currentOutputId === videoId) this.currentOutputId = null;
                    if (this.lastOutputId === videoId) this.lastOutputId = null;
                    if (this.currentScreensaverId === videoId) this.currentScreensaverId = null;
                    if (this.lastScreensaverId === videoId) this.lastScreensaverId = null;
                    if (removedCurrent) {
                        this.currentVideoId = null;
                        this.currentPlayingIndex = -1;
                        this.currentVideoIsScreensaver = false;
                        this.isPlayingScreensaver = false;
                        this.currentScreensaverReason = 'fallback';
                    }
                    this.sortScreensaverVideos();
                    this.buildVideoLookup();
                    this.playlistState = this.playlistStateStore.setScreensaverOrder(this.screensaverVideos.map(video => video.id));
                    this.syncPlaylistState();
                    this.updateVideoQueue();
                    this.updatePlaylist();
                    if (removedCurrent && this.video) {
                        try {
                            this.video.pause();
                        } catch (pauseError) {
                            console.warn('Failed to pause video after deletion:', pauseError);
                        }
                        this.video.removeAttribute('src');
                        this.video.load();
                        if (this.shouldAutoAdvance()) {
                            this.playNextVideo();
                        }
                    }

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

            if (typeof settings.seedreamImageSize !== 'undefined' && this.seedreamImageSizeSelect) {
                const s = settings.seedreamImageSize;
                if (s && typeof s === 'object') {
                    this.seedreamImageSizeSelect.value = 'custom';
                    if (this.seedreamCustomWidthInput) this.seedreamCustomWidthInput.value = String(s.width || '');
                    if (this.seedreamCustomHeightInput) this.seedreamCustomHeightInput.value = String(s.height || '');
                } else {
                    this.seedreamImageSizeSelect.value = s;
                    if (this.seedreamCustomWidthInput) this.seedreamCustomWidthInput.value = '';
                    if (this.seedreamCustomHeightInput) this.seedreamCustomHeightInput.value = '';
                }
                this.updateSeedreamCustomVisibility();
            }

            if (typeof settings.playbackRate !== 'undefined' && this.playbackRateInput) {
                const v = Math.min(2.0, Math.max(0.2, Number(settings.playbackRate) || 1.0));
                this.playbackRateInput.value = String(v);
                this.playbackRateValue.textContent = v.toFixed(1) + 'x';
                this.applyPlaybackRate(v);
            }

            const pattern = this.normalizeScreensaverPattern(settings.screensaverPattern);
            if (this.screensaverEnabledToggle) {
                this.screensaverEnabledToggle.checked = pattern.enabled;
            }
            if (this.screensaverOutputsInput) {
                this.screensaverOutputsInput.value = String(pattern.outputsPerBlock);
            }
            if (this.screensaverCountInput) {
                this.screensaverCountInput.value = String(pattern.screensaversPerBlock);
            }

            this.clampScreensaverInputs();
            this.updateScreensaverControlAvailability();
            this.applyScreensaverPattern(pattern);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // Removed updateModelInfo - no longer needed with fixed model

    async saveSettings() {
        try {
            this.saveSettingsBtn.disabled = true;
            this.saveSettingsBtn.textContent = 'Saving...';

            this.clampScreensaverInputs();

            const pattern = {
                enabled: this.screensaverEnabledToggle ? this.screensaverEnabledToggle.checked : true,
                outputsPerBlock: this.screensaverOutputsInput ? Number.parseInt(this.screensaverOutputsInput.value, 10) || 0 : 0,
                screensaversPerBlock: this.screensaverCountInput ? Number.parseInt(this.screensaverCountInput.value, 10) || 0 : 0
            };

            const settings = {
                resolution: this.videoResolutionSelect.value,
                duration: this.videoDurationSelect.value,
                seedreamImageSize: this.buildSeedreamImageSizeValue(),
                playbackRate: this.playbackRateInput ? parseFloat(this.playbackRateInput.value) : this.currentPlaybackRate,
                screensaverPattern: pattern
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
                // Apply playback immediately
                if (typeof settings.playbackRate === 'number') {
                    this.applyPlaybackRate(settings.playbackRate);
                }
                this.applyScreensaverPattern(pattern, true);
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

    updateSeedreamCustomVisibility() {
        if (!this.seedreamImageSizeSelect || !this.seedreamCustomSizeContainer) return;
        const isCustom = this.seedreamImageSizeSelect.value === 'custom';
        if (isCustom) {
            this.seedreamCustomSizeContainer.classList.remove('hidden');
        } else {
            this.seedreamCustomSizeContainer.classList.add('hidden');
        }
    }

    buildSeedreamImageSizeValue() {
        if (!this.seedreamImageSizeSelect) return 'auto';
        if (this.seedreamImageSizeSelect.value !== 'custom') {
            return this.seedreamImageSizeSelect.value;
        }
        const w = Number(this.seedreamCustomWidthInput?.value);
        const h = Number(this.seedreamCustomHeightInput?.value);
        if (!Number.isFinite(w) || !Number.isFinite(h)) {
            this.updateStatus('Enter numeric width and height for custom size');
            return 'auto';
        }
        const width = Math.round(w);
        const height = Math.round(h);
        // Allow 720–4096 to support 1280x720 HD
        if (width < 720 || width > 4096 || height < 720 || height > 4096) {
            this.updateStatus('Custom size must be 720–4096 for both dimensions');
            return 'auto';
        }
        return { width, height };
    }

    applyPlaybackRate(rate) {
        const v = Math.min(2.0, Math.max(0.2, Number(rate) || 1.0));
        this.currentPlaybackRate = v;
        if (this.video && !this.currentVideoIsScreensaver) {
            this.video.playbackRate = v;
        }
        if (this.nextVideo) this.nextVideo.playbackRate = 1;
    }
}

// Initialize when DOM is loaded
let halloweenPhotobooth;
document.addEventListener('DOMContentLoaded', () => {
    halloweenPhotobooth = new HalloweenPhotobooth();
});
