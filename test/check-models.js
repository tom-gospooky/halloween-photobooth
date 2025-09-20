#!/usr/bin/env node

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

console.log('🔍 Checking available Gemini models...\n');

try {
  const models = await genAI.listModels();
  
  console.log('📋 Available Models:');
  models.forEach(model => {
    console.log(`  • ${model.name}`);
    console.log(`    - Supported methods: ${model.supportedGenerationMethods.join(', ')}`);
    console.log(`    - Input token limit: ${model.inputTokenLimit || 'N/A'}`);
    console.log(`    - Output token limit: ${model.outputTokenLimit || 'N/A'}`);
    console.log('');
  });
  
  // Check for specific models we're trying to use
  const modelNames = models.map(m => m.name);
  
  console.log('🎯 Model Availability Check:');
  console.log('  gemini-1.5-flash:', modelNames.includes('models/gemini-1.5-flash') ? '✅ Available' : '❌ Not found');
  console.log('  gemini-native-image:', modelNames.includes('models/gemini-native-image') ? '✅ Available' : '❌ Not found');
  console.log('  veo-3-fast:', modelNames.includes('models/veo-3-fast') ? '✅ Available' : '❌ Not found');
  console.log('  veo-3.0-generate-001:', modelNames.includes('models/veo-3.0-generate-001') ? '✅ Available' : '❌ Not found');
  
  // Look for image generation models
  console.log('\n🎨 Image Generation Models:');
  const imageModels = models.filter(m => 
    m.name.includes('image') || 
    m.supportedGenerationMethods.includes('generateContent') && 
    (m.name.includes('vision') || m.name.includes('imagen'))
  );
  
  if (imageModels.length > 0) {
    imageModels.forEach(model => console.log(`  • ${model.name}`));
  } else {
    console.log('  No image generation models found');
  }
  
  // Look for video generation models  
  console.log('\n🎬 Video Generation Models:');
  const videoModels = models.filter(m => 
    m.name.includes('video') || m.name.includes('veo')
  );
  
  if (videoModels.length > 0) {
    videoModels.forEach(model => console.log(`  • ${model.name}`));
  } else {
    console.log('  No video generation models found');
  }

} catch (error) {
  console.error('❌ Error fetching models:', error.message);
}