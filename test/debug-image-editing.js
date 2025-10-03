import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import fs from 'fs';

dotenv.config();

async function debugImageEditing() {
  try {
    console.log('🔍 Debugging Gemini 2.5 Flash Image Preview API...\n');

    const testImagePath = './test/foto_2.jpg';
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found:', testImagePath);
      return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const geminiImageModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });

    console.log('📝 Edit instruction: Transform this photo into a spooky Halloween scene');

    // Convert image to base64
    const imageBuffer = await sharp(testImagePath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const imageBase64 = imageBuffer.toString('base64');

    console.log('🎨 Calling Gemini 2.5 Flash Image Preview API...');

    const result = await geminiImageModel.generateContent([
      'Transform this photo into a spooky Halloween scene',
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = result.response;
    console.log('\n📋 Full Response Structure:');
    console.log('Response keys:', Object.keys(response));

    if (response.candidates) {
      console.log('Candidates length:', response.candidates.length);
      if (response.candidates[0]) {
        const candidate = response.candidates[0];
        console.log('Candidate keys:', Object.keys(candidate));

        if (candidate.content) {
          console.log('Content keys:', Object.keys(candidate.content));

          if (candidate.content.parts) {
            console.log('Parts length:', candidate.content.parts.length);
            candidate.content.parts.forEach((part, index) => {
              console.log(`Part ${index} keys:`, Object.keys(part));
              if (part.inlineData) {
                console.log(`Part ${index} inlineData keys:`, Object.keys(part.inlineData));
                console.log(`Part ${index} mimeType:`, part.inlineData.mimeType);
                console.log(`Part ${index} data length:`, part.inlineData.data ? part.inlineData.data.length : 'No data');
              }
              if (part.text) {
                console.log(`Part ${index} text:`, part.text.substring(0, 200) + '...');
              }
            });
          }
        }
      }
    }

    // Try to get text response
    try {
      const textResponse = result.response.text();
      console.log('\n📝 Text Response:', textResponse.substring(0, 500) + '...');
    } catch (textError) {
      console.log('\n❌ No text response available:', textError.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Error details:', error);
  }
}

debugImageEditing();