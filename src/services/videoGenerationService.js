import { FalWanService } from './falWanService.js';
import fs from 'fs';
import sharp from 'sharp';

export class VideoGenerationService {
  constructor() {
    this.wanService = new FalWanService();
    this.isInitialized = false;
  }

  async generateVideo(geminiOutputText, imagePath, originalFileName) {
    try {
      console.log('🎬 Generating video with WAN 2.2 Turbo using Gemini output...');

      if (!this.isInitialized) {
        await this.wanService.initialize();
        this.isInitialized = true;
      }

      console.log(`📝 Using Gemini 2.5 Flash output text for WAN 2.2 Turbo`);
      console.log(`📄 Text length: ${geminiOutputText.length} characters`);

      // Generate video with WAN using Gemini's output text
      const result = await this.wanService.generateVideo(geminiOutputText, imagePath, {
        aspectRatio: "16:9",
        resolution: "720p"
      });
      
      if (result.success) {
        console.log(`✅ Video generated with ${result.model}: ${result.outputPath}`);
        return result.outputPath;
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.log(`❌ WAN generation failed: ${error.message}`);
      console.log('🔄 Falling back to placeholder video...');
      return await this.createPlaceholderVideo(imagePath, originalFileName, geminiOutputText);
    }
  }



  async createPlaceholderVideo(imagePath, originalFileName, prompt) {
    try {
      console.log('🎨 Creating placeholder Halloween video...');
      
      // Create a simple placeholder video by combining the image with a spooky overlay
      // This is a fallback when WAN 2.2 Turbo API is not available
      
      const outputPath = `./temp/video_${Date.now()}_${originalFileName}.mp4`;
      
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