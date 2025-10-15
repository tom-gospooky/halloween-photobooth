import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import fs from 'fs';
import { GeminiErrorHandler } from '../utils/geminiErrorHandler.js';

export class PhotoAnalysisService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    this.gemini25Model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' });
    this.errorHandler = new GeminiErrorHandler();
  }

  getMasterPrompt() {
    try {
      // Priority 1: Read from master.md file
      if (fs.existsSync('./master.md')) {
        const masterPrompt = fs.readFileSync('./master.md', 'utf8').trim();
        if (masterPrompt) return masterPrompt;
      }
    } catch (error) {
      // Silently ignore, fallback below
    }

    // Priority 2: Environment variable
    if (process.env.MASTER_PROMPT) {
      return process.env.MASTER_PROMPT;
    }

    // Priority 3: Default fallback
    return "Transform this Halloween photo into a spooky 'Haunted High School' scene with supernatural elements, floating objects, and eerie lighting effects. Duration: 8 seconds.";
  }

  async generateDualPrompts(imagePath, options = {}) {
    try {
      const masterPrompt = this.getMasterPrompt();

      // Convert image to base64
      const imageBuffer = await sharp(imagePath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const imageBase64 = imageBuffer.toString('base64');

      const inputMessages = [
        masterPrompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg'
          }
        }
      ];

      // Log raw Gemini request
      let callId = null;
      if (options.apiLogger) {
        try {
          callId = options.apiLogger.apiRequest(
            'gemini',
            'models/gemini-2.5-flash-preview-09-2025:generateContent',
            inputMessages
          );
        } catch {}
      }

      const result = await this.gemini25Model.generateContent(inputMessages);

      // Log raw Gemini response (safe extract)
      if (options.apiLogger) {
        try {
          const safeResp = {
            text: (result?.response?.text && result.response.text()) || null,
            candidates: result?.response?.candidates || null,
            promptFeedback: result?.response?.promptFeedback || null
          };
          options.apiLogger.apiResponse(callId || 0, safeResp);
        } catch {}
      }

      const responseText = result.response.text().trim();

      // Parse JSON response (handle markdown code blocks)
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = responseText;

        // Handle ```json code blocks
        if (responseText.includes('```json')) {
          const match = responseText.match(/```json\s*(.*?)\s*```/s);
          if (match) {
            cleanedResponse = match[1];
          }
        }
        // Handle plain backticks wrapping JSON
        else if (responseText.trim().startsWith('`') && responseText.trim().endsWith('`')) {
          cleanedResponse = responseText.trim().slice(1, -1).trim();
        }

        const jsonResponse = JSON.parse(cleanedResponse);

        if (jsonResponse.output_1 && jsonResponse.output_2) {
          return {
            // Per new structure: output_1 = image edit instruction, output_2 = image-to-video prompt
            veoPrompt: jsonResponse.output_2,
            imageEditPrompt: jsonResponse.output_1,
            success: true
          };
        } else {
          throw new Error('Invalid JSON structure - missing output_1 or output_2');
        }
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError.message);

        // Fallback: use entire response as veo prompt
        return {
          veoPrompt: responseText,
          imageEditPrompt: "Transform this photo into a spooky 90's high school slasher scene with dramatic lighting and horror atmosphere",
          success: false,
          fallbackUsed: true
        };
      }

    } catch (error) {
      console.error('❌ Gemini 2.5 Flash dual prompt generation failed:', error.message);

      // Fallback to master prompt directly
      const fallbackPrompt = this.getMasterPrompt();

      return {
        veoPrompt: fallbackPrompt,
        imageEditPrompt: "Transform this photo into a spooky 90's high school slasher scene with dramatic lighting and horror atmosphere",
        success: false,
        fallbackUsed: true
      };
    }
  }

  // Keep backward compatibility
  async generateVideoPrompt(imagePath) {
    const result = await this.generateDualPrompts(imagePath);
    return result.veoPrompt;
  }

}
