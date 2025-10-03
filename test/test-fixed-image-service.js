import dotenv from 'dotenv';
import { GeminiImageService } from '../src/services/geminiImageService.js';
import fs from 'fs';

dotenv.config();

async function testFixedImageService() {
  try {
    console.log('🎨 Testing fixed Gemini Image Service...\n');

    const testImagePath = './test/foto_2.jpg';
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found:', testImagePath);
      return;
    }

    const geminiImageService = new GeminiImageService();
    const editInstruction = 'Transform this image into a grimy 90s high school hallway bathed in sickly green fluorescent light, with blood streaks on lockers and characters frozen in silent terror, suggesting an unseen slasher lurks.';

    console.log('📝 Edit instruction:', editInstruction);
    console.log('🎨 Calling editImage method...');

    const editedImagePath = await geminiImageService.editImage(testImagePath, editInstruction);

    console.log('✅ Result:', editedImagePath);
    console.log('📏 File exists:', fs.existsSync(editedImagePath));

    if (fs.existsSync(editedImagePath) && editedImagePath !== testImagePath) {
      const stats = fs.statSync(editedImagePath);
      console.log('📦 File size:', Math.round(stats.size / 1024) + ' KB');
      console.log('🎉 SUCCESS: Image was actually edited!');
    } else {
      console.log('⚠️  Fallback was used - original image returned');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testFixedImageService();