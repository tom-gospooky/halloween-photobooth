import dotenv from 'dotenv';
import { GeminiImageService } from '../src/services/geminiImageService.js';
import fs from 'fs';

dotenv.config();

async function testSafePrompt() {
  try {
    console.log('🎨 Testing safe prompt for image editing...\n');

    const testImagePath = './test/foto_2.jpg';
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found:', testImagePath);
      return;
    }

    const geminiImageService = new GeminiImageService();

    // Test with very safe prompt
    const safeInstruction = 'Transform this image to have the aesthetic of a 90s movie scene with school hallway setting, dramatic lighting, and vintage color grading';

    console.log('📝 Safe instruction:', safeInstruction);
    console.log('🎨 Calling editImage method...');

    const editedImagePath = await geminiImageService.editImage(testImagePath, safeInstruction);

    console.log('✅ Result:', editedImagePath);
    console.log('📏 File exists:', fs.existsSync(editedImagePath));

    if (fs.existsSync(editedImagePath) && editedImagePath !== testImagePath) {
      const stats = fs.statSync(editedImagePath);
      console.log('📦 File size:', Math.round(stats.size / 1024) + ' KB');
      console.log('🎉 SUCCESS: Image was edited with safe prompt!');
    } else {
      console.log('⚠️  Still using fallback - even safe prompt failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testSafePrompt();