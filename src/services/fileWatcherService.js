import { ProcessedFileTracker } from './processedFileTracker.js';

export class FileWatcherService {
  constructor(localStorageService, photoAnalysisService, videoGenerationService) {
    this.localStorage = localStorageService;
    this.photoAnalysis = photoAnalysisService;
    this.videoGeneration = videoGenerationService;
    this.isRunning = false;
    this.fileTracker = new ProcessedFileTracker();
    this.watchInterval = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  File watcher already running');
      return;
    }

    try {
      console.log('👁️  Starting file watcher service...');

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

      for (const file of inputFiles) {
        // Check if file is already processed or currently being processed
        if (this.fileTracker.isFileProcessed(file.path, file.name)) {
          continue; // Skip already processed files
        }

        if (this.fileTracker.isFileCurrentlyProcessing(file.path, file.name)) {
          continue; // Skip files currently being processed
        }

        console.log(`🔍 New photo detected: ${file.name}`);
        await this.processNewPhoto(file);
      }
    } catch (error) {
      console.error('Error checking for new files:', error);
    }
  }

  async processNewPhoto(file) {
    const startTime = Date.now();
    console.log(`🎃 Processing photo: ${file.name}`);

    // Mark file as currently being processed to prevent duplicates
    await this.fileTracker.markFileAsProcessing(file.path, file.name);

    try {
      // Step 1: Generate video prompt with Gemini 2.5 Flash + master prompt
      console.log('📝 Step 1: Generating video prompt with Gemini 2.5 Flash + master prompt...');
      const videoPrompt = await this.photoAnalysis.generateVideoPrompt(file.path);

      // Step 2: Generate video with WAN 2.2 Turbo using Gemini output + image
      console.log('🎬 Step 2: Generating video with WAN 2.2 Turbo using Gemini output + image...');
      const videoPath = await this.videoGeneration.generateVideo(videoPrompt, file.path, file.name);

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

          // Update the metadata file to reflect the final video filename
          const outputTxtPath = `./output/${txtFileName}`;
          try {
            let metadataContent = fs.default.readFileSync(outputTxtPath, 'utf8');
            metadataContent = metadataContent.replace(/Video file:.*/, `Video file: ${videoFileName}`);
            fs.default.writeFileSync(outputTxtPath, metadataContent);
            console.log('✅ Metadata .txt file saved to output folder with correct filename');
          } catch (updateError) {
            console.warn('⚠️  Could not update metadata filename:', updateError.message);
            console.log('✅ Metadata .txt file saved to output folder');
          }
        }

        // Clean up temp files
        try {
          fs.default.unlinkSync(videoPath);
          if (fs.default.existsSync(tempTxtPath)) {
            fs.default.unlinkSync(tempTxtPath);
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
      fileTracker: this.fileTracker.getStatus()
    };
  }
}