export class GeminiErrorHandler {
  constructor() {
    this.retryDelay = 1000; // Start with 1 second
    this.maxRetryDelay = 32000; // Max 32 seconds
    this.maxRetries = 3;
  }

  async handleGeminiError(error, operation, retryFn) {
    console.error(`❌ Gemini API Error in ${operation}:`, error.message);
    
    const errorInfo = this.parseGeminiError(error);
    
    switch (errorInfo.type) {
      case 'RATE_LIMIT':
        return await this.handleRateLimit(error, operation, retryFn, errorInfo);
        
      case 'QUOTA_EXCEEDED':
        return this.handleQuotaExceeded(error, operation);
        
      case 'AUTHENTICATION':
        return this.handleAuthError(error, operation);
        
      case 'CONTENT_FILTER':
        return this.handleContentFilter(error, operation);
        
      case 'MODEL_UNAVAILABLE':
        return this.handleModelUnavailable(error, operation);
        
      case 'NETWORK':
        return await this.handleNetworkError(error, operation, retryFn);
        
      default:
        return await this.handleGenericError(error, operation, retryFn);
    }
  }

  parseGeminiError(error) {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code;
    
    if (message.includes('rate limit') || status === 429) {
      return { 
        type: 'RATE_LIMIT', 
        retryAfter: this.extractRetryAfter(error) 
      };
    }
    
    if (message.includes('quota') || message.includes('limit exceeded')) {
      return { type: 'QUOTA_EXCEEDED' };
    }
    
    if (message.includes('api key') || message.includes('authentication') || status === 401 || status === 403) {
      return { type: 'AUTHENTICATION' };
    }
    
    if (message.includes('safety') || message.includes('content filter') || message.includes('harmful')) {
      return { type: 'CONTENT_FILTER' };
    }
    
    if (message.includes('model') && (message.includes('unavailable') || message.includes('not found'))) {
      return { type: 'MODEL_UNAVAILABLE' };
    }
    
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return { type: 'NETWORK' };
    }
    
    return { type: 'UNKNOWN' };
  }

  extractRetryAfter(error) {
    // Try to extract retry-after header or parse from error message
    const retryAfter = error.headers?.['retry-after'] || error.retryAfter;
    if (retryAfter) {
      return parseInt(retryAfter) * 1000; // Convert to milliseconds
    }
    
    // Default exponential backoff
    return Math.min(this.retryDelay * 2, this.maxRetryDelay);
  }

  async handleRateLimit(error, operation, retryFn, errorInfo) {
    if (!retryFn) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        fallback: 'use_default'
      };
    }

    const delay = errorInfo.retryAfter || this.retryDelay;
    console.log(`⏳ Rate limit hit, waiting ${delay}ms before retry...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      return await retryFn();
    } catch (retryError) {
      console.error(`❌ Retry after rate limit failed:`, retryError.message);
      return {
        success: false,
        error: 'Rate limit retry failed',
        fallback: 'use_default'
      };
    }
  }

  handleQuotaExceeded(error, operation) {
    console.error('💰 Gemini API quota exceeded');
    
    return {
      success: false,
      error: 'API quota exceeded',
      fallback: 'use_default',
      action: 'notify_admin'
    };
  }

  handleAuthError(error, operation) {
    console.error('🔐 Gemini API authentication failed');
    
    return {
      success: false,
      error: 'Authentication failed - check API key',
      fallback: 'use_default',
      action: 'check_credentials'
    };
  }

  handleContentFilter(error, operation) {
    console.warn('⚠️  Content filtered by Gemini safety filters');
    
    return {
      success: false,
      error: 'Content blocked by safety filters',
      fallback: 'use_safer_prompt',
      suggestion: 'Try with less intense Halloween themes'
    };
  }

  handleModelUnavailable(error, operation) {
    console.warn('🚫 Gemini model temporarily unavailable');
    
    return {
      success: false,
      error: 'Model temporarily unavailable',
      fallback: 'use_default',
      action: 'try_again_later'
    };
  }

  async handleNetworkError(error, operation, retryFn) {
    if (!retryFn) {
      return {
        success: false,
        error: 'Network error',
        fallback: 'use_default'
      };
    }

    console.log('🌐 Network error, retrying with exponential backoff...');
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const delay = Math.min(1000 * Math.pow(2, attempt), this.maxRetryDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        console.log(`🔄 Network retry attempt ${attempt + 1}/${this.maxRetries}`);
        return await retryFn();
      } catch (retryError) {
        if (attempt === this.maxRetries - 1) {
          return {
            success: false,
            error: 'Network error after retries',
            fallback: 'use_default'
          };
        }
      }
    }
  }

  async handleGenericError(error, operation, retryFn) {
    console.error(`🔥 Unknown Gemini error in ${operation}:`, error);
    
    if (!retryFn) {
      return {
        success: false,
        error: error.message,
        fallback: 'use_default'
      };
    }

    // Try once more for unknown errors
    try {
      console.log('🔄 Retrying unknown error once...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await retryFn();
    } catch (retryError) {
      return {
        success: false,
        error: `Unknown error: ${error.message}`,
        fallback: 'use_default'
      };
    }
  }

  // Helper methods for different fallback strategies
  getImageGenerationFallback(operation) {
    switch (operation) {
      case 'enhance_image':
        return {
          success: true,
          fallback: true,
          action: 'use_original_image',
          message: 'Using original image without enhancement'
        };
      default:
        return {
          success: false,
          fallback: true,
          action: 'use_default_enhancement'
        };
    }
  }

  getVideoGenerationFallback(operation) {
    switch (operation) {
      case 'generate_video':
        return {
          success: false,
          fallback: true,
          action: 'use_screensaver',
          message: 'Falling back to screensaver content'
        };
      default:
        return {
          success: false,
          fallback: true,
          action: 'create_placeholder'
        };
    }
  }

  getAnalysisFallback(operation) {
    switch (operation) {
      case 'analyze_photo':
        return {
          success: true,
          fallback: true,
          data: this.getDefaultAnalysis(),
          message: 'Using default photo analysis'
        };
      case 'generate_prompt':
        return {
          success: true,
          fallback: true,
          data: this.getDefaultPrompt(),
          message: 'Using default Halloween prompt'
        };
      default:
        return {
          success: false,
          fallback: true
        };
    }
  }

  getDefaultAnalysis() {
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
    return "Cinematic shot: Group of friends in Halloween costumes walking through a mystical high school hallway. Ghostly lockers glow with supernatural blue light. Camera glides forward as spectral students appear in the background. Duration: 8 seconds. Audio: Subtle spooky atmospheric sounds.";
  }

  // Health monitoring
  getHealthStatus() {
    return {
      status: 'operational',
      lastError: null,
      recommendations: [
        'Monitor API quota usage',
        'Check for rate limit patterns',
        'Ensure content meets safety guidelines'
      ]
    };
  }
}