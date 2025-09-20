#!/usr/bin/env node

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('🎬 Testing Veo 3 Video Generation API...\n');

async function testVeo3VideoGeneration() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.log('❌ No API key found');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test available models to see what Veo models are accessible
    console.log('🔍 Checking for Veo 3 models...\n');
    
    const veoModelNames = [
      'veo-3.0-generate-preview',
      'veo-3-fast', 
      'veo-3.0-generate-001',
      'veo-2.0-generate-001'
    ];
    
    for (const modelName of veoModelNames) {
      try {
        console.log(`Testing model: ${modelName}...`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Create a simple Halloween video prompt
        const prompt = "A spooky Halloween scene in a haunted high school hallway with floating jack-o'-lanterns and ghostly students. Duration: 5 seconds. Style: cinematic and atmospheric.";
        
        console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
        
        // Test if we can generate content
        const result = await model.generateContent(prompt);
        console.log(`✅ ${modelName} is available!`);
        
        // Check response format
        const response = result.response;
        console.log('Response parts:', response.parts?.length || 0);
        
        if (response.parts && response.parts.length > 0) {
          response.parts.forEach((part, index) => {
            if (part.inlineData) {
              console.log(`  Part ${index}: ${part.inlineData.mimeType} (${part.inlineData.data?.length || 0} bytes)`);
            } else if (part.text) {
              console.log(`  Part ${index}: text (${part.text.length} chars)`);
            }
          });
        }
        
        return { model: modelName, success: true, result };
        
      } catch (error) {
        console.log(`❌ ${modelName}: ${error.message}`);
        
        if (error.message.includes('not found')) {
          console.log(`   Model not available in current API`);
        } else if (error.message.includes('API key')) {
          console.log(`   API key issue`);
        } else {
          console.log(`   Other error: ${error.message}`);
        }
      }
      console.log('');
    }
    
    console.log('⚠️  No Veo video generation models are currently available');
    console.log('This is expected - Veo models are still being rolled out');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testVeo3WithImage() {
  try {
    console.log('🎨 Testing Veo 3 with image input...\n');
    
    // Use real Halloween image from /test folder
    const testImagePath = './test/foto_1.jpg';
    if (!fs.existsSync(testImagePath)) {
      console.log('No test image found, skipping image-to-video test');
      return;
    }
    
    const imageBuffer = fs.readFileSync(testImagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    
    // Try with various model names
    const veoModels = ['veo-3.0-generate-preview', 'veo-3-fast'];
    
    for (const modelName of veoModels) {
      try {
        console.log(`🎬 Testing ${modelName} with image...`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent([
          {
            text: "Transform this Halloween photo into a spooky 8-second video animation with ghostly effects and atmospheric lighting. Style: cinematic horror."
          },
          {
            inlineData: {
              data: imageBase64,
              mimeType: 'image/jpeg'
            }
          }
        ]);
        
        console.log(`✅ ${modelName} with image input successful!`);
        
        // Process the video result
        const videoPart = result.response.parts?.find(part => 
          part.inlineData?.mimeType?.startsWith('video/')
        );
        
        if (videoPart) {
          const outputPath = `./temp/veo3_test_video_${Date.now()}.mp4`;
          const videoBuffer = Buffer.from(videoPart.inlineData.data, 'base64');
          fs.writeFileSync(outputPath, videoBuffer);
          
          console.log(`🎥 Video saved: ${outputPath}`);
          console.log(`📁 Video size: ${Math.round(videoBuffer.length / 1024)}KB`);
          
          return { success: true, model: modelName, outputPath };
        } else {
          console.log('No video data in response');
        }
        
      } catch (error) {
        console.log(`❌ ${modelName}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Image-to-video test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('🎃 Veo 3 Halloween Video Generation Test\n');
  
  await testVeo3VideoGeneration();
  console.log('\n' + '='.repeat(50) + '\n');
  await testVeo3WithImage();
  
  console.log('\n📋 Summary:');
  console.log('• Veo 3 models may not be available in all regions yet');
  console.log('• Video generation is typically available via Vertex AI');
  console.log('• For production use, consider using Vertex AI REST API directly');
  console.log('• Monitor Google AI Studio for model availability updates');
}

runAllTests().catch(console.error);