import { fal } from '@fal-ai/client';
import fs from 'fs';
import https from 'https';

export class FalWanService {
  constructor() {
    this.apiKey = process.env.FAL_KEY;
    this.isInitialized = false;
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

      console.log('✅ FAL WAN 2.2 Turbo service initialized');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FAL WAN service:', error.message);
      return false;
    }
  }

  async generateVideo(prompt, imagePath, options = {}) {
    try {
      console.log('🎬 Generating video with WAN 2.2 Turbo...');

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Extract filename for metadata
      const originalFileName = imagePath.split('/').pop();

      // Convert local image to base64 data URI for FAL
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);
      const imageDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

      console.log('📸 Image converted to data URI for WAN');
      console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

      const result = await fal.run("fal-ai/wan/v2.2-a14b/image-to-video/turbo", {
        input: {
          image_url: imageDataUri,
          prompt: prompt,
          // Optional parameters with defaults
          resolution: options.resolution || "720p",
          aspect_ratio: options.aspectRatio || "16:9",
          enable_safety_checker: false, // Allow horror content
          expand_prompt: true // Let WAN enhance the prompt
        }
      });

      // API call successful, processing response

      if (result && result.data && result.data.video && result.data.video.url) {
        console.log('✅ WAN 2.2 Turbo video generation completed');

        // Download the video from the URL
        const timestamp = Date.now();
        const outputPath = `./temp/wan_video_${timestamp}.mp4`;

        await this.downloadVideo(result.data.video.url, outputPath);

        // Create metadata .txt file for successful WAN generation
        await this.createMetadataFile(outputPath, originalFileName, prompt);

        return {
          success: true,
          model: 'wan-2.2-turbo',
          outputPath: outputPath,
          size: fs.statSync(outputPath).size,
          mimeType: 'video/mp4'
        };
      } else {
        throw new Error(`No video URL in WAN response. Got: ${JSON.stringify(result)}`);
      }

    } catch (error) {
      console.error('❌ WAN 2.2 Turbo generation failed:', error.message);
      return {
        success: false,
        error: error.message,
        model: 'wan-2.2-turbo'
      };
    }
  }

  async downloadVideo(videoUrl, outputPath) {
    console.log('⬇️ Downloading video from WAN...');

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
      const metadataPath = videoPath.replace('.mp4', '.txt');
      const videoFileName = finalVideoName || videoPath.split('/').pop();

      const metadataContent = `# Halloween Video - WAN 2.2 Turbo Generated
Generated from: ${originalFileName}
Prompt: ${prompt}
Timestamp: ${new Date().toISOString()}
Model: WAN 2.2 Turbo via fal.ai
Video file: ${videoFileName}

This video was successfully generated using WAN 2.2 Turbo image-to-video AI.`;

      fs.writeFileSync(metadataPath, metadataContent);
      console.log(`📝 Metadata file created: ${metadataPath.split('/').pop()}`);

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
      console.log('🧪 Testing FAL WAN 2.2 Turbo service...');

      if (!await this.initialize()) {
        return { success: false, error: 'Initialization failed' };
      }

      // We would need a test image for a full test
      console.log('✅ FAL WAN service initialized successfully');
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