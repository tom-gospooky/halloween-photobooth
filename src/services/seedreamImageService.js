import { fal } from '@fal-ai/client';
import { getImageDimensions } from '../utils/imageUtils.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { pipeline as streamPipeline } from 'stream/promises';
import { Readable } from 'stream';

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

  async editImage(imagePath, editInstruction, options = {}) {
    try {
      const log = options.logger;
      log ? log.stage('Seedream edit') : console.log('🎨 Seedream edit');
      if (!this.isInitialized) {
        await this.initialize();
      }

      const sanitizedInstruction = this.sanitizeImageEditPrompt(editInstruction);
      log ? log.info('Edit instruction prepared') : null;

      // Upload image to FAL storage first (Seedream requires public URLs, not data URIs)
      log ? log.info('Uploading image') : null;

      // Read image as buffer and create File with proper name/type
      const imgBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeTypeFromPath(imagePath);
      const ext = path.extname(imagePath) || '.jpg';
      const basename = path.basename(imagePath, ext);
      const filename = `${basename}${ext}`;

      // Create File object with proper name and MIME type (Node 18+)
      const file = new File([imgBuffer], filename, { type: mimeType });
      const imageUrl = await fal.storage.upload(file);
      log ? log.info('Image uploaded') : null;

      // Get image dimensions for logging
      const dimensions = await getImageDimensions(imagePath);

      // Get image size from settings (defaults to "auto")
      const imageSize = this.settingsService?.getSeedreamImageSize() || "auto";

      log ? log.info(`Image size: ${imageSize} (${dimensions.width}x${dimensions.height})`) : null;

      // Build input with auto-detected settings
      const input = {
        image_urls: [imageUrl],  // Use FAL-hosted URL, not data URI
        prompt: sanitizedInstruction,
        image_size: imageSize,
        num_images: 1,  // Always generate 1 image (simplified)
        enable_safety_checker: false  // Disable for creative Halloween content
      };

      // Call Seedream v4 Edit API with correct parameters
      log ? log.info('Calling Seedream API') : null;

      const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS' || update.status === 'IN_QUEUE') {
            console.log(`⏳ Seedream status: ${update.status}`);
          }
        }
      });
      log ? log.info('Seedream response received') : null;

      // Extract image URL from response - FAL API returns images directly in result
      const url = result?.images?.[0]?.url           // Standard FAL response
        || result?.data?.images?.[0]?.url            // Wrapped response
        || result?.data?.image?.url                   // Alternative structure
        || result?.data?.output?.[0]?.url            // Legacy structure
        || result?.data?.url;                        // Direct URL

      log ? log.info(url ? 'URL extracted' : 'No URL in response') : null;

      if (!url) {
        console.error('❌ Full Seedream response:', JSON.stringify(result, null, 2));
        throw new Error('No image URL in Seedream response');
      }

      const timestamp = Date.now();
      const originalName = path.basename(imagePath, path.extname(imagePath));
      const editedImagePath = `./temp/${timestamp}_${originalName}_edited.jpg`;
      await this.downloadFile(url, editedImagePath);

      log ? log.success('Edited image downloaded') : console.log('✅ Edited image downloaded');
      return editedImagePath;
    } catch (error) {
      console.error('❌ Seedream image editing failed:', error.message);
      console.error('❌ Error details:', JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n')[0],
        response: error.response?.data || error.response || 'No response data'
      }));
      options.logger ? options.logger.warn('Seedream failed, falling back to original image') : console.log('🔄 Seedream fallback to original');
      return imagePath;
    }
  }

  async downloadFile(fileUrl, outputPath) {
    // Prefer fetch with redirect following (Node 18+)
    try {
      try { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); } catch {}
      const res = await fetch(fileUrl, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`Download failed with status: ${res.status} ${res.statusText}`);
      }
      const fileStream = fs.createWriteStream(outputPath);
      await streamPipeline(Readable.fromWeb(res.body), fileStream);
      return;
    } catch (err) {
      // Fallback with manual redirect handling
      const follow = (url, redirectsLeft = 5) => new Promise((resolve, reject) => {
        const handle = (requestUrl, remaining) => {
          https.get(requestUrl, (response) => {
            const { statusCode, headers } = response;
            if (statusCode >= 300 && statusCode < 400 && headers.location) {
              if (remaining <= 0) {
                reject(new Error('Too many redirects'));
                return;
              }
              response.resume();
              const next = headers.location.startsWith('http') ? headers.location : new URL(headers.location, requestUrl).toString();
              handle(next, remaining - 1);
              return;
            }
            if (statusCode !== 200) {
              reject(new Error(`Download failed with status: ${statusCode}`));
              return;
            }

            try { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); } catch {}
            const fileStream = fs.createWriteStream(outputPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              resolve();
            });
            fileStream.on('error', (e) => {
              try { fs.unlinkSync(outputPath); } catch {}
              reject(e);
            });
          }).on('error', reject);
        };
        handle(fileUrl, redirectsLeft);
      });
      await follow(fileUrl);
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
}
