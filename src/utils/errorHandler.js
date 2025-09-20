export class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.lastErrorTimes = new Map();
    this.maxRetries = 3;
    this.cooldownPeriod = 60000; // 1 minute
  }

  async handleServiceError(serviceName, error, operation, retryFn = null) {
    const errorKey = `${serviceName}-${operation}`;
    const now = Date.now();
    
    // Log the error
    console.error(`❌ ${serviceName} Error in ${operation}:`, error.message);
    
    // Track error frequency
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    this.lastErrorTimes.set(errorKey, now);
    
    // Check if we should retry
    if (retryFn && this.shouldRetry(errorKey)) {
      try {
        console.log(`🔄 Retrying ${serviceName} ${operation}...`);
        return await retryFn();
      } catch (retryError) {
        console.error(`❌ Retry failed for ${serviceName} ${operation}:`, retryError.message);
      }
    }
    
    // Handle specific error types
    return this.getErrorFallback(serviceName, operation, error);
  }

  shouldRetry(errorKey) {
    const errorCount = this.errorCounts.get(errorKey) || 0;
    const lastError = this.lastErrorTimes.get(errorKey) || 0;
    const now = Date.now();
    
    // Reset error count if enough time has passed
    if (now - lastError > this.cooldownPeriod) {
      this.errorCounts.set(errorKey, 0);
      return true;
    }
    
    return errorCount < this.maxRetries;
  }

  getErrorFallback(serviceName, operation, error) {
    switch (serviceName) {
      case 'GoogleDrive':
        return this.handleGoogleDriveError(operation, error);
      
      case 'PhotoAnalysis':
        return this.handlePhotoAnalysisError(operation, error);
        
      case 'VideoGeneration':
        return this.handleVideoGenerationError(operation, error);
        
      case 'FileWatcher':
        return this.handleFileWatcherError(operation, error);
        
      default:
        return this.getGenericFallback(operation, error);
    }
  }

  handleGoogleDriveError(operation, error) {
    switch (operation) {
      case 'initialize':
        return {
          success: false,
          error: 'Google Drive initialization failed',
          fallback: 'manual_upload_mode'
        };
        
      case 'watchFolder':
        return {
          success: false,
          error: 'Folder watching failed',
          fallback: 'manual_polling'
        };
        
      case 'uploadFile':
        return {
          success: false,
          error: 'File upload failed',
          fallback: 'local_storage'
        };
        
      default:
        return { success: false, error: error.message };
    }
  }

  handlePhotoAnalysisError(operation, error) {
    switch (operation) {
      case 'analyzePhoto':
        return {
          success: true,
          fallback: true,
          data: this.getDefaultPhotoAnalysis()
        };
        
      case 'generatePrompt':
        return {
          success: true,
          fallback: true,
          data: this.getDefaultPrompt()
        };
        
      default:
        return { success: false, error: error.message };
    }
  }

  handleVideoGenerationError(operation, error) {
    switch (operation) {
      case 'generateVideo':
        return {
          success: false,
          error: 'Video generation failed',
          fallback: 'use_screensaver'
        };
        
      default:
        return { success: false, error: error.message };
    }
  }

  handleFileWatcherError(operation, error) {
    return {
      success: false,
      error: 'File watcher error',
      action: 'continue_monitoring'
    };
  }

  getGenericFallback(operation, error) {
    return {
      success: false,
      error: `${operation} failed: ${error.message}`,
      fallback: 'manual_intervention'
    };
  }

  getDefaultPhotoAnalysis() {
    return {
      people: { count: 1, ageGroup: "adults", groupDynamic: "friends" },
      costumes: [{ description: "Halloween costume", theme: "classic", quality: "store-bought" }],
      setting: { location: "indoor", lighting: "bright", mood: "playful" },
      composition: { pose: "group-shot", energy: "medium", focus: "costumes" },
      hauntedHighSchoolElements: ["party atmosphere"],
      needsEnhancement: false,
      enhancementSuggestions: ""
    };
  }

  getDefaultPrompt() {
    return "Cinematic shot: Group of friends in Halloween costumes walking through a mystical high school hallway. Ghostly lockers glow with supernatural blue light. Camera glides forward as spectral students appear in the background. Duration: 6 seconds.";
  }

  // Health check methods
  getServiceHealth() {
    const now = Date.now();
    const health = {};
    
    for (const [errorKey, lastError] of this.lastErrorTimes.entries()) {
      const [service] = errorKey.split('-');
      const errorCount = this.errorCounts.get(errorKey) || 0;
      const timeSinceError = now - lastError;
      
      if (!health[service]) {
        health[service] = {
          status: 'healthy',
          errorCount: 0,
          lastError: null
        };
      }
      
      health[service].errorCount += errorCount;
      
      if (timeSinceError < this.cooldownPeriod && errorCount > 0) {
        health[service].status = 'degraded';
        health[service].lastError = new Date(lastError).toISOString();
      }
      
      if (errorCount >= this.maxRetries) {
        health[service].status = 'unhealthy';
      }
    }
    
    return health;
  }

  resetServiceHealth(serviceName) {
    const keysToReset = [];
    for (const errorKey of this.errorCounts.keys()) {
      if (errorKey.startsWith(serviceName)) {
        keysToReset.push(errorKey);
      }
    }
    
    keysToReset.forEach(key => {
      this.errorCounts.delete(key);
      this.lastErrorTimes.delete(key);
    });
    
    console.log(`🔄 Reset error tracking for ${serviceName}`);
  }
}

export class ScreensaverManager {
  constructor(googleDriveService) {
    this.googleDrive = googleDriveService;
    this.screensaverVideos = [];
    this.lastUpdate = null;
    this.updateInterval = 300000; // 5 minutes
  }

  async initialize() {
    try {
      console.log('🎬 Initializing screensaver manager...');
      await this.loadScreensaverVideos();
      this.startPeriodicUpdate();
      console.log('✅ Screensaver manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize screensaver manager:', error);
      this.createDefaultScreensaver();
    }
  }

  async loadScreensaverVideos() {
    try {
      this.screensaverVideos = await this.googleDrive.getScreensaverVideos();
      this.lastUpdate = Date.now();
      
      if (this.screensaverVideos.length === 0) {
        console.warn('⚠️  No screensaver videos found, creating defaults');
        await this.createDefaultScreensaver();
      } else {
        console.log(`📺 Loaded ${this.screensaverVideos.length} screensaver videos`);
      }
    } catch (error) {
      console.error('Failed to load screensaver videos:', error);
      await this.createDefaultScreensaver();
    }
  }

  async createDefaultScreensaver() {
    // Create placeholder screensaver content when Google Drive is unavailable
    this.screensaverVideos = [
      {
        id: 'default-1',
        name: 'halloween_screensaver_1.mp4',
        type: 'placeholder',
        content: 'Spooky Halloween Animation - Coming Soon...'
      },
      {
        id: 'default-2', 
        name: 'halloween_screensaver_2.mp4',
        type: 'placeholder',
        content: 'Haunted High School Experience Loading...'
      }
    ];
    
    console.log('🎃 Created default screensaver playlist');
  }

  getRandomScreensaverVideo() {
    if (this.screensaverVideos.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * this.screensaverVideos.length);
    return this.screensaverVideos[randomIndex];
  }

  startPeriodicUpdate() {
    setInterval(async () => {
      try {
        await this.loadScreensaverVideos();
      } catch (error) {
        console.error('Error updating screensaver videos:', error);
      }
    }, this.updateInterval);
  }

  getStatus() {
    return {
      videoCount: this.screensaverVideos.length,
      lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : null,
      isActive: this.screensaverVideos.length > 0
    };
  }
}