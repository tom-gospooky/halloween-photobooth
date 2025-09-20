#!/usr/bin/env node

import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

dotenv.config();

console.log('🎃 Testing Gemini API Veo 3 Video Generation\n');

async function testVeoModels() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('❌ No API key found (GOOGLE_AI_API_KEY or GEMINI_API_KEY)');
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    console.log('✅ GoogleGenAI client initialized with API key');

    // Test the correct Veo model names from the document
    const veoModels = [
      'veo-3.0-generate-001',         // Veo 3 (stable)
      'veo-3.0-generate-preview',     // Veo 3 (preview)  
      'veo-3.0-fast-generate-001',    // Veo 3 Fast (stable)
      'veo-3.0-fast-generate-preview' // Veo 3 Fast (preview)
    ];

    console.log('🎬 Testing Veo video generation models...\n');

    for (const modelName of veoModels) {
      try {
        console.log(`🔄 Testing ${modelName}...`);

        // Halloween-themed prompt
        const prompt = 'Cinematic tracking shot through a haunted high school hallway at night. Ghostly students in Halloween costumes walk past floating lockers. Flickering fluorescent lights cast eerie shadows. Whispered voices echo: "Welcome to Haunted High School." Duration: 8 seconds, atmospheric horror style.';

        console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

        // Start video generation operation
        let operation = await ai.models.generateVideos({
          model: modelName,
          prompt: prompt,
          config: { 
            aspectRatio: "16:9",
            resolution: "720p", 
            negativePrompt: "cartoon, low quality, flicker"
          }
        });

        console.log(`✅ ${modelName} started video generation!`);
        console.log(`🔗 Operation name: ${operation.name}`);

        // Poll for completion (with timeout)
        const maxPolls = 30; // 5 minutes max
        let pollCount = 0;
        
        while (!operation.done && pollCount < maxPolls) {
          console.log(`⏳ Polling... (${pollCount + 1}/${maxPolls})`);
          await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
          
          operation = await ai.operations.getVideosOperation({ operation });
          pollCount++;
        }

        if (operation.done) {
          console.log(`🎥 Video generation completed with ${modelName}!`);
          
          // Download the video
          const video = operation.response.generatedVideos[0];
          const outputPath = `./temp/${modelName}_halloween_${Date.now()}.mp4`;
          
          await ai.files.download({
            file: video.video,
            downloadPath: outputPath,
          });
          
          console.log(`✅ Video saved: ${outputPath}`);
          
          // Get file stats
          const stats = fs.statSync(outputPath);
          console.log(`📁 Video size: ${Math.round(stats.size / 1024)}KB`);
          
          return { 
            success: true, 
            model: modelName, 
            outputPath: outputPath,
            size: stats.size 
          };
          
        } else {
          console.log(`⏰ ${modelName} timed out after ${maxPolls * 10} seconds`);
        }

      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message}`);
        
        if (error.message.includes('quota')) {
          console.log('   💡 Quota exceeded - need to upgrade tier or wait for reset');
        } else if (error.message.includes('not found')) {
          console.log('   💡 Model not available in your region or tier');
        } else if (error.message.includes('billing')) {
          console.log('   💡 Billing account required for video generation');
        }
      }
      
      console.log('');
    }

    console.log('❌ No Veo models were successfully accessible');
    return { success: false };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testImageGeneration() {
  try {
    console.log('\n🎨 Testing Gemini 2.5 Flash Image Generation...\n');
    
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = "Spooky Halloween scene: A haunted high school hallway with floating jack-o'-lanterns, ghostly students in costumes, and eerie fluorescent lighting. Atmospheric horror style, cinematic composition.";
    
    console.log(`📝 Image prompt: ${prompt.substring(0, 100)}...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: prompt,
    });

    // Save first inline image part
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        const outputPath = `./temp/halloween_image_${Date.now()}.png`;
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`✅ Image generated: ${outputPath}`);
        console.log(`📁 Image size: ${Math.round(buffer.length / 1024)}KB`);
        
        return { success: true, outputPath, size: buffer.length };
      }
    }
    
    console.log('❌ No image data in response');
    return { success: false };
    
  } catch (error) {
    console.log(`❌ Image generation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runCompleteTest() {
  console.log('🎃 Gemini API Halloween Video Generation Test\n');
  
  // Test image generation first (faster, cheaper)
  const imageResult = await testImageGeneration();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test video generation
  const videoResult = await testVeoModels();
  
  console.log('\n📋 Test Summary:');
  console.log(`📸 Image Generation: ${imageResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`🎬 Video Generation: ${videoResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (videoResult.success) {
    console.log(`🎉 Video model working: ${videoResult.model}`);
    console.log('🚀 Ready to integrate into Halloween photobooth!');
  } else {
    console.log('💡 Next steps:');
    console.log('  1. Enable billing on your Google Cloud project');
    console.log('  2. Upgrade to Tier 1+ in AI Studio');
    console.log('  3. Check quota limits for Veo models');
  }
}

runCompleteTest().catch(console.error);