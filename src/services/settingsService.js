import fs from 'fs';
import path from 'path';

export class SettingsService {
  constructor() {
    this.settingsPath = path.resolve('./settings.json');
    this.settings = this.getDefaultSettings();
    this.isLoaded = false;
  }

  getDefaultSettings() {
    return {
      // Simplified settings for WAN 2.5 Preview only
      resolution: '1080p',          // '480p' | '720p' | '1080p'
      duration: '5',                // '5' | '10' seconds
      seedreamImageSize: 'auto_2K', // 'auto' | 'auto_2K' | 'auto_4K' | 'square_hd' | 'landscape_16_9' | 'portrait_16_9'
      playbackRate: 1.0             // 0.2 - 2.0

      // Aspect ratio is auto-detected from input image
      // Image editing always uses Seedream
      // Prompt generation always uses Gemini 2.5 Flash
    };
  }

  async load() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf8');
        const data = JSON.parse(raw);
        // Deep merge with defaults to ensure all fields exist
        this.settings = this.deepMerge(this.getDefaultSettings(), data);
        this.isLoaded = true;
        console.log('✅ Settings loaded from settings.json');
        return true;
      }
      // Create file with defaults if it doesn't exist
      await this.save(this.settings);
      this.isLoaded = true;
      console.log('✅ Created default settings.json');
      return true;
    } catch (err) {
      console.error('❌ Failed to load settings:', err.message);
      this.isLoaded = false;
      return false;
    }
  }

  getSettings() {
    return JSON.parse(JSON.stringify(this.settings)); // Deep clone
  }

  getDuration() {
    return this.settings.duration || '5';
  }

  getResolution() {
    return this.settings.resolution || '1080p';
  }

  getSeedreamImageSize() {
    return this.settings.seedreamImageSize || 'auto';
  }

  getPlaybackRate() {
    const v = Number(this.settings.playbackRate);
    return isNaN(v) ? 1.0 : Math.min(2.0, Math.max(0.2, v));
  }

  async save(newSettings) {
    try {
      // Whitelist keys to prevent stale/dead config from persisting
      const allowed = ['resolution', 'duration', 'seedreamImageSize', 'playbackRate'];
      const pruned = {};
      for (const key of allowed) {
        if (newSettings && Object.prototype.hasOwnProperty.call(newSettings, key)) {
          pruned[key] = newSettings[key];
        }
      }
      // Merge with current to keep existing values when not provided
      this.settings = this.deepMerge(this.settings, pruned);
      fs.writeFileSync(this.settingsPath, JSON.stringify({
        resolution: this.settings.resolution,
        duration: this.settings.duration,
        seedreamImageSize: this.settings.seedreamImageSize,
        playbackRate: this.getPlaybackRate()
      }, null, 2));
      console.log('✅ Settings saved to settings.json');
      return true;
    } catch (err) {
      console.error('❌ Failed to save settings:', err.message);
      return false;
    }
  }

  async update(partial) {
    return this.save(partial);
  }

  async setResolution(resolution) {
    const validResolutions = ['480p', '720p', '1080p'];
    if (!validResolutions.includes(resolution)) {
      console.warn(`⚠️  Invalid resolution: ${resolution}`);
      return false;
    }
    this.settings.resolution = resolution;
    return this.save(this.settings);
  }

  async setDuration(duration) {
    if (!['5', '10'].includes(String(duration))) {
      console.warn(`⚠️  Invalid duration: ${duration}`);
      return false;
    }
    this.settings.duration = String(duration);
    return this.save(this.settings);
  }

  async setSeedreamImageSize(size) {
    const validSizes = ['auto', 'auto_2K', 'auto_4K', 'square_hd', 'landscape_16_9', 'portrait_16_9', 'landscape_4_3', 'portrait_4_3'];
    if (!validSizes.includes(size)) {
      console.warn(`⚠️  Invalid seedream image size: ${size}`);
      return false;
    }
    this.settings.seedreamImageSize = size;
    return this.save(this.settings);
  }

  async setPlaybackRate(rate) {
    const v = Number(rate);
    if (isNaN(v) || v < 0.2 || v > 2.0) {
      console.warn(`⚠️  Invalid playbackRate: ${rate}`);
      return false;
    }
    this.settings.playbackRate = v;
    return this.save(this.settings);
  }

  validate(settings = this.settings) {
    const errors = [];

    // Validate resolution
    const validResolutions = ['480p', '720p', '1080p'];
    if (!validResolutions.includes(settings.resolution)) {
      errors.push(`Invalid resolution: ${settings.resolution}. Must be one of: ${validResolutions.join(', ')}`);
    }

    // Validate duration
    if (!['5', '10'].includes(String(settings.duration))) {
      errors.push('Duration must be 5 or 10 seconds');
    }

    // Validate seedream image size
    const validSizes = ['auto', 'auto_2K', 'auto_4K', 'square_hd', 'landscape_16_9', 'portrait_16_9', 'landscape_4_3', 'portrait_4_3'];
    if (settings.seedreamImageSize && !validSizes.includes(settings.seedreamImageSize)) {
      errors.push(`Invalid seedream image size: ${settings.seedreamImageSize}. Must be one of: ${validSizes.join(', ')}`);
    }

    // Validate playback rate
    const v = Number(settings.playbackRate);
    if (isNaN(v) || v < 0.2 || v > 2.0) {
      errors.push('Playback rate must be a number between 0.2 and 2.0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Minimal schema to support the server route (optional)
  getSchema() {
    return {
      fields: {
        resolution: { type: 'enum', values: ['480p', '720p', '1080p'] },
        duration: { type: 'enum', values: ['5', '10'] },
        seedreamImageSize: { type: 'enum', values: ['auto', 'auto_2K', 'auto_4K', 'square_hd', 'landscape_16_9', 'portrait_16_9', 'landscape_4_3', 'portrait_4_3'] },
        playbackRate: { type: 'number', min: 0.2, max: 2.0, step: 0.1, default: 1.0 }
      }
    };
  }

  deepMerge(target, source) {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}
