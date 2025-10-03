import { VideoGenerationService } from '../src/services/videoGenerationService.js';
import { PhotoAnalysisService } from '../src/services/photoAnalysisService.js';
import { config } from 'dotenv';
import fs from 'fs';

// Load environment variables
config();

async function testFullWorkflowWithSeedream() {
  console.log('🎬 Testing Full Workflow with Seedream Image Editing\n');
  console.log('='.repeat(60));

  const testImage = './input/P1466596.jpg';

  if (!fs.existsSync(testImage)) {
    console.error('❌ Test image not found:', testImage);
    process.exit(1);
  }

  console.log(`📸 Test image: ${testImage}`);
  const stats = fs.statSync(testImage);
  console.log(`📦 Original size: ${(stats.size / 1024).toFixed(2)} KB\n`);

  try {
    // Step 1: Photo Analysis
    console.log('📋 Step 1: Analyzing photo with Gemini 2.5 Flash');
    const photoAnalysisService = new PhotoAnalysisService();

    const analysisStartTime = Date.now();
    const analysis = await photoAnalysisService.generateDualPrompts(testImage);
    const analysisDuration = Date.now() - analysisStartTime;

    console.log(`   ⏱️  Duration: ${(analysisDuration / 1000).toFixed(2)}s`);
    console.log(`   📝 Generated prompt length: ${analysis.veoPrompt.length} chars`);
    console.log(`   📝 Image edit prompt length: ${analysis.imageEditPrompt.length} chars`);
    console.log('   ✅ Photo analysis complete\n');

    // Step 2: Image Editing with Seedream
    console.log('📋 Step 2: Editing image with Seedream v4');
    console.log(`   Instruction: ${analysis.imageEditPrompt.substring(0, 100)}...`);

    const videoService = new VideoGenerationService();
    const imageEditStartTime = Date.now();

    const editedImagePath = await videoService.imageEditService.editImage(
      testImage,
      analysis.imageEditPrompt
    );

    const imageEditDuration = Date.now() - imageEditStartTime;
    console.log(`   ⏱️  Duration: ${(imageEditDuration / 1000).toFixed(2)}s`);

    if (fs.existsSync(editedImagePath)) {
      const editedStats = fs.statSync(editedImagePath);
      console.log(`   📦 Edited size: ${(editedStats.size / 1024).toFixed(2)} KB`);
      console.log(`   📁 Edited image: ${editedImagePath}`);
      console.log('   ✅ Image editing complete\n');
    } else {
      console.log('   ⚠️  Edited image file not found (fallback used)\n');
    }

    // Step 3: Video Generation
    console.log('📋 Step 3: Generating video');
    console.log(`   Video model: ${videoService.getModel()}`);
    console.log(`   Veo prompt: ${analysis.veoPrompt.substring(0, 100)}...`);

    const videoStartTime = Date.now();
    const videoPath = await videoService.generateVideo(
      analysis.veoPrompt,
      editedImagePath,
      'test_full_workflow',
      { dryRun: true, outputDir: './output/tests' }
    );
    const videoDuration = Date.now() - videoStartTime;

    console.log(`   ⏱️  Duration: ${(videoDuration / 1000).toFixed(2)}s`);
    console.log(`   📁 Video output: ${videoPath}`);
    console.log('   ✅ Video generation complete\n');

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Workflow Summary\n');

    const totalDuration = analysisDuration + imageEditDuration + videoDuration;

    console.log(`   Total time: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   • Analysis: ${(analysisDuration / 1000).toFixed(2)}s (${((analysisDuration / totalDuration) * 100).toFixed(1)}%)`);
    console.log(`   • Image edit: ${(imageEditDuration / 1000).toFixed(2)}s (${((imageEditDuration / totalDuration) * 100).toFixed(1)}%)`);
    console.log(`   • Video gen: ${(videoDuration / 1000).toFixed(2)}s (${((videoDuration / totalDuration) * 100).toFixed(1)}%)`);

    console.log('\n✨ Full workflow completed successfully!');

    return {
      success: true,
      timing: {
        analysis: analysisDuration,
        imageEdit: imageEditDuration,
        video: videoDuration,
        total: totalDuration
      },
      files: {
        original: testImage,
        edited: editedImagePath,
        video: videoPath
      },
      prompts: {
        veo: analysis.veoPrompt,
        imageEdit: analysis.imageEditPrompt
      }
    };

  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run test
testFullWorkflowWithSeedream()
  .then((result) => {
    console.log('\n✅ Test completed successfully');
    console.log('📄 Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed');
    process.exit(1);
  });
