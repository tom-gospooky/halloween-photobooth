import { fal } from '@fal-ai/client';
import { config } from 'dotenv';
import fs from 'fs';

// Load environment variables
config();

async function testSeedreamAPIDirect() {
  console.log('🔬 Testing Seedream API Direct Call\n');
  console.log('='.repeat(60));

  try {
    // Configure FAL client
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      throw new Error('FAL_KEY not found in environment');
    }

    fal.config({ credentials: apiKey });
    console.log('✅ FAL client configured\n');

    // Load test image
    const testImagePath = './input/P1466596.jpg';
    if (!fs.existsSync(testImagePath)) {
      throw new Error(`Test image not found: ${testImagePath}`);
    }

    const imgBuffer = fs.readFileSync(testImagePath);
    const imageDataUri = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
    console.log(`📸 Loaded test image: ${testImagePath}`);
    console.log(`📦 Image size: ${(imgBuffer.length / 1024).toFixed(2)} KB\n`);

    // Test different endpoints and parameters
    const testCases = [
      {
        name: 'Seedream v4 Edit with image_urls (array)',
        endpoint: 'fal-ai/bytedance/seedream/v4/edit',
        input: {
          image_urls: [imageDataUri],
          prompt: 'Add dramatic Halloween lighting and mysterious atmosphere'
        }
      },
      {
        name: 'Seedream v4 Edit with image_url',
        endpoint: 'fal-ai/bytedance/seedream/v4/edit',
        input: {
          image_url: imageDataUri,
          prompt: 'Add dramatic Halloween lighting and mysterious atmosphere'
        }
      },
      {
        name: 'Seedream v4 Edit with image',
        endpoint: 'fal-ai/bytedance/seedream/v4/edit',
        input: {
          image: imageDataUri,
          prompt: 'Add dramatic Halloween lighting and mysterious atmosphere'
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📋 Testing: ${testCase.name}`);
      console.log(`   Endpoint: ${testCase.endpoint}`);
      console.log(`   Parameters: ${Object.keys(testCase.input).join(', ')}`);

      try {
        console.log('   ⏳ Sending request...');
        const startTime = Date.now();

        const result = await fal.run(testCase.endpoint, {
          input: testCase.input
        });

        const duration = Date.now() - startTime;
        console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log('   ✅ API call successful!');
        console.log('   📦 Response structure:');
        console.log('      ', JSON.stringify(result, null, 2).split('\n').join('\n       '));

        // Try to extract image URL
        const url = result?.data?.image?.url
          || result?.data?.images?.[0]?.url
          || result?.data?.output?.[0]?.url
          || result?.data?.url
          || result?.image?.url
          || result?.images?.[0]?.url;

        if (url) {
          console.log(`   🌐 Image URL found: ${url.substring(0, 80)}...`);
          return { success: true, url, testCase: testCase.name };
        } else {
          console.log('   ⚠️  No image URL found in response');
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        if (error.response?.data) {
          console.log('   📄 Error details:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.body) {
          console.log('   📄 Error body:', JSON.stringify(error.body, null, 2));
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('❌ No successful API call found');
    console.log('\n💡 This may indicate:');
    console.log('   • The endpoint path has changed');
    console.log('   • The parameter structure is different');
    console.log('   • The model requires different input format');
    console.log('   • API access or permissions issue');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

testSeedreamAPIDirect()
  .then((result) => {
    if (result?.success) {
      console.log('\n✨ Test completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠️  Test completed with issues');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Test run failed');
    process.exit(1);
  });
