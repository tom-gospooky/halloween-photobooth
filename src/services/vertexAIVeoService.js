import { google } from 'googleapis';
import fs from 'fs';
import axios from 'axios';
import sharp from 'sharp';

export class VertexAIVeoService {
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'halloween-photo-booth-472218';
    this.location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    this.credentialsPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    
    this.veoModelEndpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models`;
  }

  async initialize() {
    try {
      // Set up authentication using service account
      if (!fs.existsSync(this.credentialsPath)) {
        throw new Error('Service account credentials not found');
      }

      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      // Test authentication
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();
      
      if (!accessToken.token) {
        throw new Error('Failed to get access token');
      }

      this.accessToken = accessToken.token;
      console.log('✅ Vertex AI Veo service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Vertex AI Veo service:', error.message);
      return false;
    }
  }

  async generateVideo(prompt, imagePath = null, options = {}) {
    try {
      console.log('🎬 Attempting video generation with Vertex AI Veo...');
      
      if (!this.accessToken) {
        throw new Error('Service not initialized - no access token');
      }

      // Prepare the request payload
      const requestPayload = await this.prepareVeoRequest(prompt, imagePath, options);
      
      // Try different Veo model versions
      const modelVersions = [
        'veo-3.0-generate-preview',
        'veo-3-fast', 
        'veo-2.0-generate-001'
      ];

      for (const modelVersion of modelVersions) {
        try {
          console.log(`🔄 Trying ${modelVersion}...`);
          
          const response = await this.callVeoAPI(modelVersion, requestPayload);
          
          if (response.success) {
            console.log(`✅ Video generated successfully with ${modelVersion}`);
            return response;
          }
          
        } catch (modelError) {
          console.log(`❌ ${modelVersion} failed: ${modelError.message}`);
          continue;
        }
      }
      
      throw new Error('All Veo models failed or unavailable');
      
    } catch (error) {
      console.error('❌ Vertex AI Veo generation failed:', error.message);
      throw error;
    }
  }

  async prepareVeoRequest(prompt, imagePath, options) {
    const request = {
      instances: [{
        prompt: prompt,
        ...options
      }],
      parameters: {
        // Veo 3 parameters
        sampleCount: 1,
        aspectRatio: options.aspectRatio || "16:9",
        duration: options.duration || "8s",
        // Add additional parameters as needed
      }
    };

    // Add image if provided
    if (imagePath && fs.existsSync(imagePath)) {
      const imageBuffer = await sharp(imagePath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      const imageBase64 = imageBuffer.toString('base64');
      
      request.instances[0].image = {
        bytesBase64Encoded: imageBase64
      };
      
      console.log('📸 Added image input to Veo request');
    }

    return request;
  }

  async callVeoAPI(modelVersion, payload) {
    try {
      const url = `${this.veoModelEndpoint}/${modelVersion}:predict`;
      
      console.log(`📡 Making request to: ${url}`);
      
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes timeout for video generation
      });

      if (response.status === 200) {
        return await this.processVeoResponse(response.data, modelVersion);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Model ${modelVersion} not available in ${this.location}`);
      } else if (error.response?.status === 403) {
        throw new Error('Insufficient permissions or Vertex AI API not enabled');
      } else if (error.response?.data?.error) {
        throw new Error(`API Error: ${error.response.data.error.message}`);
      } else {
        throw error;
      }
    }
  }

  async processVeoResponse(responseData, modelVersion) {
    try {
      console.log('📋 Processing Veo response...');
      
      const predictions = responseData.predictions;
      if (!predictions || predictions.length === 0) {
        throw new Error('No predictions in response');
      }

      const prediction = predictions[0];
      
      // Extract video data - format may vary based on Vertex AI response structure
      let videoData = null;
      let mimeType = 'video/mp4';
      
      if (prediction.bytesBase64Encoded) {
        videoData = prediction.bytesBase64Encoded;
      } else if (prediction.generatedVideo) {
        videoData = prediction.generatedVideo.bytesBase64Encoded;
      } else if (prediction.videos && prediction.videos.length > 0) {
        videoData = prediction.videos[0].bytesBase64Encoded;
        mimeType = prediction.videos[0].mimeType || 'video/mp4';
      }

      if (!videoData) {
        console.log('Response structure:', JSON.stringify(prediction, null, 2));
        throw new Error('No video data found in response');
      }

      // Save video to temp file
      const timestamp = Date.now();
      const outputPath = `./temp/veo_${modelVersion}_${timestamp}.mp4`;
      const videoBuffer = Buffer.from(videoData, 'base64');
      
      fs.writeFileSync(outputPath, videoBuffer);
      
      console.log(`🎥 Video saved: ${outputPath} (${Math.round(videoBuffer.length / 1024)}KB)`);
      
      return {
        success: true,
        model: modelVersion,
        outputPath: outputPath,
        size: videoBuffer.length,
        mimeType: mimeType
      };
      
    } catch (error) {
      console.error('❌ Failed to process Veo response:', error.message);
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();
      
      if (accessToken.token) {
        this.accessToken = accessToken.token;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return false;
    }
  }

  // Test method to check service availability
  async testService() {
    try {
      console.log('🧪 Testing Vertex AI Veo service availability...');
      
      if (!await this.initialize()) {
        return { success: false, error: 'Initialization failed' };
      }

      // Simple test prompt
      const testPrompt = "A simple animated Halloween pumpkin glowing in the dark. Duration: 3 seconds.";
      
      const result = await this.generateVideo(testPrompt, null, {
        duration: "3s",
        aspectRatio: "16:9"
      });
      
      return { success: true, result };
      
    } catch (error) {
      console.log(`❌ Service test failed: ${error.message}`);
      
      let errorType = 'unknown';
      if (error.message.includes('not available')) {
        errorType = 'model_unavailable';
      } else if (error.message.includes('permissions')) {
        errorType = 'permissions';
      } else if (error.message.includes('API not enabled')) {
        errorType = 'api_not_enabled';
      }
      
      return { success: false, error: error.message, type: errorType };
    }
  }
}