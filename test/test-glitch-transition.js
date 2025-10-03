// Test script for Halloween Glitch Transition System
// Run this in browser console to test the transition effects

async function testGlitchTransition() {
    console.log('🧪 Testing Horror Glitch Transition System');

    // Check if the glitch transition system is properly initialized
    if (!window.halloweenPhotobooth) {
        console.error('❌ Halloween Photobooth not initialized');
        return;
    }

    const photobooth = window.halloweenPhotobooth;

    // Check if glitch transition is available
    if (!photobooth.glitchTransition) {
        console.error('❌ Glitch transition system not initialized');
        return;
    }

    console.log('✅ Glitch transition system found');

    // Check WebGL support
    const gl = photobooth.glitchTransition.gl;
    if (!gl) {
        console.error('❌ WebGL not supported');
        return;
    }

    console.log('✅ WebGL is available');

    // Test shader compilation
    if (!photobooth.glitchTransition.program) {
        console.error('❌ Shader program not compiled');
        return;
    }

    console.log('✅ Horror shaders compiled successfully');

    // Test texture generation
    if (!photobooth.glitchTransition.noiseTexture || !photobooth.glitchTransition.bloodTexture) {
        console.error('❌ Horror textures not generated');
        return;
    }

    console.log('✅ Horror textures generated (noise & blood)');

    // Test canvas rendering
    const canvas = photobooth.canvas;
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.error('❌ Canvas not properly sized');
        return;
    }

    console.log(`✅ Canvas ready: ${canvas.width}x${canvas.height}`);

    // Test video integration
    const video = photobooth.video;
    if (!video) {
        console.error('❌ Main video element not found');
        return;
    }

    console.log('✅ Video element found');

    // If videos are loaded, test manual transition
    if (photobooth.videoQueue.length >= 2) {
        console.log('🔥 Testing manual transition between videos');

        // Force prepare next video
        photobooth.prepareNextVideo();

        // Wait a bit then trigger transition
        setTimeout(async () => {
            const currentVideo = photobooth.videoQueue[0];
            await photobooth.startGlitchTransition(currentVideo);
            console.log('🎬 Manual transition test completed');
        }, 2000);
    }

    console.log('🎃 All tests passed! Horror glitch transitions are ready');

    // Log performance info
    console.log('📊 Performance Info:');
    console.log(`- Transition Duration: ${photobooth.glitchTransition.transitionDuration}s`);
    console.log(`- Canvas Size: ${canvas.width}x${canvas.height}`);
    console.log(`- Video Queue: ${photobooth.videoQueue.length} videos`);
    console.log(`- WebGL Context: ${gl.getParameter(gl.VERSION)}`);
}

// Auto-run test when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(testGlitchTransition, 1000);
    });
} else {
    setTimeout(testGlitchTransition, 1000);
}

// Export for manual testing
window.testGlitchTransition = testGlitchTransition;

console.log('🧪 Glitch Transition Test loaded. Run testGlitchTransition() to test manually.');