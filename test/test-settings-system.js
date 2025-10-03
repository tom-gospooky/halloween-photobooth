import { SettingsService } from '../src/services/settingsService.js';
import { VideoGenerationService } from '../src/services/videoGenerationService.js';
import { SeedreamImageService } from '../src/services/seedreamImageService.js';
import fs from 'fs';

async function testSettingsSystem() {
  console.log('⚙️  Testing Comprehensive Settings System\n');
  console.log('='.repeat(60));

  const results = {
    defaultSettings: false,
    validation: false,
    persistence: false,
    modelIntegration: false,
    seedreamIntegration: false,
    schema: false
  };

  // Test 1: Default Settings Loading
  console.log('\n📋 Test 1: Default Settings');
  try {
    const settingsService = new SettingsService();
    const defaults = settingsService.getDefaultSettings();

    // Verify all models are present
    const hasAllModels = defaults['wan-2.2-turbo'] &&
      defaults['wan-2.5-preview'] &&
      defaults['kling-v2.5-turbo'] &&
      defaults.seedream;

    console.log(`  ✅ Default settings structure: ${hasAllModels ? 'PASS' : 'FAIL'}`);
    console.log(`  📦 Models configured: ${Object.keys(defaults).filter(k => k !== 'videoModel').length}`);

    results.defaultSettings = hasAllModels;
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  // Test 2: Settings Validation
  console.log('\n📋 Test 2: Settings Validation');
  try {
    const settingsService = new SettingsService();
    await settingsService.load();

    // Test valid settings
    const validSettings = settingsService.getDefaultSettings();
    const validResult = settingsService.validate(validSettings);
    console.log(`  ✅ Valid settings: ${validResult.valid ? 'PASS' : 'FAIL'}`);

    // Test invalid settings
    const invalidSettings = {
      ...validSettings,
      videoModel: 'invalid-model',
      'wan-2.2-turbo': {
        ...validSettings['wan-2.2-turbo'],
        numFrames: 999, // Out of range
        resolution: 'invalid' // Invalid enum
      }
    };

    const invalidResult = settingsService.validate(invalidSettings);
    console.log(`  ✅ Invalid settings detected: ${!invalidResult.valid ? 'PASS' : 'FAIL'}`);
    if (!invalidResult.valid) {
      console.log(`  📝 Validation errors: ${invalidResult.errors.length}`);
      invalidResult.errors.forEach(err => console.log(`     • ${err}`));
    }

    results.validation = validResult.valid && !invalidResult.valid;
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  // Test 3: Settings Persistence
  console.log('\n📋 Test 3: Settings Persistence');
  try {
    const testFile = './test-settings-temp.json';

    // Create test settings service
    const settingsService = new SettingsService();
    settingsService.settingsPath = testFile;

    // Save custom settings
    const customSettings = {
      videoModel: 'wan-2.5-preview',
      'wan-2.5-preview': {
        resolution: '1080p',
        duration: '10',
        negativePrompt: 'test prompt'
      }
    };

    await settingsService.save(customSettings);

    // Load in new instance
    const settingsService2 = new SettingsService();
    settingsService2.settingsPath = testFile;
    await settingsService2.load();

    const loaded = settingsService2.getSettings();
    const persisted = loaded.videoModel === 'wan-2.5-preview' &&
      loaded['wan-2.5-preview'].resolution === '1080p' &&
      loaded['wan-2.5-preview'].duration === '10';

    console.log(`  ✅ Settings persisted: ${persisted ? 'PASS' : 'FAIL'}`);

    // Cleanup
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }

    results.persistence = persisted;
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  // Test 4: Video Service Integration
  console.log('\n📋 Test 4: Video Service Integration');
  try {
    const settingsService = new SettingsService();
    await settingsService.load();

    // Set custom WAN 2.2 settings
    await settingsService.updateModelSettings('wan-2.2-turbo', {
      resolution: '580p',
      aspectRatio: '9:16',
      numFrames: 100
    });

    // Create video service with settings
    const videoService = new VideoGenerationService(settingsService);
    await videoService.initialize();

    const wan22Settings = settingsService.getModelSettings('wan-2.2-turbo');
    const hasCustomSettings = wan22Settings.resolution === '580p' &&
      wan22Settings.aspectRatio === '9:16' &&
      wan22Settings.numFrames === 100;

    console.log(`  ✅ Model settings applied: ${hasCustomSettings ? 'PASS' : 'FAIL'}`);
    console.log(`     Resolution: ${wan22Settings.resolution}`);
    console.log(`     Aspect Ratio: ${wan22Settings.aspectRatio}`);
    console.log(`     Num Frames: ${wan22Settings.numFrames}`);

    results.modelIntegration = hasCustomSettings;
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  // Test 5: Seedream Integration
  console.log('\n📋 Test 5: Seedream Service Integration');
  try {
    const settingsService = new SettingsService();
    await settingsService.load();

    // Set custom Seedream settings
    await settingsService.updateSeedreamSettings({
      numImages: 3,
      imageSize: '1024x1024',
      seed: 12345
    });

    const seedreamService = new SeedreamImageService(settingsService);
    const seedreamSettings = settingsService.getSeedreamSettings();

    const hasCustomSettings = seedreamSettings.numImages === 3 &&
      seedreamSettings.imageSize === '1024x1024' &&
      seedreamSettings.seed === 12345;

    console.log(`  ✅ Seedream settings applied: ${hasCustomSettings ? 'PASS' : 'FAIL'}`);
    console.log(`     Num Images: ${seedreamSettings.numImages}`);
    console.log(`     Image Size: ${seedreamSettings.imageSize}`);
    console.log(`     Seed: ${seedreamSettings.seed}`);

    results.seedreamIntegration = hasCustomSettings;
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  // Test 6: Schema Generation
  console.log('\n📋 Test 6: Schema Generation for UI');
  try {
    const settingsService = new SettingsService();
    const schema = settingsService.getSchema();

    const hasVideoModel = schema.videoModel && schema.videoModel.type === 'enum';
    const hasWan22 = schema['wan-2.2-turbo'] && schema['wan-2.2-turbo'].numFrames;
    const hasWan25 = schema['wan-2.5-preview'] && schema['wan-2.5-preview'].resolution;
    const hasKling = schema['kling-v2.5-turbo'] && schema['kling-v2.5-turbo'].cfgScale;
    const hasSeedream = schema.seedream && schema.seedream.numImages;

    const schemaComplete = hasVideoModel && hasWan22 && hasWan25 && hasKling && hasSeedream;

    console.log(`  ✅ Schema generation: ${schemaComplete ? 'PASS' : 'FAIL'}`);
    console.log(`     Video Model: ${hasVideoModel ? '✓' : '✗'}`);
    console.log(`     WAN 2.2: ${hasWan22 ? '✓' : '✗'}`);
    console.log(`     WAN 2.5: ${hasWan25 ? '✓' : '✗'}`);
    console.log(`     Kling: ${hasKling ? '✓' : '✗'}`);
    console.log(`     Seedream: ${hasSeedream ? '✓' : '✗'}`);

    // Display sample schema
    console.log('\n  📄 Sample Schema Structure:');
    console.log(JSON.stringify({
      'wan-2.2-turbo': {
        numFrames: schema['wan-2.2-turbo'].numFrames,
        resolution: schema['wan-2.2-turbo'].resolution
      },
      seedream: {
        numImages: schema.seedream.numImages,
        imageSize: schema.seedream.imageSize
      }
    }, null, 2).split('\n').map(line => `     ${line}`).join('\n'));

    results.schema = schemaComplete;
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');

  const testNames = [
    'Default Settings Loading',
    'Settings Validation',
    'Settings Persistence',
    'Video Service Integration',
    'Seedream Integration',
    'Schema Generation'
  ];

  let passCount = 0;
  Object.keys(results).forEach((key, index) => {
    const status = results[key] ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${testNames[index]}: ${status}`);
    if (results[key]) passCount++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Overall: ${passCount}/${Object.keys(results).length} tests passed\n`);

  if (passCount === Object.keys(results).length) {
    console.log('✨ All settings tests passed!');
  } else {
    console.log(`⚠️  ${Object.keys(results).length - passCount} test(s) failed`);
  }

  return results;
}

// Run tests
testSettingsSystem()
  .then(() => {
    console.log('\n✅ Test run completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test run failed:', error);
    process.exit(1);
  });
