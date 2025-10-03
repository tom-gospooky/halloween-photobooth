import { ProcessedFileTracker } from './processedFileTracker.js';
import path from 'path';
import { createImageLogger } from '../utils/logger.js';

export class FileWatcherService {
  constructor(localStorageService, photoAnalysisService, videoGenerationService) {
    this.localStorage = localStorageService;
    this.photoAnalysis = photoAnalysisService;
    this.videoGeneration = videoGenerationService;
    this.isRunning = false;
    this.fileTracker = new ProcessedFileTracker();
    this.watchInterval = null;
    // Simple concurrency control
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10);
    this.activeTasks = new Set();
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  File watcher already running');
      return;
    }

    try {
      console.log('👁️  Starting file watcher service...');
      console.log(`🧵 Concurrency set to ${this.maxConcurrent} job(s)`);

      // Initialize file tracker first
      await this.fileTracker.initialize();

      this.isRunning = true;

      // Start watching for new files
      this.watchInterval = setInterval(async () => {
        await this.checkForNewFiles();
      }, 15000); // Check every 15 seconds

      // Initial check
      await this.checkForNewFiles();

      console.log('✅ File watcher service started');
    } catch (error) {
      console.error('❌ Failed to start file watcher:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    console.log('🛑 Stopping file watcher service...');
    this.isRunning = false;
    
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    
    console.log('✅ File watcher service stopped');
  }

  async checkForNewFiles() {
    if (!this.isRunning) return;

    try {
      const inputFiles = await this.localStorage.getNewInputFiles();

      // Determine available slots for processing
      const availableSlots = Math.max(this.maxConcurrent - this.activeTasks.size, 0);
      if (availableSlots <= 0) {
        return; // Pool is full; try again on next tick
      }

      let scheduled = 0;
      for (const file of inputFiles) {
        if (scheduled >= availableSlots) break;

        // Skip files already processed or in-progress
        if (this.fileTracker.isFileProcessed(file.path, file.name)) continue;
        if (this.fileTracker.isFileCurrentlyProcessing(file.path, file.name)) continue;

        console.log(`🔍 New photo detected: ${file.name}`);

        // Mark as processing immediately to prevent duplicate scheduling
        await this.fileTracker.markFileAsProcessing(file.path, file.name);
        // Indicate initial stage
        await this.fileTracker.setProcessingStage(file.path, file.name, 'prompt');

        // Schedule processing without awaiting (parallel within concurrency limit)
        const task = this.processNewPhoto(file)
          .catch((err) => {
            const log = createImageLogger(file.path, file.name);
            log.error(`Task error: ${err.message}`);
          })
          .finally(() => {
            this.activeTasks.delete(task);
          });

        this.activeTasks.add(task);
        scheduled += 1;
      }
    } catch (error) {
      console.error('Error checking for new files:', error);
    }
  }

  async processNewPhoto(file) {
    const overallStart = Date.now();
    const log = createImageLogger(file.path, file.name);
    log.stage('Start processing');

    // Timing tracking object
    const timing = {
      promptGeneration: 0,
      imageEdit: 0,
      videoGeneration: 0,
      total: 0
    };

    // Marking as processing happens in checkForNewFiles to avoid race conditions

    try {
      // Step 1: Generate dual prompts (Veo3 + image edit) with Gemini 2.5 Flash + master prompt
      log.stage('Prompt generation');
      const promptStart = Date.now();
      const dualPrompts = await this.photoAnalysis.generateDualPrompts(file.path);
      timing.promptGeneration = (Date.now() - promptStart) / 1000;
      log.info(`Prompt ready (${timing.promptGeneration.toFixed(2)}s)`);

      // Step 2: Generate video with image editing workflow
      log.stage('Image editing + video generation');
      const workflowStart = Date.now();
      const result = await this.videoGeneration.generateVideoWithImageEdit(
        dualPrompts.veoPrompt,
        dualPrompts.imageEditPrompt,
        file.path,
        file.name,
        {
          onImageEditStart: async () => {
            await this.fileTracker.setProcessingStage(file.path, file.name, 'image_edit');
            log.info('Image edit started');
          },
          onImageEditComplete: async () => {
            await this.fileTracker.setProcessingStage(file.path, file.name, 'image_edit');
            log.info('Image edit complete');
          },
          onVideoStart: async () => {
            await this.fileTracker.setProcessingStage(file.path, file.name, 'video');
            log.info('Video generation started');
          },
          onVideoComplete: async () => {
            await this.fileTracker.setProcessingStage(file.path, file.name, 'video');
            log.info('Video generation complete');
          }
        }
      );
      const videoPath = result.videoPath;
      const editedImagePath = result.editedImagePath;

      // Extract timing from result if available
      if (result.timing) {
        timing.imageEdit = result.timing.imageEdit || 0;
        timing.videoGeneration = result.timing.videoGeneration || 0;
      } else {
        // Fallback: calculate total workflow time
        const workflowTime = (Date.now() - workflowStart) / 1000;
        timing.imageEdit = workflowTime * 0.3; // Estimate
        timing.videoGeneration = workflowTime * 0.7; // Estimate
      }
      log.info(`Durations — edit: ${timing.imageEdit.toFixed(2)}s, video: ${timing.videoGeneration.toFixed(2)}s`);

      // Calculate total timing
      timing.total = (Date.now() - overallStart) / 1000;

      // Step 3: Move generated video and metadata to output folder (if successful)
      let finalVideoPath = null;
      const fs = await import('fs');
      if (videoPath && fs.default.existsSync(videoPath)) {
        const timestamp = Date.now();
        const baseName = file.name.split('.')[0];
        let editedImageFileName = null;
        let videoFileName = null;
        // Determine if we actually have a valid MP4 before copying
        const lower = videoPath.toLowerCase();
        const isPlaceholder = lower.endsWith('_placeholder.jpg');
        let isValidMp4 = lower.endsWith('.mp4');

        if (isValidMp4) {
          try {
            const fd = fs.default.openSync(videoPath, 'r');
            const header = Buffer.alloc(12);
            fs.default.readSync(fd, header, 0, 12, 0);
            fs.default.closeSync(fd);
            isValidMp4 = header.slice(4, 8).toString() === 'ftyp';
          } catch (sigErr) {
            console.warn('⚠️  Could not verify MP4 signature:', sigErr.message);
            isValidMp4 = false;
          }
        }

        if (!isValidMp4) {
          // Do not copy placeholders or invalid files as .mp4 into output
          console.warn(`⚠️  Skipping output copy — ${isPlaceholder ? 'placeholder' : 'invalid'} file: ${videoPath}`);
        } else {
        log.stage('Saving outputs');
          videoFileName = `${timestamp}_${baseName}_halloween.mp4`;

          // Copy video to output folder
          await this.localStorage.copyFile(videoPath, videoFileName, 'output');
          finalVideoPath = `./output/${videoFileName}`;
        log.success('Video saved to output');

          // Copy edited image to output folder if it exists and is different from original
          if (editedImagePath && editedImagePath !== file.path && fs.default.existsSync(editedImagePath)) {
            editedImageFileName = `${timestamp}_${baseName}_edited.jpg`;
            await this.localStorage.copyFile(editedImagePath, editedImageFileName, 'output');
          log.success('Edited image saved to output');
          }

        }

        // Get current settings for metadata
        const currentSettings = this.videoGeneration.settingsService.getSettings();

        // Create structured JSON metadata
        const metadata = {
          source: {
            filename: file.name,
            timestamp: new Date().toISOString(),
            processedAt: timestamp
          },
          output: {
            video: finalVideoPath ? path.basename(finalVideoPath) : null,
            editedImage: editedImageFileName || null
          },
          prompts: {
            imageEdit: dualPrompts.imageEditPrompt,
            videoGeneration: dualPrompts.veoPrompt
          },
          processing: {
            total: parseFloat(timing.total.toFixed(2)),
            stages: {
              promptGeneration: parseFloat(timing.promptGeneration.toFixed(2)),
              imageEdit: parseFloat(timing.imageEdit.toFixed(2)),
              videoGeneration: parseFloat(timing.videoGeneration.toFixed(2))
            }
          },
          settings: {
            resolution: currentSettings.resolution || '1080p',
            duration: currentSettings.duration || '5',
            model: 'wan-25-preview'
          },
          pipeline: {
            promptGenerator: 'gemini-2.5-flash',
            imageEditor: 'seedream',
            videoGenerator: 'wan-25-preview'
          },
          status: finalVideoPath ? 'success' : (isPlaceholder ? 'placeholder' : 'failed')
        };

        // Write JSON metadata file
        const outputJsonPath = `./output/${timestamp}_${baseName}_halloween.json`;
        fs.default.writeFileSync(outputJsonPath, JSON.stringify(metadata, null, 2));
        log.success('Metadata saved');
        log.info(`Total time: ${timing.total.toFixed(2)}s`);

        // Clean up temp files
        try {
          // Clean up temp only if file exists
          if (fs.default.existsSync(videoPath)) {
            fs.default.unlinkSync(videoPath);
          log.info('Cleaned temp video');
          }

          // Clean up any old .txt metadata files from temp (legacy)
          const tempTxtPath = videoPath.includes('_placeholder.jpg')
            ? videoPath.replace('_placeholder.jpg', '.txt')
            : videoPath.replace('.mp4', '.txt');

          if (fs.default.existsSync(tempTxtPath)) {
            fs.default.unlinkSync(tempTxtPath);
            log.info('Cleaned temp txt');
          }

          // Clean up edited image from temp if it exists and is different from original
          if (editedImagePath && editedImagePath !== file.path && fs.default.existsSync(editedImagePath)) {
            fs.default.unlinkSync(editedImagePath);
            log.info('Cleaned temp edited image');
          }
        } catch (cleanupError) {
          console.warn('⚠️  Could not clean up temp files:', cleanupError.message);
        }
      }

      // Step 4: Mark file as successfully processed (KEEP ORIGINAL IN INPUT FOLDER)
      await this.fileTracker.markFileAsProcessed(file.path, file.name, finalVideoPath);
      log.success(`Completed in ${timing.total.toFixed(2)}s`);

    } catch (error) {
      log.error(`Failed: ${error.message}`);

      // Mark as processed even on failure to prevent retry loops that waste money
      await this.fileTracker.markFileAsProcessed(file.path, file.name, null);
      log.warn('Marked as processed to avoid retry loops');
    }
  }


  getStatus() {
    return {
      isRunning: this.isRunning,
      processedCount: this.fileTracker.getProcessedCount(),
      lastCheck: new Date().toISOString(),
      fileTracker: this.fileTracker.getStatus(),
      concurrency: {
        maxConcurrent: this.maxConcurrent,
        active: this.activeTasks.size
      }
    };
  }
}
