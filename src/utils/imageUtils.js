import sharp from 'sharp';

/**
 * Detect the aspect ratio of an image and return the closest standard ratio
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} - Aspect ratio as string ('16:9', '9:16', '1:1', or '16:9' as fallback)
 */
export async function detectAspectRatio(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      console.warn('⚠️  Could not detect image dimensions, using 16:9 fallback');
      return '16:9';
    }

    const ratio = width / height;

    // Define tolerance for matching standard ratios
    const ratios = [
      { name: '1:1', value: 1.0, tolerance: 0.05 },       // Square
      { name: '16:9', value: 16/9, tolerance: 0.1 },      // Landscape ~1.778
      { name: '9:16', value: 9/16, tolerance: 0.05 },     // Portrait ~0.563
      { name: '4:3', value: 4/3, tolerance: 0.05 },       // Classic ~1.333
      { name: '3:4', value: 3/4, tolerance: 0.05 }        // Portrait classic ~0.75
    ];

    // Find the closest matching ratio
    for (const standardRatio of ratios) {
      if (Math.abs(ratio - standardRatio.value) <= standardRatio.tolerance) {
        // No console output to keep logs clean

        // Map to supported API ratios
        if (standardRatio.name === '4:3' || standardRatio.name === '16:9') {
          return '16:9'; // Landscape-ish defaults to 16:9
        }
        if (standardRatio.name === '3:4' || standardRatio.name === '9:16') {
          return '9:16'; // Portrait-ish defaults to 9:16
        }
        return standardRatio.name;
      }
    }

    // If no close match, decide based on orientation
    if (ratio > 1.2) {
      // No console output to keep logs clean
      return '16:9';
    } else if (ratio < 0.8) {
      // No console output to keep logs clean
      return '9:16';
    } else {
      // No console output to keep logs clean
      return '1:1';
    }

  } catch (error) {
    console.error('❌ Error detecting aspect ratio:', error.message);
    return '16:9';
  }
}

/**
 * Get image dimensions
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getImageDimensions(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  } catch (error) {
    console.error('❌ Error getting image dimensions:', error.message);
    return { width: 0, height: 0 };
  }
}
