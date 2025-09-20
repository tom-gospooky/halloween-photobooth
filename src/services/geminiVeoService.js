import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

export class GeminiVeoService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('Gemini API key not found (GOOGLE_AI_API_KEY or GEMINI_API_KEY)');
      }

      console.log('✅ Gemini Veo service initialized');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Veo service:', error.message);
      return false;
    }
  }

  async generateVideo(prompt, imagePath = null, options = {}) {
    try {
      console.log('🎬 Generating video with Gemini Veo...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Try the available Veo models in order of preference
      const veoModels = [
        'veo-3.0-fast-generate-001',    // Fastest, stable
        'veo-3.0-fast-generate-preview', // Fastest, preview
        'veo-3.0-generate-001',         // Standard, stable  
        'veo-3.0-generate-preview'      // Standard, preview
      ];

      for (const model of veoModels) {
        try {
          console.log(`🔄 Trying ${model}...`);
          
          const config = {
            aspectRatio: options.aspectRatio || "16:9",
            negativePrompt: options.negativePrompt || "cartoon, low quality, flicker"
            // Note: resolution parameter removed - not supported by all Veo models
          };

          let operation;

          if (imagePath && fs.existsSync(imagePath)) {
            // Image-to-video generation
            console.log('📸 Generating video from image...');
            const imageBytes = fs.readFileSync(imagePath).toString("base64");
            
            operation = await this.ai.models.generateVideos({
              model: model,
              prompt: prompt,
              image: { imageBytes, mimeType: "image/jpeg" },
              config: config
            });
          } else {
            // Text-to-video generation
            console.log('📝 Generating video from text...');
            operation = await this.ai.models.generateVideos({
              model: model,
              prompt: prompt,
              config: config
            });
          }

          console.log(`✅ ${model} started video generation!`);
          console.log(`🔗 Operation: ${operation.name}`);

          // Poll for completion
          const result = await this.pollForCompletion(operation, model);
          if (result.success) {
            return result;
          }

        } catch (modelError) {
          console.log(`❌ ${model} failed: ${modelError.message}`);
          
          if (modelError.message.includes('quota')) {
            console.log('   💡 Quota exceeded - trying next model or wait for reset');
          } else if (modelError.message.includes('billing')) {
            console.log('   💡 Billing required for video generation');
          }
          continue;
        }
      }

      throw new Error('All Veo models failed or unavailable');

    } catch (error) {
      console.error('❌ Gemini Veo generation failed:', error.message);
      throw error;
    }
  }

  async pollForCompletion(operation, modelName, maxWaitMinutes = 10) {
    try {
      const maxPolls = Math.floor((maxWaitMinutes * 60) / 10); // Poll every 10 seconds
      let pollCount = 0;

      console.log(`⏳ Waiting for video generation (max ${maxWaitMinutes} minutes)...`);

      while (!operation.done && pollCount < maxPolls) {
        await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
        
        try {
          operation = await this.ai.operations.getVideosOperation({ operation });
          pollCount++;
          
          if (pollCount % 6 === 0) { // Log every minute
            console.log(`⏳ Still processing... (${Math.round(pollCount / 6)} min)`);
          }
        } catch (pollError) {
          console.log(`⚠️  Polling error: ${pollError.message}`);
          pollCount++;
        }
      }

      if (!operation.done) {
        console.log(`⏰ Video generation timed out after ${maxWaitMinutes} minutes`);
        return { success: false, error: 'Timeout' };
      }

      console.log(`🎥 Video generation completed with ${modelName}!`);

      // Download the video
      const video = operation.response.generatedVideos[0];
      const timestamp = Date.now();
      const outputPath = `./temp/veo_${modelName}_${timestamp}.mp4`;

      await this.ai.files.download({
        file: video.video,
        downloadPath: outputPath,
      });

      // Wait a moment for file write to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if file exists before getting stats
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Downloaded file not found: ${outputPath}`);
      }
      
      const stats = fs.statSync(outputPath);
      console.log(`✅ Video saved: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);

      return {
        success: true,
        model: modelName,
        outputPath: outputPath,
        size: stats.size,
        mimeType: 'video/mp4'
      };

    } catch (error) {
      console.error('❌ Failed during polling/download:', error.message);
      return { success: false, error: error.message };
    }
  }

  async generateImage(prompt, options = {}) {
    try {
      console.log('🎨 Generating image with Gemini 2.5 Flash...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
      });

      // Save first inline image part
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const timestamp = Date.now();
          const outputPath = `./temp/gemini_image_${timestamp}.png`;
          
          fs.writeFileSync(outputPath, buffer);
          
          console.log(`✅ Image saved: ${outputPath} (${Math.round(buffer.length / 1024)}KB)`);
          
          return {
            success: true,
            outputPath: outputPath,
            size: buffer.length,
            mimeType: 'image/png'
          };
        }
      }
      
      throw new Error('No image data in response');
      
    } catch (error) {
      console.error('❌ Gemini image generation failed:', error.message);
      throw error;
    }
  }

  // Test method to verify service functionality
  async testService() {
    try {
      console.log('🧪 Testing Gemini Veo service...');

      if (!await this.initialize()) {
        return { success: false, error: 'Initialization failed' };
      }

      // Test image generation first (faster)
      const imagePrompt = "Spooky Halloween jack-o'-lantern glowing in dark classroom, atmospheric lighting";
      const imageResult = await this.generateImage(imagePrompt);

      // Test video generation with a simple prompt
      const videoPrompt = "Close-up of a Halloween pumpkin slowly glowing brighter, then dimming. Atmospheric horror lighting. Duration: 5 seconds.";
      const videoResult = await this.generateVideo(videoPrompt, null, {
        aspectRatio: "16:9",
        resolution: "720p"
      });

      return { 
        success: true, 
        image: imageResult,
        video: videoResult
      };

    } catch (error) {
      console.log(`❌ Service test failed: ${error.message}`);
      
      let errorType = 'unknown';
      if (error.message.includes('quota')) {
        errorType = 'quota_exceeded';
      } else if (error.message.includes('billing')) {
        errorType = 'billing_required';
      } else if (error.message.includes('not found')) {
        errorType = 'model_unavailable';
      }

      return { success: false, error: error.message, type: errorType };
    }
  }
}