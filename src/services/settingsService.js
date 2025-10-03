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
      // Model selection
      videoModel: 'wan-2.2-turbo',

      // User-facing settings (simple)
      duration: '5',           // '5' | '10' seconds (for WAN 2.5 and Kling)
      imageVariations: 1,      // 1-4: Number of Seedream image variations

      // Aspect ratio is auto-detected from input image, fallback to 16:9
      // Resolution defaults: WAN 2.2 = 720p, WAN 2.5 = 1080p, Kling = auto
      // FPS and frames use API defaults
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

  getImageVariations() {
    return this.settings.imageVariations || 1;
  }

  async save(newSettings) {
    try {
      // Deep merge to preserve nested structure
      this.settings = this.deepMerge(this.settings, newSettings);
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
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

  async setVideoModel(modelId) {
    const validModels = ['wan-2.2-turbo', 'wan-2.5-preview', 'kling-v2.5-turbo'];
    if (!validModels.includes(modelId)) {
      console.warn(`⚠️  Invalid model: ${modelId}`);
      return false;
    }
    this.settings.videoModel = modelId;
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

  async setImageVariations(count) {
    const num = parseInt(count);
    if (num < 1 || num > 4) {
      console.warn(`⚠️  Invalid image variations: ${count}`);
      return false;
    }
    this.settings.imageVariations = num;
    return this.save(this.settings);
  }

  validate(settings = this.settings) {
    const errors = [];

    // Validate video model
    const validModels = ['wan-2.2-turbo', 'wan-2.5-preview', 'kling-v2.5-turbo'];
    if (!validModels.includes(settings.videoModel)) {
      errors.push(`Invalid videoModel: ${settings.videoModel}`);
    }

    // Validate duration
    if (!['5', '10'].includes(String(settings.duration))) {
      errors.push('Duration must be 5 or 10 seconds');
    }

    // Validate image variations
    if (settings.imageVariations < 1 || settings.imageVariations > 4) {
      errors.push('Image variations must be 1-4');
    }

    return {
      valid: errors.length === 0,
      errors
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
