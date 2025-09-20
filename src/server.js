import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { LocalStorageService } from './services/localStorageService.js';
import { PhotoAnalysisService } from './services/photoAnalysisService.js';
import { VideoGenerationService } from './services/videoGenerationService.js';
import { FileWatcherService } from './services/fileWatcherService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let services = {};

async function initializeServices() {
  try {
    console.log('🎃 Initializing Halloween Photobooth services...');

    services.localStorage = new LocalStorageService();
    await services.localStorage.initialize();

    services.photoAnalysis = new PhotoAnalysisService();
    services.videoGeneration = new VideoGenerationService();

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
    console.error('Error streaming video:', error);
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