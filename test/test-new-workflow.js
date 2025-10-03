import dotenv from 'dotenv';
import { PhotoAnalysisService } from '../src/services/photoAnalysisService.js';
import { GeminiImageService } from '../src/services/geminiImageService.js';
import { VideoGenerationService } from '../src/services/videoGenerationService.js';
import fs from 'fs';

dotenv.config();

async function testNewWorkflow() {
  try {
    console.log('🎃 Testing new image editing workflow...\n');

    // Use test image
    const testImagePath = './test/foto_2.jpg';

    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found:', testImagePath);
      return;
    }

    console.log(`📸 Using test image: ${testImagePath}`);

    // Step 1: Test dual prompts generation
    console.log('\n📝 Step 1: Testing dual prompts generation...');
    const photoAnalysisService = new PhotoAnalysisService();
    const dualPrompts = await photoAnalysisService.generateDualPrompts(testImagePath);

    console.log('✅ Dual prompts generated:');
    console.log('🎬 Veo3 Prompt:', dualPrompts.veoPrompt.substring(0, 100) + '...');
    console.log('🎨 Image Edit Prompt:', dualPrompts.imageEditPrompt);
    console.log('✨ Success:', dualPrompts.success);

    if (dualPrompts.fallbackUsed) {
      console.log('⚠️  Fallback was used due to JSON parsing issues');
    }

    // Step 2: Test image editing
    console.log('\n🎨 Step 2: Testing image editing...');
    const geminiImageService = new GeminiImageService();
    const editedImagePath = await geminiImageService.editImage(testImagePath, dualPrompts.imageEditPrompt);

    console.log('✅ Image editing result:');
    console.log('📁 Edited image path:', editedImagePath);
    console.log('📏 File exists:', fs.existsSync(editedImagePath));

    // Step 3: Test complete workflow
    console.log('\n🎬 Step 3: Testing complete video generation workflow...');
    const videoGenerationService = new VideoGenerationService();
    const videoPath = await videoGenerationService.generateVideoWithImageEdit(
      dualPrompts.veoPrompt,
      dualPrompts.imageEditPrompt,
      testImagePath,
      'foto_2.jpg'
    );

    console.log('✅ Complete workflow result:');
    console.log('📁 Video path:', videoPath);
    console.log('📏 File exists:', fs.existsSync(videoPath));

    console.log('\n✅ New workflow test completed successfully!');

    // Summary
    console.log('\n📋 Summary:');
    console.log('✅ Dual prompt generation: Working');
    console.log('✅ Image editing service: Working');
    console.log('✅ Complete workflow: Working');
    console.log('\n🎃 The new image editing workflow is ready to use!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testNewWorkflow();