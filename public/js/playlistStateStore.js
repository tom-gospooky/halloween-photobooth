const PLAYLIST_STATE_KEY = 'halloween-playlist-state';
const PLAYLIST_STATE_VERSION = 1;

const DEFAULT_PLAYLIST_SETTINGS = {
    newItemPlacement: 'append', // append keeps fairness for unplayed queue
    playbackBaseOrder: 'newest',
    screensaverPattern: {
        enabled: true,
        outputsPerBlock: 2,
        screensaversPerBlock: 1
    }
};

class PlaylistStateStore {
    constructor(storage) {
        this.storage = storage;
        this.state = this._load();
    }

    getState() {
        return this.state;
    }

    reset() {
        this.state = this._defaultState();
        this._persist();
        return this.state;
    }

    update(mutator) {
        const next = mutator(this.state) || this.state;
        if (next.version !== PLAYLIST_STATE_VERSION) {
            next.version = PLAYLIST_STATE_VERSION;
        }
        this.state = next;
        this._persist();
        return this.state;
    }

    syncOutputVideos(videos, disabledSet) {
        const disabled = disabledSet || new Set();
        const outputVideos = videos.filter(video => !video.type || video.type !== 'screensaver');
        this.update((state) => {
            const knownIds = new Set(outputVideos.map(video => video.id));

            state.unplayedOrder = state.unplayedOrder.filter(id => knownIds.has(id));
            state.playedRoundOrder = state.playedRoundOrder.filter(id => knownIds.has(id));
            state.scheduler.roundQueue = (state.scheduler.roundQueue || []).filter(id => knownIds.has(id) && !disabled.has(id));

            Object.keys(state.videoMeta).forEach(id => {
                if (!knownIds.has(id)) {
                    delete state.videoMeta[id];
                }
            });

            const placement = (state.settings && state.settings.newItemPlacement) || DEFAULT_PLAYLIST_SETTINGS.newItemPlacement;

            outputVideos.forEach((video) => {
                const id = video.id;
                if (!state.videoMeta[id]) {
                    state.videoMeta[id] = {
                        plays: 0,
                        firstSeenAt: new Date().toISOString(),
                        lastPlayedAt: null,
                        disabled: disabled.has(id),
                        createdTime: video.createdTime || null
                    };
                    this._insertIntoUnplayed(state, video, placement);
                } else {
                    const meta = state.videoMeta[id];
                    if (typeof meta.plays !== 'number' || meta.plays < 0) {
                        meta.plays = 0;
                    }
                    if (!meta.firstSeenAt) {
                        meta.firstSeenAt = new Date().toISOString();
                    }
                    if (!meta.createdTime && video.createdTime) {
                        meta.createdTime = video.createdTime;
                    }
                    meta.disabled = disabled.has(id);
                }
            });

            // Keep unplayed list aligned with play counts and disabled state
            state.unplayedOrder = state.unplayedOrder.filter(id => {
                const meta = state.videoMeta[id];
                return meta && meta.plays === 0 && !meta.disabled;
            });

            Object.keys(state.videoMeta).forEach(id => {
                const meta = state.videoMeta[id];
                if (meta && meta.plays === 0 && !meta.disabled) {
                    if (!state.unplayedOrder.includes(id)) {
                        this._insertIntoUnplayed(state, { id, createdTime: meta.createdTime }, placement);
                    }
                }
            });

            return state;
        });

        return this.state;
    }

    setVideoDisabled(videoId, isDisabled) {
        this.update((state) => {
            if (!state.videoMeta[videoId]) {
                state.videoMeta[videoId] = {
                    plays: 0,
                    firstSeenAt: new Date().toISOString(),
                    lastPlayedAt: null,
                    disabled: isDisabled,
                    createdTime: null
                };
            } else {
                state.videoMeta[videoId].disabled = isDisabled;
            }

            if (isDisabled) {
                state.unplayedOrder = state.unplayedOrder.filter(id => id !== videoId);
                state.playedRoundOrder = state.playedRoundOrder.filter(id => id !== videoId);
                state.scheduler.roundQueue = (state.scheduler.roundQueue || []).filter(id => id !== videoId);
                state.scheduler.currentOutputIndex = 0;
            } else {
                const meta = state.videoMeta[videoId];
                if (meta && meta.plays === 0 && !state.unplayedOrder.includes(videoId)) {
                    const placement = (state.settings && state.settings.newItemPlacement) || DEFAULT_PLAYLIST_SETTINGS.newItemPlacement;
                    this._insertIntoUnplayed(state, { id: videoId, createdTime: meta.createdTime }, placement);
                }
            }

            return state;
        });

        return this.state;
    }

    markVideoPlayed(videoId) {
        this.update((state) => {
            const meta = state.videoMeta[videoId];
            if (!meta) {
                return state;
            }

            meta.plays = (meta.plays || 0) + 1;
            meta.lastPlayedAt = new Date().toISOString();

            state.unplayedOrder = state.unplayedOrder.filter(id => id !== videoId);
            state.scheduler.roundQueue = (state.scheduler.roundQueue || []).filter(id => id !== videoId);
            state.scheduler.currentOutputIndex = 0;

            if (!meta.disabled && !state.playedRoundOrder.includes(videoId)) {
                state.playedRoundOrder.push(videoId);
            }

            return state;
        });

        return this.state;
    }

    selectNextOutputId() {
        let selectedId = null;

        this.update((state) => {
            const enabledIds = Object.keys(state.videoMeta).filter((id) => {
                const meta = state.videoMeta[id];
                return meta && !meta.disabled;
            });

            if (enabledIds.length === 0) {
                state.roundNumber = 0;
                state.scheduler.currentOutputIndex = 0;
                state.scheduler.roundQueue = [];
                selectedId = null;
                return state;
            }

            let minPlays = Infinity;
            enabledIds.forEach((id) => {
                const meta = state.videoMeta[id];
                const plays = meta && typeof meta.plays === 'number' ? meta.plays : 0;
                if (plays < minPlays) {
                    minPlays = plays;
                }
            });
            if (!Number.isFinite(minPlays)) {
                minPlays = 0;
            }

            if (state.roundNumber !== minPlays) {
                state.roundNumber = minPlays;
                state.scheduler.currentOutputIndex = 0;
                state.scheduler.roundQueue = [];
            }

            if (state.roundNumber === 0) {
                const placement = (state.settings && state.settings.newItemPlacement) || DEFAULT_PLAYLIST_SETTINGS.newItemPlacement;
                const zeroPlayIds = enabledIds.filter((id) => {
                    const meta = state.videoMeta[id];
                    return !meta.disabled && (meta.plays || 0) === 0;
                });

                const zeroSet = new Set(zeroPlayIds);
                state.unplayedOrder = state.unplayedOrder.filter((id) => zeroSet.has(id));
                zeroPlayIds.forEach((id) => {
                    if (!state.unplayedOrder.includes(id)) {
                        const meta = state.videoMeta[id];
                        this._insertIntoUnplayed(state, { id, createdTime: meta?.createdTime }, placement);
                    }
                });

                selectedId = state.unplayedOrder.length > 0 ? state.unplayedOrder[0] : null;
                return state;
            }

            const currentRound = state.roundNumber;
            const candidates = enabledIds.filter((id) => {
                const meta = state.videoMeta[id];
                return meta && !meta.disabled && (meta.plays || 0) === currentRound;
            });

            let roundQueue = (state.scheduler.roundQueue || []).filter((id) => {
                const meta = state.videoMeta[id];
                return meta && !meta.disabled && (meta.plays || 0) === currentRound;
            });

            if (roundQueue.length === 0 && candidates.length > 0) {
                roundQueue = this._orderByBasePreference(state, candidates);
                roundQueue = this._shuffleArray(roundQueue);
                state.scheduler.currentOutputIndex = 0;
            } else if (roundQueue.length > 0) {
                const missing = candidates.filter((id) => !roundQueue.includes(id));
                if (missing.length > 0) {
                    const orderedMissing = this._orderByBasePreference(state, missing);
                    roundQueue = roundQueue.concat(orderedMissing);
                }
            }

            if (roundQueue.length === 0) {
                selectedId = null;
                state.scheduler.roundQueue = [];
                state.scheduler.currentOutputIndex = 0;
                return state;
            }

            const index = Math.min(state.scheduler.currentOutputIndex || 0, roundQueue.length - 1);
            selectedId = roundQueue[index];
            state.scheduler.currentOutputIndex = (index + 1) % roundQueue.length;
            state.scheduler.roundQueue = roundQueue;

            return state;
        });

        return selectedId;
    }

    requeueOutput(videoId) {
        this.update((state) => {
            const meta = state.videoMeta[videoId];
            if (!meta || meta.disabled) {
                return state;
            }

            if ((meta.plays || 0) === 0) {
                const placement = (state.settings && state.settings.newItemPlacement) || DEFAULT_PLAYLIST_SETTINGS.newItemPlacement;
                if (!state.unplayedOrder.includes(videoId)) {
                    this._insertIntoUnplayed(state, { id: videoId, createdTime: meta?.createdTime }, placement);
                }
            } else {
                let queue = state.scheduler.roundQueue || [];
                const existingIndex = queue.indexOf(videoId);
                if (existingIndex !== -1) {
                    queue.splice(existingIndex, 1);
                }
                queue.unshift(videoId);
                state.scheduler.roundQueue = queue;
                state.scheduler.currentOutputIndex = 0;
            }

            return state;
        });

        return this.state;
    }

    setSchedulerState(patch = {}) {
        this.update((state) => {
            const updatePatch = patch || {};
            state.scheduler = {
                ...(state.scheduler || {}),
                ...updatePatch
            };

            if (!Array.isArray(state.scheduler.roundQueue)) {
                state.scheduler.roundQueue = [];
            }

            return state;
        });

        return this.state;
    }

    resetPlayback(videos = []) {
        const outputs = Array.isArray(videos) ? videos : [];

        this.update((state) => {
            const now = new Date().toISOString();

            outputs.forEach((video) => {
                if (!video || !video.id) {
                    return;
                }

                const id = video.id;
                if (!state.videoMeta[id]) {
                    state.videoMeta[id] = {
                        plays: 0,
                        firstSeenAt: now,
                        lastPlayedAt: null,
                        disabled: false,
                        createdTime: video.createdTime || null
                    };
                } else {
                    const meta = state.videoMeta[id];
                    meta.plays = 0;
                    meta.lastPlayedAt = null;
                    if (!meta.firstSeenAt) {
                        meta.firstSeenAt = now;
                    }
                    if (video.createdTime) {
                        meta.createdTime = video.createdTime;
                    }
                }
            });

            const enabledSorted = outputs
                .filter((video) => {
                    const meta = state.videoMeta[video.id];
                    return meta && !meta.disabled;
                })
                .sort((a, b) => {
                    const metaA = state.videoMeta[a.id];
                    const metaB = state.videoMeta[b.id];
                    return this._getVideoTimestamp(a, metaA) - this._getVideoTimestamp(b, metaB);
                })
                .map((video) => video.id);

            state.unplayedOrder = enabledSorted;
            state.playedRoundOrder = [];
            state.roundNumber = 0;

            state.scheduler = {
                ...(state.scheduler || {}),
                started: false,
                paused: true,
                currentOutputIndex: 0,
                outputsSinceScreensaver: 0,
                screensaversInRow: 0,
                roundQueue: []
            };

            return state;
        });

        return this.state;
    }

    setSettings(partialSettings = {}) {
        this.update((state) => {
            state.settings = this._mergeSettings(
                DEFAULT_PLAYLIST_SETTINGS,
                {
                    ...state.settings,
                    ...partialSettings
                }
            );

            const pattern = state.settings.screensaverPattern || {};
            if (!pattern.enabled || (pattern.outputsPerBlock <= 0 || pattern.screensaversPerBlock <= 0)) {
                state.scheduler.outputsSinceScreensaver = 0;
                state.scheduler.screensaversInRow = 0;
            }

            return state;
        });

        return this.state;
    }

    setScreensaverOrder(orderIds = []) {
        const unique = Array.from(new Set(orderIds.filter(Boolean)));

        this.update((state) => {
            state.screensaver = state.screensaver || { order: [], index: 0 };
            state.screensaver.order = unique;

            if (unique.length === 0) {
                state.screensaver.index = 0;
            } else if (!Number.isInteger(state.screensaver.index) || state.screensaver.index >= unique.length || state.screensaver.index < 0) {
                state.screensaver.index = 0;
            }

            return state;
        });

        return this.state;
    }

    setScreensaverIndex(index) {
        this.update((state) => {
            state.screensaver = state.screensaver || { order: [], index: 0 };
            const length = state.screensaver.order ? state.screensaver.order.length : 0;
            if (length <= 0) {
                state.screensaver.index = 0;
            } else {
                const normalized = ((Number(index) || 0) % length + length) % length;
                state.screensaver.index = normalized;
            }
            return state;
        });

        return this.state;
    }

    recordOutputCompleted(pattern = DEFAULT_PLAYLIST_SETTINGS.screensaverPattern) {
        this.update((state) => {
            const scheduler = state.scheduler || {};
            scheduler.outputsSinceScreensaver = (scheduler.outputsSinceScreensaver || 0) + 1;
            scheduler.screensaversInRow = 0;
            state.scheduler = scheduler;

            if (!pattern.enabled) {
                scheduler.outputsSinceScreensaver = 0;
                scheduler.screensaversInRow = 0;
            }

            return state;
        });

        return this.state;
    }

    recordScreensaverCompleted(pattern = DEFAULT_PLAYLIST_SETTINGS.screensaverPattern) {
        this.update((state) => {
            const scheduler = state.scheduler || {};
            const screensaversPerBlock = Math.max(0, Number(pattern.screensaversPerBlock) || 0);
            scheduler.screensaversInRow = (scheduler.screensaversInRow || 0) + 1;

            if (!pattern.enabled || screensaversPerBlock <= 0) {
                scheduler.outputsSinceScreensaver = 0;
                scheduler.screensaversInRow = 0;
            } else if (scheduler.screensaversInRow >= screensaversPerBlock) {
                scheduler.outputsSinceScreensaver = 0;
                scheduler.screensaversInRow = 0;
            }

            state.scheduler = scheduler;
            return state;
        });

        return this.state;
    }

    _load() {
        if (!this.storage || typeof this.storage.getItem !== 'function') {
            return this._defaultState();
        }

        try {
            const raw = this.storage.getItem(PLAYLIST_STATE_KEY);
            if (!raw) {
                return this._defaultState();
            }

            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== PLAYLIST_STATE_VERSION) {
                return this._defaultState();
            }

            return this._applyDefaults(parsed);
        } catch (error) {
            console.warn('Failed to load playlist state:', error);
            return this._defaultState();
        }
    }

    _persist() {
        if (!this.storage || typeof this.storage.setItem !== 'function') {
            return;
        }

        try {
            this.storage.setItem(PLAYLIST_STATE_KEY, JSON.stringify(this.state));
        } catch (error) {
            console.warn('Failed to persist playlist state:', error);
        }
    }

    _defaultState() {
        return {
            version: PLAYLIST_STATE_VERSION,
            videoMeta: {},
            unplayedOrder: [],
            playedRoundOrder: [],
            roundNumber: 0,
            scheduler: {
                started: false,
                paused: true,
                currentOutputIndex: 0,
                outputsSinceScreensaver: 0,
                screensaversInRow: 0,
                roundQueue: []
            },
            screensaver: {
                order: [],
                index: 0
            },
            settings: this._cloneSettings(DEFAULT_PLAYLIST_SETTINGS)
        };
    }

    _applyDefaults(state) {
        const base = this._defaultState();
        const merged = {
            ...base,
            ...state,
            scheduler: {
                ...base.scheduler,
                ...(state.scheduler || {})
            },
            screensaver: {
                ...base.screensaver,
                ...(state.screensaver || {})
            },
            settings: this._mergeSettings(base.settings, state.settings || {})
        };

        merged.unplayedOrder = Array.isArray(state.unplayedOrder) ? state.unplayedOrder.slice() : [];
        merged.playedRoundOrder = Array.isArray(state.playedRoundOrder) ? state.playedRoundOrder.slice() : [];
        merged.videoMeta = state.videoMeta && typeof state.videoMeta === 'object' ? { ...state.videoMeta } : {};
        merged.scheduler.roundQueue = Array.isArray(merged.scheduler.roundQueue)
            ? merged.scheduler.roundQueue.slice()
            : [];

        return merged;
    }

    _mergeSettings(defaults, incoming) {
        const merged = {
            ...defaults,
            ...incoming
        };

        merged.screensaverPattern = {
            ...defaults.screensaverPattern,
            ...(incoming.screensaverPattern || {})
        };

        return merged;
    }

    _cloneSettings(settings) {
        return {
            ...settings,
            screensaverPattern: {
                ...(settings.screensaverPattern || {})
            }
        };
    }

    _getVideoTimestamp(video, meta) {
        const candidates = [
            video?.createdTime,
            video?.created,
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

    _orderByBasePreference(state, ids) {
        const baseOrder = (state.settings && state.settings.playbackBaseOrder) || DEFAULT_PLAYLIST_SETTINGS.playbackBaseOrder;
        const getTime = (meta) => {
            if (!meta) return 0;
            if (meta.createdTime) {
                const time = new Date(meta.createdTime).getTime();
                if (!Number.isNaN(time)) {
                    return time;
                }
            }
            if (meta.firstSeenAt) {
                const time = new Date(meta.firstSeenAt).getTime();
                if (!Number.isNaN(time)) {
                    return time;
                }
            }
            return 0;
        };

        const sorted = ids.slice().sort((a, b) => {
            const metaA = state.videoMeta[a];
            const metaB = state.videoMeta[b];
            const timeA = getTime(metaA);
            const timeB = getTime(metaB);

            if (baseOrder === 'oldest') {
                if (timeA !== timeB) {
                    return timeA - timeB;
                }
                return String(a).localeCompare(String(b));
            }

            if (timeA !== timeB) {
                return timeB - timeA;
            }
            return String(a).localeCompare(String(b));
        });

        return sorted;
    }

    _shuffleArray(items) {
        const arr = items.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    _insertIntoUnplayed(state, video, placement) {
        const id = video.id;
        if (state.unplayedOrder.includes(id)) {
            return;
        }

        if (placement === 'prepend') {
            state.unplayedOrder.unshift(id);
            return;
        }

        if (placement === 'byCreated' && video && video.createdTime) {
            const target = new Date(video.createdTime).getTime();
            let index = state.unplayedOrder.findIndex(existingId => {
                const meta = state.videoMeta[existingId];
                if (!meta || !meta.createdTime) {
                    return false;
                }
                const comparison = new Date(meta.createdTime).getTime();
                return target > comparison;
            });

            if (index === -1) {
                index = state.unplayedOrder.length;
            }
            state.unplayedOrder.splice(index, 0, id);
            return;
        }

        state.unplayedOrder.push(id);
    }
}

export {
    DEFAULT_PLAYLIST_SETTINGS,
    PLAYLIST_STATE_KEY,
    PLAYLIST_STATE_VERSION,
    PlaylistStateStore
};
