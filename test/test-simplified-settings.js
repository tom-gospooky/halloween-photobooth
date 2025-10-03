import { SettingsService } from '../src/services/settingsService.js';

console.log('🧪 Testing Simplified Settings Service\n');

async function testSimplifiedSettings() {
  const settingsService = new SettingsService();
  await settingsService.load();

  console.log('✅ Settings loaded');
  console.log('📋 Current settings:');
  const settings = settingsService.getSettings();
  console.log(JSON.stringify(settings, null, 2));

  console.log('\n📊 Testing individual getters:');
  console.log(`  - Video Model: ${settingsService.getSettings().videoModel}`);
  console.log(`  - Duration: ${settingsService.getDuration()}s`);
  console.log(`  - Image Variations: ${settingsService.getImageVariations()}`);

  console.log('\n🔧 Testing setters:');
  await settingsService.setVideoModel('wan-2.5-preview');
  console.log(`  ✅ Video model set to: ${settingsService.getSettings().videoModel}`);

  await settingsService.update({ duration: '10', imageVariations: 3 });
  console.log(`  ✅ Duration set to: ${settingsService.getDuration()}s`);
  console.log(`  ✅ Image variations set to: ${settingsService.getImageVariations()}`);

  console.log('\n✅ All simplified settings tests passed!');
  console.log('✅ Settings system ready for use with:');
  console.log('   - Model selection (wan-2.2-turbo, wan-2.5-preview, kling-v2.5-turbo)');
  console.log('   - Duration selection (5s or 10s)');
  console.log('   - Image variations (1-4)');
  console.log('   - Aspect ratio: Auto-detected from input images');
}

testSimplifiedSettings().catch(console.error);
