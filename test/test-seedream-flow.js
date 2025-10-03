import { SeedreamImageService } from '../src/services/seedreamImageService.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

async function testSeedreamFlow() {
  console.log('🧪 Testing Seedream Image Editing Flow\n');
  console.log('='.repeat(60));

  const service = new SeedreamImageService();
  const results = {
    initialization: false,
    promptSanitization: false,
    imageEditing: false,
    fallbackHandling: false,
    mimeTypeDetection: false
  };

  // Test 1: Initialization
  console.log('\n📋 Test 1: Service Initialization');
  try {
    const initResult = await service.initialize();
    results.initialization = initResult;
    console.log(initResult ? '✅ Initialization successful' : '❌ Initialization failed');
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
  }

  // Test 2: Prompt Sanitization
  console.log('\n📋 Test 2: Prompt Sanitization');
  try {
    const testPrompts = [
      {
        input: 'Add blood and terror to the scene',
        expected: ['dark red', 'dramatic suspense']
      },
      {
        input: 'Create a horror movie with scary slasher effects',
        expected: ['90s thriller', 'atmospheric', '90s movie']
      },
      {
        input: 'Add chilling ominous atmosphere with death and violence',
        expected: ['atmospheric', 'dramatic', 'action movie style']
      }
    ];

    let allPassed = true;
    for (const test of testPrompts) {
      const sanitized = service.sanitizeImageEditPrompt(test.input);
      const hasExpectedTerms = test.expected.some(term => sanitized.includes(term));
      const hasBlockedTerms = /blood|terror|horror|scary|death|violence|slasher/i.test(sanitized);

      console.log(`  Input: "${test.input}"`);
      console.log(`  Output: "${sanitized}"`);
      console.log(`  ${hasExpectedTerms && !hasBlockedTerms ? '✅' : '❌'} ${hasExpectedTerms && !hasBlockedTerms ? 'PASS' : 'FAIL'}`);

      if (!hasExpectedTerms || hasBlockedTerms) allPassed = false;
    }
    results.promptSanitization = allPassed;
  } catch (error) {
    console.error('❌ Prompt sanitization error:', error.message);
  }

  // Test 3: MIME Type Detection
  console.log('\n📋 Test 3: MIME Type Detection');
  try {
    const testFiles = [
      { path: 'test.jpg', expected: 'image/jpeg' },
      { path: 'test.jpeg', expected: 'image/jpeg' },
      { path: 'test.png', expected: 'image/png' },
      { path: 'test.webp', expected: 'image/webp' },
      { path: 'test.unknown', expected: 'image/jpeg' } // default
    ];

    let allPassed = true;
    for (const test of testFiles) {
      const mimeType = service.getMimeTypeFromPath(test.path);
      const passed = mimeType === test.expected;
      console.log(`  ${test.path}: ${mimeType} ${passed ? '✅' : '❌'}`);
      if (!passed) allPassed = false;
    }
    results.mimeTypeDetection = allPassed;
  } catch (error) {
    console.error('❌ MIME type detection error:', error.message);
  }

  // Test 4: Image Editing (using real image if available)
  console.log('\n📋 Test 4: Image Editing with Real Image');
  const testImages = [
    './input/P1466596.jpg',
    './input/P1466584.jpg'
  ];

  const availableImage = testImages.find(img => fs.existsSync(img));

  if (availableImage) {
    console.log(`  Using test image: ${availableImage}`);
    try {
      const editInstruction = 'Add a spooky Halloween atmosphere with dramatic lighting and mysterious shadows';
      console.log(`  Edit instruction: "${editInstruction}"`);

      const startTime = Date.now();
      const editedPath = await service.editImage(availableImage, editInstruction);
      const duration = Date.now() - startTime;

      console.log(`  ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

      if (fs.existsSync(editedPath)) {
        const stats = fs.statSync(editedPath);
        console.log(`  📦 Output size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`  📁 Output path: ${editedPath}`);
        console.log('  ✅ Image editing successful');
        results.imageEditing = true;
      } else {
        console.log('  ❌ Output file not found');
        results.imageEditing = false;
      }
    } catch (error) {
      console.error('  ❌ Image editing error:', error.message);
      results.imageEditing = false;
    }
  } else {
    console.log('  ⚠️  No test images available in ./input/');
    console.log('  ℹ️  Skipping real image editing test');
  }

  // Test 5: Fallback Handling
  console.log('\n📋 Test 5: Fallback Handling (Invalid Image)');
  try {
    const invalidImagePath = './test/nonexistent_image.jpg';
    const editInstruction = 'Test fallback';

    const result = await service.editImage(invalidImagePath, editInstruction);

    // Should return original path on failure
    const fallbackWorked = result === invalidImagePath;
    console.log(`  ${fallbackWorked ? '✅' : '❌'} Fallback ${fallbackWorked ? 'worked' : 'failed'}: returned ${result}`);
    results.fallbackHandling = fallbackWorked;
  } catch (error) {
    // Should not throw, should gracefully fallback
    console.error('  ❌ Should not throw error, should fallback gracefully');
    results.fallbackHandling = false;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');

  const testNames = [
    'Initialization',
    'Prompt Sanitization',
    'MIME Type Detection',
    'Image Editing',
    'Fallback Handling'
  ];

  let passCount = 0;
  let totalTests = 0;

  Object.keys(results).forEach((key, index) => {
    const status = results[key] ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${testNames[index]}: ${status}`);
    if (results[key]) passCount++;
    totalTests++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Overall: ${passCount}/${totalTests} tests passed`);

  if (passCount === totalTests) {
    console.log('✨ All tests passed!');
  } else {
    console.log(`⚠️  ${totalTests - passCount} test(s) failed`);
  }

  return results;
}

// Run tests
testSeedreamFlow()
  .then(() => {
    console.log('\n✅ Test run completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test run failed:', error);
    process.exit(1);
  });
