#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import { FalWanService } from '../src/services/falWanService.js';

// Load environment variables
dotenv.config();

async function testWanSimple() {
  console.log('🧪 Simple WAN 2.2 Turbo Test');

  try {
    const wanService = new FalWanService();

    // Test initialization
    console.log('\n1️⃣ Testing initialization...');
    const initialized = await wanService.initialize();

    if (!initialized) {
      console.log('❌ Failed to initialize WAN service');
      return;
    }

    console.log('✅ WAN service initialized successfully');
    console.log(`🔑 FAL_KEY found: ${process.env.FAL_KEY ? 'Yes' : 'No'}`);

    // Test with a simple prompt and image from /test folder
    console.log('\n2️⃣ Testing video generation...');
    const testImagePath = './test/foto_1.jpg';
    const simplePrompt = "A spooky dark scene with supernatural floating objects, horror movie style, 8 seconds";

    if (!fs.existsSync(testImagePath)) {
      console.log('⚠️  Test image not found, skipping video generation test');
      return;
    }

    console.log('🎬 Starting video generation (this may take 30-60 seconds)...');
    const result = await wanService.generateVideo(simplePrompt, testImagePath, {
      resolution: "480p", // Use smaller resolution for faster generation
      aspectRatio: "16:9"
    });

    if (result.success) {
      console.log('✅ Video generation successful!');
      console.log(`📁 Output: ${result.outputPath}`);
      console.log(`📊 Size: ${Math.round(result.size / 1024)}KB`);
    } else {
      console.log('❌ Video generation failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testWanSimple()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });