import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { LocalStorageService } from './services/localStorageService.js';
import { PhotoAnalysisService } from './services/photoAnalysisService.js';
import { VideoGenerationService } from './services/videoGenerationService.js';
import { FileWatcherService } from './services/fileWatcherService.js';
import { SettingsService } from './services/settingsService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/screensaver', express.static(path.join(__dirname, '..', 'screensaver')));

let services = {};

async function initializeServices() {
  try {
    console.log('🎃 Initializing Halloween Photobooth services...');

    services.localStorage = new LocalStorageService();
    await services.localStorage.initialize();

    // Load persisted settings
    services.settings = new SettingsService();
    await services.settings.load();

    services.photoAnalysis = new PhotoAnalysisService();
    // Pass settings service to video generation
    services.videoGeneration = new VideoGenerationService(services.settings);
    await services.videoGeneration.initialize();

    services.fileWatcher = new FileWatcherService(
      services.localStorage,
      services.photoAnalysis,
      services.videoGeneration
    );

    await services.fileWatcher.start();

    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    services: {
      localStorage: services.localStorage?.isInitialized || false,
      fileWatcher: services.fileWatcher?.isRunning || false
    },
    storage: services.localStorage?.getStatus() || {},
    fileWatcher: {
      isRunning: services.fileWatcher?.isRunning || false,
      processedCount: services.fileWatcher?.fileTracker?.getProcessedCount() || 0
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/videos', async (req, res) => {
  try {
    const videos = await services.localStorage.getOutputVideos();
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.get('/api/video/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const { download } = req.query;

    // Try to find the video in output folder first, then screensaver folder
    let videoStream;
    try {
      videoStream = services.localStorage.getVideoStream(fileName);
    } catch (error) {
      // Try screensaver folder
      try {
        videoStream = services.localStorage.getScreensaverVideoStream(fileName);
      } catch (error2) {
        throw new Error(`Video not found: ${fileName}`);
      }
    }

    res.setHeader('Content-Type', 'video/mp4');

    // Add download headers if requested
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    videoStream.pipe(res);
  } catch (error) {
    // Silently return 404 for missing videos (frontend may have stale metadata)
    if (!error.message.includes('Video not found')) {
      console.error('Error streaming video:', error);
    }
    res.status(404).json({ error: 'Video not found' });
  }
});

app.get('/api/screensaver', async (req, res) => {
  try {
    const screensaverVideos = await services.localStorage.getScreensaverVideos();
    res.json(screensaverVideos);
  } catch (error) {
    console.error('Error fetching screensaver videos:', error);
    res.status(500).json({ error: 'Failed to fetch screensaver videos' });
  }
});

// Admin API endpoints
app.get('/api/thumbnail/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const thumbnail = await services.localStorage.getThumbnail(videoId);

    if (thumbnail) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(thumbnail);
    } else {
      // Return a default placeholder image
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(`
        <svg width="300" height="200" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="200" fill="#333"/>
          <text x="150" y="100" text-anchor="middle" fill="#ff6b35" font-family="Arial" font-size="18">📽️</text>
        </svg>
      `);
    }
  } catch (error) {
    console.error('Error fetching thumbnail:', error);
    res.status(500).json({ error: 'Failed to fetch thumbnail' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const uptime = process.uptime();
    const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

    res.json({
      status: 'running',
      uptime: uptimeString,
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.delete('/api/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const success = await services.localStorage.deleteVideo(videoId);

    if (success) {
      res.json({ success: true, message: 'Video deleted successfully' });
    } else {
      res.status(404).json({ error: 'Video not found' });
    }
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

app.post('/api/admin/reset-input', async (req, res) => {
  try {
    console.log('🔄 Reset input request received');

    // Reset the processed file tracker
    if (services.fileWatcher && services.fileWatcher.fileTracker) {
      await services.fileWatcher.fileTracker.resetAllProcessedFiles();
      res.json({
        success: true,
        message: 'Input processing history cleared. All images in input folder will be treated as new.'
      });
    } else {
      res.status(500).json({ error: 'File tracker not available' });
    }
  } catch (error) {
    console.error('Error resetting input:', error);
    res.status(500).json({ error: 'Failed to reset input processing history' });
  }
});

// Settings API endpoints
// Get all settings with schema
app.get('/api/settings', (req, res) => {
  try {
    const settings = services.settings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get settings schema for UI generation
// Update all settings
app.post('/api/settings', async (req, res) => {
  try {
    const newSettings = req.body;

    // Validate settings
    const validation = services.settings.validate(newSettings);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid settings',
        validationErrors: validation.errors
      });
    }

    // Save settings
    const success = await services.settings.save(newSettings);

    if (success) {
      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: services.settings.getSettings()
      });
    } else {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Update resolution
app.post('/api/settings/resolution', async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: 'resolution is required' });
    }

    const success = await services.settings.setResolution(resolution);

    if (success) {
      res.json({
        success: true,
        message: `Resolution changed to ${resolution}`,
        settings: services.settings.getSettings()
      });
    } else {
      res.status(400).json({ error: `Invalid resolution: ${resolution}` });
    }
  } catch (error) {
    console.error('Error changing resolution:', error);
    res.status(500).json({ error: 'Failed to change resolution' });
  }
});

// Update duration
app.post('/api/settings/duration', async (req, res) => {
  try {
    const { duration } = req.body;

    if (!duration) {
      return res.status(400).json({ error: 'duration is required' });
    }

    const success = await services.settings.setDuration(duration);

    if (success) {
      res.json({
        success: true,
        message: `Duration changed to ${duration} seconds`,
        settings: services.settings.getSettings()
      });
    } else {
      res.status(400).json({ error: `Invalid duration: ${duration}` });
    }
  } catch (error) {
    console.error('Error changing duration:', error);
    res.status(500).json({ error: 'Failed to change duration' });
  }
});

// Update seedream image size
app.post('/api/settings/seedream-image-size', async (req, res) => {
  try {
    // Accept either { size: 'enum' } or { size: { width, height } }
    const { size, width, height } = req.body || {};

    let value = size;
    if (typeof value === 'undefined' && typeof width !== 'undefined' && typeof height !== 'undefined') {
      value = { width, height };
    }

    if (typeof value === 'undefined') {
      return res.status(400).json({ error: 'size is required (enum string or {width,height})' });
    }

    const success = await services.settings.setSeedreamImageSize(value);

    if (success) {
      res.json({
        success: true,
        message: 'Seedream image size updated',
        settings: services.settings.getSettings()
      });
    } else {
      res.status(400).json({ error: 'Invalid seedream image size' });
    }
  } catch (error) {
    console.error('Error changing seedream image size:', error);
    res.status(500).json({ error: 'Failed to change seedream image size' });
  }
});

// Update playback rate
app.post('/api/settings/playback-rate', async (req, res) => {
  try {
    const { playbackRate } = req.body;
    if (typeof playbackRate === 'undefined') {
      return res.status(400).json({ error: 'playbackRate is required' });
    }
    const success = await services.settings.setPlaybackRate(playbackRate);
    if (success) {
      res.json({
        success: true,
        message: `Playback rate changed to ${playbackRate}x`,
        settings: services.settings.getSettings()
      });
    } else {
      res.status(400).json({ error: `Invalid playbackRate: ${playbackRate}` });
    }
  } catch (error) {
    console.error('Error changing playback rate:', error);
    res.status(500).json({ error: 'Failed to change playback rate' });
  }
});

// Get input folder status and file processing info
app.get('/api/input-status', async (req, res) => {
  try {
    const inputPath = './input';

    // Get all files in input folder
    const files = fs.readdirSync(inputPath)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(filename => {
        const filePath = path.join(inputPath, filename);
        const stats = fs.statSync(filePath);

        // Check status from processed file tracker
        let status = 'pending';
        let processedAt = null;
        let stage = null;

        // Use the active file tracker from the watcher
        const tracker = services.fileWatcher?.fileTracker || services.fileWatcher?.processedFileTracker;
        if (tracker) {
          if (tracker.isFileCurrentlyProcessing(filePath, filename)) {
            status = 'processing';
            const record = Array.from(tracker.processedFiles.values()).find(r => r.fileName === filename);
            if (record) {
              stage = record.stage || null;
            }
          } else if (tracker.isFileProcessed(filePath, filename)) {
            status = 'completed';
            // Get the processed time
            const record = Array.from(tracker.processedFiles.values())
              .find(r => r.fileName === filename);
            if (record) {
              processedAt = record.processedAt;
              stage = record.stage || 'completed';
            }
          }
        }

        return {
          filename,
          size: stats.size,
          sizeFormatted: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          created: stats.birthtime,
          modified: stats.mtime,
          status,
          processedAt,
          stage
        };
      })
      .sort((a, b) => b.modified - a.modified);

    const statusCounts = files.reduce((acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      inputFolder: inputPath,
      totalFiles: files.length,
      statusCounts,
      files
    });
  } catch (error) {
    console.error('Error fetching input status:', error);
    res.status(500).json({ error: 'Failed to fetch input status' });
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down Halloween Photobooth...');
  if (services.fileWatcher) {
    await services.fileWatcher.stop();
  }
  process.exit(0);
});

async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`🎃 Halloween Photobooth server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
