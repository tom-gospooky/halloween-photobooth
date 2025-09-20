#!/usr/bin/env node

import dotenv from 'dotenv';
import { GeminiVeoService } from './src/services/geminiVeoService.js';

dotenv.config();

async function testGeminiService() {
  console.log('🎃 Testing Gemini Veo Service Integration\n');
  
  try {
    const veoService = new GeminiVeoService();
    
    // Test the service
    const testResult = await veoService.testService();
    
    if (testResult.success) {
      console.log('\n✅ Gemini Veo service test completed successfully!');
      console.log(`📸 Image: ${testResult.image.outputPath}`);
      console.log(`🎥 Video: ${testResult.video.outputPath}`);
      console.log(`🎬 Model used: ${testResult.video.model}`);
      
      console.log('\n🎉 Ready to integrate into Halloween photobooth!');
      console.log('\n🚀 Next steps:');
      console.log('1. Update videoGenerationService.js to use GeminiVeoService');
      console.log('2. Test complete workflow with real Halloween photos');
      console.log('3. Deploy for Halloween 2025 party!');
      
    } else {
      console.log('\n❌ Gemini Veo service test failed');
      console.log(`Error: ${testResult.error}`);
      console.log(`Type: ${testResult.type}`);
      
      // Provide troubleshooting guidance
      if (testResult.type === 'quota_exceeded') {
        console.log('\n💡 Troubleshooting:');
        console.log('• Video generation quota exceeded');
        console.log('• Upgrade to higher tier in AI Studio');
        console.log('• Wait for daily quota reset (midnight Pacific)');
      } else if (testResult.type === 'billing_required') {
        console.log('\n💡 Troubleshooting:');
        console.log('• Enable billing on your Google Cloud project');
        console.log('• Upgrade to paid tier in AI Studio');
        console.log('• Veo models require billing for video generation');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testGeminiService().catch(console.error);