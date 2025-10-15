import { fal } from '@fal-ai/client';
import fs from 'fs';
import https from 'https';
import { pipeline as streamPipeline } from 'stream/promises';
import { Readable } from 'stream';
import path from 'path';

export class FalWan25Service {
  constructor(settingsService = null) {
    this.apiKey = process.env.FAL_KEY;
    this.isInitialized = false;
    this.settingsService = settingsService;
    this.negativePrompt = '';
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

      // Load negative prompt from negative.md
      await this.loadNegativePrompt();

      console.log('✅ FAL WAN 2.5 Preview service initialized');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FAL WAN 2.5 service:', error.message);
      return false;
    }
  }

  async loadNegativePrompt() {
    try {
      const negativePath = path.resolve('./negative.md');
      if (fs.existsSync(negativePath)) {
        const content = fs.readFileSync(negativePath, 'utf8');
        // Simply use the entire content as negative prompt (stripped of markdown headers)
        const cleaned = content
          .replace(/^#.*$/gm, '')  // Remove markdown headers
          .replace(/^-{3,}$/gm, '') // Remove horizontal rules
          .trim();

        if (cleaned && cleaned.length > 0) {
          this.negativePrompt = cleaned;
          console.log('✅ Loaded negative prompt from negative.md');
        } else {
          console.warn('⚠️ negative.md is empty, using default');
          this.negativePrompt = 'blur, distortion, low quality';
        }
      } else {
        console.warn('⚠️ negative.md not found, using default negative prompt');
        this.negativePrompt = 'blur, distortion, low quality';
      }
    } catch (error) {
      console.error('❌ Failed to load negative prompt:', error.message);
      this.negativePrompt = 'blur, distortion, low quality';
    }
  }

  async generateVideo(prompt, imagePath, options = {}) {
    try {
      const log = options.logger;

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Extract filename (not used here; metadata is written later)
      // const originalFileName = imagePath.split('/').pop();

      // Convert local image to base64 data URI for FAL
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeTypeFromPath(imagePath);
      const imageDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

      // Minimal logging — caller logs the stage

      // Use provided options or defaults from settingsService
      const resolution = options.resolution || this.settingsService?.getSettings().resolution || "1080p";
      const duration = options.duration || this.settingsService?.getSettings().duration || "5";

      const input = {
        image_url: imageDataUri,
        prompt: prompt,
        resolution: resolution,
        duration: parseInt(duration),
        negative_prompt: this.negativePrompt, // Load from negative.md
        enable_safety_checker: false, // Allow horror content
        enable_prompt_expansion: false  // Use LLM enhancement
      };

      //

      // Log raw WAN request
      let callId = null;
      try {
        if (options.apiLogger) {
          callId = options.apiLogger.apiRequest('fal_wan', 'fal-ai/wan-25-preview/image-to-video', { input });
        }
      } catch {}

      const result = await fal.run("fal-ai/wan-25-preview/image-to-video", { input });

      try { options.apiLogger && options.apiLogger.apiResponse(callId || 0, result); } catch {}

      //

      // Correct path: result.data.video.url (fal.run wraps response in data object)
      if (result && result.data && result.data.video && result.data.video.url) {
        // Caller will log video completion

        // Download the video from the URL
        const timestamp = Date.now();
        const outputPath = `./temp/wan25_video_${timestamp}.mp4`;

        await this.downloadVideo(result.data.video.url, outputPath, log);

        // No temp metadata creation here; final metadata is written when moving to output

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
      // Try to extract structured error info from FAL response
      const details = await this.parseFalError(error);
      const code = details.code || 'UNKNOWN';
      console.error('❌ WAN 2.5 Preview generation failed:', details.message || error.message);
      return {
        success: false,
        error: details.message || error.message,
        code,
        details,
        model: 'wan-2.5-preview'
      };
    }
  }

  async downloadVideo(videoUrl, outputPath, log = null) {
    // Keep download logs minimal

    // Prefer fetch with redirect following (Node 18+)
    try {
      // Ensure temp directory exists
      try { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); } catch {}

      const res = await fetch(videoUrl, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`Download failed with status: ${res.status} ${res.statusText}`);
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      // Stream to file
      const fileStream = fs.createWriteStream(outputPath);
      await streamPipeline(Readable.fromWeb(res.body), fileStream);

      // Basic MP4 signature check: 'ftyp' at offset 4
      try {
        const fd = fs.openSync(outputPath, 'r');
        const header = Buffer.alloc(12);
        fs.readSync(fd, header, 0, 12, 0);
        fs.closeSync(fd);
        const isMp4 = header.slice(4, 8).toString() === 'ftyp';
        if (!isMp4) {
          const size = fs.statSync(outputPath).size;
          // Clean up partial or wrong file to avoid propagating corruption
          try { fs.unlinkSync(outputPath); } catch {}
          throw new Error(`Downloaded file is not a valid MP4 (content-type=${contentType || 'unknown'}, size=${size} bytes)`);
        }
      } catch (sigErr) {
        // If we fail to read header, remove file and rethrow
        try { fs.unlinkSync(outputPath); } catch {}
        throw sigErr;
      }

      // download complete
      return;
    } catch (err) {
      // Fallback to https.get with manual redirect handling (rarely used if fetch works)
      if (log) log.warn(`fetch download failed (${err.message}); trying https.get with redirects`);

      const follow = (url, redirectsLeft = 5) => new Promise((resolve, reject) => {
        const handle = (requestUrl, remaining) => {
          https.get(requestUrl, (response) => {
            const { statusCode, headers } = response;
            if (statusCode >= 300 && statusCode < 400 && headers.location) {
              if (remaining <= 0) {
                reject(new Error('Too many redirects'));
                return;
              }
              response.resume(); // discard
              const next = headers.location.startsWith('http') ? headers.location : new URL(headers.location, requestUrl).toString();
              handle(next, remaining - 1);
              return;
            }
            if (statusCode !== 200) {
              reject(new Error(`Download failed with status: ${statusCode}`));
              return;
            }

            const fileStream = fs.createWriteStream(outputPath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close();
              try {
                const fd = fs.openSync(outputPath, 'r');
                const header = Buffer.alloc(12);
                fs.readSync(fd, header, 0, 12, 0);
                fs.closeSync(fd);
                const isMp4 = header.slice(4, 8).toString() === 'ftyp';
                if (!isMp4) {
                  try { fs.unlinkSync(outputPath); } catch {}
                  reject(new Error('Downloaded file is not a valid MP4'));
                  return;
                }
              } catch (e) {
                try { fs.unlinkSync(outputPath); } catch {}
                reject(e);
                return;
              }
              // download complete
              resolve();
            });

            fileStream.on('error', (e) => {
              try { fs.unlinkSync(outputPath); } catch {}
              reject(e);
            });
          }).on('error', reject);
        };
        handle(url, redirectsLeft);
      });

      await follow(videoUrl);
    }
  }

  // Temp metadata creation removed — output metadata is created by FileWatcherService

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

  async parseFalError(error) {
    const info = {
      message: error?.message || 'Unknown error',
      code: 'UNKNOWN'
    };

    // Check for a fetch/Response-like object
    const resp = error?.response || error?.cause?.response;
    try {
      if (resp && typeof resp.status === 'number') {
        info.status = resp.status;
        info.statusText = resp.statusText;
        const ct = resp.headers?.get ? resp.headers.get('content-type') || '' : '';
        if (typeof resp.clone === 'function') {
          if (ct.includes('application/json')) {
            try {
              info.body = await resp.clone().json();
            } catch {
              info.bodyText = await resp.clone().text();
            }
          } else {
            info.bodyText = await resp.clone().text();
          }
        }
      } else if (error?.response?.data) {
        // Axios-like
        info.body = error.response.data;
        info.status = error.response.status;
        info.statusText = error.response.statusText;
      } else if (error?.data) {
        info.body = error.data;
      }
    } catch {
      // ignore parse failures
    }

    // Extract validation messages
    const detail = info.body?.detail;
    if (Array.isArray(detail)) {
      info.validation = detail.map(d => {
        const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
        return `${loc || 'param'}: ${d.msg || d.message || 'invalid'}`;
      });
    }
    if (!info.message) {
      info.message = info.body?.message || info.statusText || 'Unknown error';
    }

    // Map to a simple code
    if (info.status === 422 || /unprocessable/i.test(info.message || '')) {
      info.code = 'UNPROCESSABLE_ENTITY';
    } else if (info.status === 401 || info.status === 403) {
      info.code = 'UNAUTHORIZED';
    } else if (info.status === 429) {
      info.code = 'RATE_LIMIT';
    } else if (info.status === 413) {
      info.code = 'PAYLOAD_TOO_LARGE';
    }
    return info;
  }
}
