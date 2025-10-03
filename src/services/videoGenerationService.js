import { FalWan25Service } from './falWan25Service.js';
import { SeedreamImageService } from './seedreamImageService.js';
import { SettingsService } from './settingsService.js';
import { detectAspectRatio } from '../utils/imageUtils.js';
import fs from 'fs';
import path from 'path';

export class VideoGenerationService {
  constructor(settingsService = null) {
    // Initialize or create settings service
    this.settingsService = settingsService || new SettingsService();

    // Only use WAN 2.5 Preview for video generation
    this.wan25Service = new FalWan25Service(this.settingsService);

    // Keep Seedream for image editing
    this.imageEditService = new SeedreamImageService(this.settingsService);

    this.isInitialized = false;
  }

  async initialize() {
    if (!this.settingsService.isLoaded) {
      await this.settingsService.load();
    }
    // Initialize WAN 2.5 service
    await this.wan25Service.initialize();
    this.isInitialized = true;
    console.log('📹 Video Generation Service initialized with WAN 2.5 Preview');
  }

  async generateVideoWithImageEdit(veoPrompt, imageEditPrompt, originalImagePath, originalFileName, progress = {}) {
    const timing = {
      imageEdit: 0,
      videoGeneration: 0
    };

    try {
      // Stage logged by caller

      // Step 1: Edit the image using Seedream v4 Edit
      try { progress.onImageEditStart && progress.onImageEditStart(); } catch {}
      //
      const imageEditStart = Date.now();
      const editedImagePath = await this.imageEditService.editImage(originalImagePath, imageEditPrompt, { logger: progress.logger });
      try { progress.onImageEditComplete && progress.onImageEditComplete(editedImagePath); } catch {}
      timing.imageEdit = (Date.now() - imageEditStart) / 1000;
      //

      // Step 2: Generate video using edited image and Veo prompt
      //
      try { progress.onVideoStart && progress.onVideoStart(); } catch {}
      const videoGenStart = Date.now();
      const videoPath = await this.generateVideo(veoPrompt, editedImagePath, originalFileName, { logger: progress.logger });
      timing.videoGeneration = (Date.now() - videoGenStart) / 1000;
      //
      try { progress.onVideoComplete && progress.onVideoComplete(videoPath); } catch {}

      return {
        videoPath,
        editedImagePath,
        timing
      };

    } catch (error) {
      if (progress?.logger) {
        progress.logger.error(`Image editing workflow failed: ${error.message}`);
        progress.logger.warn('Falling back to original image');
      }

      // Fallback to original workflow without image editing
      try { progress.onVideoStart && progress.onVideoStart(); } catch {}
      const videoGenStart = Date.now();
      const videoPath = await this.generateVideo(veoPrompt, originalImagePath, originalFileName, { logger: progress.logger });
      timing.videoGeneration = (Date.now() - videoGenStart) / 1000;
      timing.imageEdit = 0; // Failed, so 0 time

      return {
        videoPath,
        editedImagePath: originalImagePath, // Return original as edited path for fallback
        timing
      };
    }
  }

  async generateVideo(geminiOutputText, imagePath, originalFileName, options = {}) {
    try {
      // Ensure settings are loaded
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Caller logs video generation start/complete; keep quiet here

      // Dry-run short-circuit: create placeholder only, no network calls
      if (options?.dryRun) {
        return await this.createPlaceholderVideo(imagePath, originalFileName, geminiOutputText, options.outputDir);
      }

      //

      // Detect aspect ratio from input image
      const aspectRatio = await detectAspectRatio(imagePath);

      // Get settings from settingsService
      const settings = this.settingsService.getSettings();

      // Build options with auto-detected aspect ratio and user settings
      const genOptions = {
        aspectRatio: aspectRatio,  // Auto-detected or '16:9' fallback
        resolution: settings.resolution || "1080p",
        duration: parseInt(settings.duration || "5")
      };

      //

      const result = await this.wan25Service.generateVideo(geminiOutputText, imagePath, { ...genOptions, logger: options.logger });

      if (result.success) {
        // Caller logs completion
        return result.outputPath;
      } else {
        const err = new Error(result.error || 'WAN error');
        if (result.code) err.code = result.code;
        if (result.details) err.details = result.details;
        throw err;
      }

    } catch (error) {
      // If WAN returned Unprocessable, bubble up so caller can reset the image
      if (error?.code === 'UNPROCESSABLE_ENTITY' || /Unprocessable/i.test(error?.message || '')) {
        if (options.logger) {
          options.logger.error(`WAN failed: ${error.message}`);
        }
        throw error; // Let higher level decide (reset)
      }
      if (options.logger) {
        options.logger.error(`WAN failed: ${error.message}`);
        if (error.details) {
          const d = error.details;
          const reason = Array.isArray(d.validation) && d.validation.length
            ? d.validation.join('; ')
            : (d.body?.message || d.bodyText || `${d.status || ''} ${d.statusText || ''}`).toString().slice(0, 200);
          if (reason.trim()) options.logger.warn(`Details: ${reason}`);
        }
        options.logger.warn('Falling back to placeholder');
      }
      return await this.createPlaceholderVideo(imagePath, originalFileName, geminiOutputText, options?.outputDir);
    }
  }



  async createPlaceholderVideo(imagePath, originalFileName, prompt, outputDir = null) {
    try {
      // Placeholder generation (no verbose log)
      
      // Create a simple placeholder video by combining the image with a spooky overlay
      // This is a fallback when WAN 2.2 Turbo API is not available
      const targetDir = outputDir ? outputDir : './temp';
      try { fs.mkdirSync(targetDir, { recursive: true }); } catch {}
      const outputPath = path.join(targetDir, `video_${Date.now()}_${originalFileName}.mp4`);
      
      // For now, we'll create a basic video file placeholder
      // In a real implementation, you might use ffmpeg to create an actual video
      const placeholderContent = `# Halloween Video - Placeholder
Generated from: ${originalFileName}
Prompt: ${prompt}
Timestamp: ${new Date().toISOString()}
Model: Placeholder (WAN 2.2 Turbo unavailable)
Video file: ${outputPath.split('/').pop()}

This would be replaced by the actual WAN 2.2 Turbo generated video.
`;

      fs.writeFileSync(outputPath.replace('.mp4', '.txt'), placeholderContent);
      
      // Create a minimal MP4 file (this would typically be done with ffmpeg)
      // For demonstration, we'll copy the image as a placeholder
      const imageBuffer = fs.readFileSync(imagePath);
      fs.writeFileSync(outputPath.replace('.mp4', '_placeholder.jpg'), imageBuffer);
      
      //
      return outputPath.replace('.mp4', '_placeholder.jpg');
      
    } catch (error) {
      console.error('Failed to create placeholder video:', error);
      throw error;
    }
  }

  async createVideoFromImage(imagePath, _duration = 6) {
    // This would use ffmpeg or similar to create a video from a static image
    // with some basic effects like zoom, fade, or particle overlays
    // Implementation would depend on having ffmpeg installed and configured
    
    console.log('🎞️  Creating video from static image not implemented yet');
    return imagePath; // Return image path as fallback
  }
}
