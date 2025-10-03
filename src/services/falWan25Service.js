import { fal } from '@fal-ai/client';
import fs from 'fs';
import https from 'https';

export class FalWan25Service {
  constructor(settingsService = null) {
    this.apiKey = process.env.FAL_KEY;
    this.isInitialized = false;
    this.settingsService = settingsService;
  }

  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('FAL_KEY not found in environment variables');
      }

      // Configure fal client
      fal.config({
        credentials: this.apiKey
      });

      console.log('✅ FAL WAN 2.5 Preview service initialized');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FAL WAN 2.5 service:', error.message);
      return false;
    }
  }

  async generateVideo(prompt, imagePath, options = {}) {
    try {
      console.log('🎬 Generating video with WAN 2.5 Preview...');

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Extract filename for metadata
      const originalFileName = imagePath.split('/').pop();

      // Convert local image to base64 data URI for FAL
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeTypeFromPath(imagePath);
      const imageDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

      console.log('📸 Image converted to data URI for WAN 2.5');
      console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

      // Use provided options or defaults
      const input = {
        image_url: imageDataUri,
        prompt: prompt,
        resolution: options.resolution || "1080p",
        duration: parseInt(options.duration || "5"),
        enable_safety_checker: false, // Allow horror content
        enable_prompt_expansion: true  // Use LLM enhancement
      };

      const result = await fal.run("fal-ai/wan-25-preview/image-to-video", { input });

      // API call successful, processing response

      if (result && result.data && result.data.video && result.data.video.url) {
        console.log('✅ WAN 2.5 Preview video generation completed');

        // Download the video from the URL
        const timestamp = Date.now();
        const outputPath = `./temp/wan25_video_${timestamp}.mp4`;

        await this.downloadVideo(result.data.video.url, outputPath);

        // Create metadata .txt file for successful WAN 2.5 generation
        await this.createMetadataFile(outputPath, originalFileName, prompt);

        return {
          success: true,
          model: 'wan-2.5-preview',
          outputPath: outputPath,
          size: fs.statSync(outputPath).size,
          mimeType: 'video/mp4'
        };
      } else {
        throw new Error(`No video URL in WAN 2.5 response. Got: ${JSON.stringify(result)}`);
      }

    } catch (error) {
      console.error('❌ WAN 2.5 Preview generation failed:', error.message);
      return {
        success: false,
        error: error.message,
        model: 'wan-2.5-preview'
      };
    }
  }

  async downloadVideo(videoUrl, outputPath) {
    console.log('⬇️ Downloading video from WAN 2.5...');

    return new Promise((resolve, reject) => {
      https.get(videoUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status: ${response.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          const stats = fs.statSync(outputPath);
          console.log(`✅ Video downloaded: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', reject);
    });
  }

  async createMetadataFile(videoPath, originalFileName, prompt, finalVideoName = null) {
    try {
      const metadataPath = videoPath.replace('.mp4', '.json');
      const videoFileName = finalVideoName || videoPath.split('/').pop();

      const metadata = {
        model: 'wan-2.5-preview',
        modelName: 'WAN 2.5 Preview',
        provider: 'fal.ai',
        type: 'image-to-video',
        source: {
          originalFileName: originalFileName,
          uploadedAt: new Date().toISOString()
        },
        generation: {
          prompt: prompt,
          videoFile: videoFileName,
          generatedAt: new Date().toISOString()
        }
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`📝 Metadata JSON created: ${metadataPath.split('/').pop()}`);

      return metadataPath;
    } catch (error) {
      console.error('⚠️ Failed to create metadata file:', error.message);
      // Don't throw - metadata file failure shouldn't break video generation
      return null;
    }
  }

  getMimeTypeFromPath(imagePath) {
    const ext = imagePath.split('.').pop().toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  // Test method to verify service functionality
  async testService() {
    try {
      console.log('🧪 Testing FAL WAN 2.5 Preview service...');

      if (!await this.initialize()) {
        return { success: false, error: 'Initialization failed' };
      }

      console.log('✅ FAL WAN 2.5 service initialized successfully');
      return {
        success: true,
        message: 'Service ready - needs test image for full video generation test'
      };

    } catch (error) {
      console.log(`❌ Service test failed: ${error.message}`);

      let errorType = 'unknown';
      if (error.message.includes('API key') || error.message.includes('unauthorized')) {
        errorType = 'authentication';
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorType = 'quota_exceeded';
      }

      return { success: false, error: error.message, type: errorType };
    }
  }
}
