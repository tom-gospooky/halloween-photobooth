#!/usr/bin/env node

import fs from 'fs';
import { LocalStorageService } from '../src/services/localStorageService.js';

async function testTxtFileCopy() {
  console.log('🧪 Testing .txt File Copy to Output Folder');
  console.log('===========================================\n');

  try {
    const localStorage = new LocalStorageService();
    await localStorage.initialize();

    // Create a mock video and .txt file in temp folder
    const tempVideoPath = './temp/test_video_12345.mp4';
    const tempTxtPath = './temp/test_video_12345.txt';

    console.log('📝 Creating mock video and .txt files...');

    // Create a small mock video file
    fs.writeFileSync(tempVideoPath, 'mock video content');

    // Create a metadata .txt file
    const metadataContent = `# Halloween Video - WAN 2.2 Turbo Generated
Generated from: test_image.jpg
Prompt: A test video for verification
Timestamp: ${new Date().toISOString()}
Model: WAN 2.2 Turbo via fal.ai
Video file: test_video_12345.mp4

This video was successfully generated using WAN 2.2 Turbo image-to-video AI.`;

    fs.writeFileSync(tempTxtPath, metadataContent);
    console.log('✅ Mock files created in temp folder');

    // Simulate the copy process from fileWatcherService
    const videoFileName = '1758999999999_test_image_halloween.mp4';
    const txtFileName = videoFileName.replace('.mp4', '.txt');

    console.log('\n📁 Testing copy to output folder...');

    // Copy video to output folder
    await localStorage.copyFile(tempVideoPath, videoFileName, 'output');
    console.log('✅ Video copied to output folder');

    // Copy .txt file to output folder
    if (fs.existsSync(tempTxtPath)) {
      await localStorage.copyFile(tempTxtPath, txtFileName, 'output');

      // Update the metadata file to reflect the final video filename
      const outputTxtPath = `./output/${txtFileName}`;
      try {
        let metadataContent = fs.readFileSync(outputTxtPath, 'utf8');
        metadataContent = metadataContent.replace(/Video file:.*/, `Video file: ${videoFileName}`);
        fs.writeFileSync(outputTxtPath, metadataContent);
        console.log('✅ Metadata .txt file copied to output folder with correct filename');
      } catch (updateError) {
        console.warn('⚠️  Could not update metadata filename:', updateError.message);
        console.log('✅ Metadata .txt file copied to output folder');
      }
    }

    // Verify files exist in output folder
    console.log('\n🔍 Verifying files in output folder...');
    const outputVideoPath = `./output/${videoFileName}`;
    const outputTxtPath = `./output/${txtFileName}`;

    const videoExists = fs.existsSync(outputVideoPath);
    const txtExists = fs.existsSync(outputTxtPath);

    console.log(`   Video file: ${videoExists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   .txt file:  ${txtExists ? '✅ EXISTS' : '❌ MISSING'}`);

    if (txtExists) {
      const txtContent = fs.readFileSync(outputTxtPath, 'utf8');
      const hasCorrectFilename = txtContent.includes(`Video file: ${videoFileName}`);
      console.log(`   Correct filename in .txt: ${hasCorrectFilename ? '✅ CORRECT' : '❌ INCORRECT'}`);

      console.log('\n📄 Output .txt file content:');
      console.log('──────────────────────────────');
      console.log(txtContent);
      console.log('──────────────────────────────');
    }

    // Clean up temp files
    console.log('\n🧹 Cleaning up temp files...');
    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    if (fs.existsSync(tempTxtPath)) fs.unlinkSync(tempTxtPath);

    console.log('\n🎉 TEST RESULTS:');
    console.log(videoExists && txtExists ? '✅ SUCCESS: Both video and .txt files copied correctly' : '❌ FAILED: Files not copied properly');

    // Clean up test files from output
    if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
    if (fs.existsSync(outputTxtPath)) fs.unlinkSync(outputTxtPath);
    console.log('🧹 Test files cleaned up from output folder');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTxtFileCopy()
  .then(() => {
    console.log('\n✅ .txt file copy test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💀 .txt copy test failed:', error);
    process.exit(1);
  });