import { FalWanService } from './falWanService.js';
import { FalWan25Service } from './falWan25Service.js';
import { FalKlingService } from './falKlingService.js';
import { SeedreamImageService } from './seedreamImageService.js';
import { SettingsService } from './settingsService.js';
import { detectAspectRatio } from '../utils/imageUtils.js';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';

export class VideoGenerationService {
  constructor(settingsService = null) {
    // Initialize or create settings service
    this.settingsService = settingsService || new SettingsService();

    // Pass settings service to all sub-services
    this.wanService = new FalWanService(this.settingsService);
    this.wan25Service = new FalWan25Service(this.settingsService);
    this.klingService = new FalKlingService(this.settingsService);
    this.imageEditService = new SeedreamImageService(this.settingsService);

    this.isInitialized = false;
    this.currentModel = 'wan-2.2-turbo'; // Default model

    // Deprecated: legacy options (now using settingsService)
    this.modelOptions = {
      kling: {
        duration: 5,
        aspectRatio: '16:9'
      }
    };
  }

  async initialize() {
    if (!this.settingsService.isLoaded) {
      await this.settingsService.load();
      // Update current model from settings
      this.currentModel = this.settingsService.getSettings().videoModel;
    }
    this.isInitialized = true;
  }

  async setModel(modelId) {
    const validModels = ['wan-2.2-turbo', 'wan-2.5-preview', 'kling-v2.5-turbo'];
    if (validModels.includes(modelId)) {
      this.currentModel = modelId;
      // Also update in settings service
      await this.settingsService.setVideoModel(modelId);
      console.log(`📹 Video model changed to: ${modelId}`);
    } else {
      console.warn(`⚠️ Invalid model ID: ${modelId}, keeping current model: ${this.currentModel}`);
    }
  }

  getModel() {
    return this.currentModel;
  }

  getOptions() {
    return this.modelOptions;
  }

  setKlingOptions(opts = {}) {
    if (!this.modelOptions.kling) this.modelOptions.kling = {};
    if (typeof opts.duration === 'number') this.modelOptions.kling.duration = opts.duration;
    if (typeof opts.aspectRatio === 'string') this.modelOptions.kling.aspectRatio = opts.aspectRatio;
    console.log(`🎛️  Updated Kling options: duration=${this.modelOptions.kling.duration}, aspectRatio=${this.modelOptions.kling.aspectRatio}`);
  }

  async generateVideoWithImageEdit(veoPrompt, imageEditPrompt, originalImagePath, originalFileName) {
    try {
      console.log('🎬 Generating video with image editing workflow...');

      // Step 1: Edit the image using Gemini Image API
      console.log('🎨 Step 1: Editing image with Seedream v4 Edit (fal.ai)...');
      const editedImagePath = await this.imageEditService.editImage(originalImagePath, imageEditPrompt);

      // Step 2: Generate video using edited image and Veo prompt
      console.log('🎬 Step 2: Generating video with edited image...');
      const videoPath = await this.generateVideo(veoPrompt, editedImagePath, originalFileName);

      return {
        videoPath,
        editedImagePath
      };

    } catch (error) {
      console.log(`❌ Image editing workflow failed: ${error.message}`);
      console.log('🔄 Falling back to original image workflow...');

      // Fallback to original workflow without image editing
      const videoPath = await this.generateVideo(veoPrompt, originalImagePath, originalFileName);
      return {
        videoPath,
        editedImagePath: originalImagePath // Return original as edited path for fallback
      };
    }
  }

  async generateVideo(geminiOutputText, imagePath, originalFileName, options = {}) {
    try {
      // Ensure settings are loaded
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`🎬 Generating video with ${this.currentModel} using Gemini output...`);

      // Dry-run short-circuit: create placeholder only, no network calls
      if (options?.dryRun) {
        console.log('🧪 Dry run enabled — skipping API calls');
        return await this.createPlaceholderVideo(imagePath, originalFileName, geminiOutputText, options.outputDir);
      }

      // Select the appropriate service based on current model
      let service;
      let modelName;

      switch (this.currentModel) {
        case 'wan-2.5-preview':
          service = this.wan25Service;
          modelName = 'WAN 2.5 Preview';
          break;
        case 'kling-v2.5-turbo':
          service = this.klingService;
          modelName = 'Kling Video v2.5 Turbo Pro';
          break;
        case 'wan-2.2-turbo':
        default:
          service = this.wanService;
          modelName = 'WAN 2.2 Turbo';
      }

      if (!this.isInitialized) {
        await service.initialize();
        this.isInitialized = true;
      }

      console.log(`📝 Using Gemini 2.5 Flash output text for ${modelName}`);
      console.log(`📄 Text length: ${geminiOutputText.length} characters`);

      // Detect aspect ratio from input image
      const aspectRatio = await detectAspectRatio(imagePath);

      // Build options with auto-detected aspect ratio and user settings
      const genOptions = {
        aspectRatio: aspectRatio,  // Auto-detected or '16:9' fallback
        resolution: this.currentModel === 'wan-2.5-preview' ? "1080p" : "720p",
        duration: parseInt(this.settingsService.getDuration())  // User setting
      };

      console.log(`📐 Using aspect ratio: ${aspectRatio} (auto-detected from image)`);
      console.log(`⏱️  Duration: ${genOptions.duration}s`);

      const result = await service.generateVideo(geminiOutputText, imagePath, genOptions);

      if (result.success) {
        console.log(`✅ Video generated with ${result.model}: ${result.outputPath}`);
        return result.outputPath;
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.log(`❌ ${this.currentModel} generation failed: ${error.message}`);
      console.log('🔄 Falling back to placeholder video...');
      return await this.createPlaceholderVideo(imagePath, originalFileName, geminiOutputText, options?.outputDir);
    }
  }



  async createPlaceholderVideo(imagePath, originalFileName, prompt, outputDir = null) {
    try {
      console.log('🎨 Creating placeholder Halloween video...');
      
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
      
      console.log('⚠️  Created placeholder instead of actual video');
      return outputPath.replace('.mp4', '_placeholder.jpg');
      
    } catch (error) {
      console.error('Failed to create placeholder video:', error);
      throw error;
    }
  }

  async createVideoFromImage(imagePath, duration = 6) {
    // This would use ffmpeg or similar to create a video from a static image
    // with some basic effects like zoom, fade, or particle overlays
    // Implementation would depend on having ffmpeg installed and configured
    
    console.log('🎞️  Creating video from static image not implemented yet');
    return imagePath; // Return image path as fallback
  }
}
