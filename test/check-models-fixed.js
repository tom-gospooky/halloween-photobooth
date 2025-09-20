#!/usr/bin/env node

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const apiKey = process.env.GOOGLE_AI_API_KEY;

console.log('🔍 Checking available Gemini models via REST API...\n');

try {
  const response = await axios.get(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  
  const models = response.data.models;
  
  console.log('📋 Available Models:');
  models.forEach(model => {
    console.log(`  • ${model.name}`);
    if (model.supportedGenerationMethods) {
      console.log(`    - Methods: ${model.supportedGenerationMethods.join(', ')}`);
    }
    if (model.inputTokenLimit) {
      console.log(`    - Input limit: ${model.inputTokenLimit}`);
    }
    console.log('');
  });
  
  // Check for specific models we're trying to use
  const modelNames = models.map(m => m.name);
  
  console.log('🎯 Model Availability Check:');
  console.log('  gemini-1.5-flash:', modelNames.includes('models/gemini-1.5-flash') ? '✅ Available' : '❌ Not found');
  console.log('  gemini-native-image:', modelNames.includes('models/gemini-native-image') ? '✅ Available' : '❌ Not found');
  console.log('  veo-3-fast:', modelNames.includes('models/veo-3-fast') ? '✅ Available' : '❌ Not found');
  console.log('  veo-3.0-generate-001:', modelNames.includes('models/veo-3.0-generate-001') ? '✅ Available' : '❌ Not found');
  
  // Look for any image-related models
  console.log('\n🎨 Available Image-Related Models:');
  const imageModels = models.filter(m => 
    m.name.toLowerCase().includes('image') || 
    m.name.toLowerCase().includes('vision') ||
    m.name.toLowerCase().includes('imagen')
  );
  
  if (imageModels.length > 0) {
    imageModels.forEach(model => console.log(`  • ${model.name}`));
  } else {
    console.log('  No image generation models found in current API');
  }
  
  // Look for video-related models
  console.log('\n🎬 Available Video-Related Models:');
  const videoModels = models.filter(m => 
    m.name.toLowerCase().includes('video') || 
    m.name.toLowerCase().includes('veo')
  );
  
  if (videoModels.length > 0) {
    videoModels.forEach(model => console.log(`  • ${model.name}`));
  } else {
    console.log('  No video generation models found in current API');
  }

} catch (error) {
  console.error('❌ Error fetching models:', error.response?.data || error.message);
}