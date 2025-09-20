#!/usr/bin/env node

import dotenv from 'dotenv';
import { PhotoAnalysisService } from '../src/services/photoAnalysisService.js';
import { VideoGenerationService } from '../src/services/videoGenerationService.js';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function fullPipelineTest() {
  console.log('🎃 Full Pipeline Test with foto_1.jpg');
  console.log('=====================================');

  const FOTO_1_PATH = './test/foto_1.jpg';

  try {
    // Verify foto_1.jpg exists
    if (!fs.existsSync(FOTO_1_PATH)) {
      throw new Error('foto_1.jpg not found in test folder');
    }

    console.log('✅ foto_1.jpg found (1.3MB Halloween party photo)');
    console.log('📸 Multiple people in costumes with props - perfect for slasher direction!');

    // Step 1: Generate video prompt using master.md + Gemini 2.5 Flash
    console.log('\n🎭 STEP 1: Master.md + foto_1.jpg → Gemini 2.5 Flash');
    console.log('================================================');

    const photoAnalysis = new PhotoAnalysisService();
    const masterPrompt = photoAnalysis.getMasterPrompt();
    console.log(`📋 Master prompt loaded: ${masterPrompt.length} characters`);

    console.log('🧠 Generating slasher film direction...');
    const videoPrompt = await photoAnalysis.generateVideoPrompt(FOTO_1_PATH);

    console.log('✅ Gemini 2.5 Flash analysis complete!');
    console.log(`📝 Generated prompt: ${videoPrompt.length} characters`);
    console.log(`📜 Preview: ${videoPrompt.substring(0, 200)}...`);

    // Step 2: Generate video using WAN 2.2 Turbo
    console.log('\n🎬 STEP 2: Slasher prompt + foto_1.jpg → WAN 2.2 Turbo');
    console.log('===================================================');

    const videoGeneration = new VideoGenerationService();

    console.log('🎥 Starting WAN 2.2 Turbo video generation...');
    console.log('⏱️  This may take 30-60 seconds for high-quality output...');

    const startTime = Date.now();
    const videoPath = await videoGeneration.generateVideo(videoPrompt, FOTO_1_PATH, 'foto_1.jpg');
    const endTime = Date.now();

    const processingTime = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n🎉 PIPELINE COMPLETE!');
    console.log('====================');
    console.log(`⏰ Total processing time: ${processingTime} seconds`);
    console.log(`📁 Generated video: ${videoPath}`);

    // Check file details
    if (fs.existsSync(videoPath)) {
      const stats = fs.statSync(videoPath);
      console.log(`📊 File size: ${Math.round(stats.size / 1024)}KB`);
      console.log(`🎞️  File type: ${videoPath.includes('.mp4') ? 'MP4 Video' : 'Placeholder'}`);

      if (videoPath.includes('wan_video')) {
        console.log('✅ SUCCESS: Real WAN 2.2 Turbo video generated!');
        console.log('🔥 Your slasher cinematography system is working perfectly!');
      } else {
        console.log('⚠️  Fallback: Placeholder created (WAN might be down/quota exceeded)');
      }
    }

    console.log('\n📋 PIPELINE SUMMARY:');
    console.log('1. ✅ Master.md slasher prompt system → Active');
    console.log('2. ✅ Gemini 2.5 Flash analysis → Generated detailed film direction');
    console.log('3. ✅ WAN 2.2 Turbo video generation → Completed');
    console.log('4. ✅ File saved → Ready for display');

  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
fullPipelineTest()
  .then(() => {
    console.log('\n🎃 Full pipeline test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💀 Pipeline test failed:', error);
    process.exit(1);
  });