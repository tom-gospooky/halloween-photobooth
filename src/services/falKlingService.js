import { fal } from '@fal-ai/client';
import fs from 'fs';
import https from 'https';

export class FalKlingService {
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

      console.log('✅ FAL Kling Video v2.5 Turbo Pro service initialized');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FAL Kling service:', error.message);
      return false;
    }
  }

  async generateVideo(prompt, imagePath, options = {}) {
    try {
      console.log('🎬 Generating video with Kling Video v2.5 Turbo Pro (image-to-video)...');

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Extract filename for metadata
      const originalFileName = imagePath.split('/').pop();

      // Convert local image to base64 data URI for FAL image-to-video
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeTypeFromPath(imagePath);
      const imageDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

      console.log('📸 Image converted to data URI for Kling');
      console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

      // Try known endpoint variants with minimal required inputs
      const candidates = [];

      // Build input with provided options or defaults
      const baseImgToVid = {
        image_url: imageDataUri,
        prompt,
        duration: String(options?.duration || '5'),
        aspect_ratio: options?.aspectRatio || '16:9',
        negative_prompt: 'blur, distort, and low quality'
      };

      candidates.push({ id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", input: baseImgToVid });
      candidates.push({ id: "fal-ai/kling-video/v2.5-turbo/image-to-video", input: baseImgToVid });

      let lastError = null;
      for (const cand of candidates) {
        try {
          console.log(`🧪 Trying Kling endpoint: ${cand.id}`);
          const result = await fal.run(cand.id, { input: cand.input });

          const url = result?.data?.video?.url || result?.data?.output?.video?.url || result?.data?.url;
          if (!url) {
            throw new Error(`No video URL in response from ${cand.id}`);
          }

          console.log('✅ Kling generation completed');
          const timestamp = Date.now();
          const outputPath = `./temp/kling_video_${timestamp}.mp4`;
          await this.downloadVideo(url, outputPath);
          await this.createMetadataFile(outputPath, originalFileName, prompt);

          return {
            success: true,
            model: 'kling-v2.5-turbo',
            outputPath,
            size: fs.statSync(outputPath).size,
            mimeType: 'video/mp4'
          };
        } catch (err) {
          console.warn(`⚠️  Kling endpoint failed: ${cand.id} → ${err.message}`);
          lastError = err;
        }
      }
      // If all candidates failed
      throw lastError || new Error('Kling generation failed');

    } catch (error) {
      console.error('❌ Kling Video v2.5 Turbo Pro image-to-video failed:', error.message);
      return {
        success: false,
        error: error.message,
        model: 'kling-v2.5-turbo'
      };
    }
  }

  async downloadVideo(videoUrl, outputPath) {
    console.log('⬇️ Downloading video from Kling...');

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
        model: 'kling-v2.5-turbo',
        modelName: 'Kling Video v2.5 Turbo Pro',
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
      console.log('🧪 Testing FAL Kling Video v2.5 Turbo Pro service...');

      if (!await this.initialize()) {
        return { success: false, error: 'Initialization failed' };
      }

      console.log('✅ FAL Kling service initialized successfully');
      return {
        success: true,
        message: 'Service ready - needs test prompt for full video generation test'
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
