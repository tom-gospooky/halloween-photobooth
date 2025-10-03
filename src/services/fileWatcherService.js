import { ProcessedFileTracker } from './processedFileTracker.js';
import path from 'path';

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

        // Schedule processing without awaiting (parallel within concurrency limit)
        const task = this.processNewPhoto(file)
          .catch((err) => {
            console.error('Process task error:', err);
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
    console.log(`🎃 Processing photo: ${file.name}`);

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
      console.log('📝 Step 1: Generating dual prompts with Gemini 2.5 Flash + master prompt...');
      const promptStart = Date.now();
      const dualPrompts = await this.photoAnalysis.generateDualPrompts(file.path);
      timing.promptGeneration = (Date.now() - promptStart) / 1000;
      console.log(`⏱️  Prompt generation completed in ${timing.promptGeneration.toFixed(2)}s`);

      // Step 2: Generate video with image editing workflow
      console.log('🎬 Step 2: Editing image and generating video with new workflow...');
      const workflowStart = Date.now();
      const result = await this.videoGeneration.generateVideoWithImageEdit(
        dualPrompts.veoPrompt,
        dualPrompts.imageEditPrompt,
        file.path,
        file.name
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
      console.log(`⏱️  Image edit: ${timing.imageEdit.toFixed(2)}s | Video gen: ${timing.videoGeneration.toFixed(2)}s`);

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
          console.log('📁 Moving video to output folder...');
          videoFileName = `${timestamp}_${baseName}_halloween.mp4`;

          // Copy video to output folder
          await this.localStorage.copyFile(videoPath, videoFileName, 'output');
          finalVideoPath = `./output/${videoFileName}`;
          console.log('✅ Video saved to output folder');

          // Copy edited image to output folder if it exists and is different from original
          if (editedImagePath && editedImagePath !== file.path && fs.default.existsSync(editedImagePath)) {
            editedImageFileName = `${timestamp}_${baseName}_edited.jpg`;
            await this.localStorage.copyFile(editedImagePath, editedImageFileName, 'output');
            console.log('✅ Edited image saved to output folder');
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
        console.log('✅ Structured JSON metadata saved');
        console.log(`⏱️  Total processing time: ${timing.total.toFixed(2)}s`);

        // Clean up temp files
        try {
          // Clean up temp only if file exists
          if (fs.default.existsSync(videoPath)) {
            fs.default.unlinkSync(videoPath);
            console.log('🧹 Cleaned up temp video file');
          }

          // Clean up any old .txt metadata files from temp (legacy)
          const tempTxtPath = videoPath.includes('_placeholder.jpg')
            ? videoPath.replace('_placeholder.jpg', '.txt')
            : videoPath.replace('.mp4', '.txt');

          if (fs.default.existsSync(tempTxtPath)) {
            fs.default.unlinkSync(tempTxtPath);
            console.log('🧹 Cleaned up temp txt file');
          }

          // Clean up edited image from temp if it exists and is different from original
          if (editedImagePath && editedImagePath !== file.path && fs.default.existsSync(editedImagePath)) {
            fs.default.unlinkSync(editedImagePath);
            console.log('🧹 Cleaned up temp edited image');
          }
        } catch (cleanupError) {
          console.warn('⚠️  Could not clean up temp files:', cleanupError.message);
        }
      }

      // Step 4: Mark file as successfully processed (KEEP ORIGINAL IN INPUT FOLDER)
      await this.fileTracker.markFileAsProcessed(file.path, file.name, finalVideoPath);
      console.log('✅ Photo remains in input folder for future reference');
      console.log(`✅ Single-use processing completed in ${timing.total.toFixed(2)}s`);
      console.log(`💰 Cost-efficient: ${file.name} will never be processed again`);

    } catch (error) {
      console.error(`❌ Failed to process photo ${file.name}:`, error);

      // Mark as processed even on failure to prevent retry loops that waste money
      await this.fileTracker.markFileAsProcessed(file.path, file.name, null);
      console.log('⚠️  File marked as processed despite error to prevent costly retries');
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
