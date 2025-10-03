import dotenv from 'dotenv';
import { PhotoAnalysisService } from '../src/services/photoAnalysisService.js';
import { VideoGenerationService } from '../src/services/videoGenerationService.js';
import fs from 'fs';

dotenv.config();

async function testAfterReset() {
  try {
    console.log('🔄 Simulating first image processing after reset...\n');

    // Use a test image from the input folder
    let testImagePath = './input/P1466584.jpg';
    if (!fs.existsSync(testImagePath)) {
      testImagePath = './test/foto_2.jpg';
    }

    if (!fs.existsSync(testImagePath)) {
      console.error('❌ No test image found');
      return;
    }

    console.log(`📸 Processing first image after reset: ${testImagePath}`);

    // Step 1: Generate dual prompts
    console.log('\n📝 Step 1: Generating dual prompts...');
    const photoAnalysisService = new PhotoAnalysisService();
    const dualPrompts = await photoAnalysisService.generateDualPrompts(testImagePath);

    console.log('🎬 Veo3 Prompt:', dualPrompts.veoPrompt.substring(0, 100) + '...');
    console.log('🎨 Image Edit Prompt:', dualPrompts.imageEditPrompt);

    // Step 2: Process with complete workflow
    console.log('\n🎬 Step 2: Running complete workflow...');
    const videoGenerationService = new VideoGenerationService();
    const result = await videoGenerationService.generateVideoWithImageEdit(
      dualPrompts.veoPrompt,
      dualPrompts.imageEditPrompt,
      testImagePath,
      'test_after_reset.jpg'
    );

    console.log('\n✅ Workflow completed');
    console.log('📁 Final video path:', result);
    console.log('📏 File exists:', fs.existsSync(result));

    if (fs.existsSync(result)) {
      const stats = fs.statSync(result);
      console.log('📦 Video size:', Math.round(stats.size / 1024) + ' KB');
    }

    // Check if edited image was created
    const editedImages = fs.readdirSync('./temp').filter(f => f.includes('_edited.jpg'));
    if (editedImages.length > 0) {
      console.log('🎨 Edited images found:', editedImages.length);
      console.log('✅ Image editing step worked!');
    } else {
      console.log('⚠️  No edited images found - using original image');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAfterReset();