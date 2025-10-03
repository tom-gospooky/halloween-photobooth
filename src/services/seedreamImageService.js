import { fal } from '@fal-ai/client';
import { getImageDimensions } from '../utils/imageUtils.js';
import fs from 'fs';
import path from 'path';
import https from 'https';

export class SeedreamImageService {
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
      fal.config({ credentials: this.apiKey });
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error('❌ Failed to initialize FAL Seedream service:', err.message);
      return false;
    }
  }

  sanitizeImageEditPrompt(prompt) {
    if (!prompt) return '';
    let sanitized = String(prompt)
      .replace(/blood/gi, 'dark red paint')
      .replace(/bloody/gi, 'dark red colored')
      .replace(/blood\s+streaks/gi, 'dark red artistic streaks')
      .replace(/blood\s+splatters/gi, 'dark red paint splatters')
      .replace(/terror/gi, 'dramatic suspense')
      .replace(/slasher/gi, '90s movie')
      .replace(/kill/gi, 'dramatic scene')
      .replace(/murder/gi, 'mystery movie')
      .replace(/death/gi, 'dramatic scene')
      .replace(/violence/gi, 'action movie style')
      .replace(/scary/gi, 'atmospheric and moody')
      .replace(/horror/gi, '90s thriller movie')
      .replace(/frightening/gi, 'mysteriously atmospheric')
      .replace(/menacing/gi, 'dramatically lit')
      .replace(/lurks/gi, 'creates atmosphere')
      .replace(/frozen in silent terror/gi, 'posed dramatically')
      .replace(/unseen slasher/gi, 'movie atmosphere')
      .replace(/chilling/gi, 'atmospheric')
      .replace(/ominous/gi, 'dramatic')
      .replace(/deserted/gi, 'empty retro');
    sanitized = sanitized.replace(/grimy/gi, 'vintage styled');
    sanitized = sanitized.replace(/abandoned/gi, 'retro');
    sanitized = sanitized.replace(/gritty/gi, 'vintage');
    return sanitized;
  }

  async editImage(imagePath, editInstruction) {
    try {
      console.log('🎨 Editing image with Seedream v4 Edit (fal.ai)...');
      if (!this.isInitialized) {
        await this.initialize();
      }

      const sanitizedInstruction = this.sanitizeImageEditPrompt(editInstruction);
      console.log(`📝 Edit instruction: ${sanitizedInstruction}`);

      // Read source image and convert to data URI
      const imgBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeTypeFromPath(imagePath);
      const imageDataUri = `data:${mimeType};base64,${imgBuffer.toString('base64')}`;

      // Get image dimensions to preserve aspect ratio
      const dimensions = await getImageDimensions(imagePath);
      let imageSize = '2048x2048'; // Default square

      if (dimensions.width && dimensions.height) {
        // Try to maintain aspect ratio
        const ratio = dimensions.width / dimensions.height;
        if (ratio > 1.2) {
          // Landscape
          imageSize = '2048x1536';  // Roughly 4:3 landscape
        } else if (ratio < 0.8) {
          // Portrait
          imageSize = '1536x2048';  // Roughly 3:4 portrait
        } else {
          // Square-ish
          imageSize = '2048x2048';
        }
      }

      console.log(`📐 Using image size: ${imageSize} (based on input dimensions ${dimensions.width}x${dimensions.height})`);

      // Get number of variations from settings
      const numImages = this.settingsService?.getImageVariations() || 1;

      // Build input with auto-detected settings
      const input = {
        image_urls: [imageDataUri],
        prompt: sanitizedInstruction,
        image_size: imageSize,
        num_images: numImages,
        enable_safety_checker: true  // Always enabled for safety
      };

      // Call Seedream v4 Edit API with correct parameters
      const result = await fal.run('fal-ai/bytedance/seedream/v4/edit', { input });

      // Extract image URL from response
      const url = result?.data?.images?.[0]?.url
        || result?.data?.image?.url
        || result?.data?.output?.[0]?.url
        || result?.data?.url;

      if (!url) {
        throw new Error('No image URL in Seedream response');
      }

      const timestamp = Date.now();
      const originalName = path.basename(imagePath, path.extname(imagePath));
      const editedImagePath = `./temp/${timestamp}_${originalName}_edited.jpg`;
      await this.downloadFile(url, editedImagePath);

      console.log(`✅ Image edited successfully: ${editedImagePath}`);
      console.log(`📄 Source MIME type: ${mimeType}, saved as JPG`);
      return editedImagePath;
    } catch (error) {
      console.error('❌ Seedream image editing failed:', error.message);
      console.log('🔄 Falling back to original image');
      return imagePath;
    }
  }

  downloadFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
      https.get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status: ${response.statusCode}`));
          return;
        }
        // Ensure temp directory exists
        try { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); } catch {}
        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', (err) => {
          try { fs.unlinkSync(outputPath); } catch {}
          reject(err);
        });
      }).on('error', reject);
    });
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
}
