import { SeedreamImageService } from '../src/services/seedreamImageService.js';
import { config } from 'dotenv';
import fs from 'fs';

async function validateSeedreamConfig() {
  console.log('🔍 Validating Seedream Configuration\n');
  console.log('='.repeat(60));

  const checks = {
    envFile: false,
    falKeyExists: false,
    falKeyValid: false,
    serviceInitialization: false,
    testImageAvailable: false,
    tempDirWritable: false
  };

  // Check 1: .env file exists
  console.log('\n📋 Check 1: Environment File');
  if (fs.existsSync('.env')) {
    console.log('  ✅ .env file exists');
    checks.envFile = true;

    // Load environment variables
    config();
  } else {
    console.log('  ❌ .env file not found');
    console.log('  💡 Create a .env file with your FAL_KEY');
  }

  // Check 2: FAL_KEY environment variable
  console.log('\n📋 Check 2: FAL_KEY Environment Variable');
  const falKey = process.env.FAL_KEY;
  if (falKey) {
    console.log('  ✅ FAL_KEY is set');
    console.log(`  📝 Key length: ${falKey.length} characters`);
    console.log(`  🔑 Key prefix: ${falKey.substring(0, 8)}...`);
    checks.falKeyExists = true;

    // Basic validation
    if (falKey.length > 20) {
      console.log('  ✅ Key length appears valid');
      checks.falKeyValid = true;
    } else {
      console.log('  ⚠️  Key seems too short');
    }
  } else {
    console.log('  ❌ FAL_KEY not found in environment');
    console.log('  💡 Add FAL_KEY=your_key_here to .env file');
  }

  // Check 3: Service Initialization
  console.log('\n📋 Check 3: Seedream Service Initialization');
  const service = new SeedreamImageService();
  try {
    const initResult = await service.initialize();
    if (initResult) {
      console.log('  ✅ Service initialized successfully');
      checks.serviceInitialization = true;
    } else {
      console.log('  ❌ Service initialization failed');
    }
  } catch (error) {
    console.log('  ❌ Service initialization error:', error.message);
  }

  // Check 4: Test Images Available
  console.log('\n📋 Check 4: Test Images Availability');
  const inputDir = './input';
  if (fs.existsSync(inputDir)) {
    const files = fs.readdirSync(inputDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    if (files.length > 0) {
      console.log(`  ✅ Found ${files.length} test image(s)`);
      files.forEach(f => console.log(`     • ${f}`));
      checks.testImageAvailable = true;
    } else {
      console.log('  ⚠️  No image files found in ./input/');
      console.log('  💡 Add some test images to ./input/ directory');
    }
  } else {
    console.log('  ❌ ./input/ directory not found');
    console.log('  💡 Create ./input/ directory and add test images');
  }

  // Check 5: Temp Directory Writable
  console.log('\n📋 Check 5: Temp Directory Permissions');
  const tempDir = './temp';
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Try to write a test file
    const testFile = `${tempDir}/.test_${Date.now()}`;
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    console.log('  ✅ ./temp/ directory is writable');
    checks.tempDirWritable = true;
  } catch (error) {
    console.log('  ❌ Cannot write to ./temp/:', error.message);
  }

  // Check 6: Sanitization Function
  console.log('\n📋 Check 6: Prompt Sanitization');
  const testPrompt = 'Add blood and horror effects';
  const sanitized = service.sanitizeImageEditPrompt(testPrompt);
  const hasProblematicTerms = /blood|horror|scary|terror/i.test(sanitized);

  if (!hasProblematicTerms) {
    console.log('  ✅ Sanitization working correctly');
    console.log(`     Input: "${testPrompt}"`);
    console.log(`     Output: "${sanitized}"`);
  } else {
    console.log('  ⚠️  Sanitization may not be working');
    console.log(`     Input: "${testPrompt}"`);
    console.log(`     Output: "${sanitized}"`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Configuration Summary\n');

  const checkResults = [
    { name: 'Environment File (.env)', status: checks.envFile },
    { name: 'FAL_KEY Exists', status: checks.falKeyExists },
    { name: 'FAL_KEY Valid Format', status: checks.falKeyValid },
    { name: 'Service Initialization', status: checks.serviceInitialization },
    { name: 'Test Images Available', status: checks.testImageAvailable },
    { name: 'Temp Directory Writable', status: checks.tempDirWritable }
  ];

  let passCount = 0;
  checkResults.forEach(check => {
    const status = check.status ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${check.name}: ${status}`);
    if (check.status) passCount++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Configuration Status: ${passCount}/${checkResults.length} checks passed\n`);

  if (passCount === checkResults.length) {
    console.log('✨ Seedream is ready to use!');
    console.log('   Run: node test/test-seedream-flow.js\n');
  } else {
    console.log('⚠️  Configuration incomplete. Please fix the issues above.\n');

    if (!checks.falKeyExists) {
      console.log('📝 Next Steps:');
      console.log('   1. Get your FAL API key from https://fal.ai/');
      console.log('   2. Add to .env file: FAL_KEY=your_key_here');
      console.log('   3. Run this validation again\n');
    }
  }

  return checks;
}

// Run validation
validateSeedreamConfig()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });
