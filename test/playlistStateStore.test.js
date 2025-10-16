import { describe, it, expect, beforeEach } from 'vitest';
import { PlaylistStateStore, DEFAULT_PLAYLIST_SETTINGS } from '../public/js/playlistStateStore.js';
import { SettingsService } from '../src/services/settingsService.js';

const createStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
};

const makeVideos = (ids, startTime = Date.now()) =>
  ids.map((id, index) => ({
    id,
    name: id,
    createdTime: new Date(startTime + index * 1000).toISOString(),
    type: 'output'
  }));

describe('PlaylistStateStore scheduling', () => {
  let store;
  let storage;

  beforeEach(() => {
    storage = createStorage();
    store = new PlaylistStateStore(storage);
    store.reset();
  });

  it('keeps existing unplayed videos ahead of new arrivals while they are still unplayed', () => {
    const videos = makeVideos(['A', 'B', 'C', 'D']);
    store.syncOutputVideos(videos, new Set());

    expect(store.selectNextOutputId()).toBe('A');
    store.markVideoPlayed('A');
    store.recordOutputCompleted(DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);

    expect(store.selectNextOutputId()).toBe('B');
    store.markVideoPlayed('B');
    store.recordOutputCompleted(DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);

    const playingId = store.selectNextOutputId();
    expect(playingId).toBe('C');

    const updatedVideos = makeVideos(['A', 'B', 'C', 'D', 'E', 'F']);
    store.syncOutputVideos(updatedVideos, new Set());

    store.markVideoPlayed('C');
    store.recordOutputCompleted(DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);

    expect(store.selectNextOutputId()).toBe('D');
  });

  it('prioritises brand new videos when they arrive during a replayed video', () => {
    const videos = makeVideos(['A', 'B']);
    store.syncOutputVideos(videos, new Set());
    store._shuffleArray = (arr) => arr.slice();

    expect(store.selectNextOutputId()).toBe('A');
    store.markVideoPlayed('A');
    store.recordOutputCompleted(DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);

    expect(store.selectNextOutputId()).toBe('B');
    store.markVideoPlayed('B');
    store.recordOutputCompleted(DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);

    const replaying = store.selectNextOutputId();
    const currentMeta = store.getState().videoMeta[replaying];
    expect(currentMeta.plays).toBe(1);

    const updated = makeVideos(['A', 'B', 'C', 'D']);
    store.syncOutputVideos(updated, new Set());

    store.markVideoPlayed('A');
    store.recordOutputCompleted(DEFAULT_PLAYLIST_SETTINGS.screensaverPattern);

    expect(store.selectNextOutputId()).toBe('C');
  });

  it('tracks screensaver cadence counters', () => {
    const pattern = {
      enabled: true,
      outputsPerBlock: 2,
      screensaversPerBlock: 1
    };

    store.recordOutputCompleted(pattern);
    store.recordOutputCompleted(pattern);

    let state = store.getState();
    expect(state.scheduler.outputsSinceScreensaver).toBe(2);
    expect(state.scheduler.screensaversInRow).toBe(0);

    store.recordScreensaverCompleted(pattern);
    state = store.getState();
    expect(state.scheduler.outputsSinceScreensaver).toBe(0);
    expect(state.scheduler.screensaversInRow).toBe(0);

    store.recordOutputCompleted({ enabled: false, outputsPerBlock: 2, screensaversPerBlock: 1 });
    state = store.getState();
    expect(state.scheduler.outputsSinceScreensaver).toBe(0);
  });
});

describe('Screensaver helpers', () => {
  it('sanitises patterns to safe integer values', () => {
    const service = new SettingsService();
    const dirtyPattern = { enabled: true, outputsPerBlock: '3.9', screensaversPerBlock: '2.2' };
    const normalised = service.sanitizeScreensaverPattern(dirtyPattern);
    expect(normalised.outputsPerBlock).toBe(3);
    expect(normalised.screensaversPerBlock).toBe(2);
  });
});
