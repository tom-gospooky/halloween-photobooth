#!/usr/bin/env node

import dotenv from 'dotenv';
import { VertexAIVeoService } from './src/services/vertexAIVeoService.js';

dotenv.config();

async function testVertexAIVeo() {
  console.log('🎬 Testing Vertex AI Veo Video Generation\n');
  
  try {
    const veoService = new VertexAIVeoService();
    
    console.log('🔧 Configuration:');
    console.log(`  Project ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID || 'halloween-photo-booth-472218'}`);
    console.log(`  Location: us-central1`);
    console.log(`  Credentials: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH}`);
    console.log('');
    
    // Test the service
    const testResult = await veoService.testService();
    
    if (testResult.success) {
      console.log('🎉 Vertex AI Veo service is working!');
      console.log(`✅ Generated video: ${testResult.result.outputPath}`);
      console.log(`📏 File size: ${Math.round(testResult.result.size / 1024)}KB`);
      console.log(`🎞️  Model used: ${testResult.result.model}`);
      
      // Try with a Halloween-specific prompt
      console.log('\n🎃 Testing with Halloween prompt...');
      
      const halloweenPrompt = "Cinematic shot: Ghostly figures walking through a haunted high school hallway with floating lockers and supernatural blue light. Camera glides forward as spectral students appear. Duration: 8 seconds. Style: atmospheric horror.";
      
      const halloweenResult = await veoService.generateVideo(halloweenPrompt, null, {
        duration: "8s",
        aspectRatio: "16:9"
      });
      
      if (halloweenResult.success) {
        console.log('🎃 Halloween video generated successfully!');
        console.log(`✅ Output: ${halloweenResult.outputPath}`);
        
        return { success: true, models: ['vertex-ai-veo'] };
      }
      
    } else {
      console.log('❌ Vertex AI Veo service test failed');
      console.log(`Error: ${testResult.error}`);
      console.log(`Type: ${testResult.type}`);
      
      // Provide troubleshooting guidance
      if (testResult.type === 'model_unavailable') {
        console.log('\n💡 Troubleshooting:');
        console.log('• Veo models may not be available in your region yet');
        console.log('• Try switching to a different region (e.g., us-central1, europe-west4)');
        console.log('• Check Google Cloud Console for model availability');
      } else if (testResult.type === 'permissions') {
        console.log('\n💡 Troubleshooting:');
        console.log('• Ensure Vertex AI API is enabled in your project');
        console.log('• Check that your service account has Vertex AI permissions');
        console.log('• Required roles: AI Platform Admin or Vertex AI User');
      } else if (testResult.type === 'api_not_enabled') {
        console.log('\n💡 Troubleshooting:');
        console.log('• Go to Google Cloud Console');
        console.log('• Navigate to APIs & Services > Library');
        console.log('• Search for and enable "Vertex AI API"');
      }
      
      return { success: false, error: testResult.error };
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return { success: false, error: error.message };
  }
}

// Also test if we can check model availability directly
async function checkModelAvailability() {
  console.log('\n🔍 Checking Vertex AI model availability...\n');
  
  try {
    const veoService = new VertexAIVeoService();
    await veoService.initialize();
    
    // Try to list available models (if possible)
    console.log('✅ Authentication successful');
    console.log('📋 Ready to test video generation models');
    
  } catch (error) {
    console.log('❌ Cannot check model availability:', error.message);
  }
}

async function runCompleteTest() {
  console.log('🎃 Vertex AI Veo Halloween Video Generation Test\n');
  
  // Check environment
  const requiredEnvVars = [
    'GOOGLE_AI_API_KEY',
    'GOOGLE_SERVICE_ACCOUNT_KEY_PATH',
    'GOOGLE_CLOUD_PROJECT_ID'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.log(`  - ${varName}`));
    console.log('\nPlease add these to your .env file');
    return;
  }
  
  await checkModelAvailability();
  const result = await testVertexAIVeo();
  
  console.log('\n📋 Test Summary:');
  if (result.success) {
    console.log('✅ Vertex AI Veo integration successful!');
    console.log('🎬 Ready for Halloween video generation');
    console.log('\n🚀 Next steps:');
    console.log('1. Update videoGenerationService.js to use Vertex AI Veo');
    console.log('2. Test with real Halloween photos');
    console.log('3. Deploy for Halloween 2025 party!');
  } else {
    console.log('❌ Vertex AI Veo not available yet');
    console.log('🔄 Current system will continue using placeholder videos');
    console.log('👀 Monitor Google Cloud for Veo availability updates');
  }
}

runCompleteTest().catch(console.error);