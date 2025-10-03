import { ProcessedFileTracker } from './processedFileTracker.js';

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
    const startTime = Date.now();
    console.log(`🎃 Processing photo: ${file.name}`);

    // Marking as processing happens in checkForNewFiles to avoid race conditions

    try {
      // Step 1: Generate dual prompts (Veo3 + image edit) with Gemini 2.5 Flash + master prompt
      console.log('📝 Step 1: Generating dual prompts with Gemini 2.5 Flash + master prompt...');
      const dualPrompts = await this.photoAnalysis.generateDualPrompts(file.path);

      // Step 2: Generate video with image editing workflow
      console.log('🎬 Step 2: Editing image and generating video with new workflow...');
      const result = await this.videoGeneration.generateVideoWithImageEdit(
        dualPrompts.veoPrompt,
        dualPrompts.imageEditPrompt,
        file.path,
        file.name
      );
      const videoPath = result.videoPath;
      const editedImagePath = result.editedImagePath;

      // Step 3: Move generated video and metadata to output folder (if successful)
      let finalVideoPath = null;
      const fs = await import('fs');
      if (videoPath && fs.default.existsSync(videoPath)) {
        console.log('📁 Moving video to output folder...');
        const videoFileName = `${Date.now()}_${file.name.split('.')[0]}_halloween.mp4`;
        const txtFileName = videoFileName.replace('.mp4', '.txt');

        // Copy video to output folder
        await this.localStorage.copyFile(videoPath, videoFileName, 'output');
        finalVideoPath = `./output/${videoFileName}`;
        console.log('✅ Video saved to output folder');

        // Copy edited image to output folder if it exists and is different from original
        if (editedImagePath && editedImagePath !== file.path && fs.default.existsSync(editedImagePath)) {
          const editedImageFileName = `${Date.now()}_${file.name.split('.')[0]}_edited.jpg`;
          await this.localStorage.copyFile(editedImagePath, editedImageFileName, 'output');
          console.log('✅ Edited image saved to output folder');
        }

        // Copy corresponding .txt metadata file if it exists
        // Handle both .mp4 and _placeholder.jpg cases
        let tempTxtPath;
        if (videoPath.includes('_placeholder.jpg')) {
          // For placeholder files: ./temp/video_123_image_placeholder.jpg -> ./temp/video_123_image.txt
          tempTxtPath = videoPath.replace('_placeholder.jpg', '.txt');
        } else {
          // For normal video files: ./temp/wan_video_123.mp4 -> ./temp/wan_video_123.txt
          tempTxtPath = videoPath.replace('.mp4', '.txt');
        }

        if (fs.default.existsSync(tempTxtPath)) {
          await this.localStorage.copyFile(tempTxtPath, txtFileName, 'output');

          // Update the metadata file to include only the two prompts and embed JSON
          const outputTxtPath = `./output/${txtFileName}`;
          try {
            let metadataContent = fs.default.readFileSync(outputTxtPath, 'utf8');

            // Ensure correct video filename
            metadataContent = metadataContent.replace(/Video file:.*/, `Video file: ${videoFileName}`);

            // Remove any existing single 'Prompt:' line(s)
            metadataContent = metadataContent.replace(/^\s*Prompt:.*\n?/gm, '');

            const promptsJson = JSON.stringify({
              output_1: dualPrompts.imageEditPrompt,
              output_2: dualPrompts.veoPrompt
            });

            const promptsSection = `\nImage Edit Prompt: ${dualPrompts.imageEditPrompt}\nImage-to-Video Prompt: ${dualPrompts.veoPrompt}\nPrompts JSON: ${promptsJson}`;

            // Append prompts section if not already present
            if (!/Image Edit Prompt:|Image-to-Video Prompt:|Prompts JSON:/m.test(metadataContent)) {
              metadataContent += promptsSection;
            }

            fs.default.writeFileSync(outputTxtPath, metadataContent);
            console.log('✅ Enhanced metadata .txt file saved with dual prompts + JSON');
          } catch (updateError) {
            console.warn('⚠️  Could not update metadata:', updateError.message);
            console.log('✅ Metadata .txt file saved to output folder');
          }
        } else {
          // Create new metadata file with both prompts if temp file doesn't exist
          const outputTxtPath = `./output/${txtFileName}`;
          const promptsJson = JSON.stringify({
            output_1: dualPrompts.imageEditPrompt,
            output_2: dualPrompts.veoPrompt
          });
          const metadataContent = `# Halloween Video - Generated
Generated from: ${file.name}
Timestamp: ${new Date().toISOString()}
Video file: ${videoFileName}
Image Edit Prompt: ${dualPrompts.imageEditPrompt}
Image-to-Video Prompt: ${dualPrompts.veoPrompt}
Prompts JSON: ${promptsJson}\n`;

          fs.default.writeFileSync(outputTxtPath, metadataContent);
          console.log('✅ New metadata .txt file created with dual prompts + JSON');
        }

        // Clean up temp files
        try {
          fs.default.unlinkSync(videoPath);
          if (fs.default.existsSync(tempTxtPath)) {
            fs.default.unlinkSync(tempTxtPath);
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

      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Single-use processing completed in ${processingTime.toFixed(1)}s`);
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
