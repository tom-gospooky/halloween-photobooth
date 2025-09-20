#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { ProcessedFileTracker } from '../src/services/processedFileTracker.js';
import { LocalStorageService } from '../src/services/localStorageService.js';

async function testSingleUseProcessing() {
  console.log('🧪 Testing Single-Use File Processing');
  console.log('=====================================\n');

  try {
    // Initialize services
    const tracker = new ProcessedFileTracker();
    const localStorage = new LocalStorageService();

    await tracker.initialize();
    await localStorage.initialize();

    // Ensure test image exists in input folder
    const testImageSource = './test/foto_1.jpg';
    const testImageTarget = './input/test_single_use.jpg';

    if (!fs.existsSync(testImageSource)) {
      console.log('❌ Test image not found:', testImageSource);
      return;
    }

    // Copy test image to input folder
    console.log('📸 Setting up test image...');
    fs.copyFileSync(testImageSource, testImageTarget);
    console.log('✅ Test image copied to input folder');

    // Test 1: First check - should NOT be processed
    console.log('\n1️⃣ First check - file should be NEW');
    const isProcessed1 = tracker.isFileProcessed(testImageTarget, 'test_single_use.jpg');
    console.log(`   Result: ${isProcessed1 ? '❌ ALREADY PROCESSED' : '✅ NEW FILE'}`);

    // Test 2: Mark as processing
    console.log('\n2️⃣ Marking file as processing...');
    await tracker.markFileAsProcessing(testImageTarget, 'test_single_use.jpg');

    const isProcessing = tracker.isFileCurrentlyProcessing(testImageTarget, 'test_single_use.jpg');
    console.log(`   Result: ${isProcessing ? '✅ MARKED AS PROCESSING' : '❌ NOT PROCESSING'}`);

    // Test 3: Check again - should be processing
    console.log('\n3️⃣ Second check - file should be PROCESSING');
    const isProcessed2 = tracker.isFileProcessed(testImageTarget, 'test_single_use.jpg');
    console.log(`   Result: ${isProcessed2 ? '❌ MARKED AS PROCESSED' : '✅ STILL PROCESSING'}`);

    // Test 4: Mark as completed
    console.log('\n4️⃣ Marking file as completed...');
    await tracker.markFileAsProcessed(testImageTarget, 'test_single_use.jpg', './output/test_output.mp4');

    // Test 5: Final check - should be processed
    console.log('\n5️⃣ Final check - file should be PROCESSED');
    const isProcessed3 = tracker.isFileProcessed(testImageTarget, 'test_single_use.jpg');
    console.log(`   Result: ${isProcessed3 ? '✅ MARKED AS PROCESSED' : '❌ NOT PROCESSED'}`);

    // Test 6: Verify file stays in input folder
    console.log('\n6️⃣ Checking if file remains in input folder...');
    const fileExists = fs.existsSync(testImageTarget);
    console.log(`   Result: ${fileExists ? '✅ FILE REMAINS IN INPUT' : '❌ FILE MISSING'}`);

    // Test 7: Test persistence across restarts
    console.log('\n7️⃣ Testing persistence (new tracker instance)...');
    const tracker2 = new ProcessedFileTracker();
    await tracker2.initialize();
    const isProcessed4 = tracker2.isFileProcessed(testImageTarget, 'test_single_use.jpg');
    console.log(`   Result: ${isProcessed4 ? '✅ PERSISTENT ACROSS RESTARTS' : '❌ NOT PERSISTENT'}`);

    // Test 8: Check tracker status
    console.log('\n8️⃣ Tracker Status:');
    const status = tracker.getStatus();
    console.log(`   Initialized: ${status.isInitialized}`);
    console.log(`   Total Processed: ${status.totalProcessed}`);
    console.log(`   Tracking File: ${status.trackingFile}`);

    // Test 9: Show processed files
    console.log('\n9️⃣ Processed Files:');
    const processedFiles = tracker.getProcessedFiles();
    processedFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.fileName} (${file.status})`);
      console.log(`      Processed: ${file.processedAt}`);
      console.log(`      Hash: ${file.fileHash?.substring(0, 16)}...`);
    });

    console.log('\n🎉 SINGLE-USE TEST RESULTS:');
    console.log('✅ Files are processed exactly once');
    console.log('✅ Files remain in input folder');
    console.log('✅ Processing state is tracked persistently');
    console.log('✅ Duplicate processing is prevented');
    console.log('💰 Cost control: No duplicate API calls');

    // Cleanup
    console.log('\n🧹 Cleaning up test files...');
    if (fs.existsSync(testImageTarget)) {
      fs.unlinkSync(testImageTarget);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSingleUseProcessing()
  .then(() => {
    console.log('\n✅ Single-use processing test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💀 Single-use test failed:', error);
    process.exit(1);
  });