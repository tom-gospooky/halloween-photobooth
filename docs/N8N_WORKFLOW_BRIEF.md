# n8n Workflow Brief: Halloween Photobooth Edit Pipeline
## Seedream Image Edit → Kling v2.5 Turbo Video Generation

---

## 📋 Executive Summary

Replace the current Node.js-based image editing and video generation pipeline with a structured **n8n workflow** that orchestrates:

1. **Image Analysis** (Gemini 2.5 Flash with master prompt)
2. **Image Editing** (Seedream v4 Edit via fal.ai)
3. **Video Generation** (Kling Video v2.5 Turbo Pro via fal.ai)
4. **Metadata Creation & Storage**

**Goal:** Create a visual, maintainable, and scalable workflow that can be easily modified, monitored, and extended without code changes.

---

## 🎯 Business Requirements

### Current Problem
- Image editing and video generation logic is scattered across multiple Node.js services
- Difficult to visualize the data flow
- Hard to modify prompts, add conditional logic, or implement A/B testing
- No visual monitoring of the pipeline stages
- Tight coupling between file watching, processing, and API calls

### Desired Outcome
- **Visual workflow** showing the complete pipeline from image upload to final video
- **Easy prompt modification** via n8n's UI (no code deploys)
- **Real-time monitoring** of each processing stage
- **Error handling and retries** built into the workflow
- **A/B testing capability** for different prompts or models
- **Cost tracking** for API usage per workflow execution

---

## 📐 System Architecture Overview

### Current Flow (Node.js)
```
Input Image (./input/)
    ↓
FileWatcherService detects new file
    ↓
PhotoAnalysisService.generateDualPrompts()
    → Gemini 2.5 Flash API call with master.md prompt
    → Returns: { imageEditPrompt, veoPrompt }
    ↓
SeedreamImageService.editImage()
    → fal.ai Seedream v4 Edit API
    → Returns: edited image URL → downloads to ./temp/
    ↓
FalKlingService.generateVideo()
    → fal.ai Kling v2.5 Turbo Pro API
    → Returns: video URL → downloads to ./temp/
    ↓
FileWatcherService moves files to ./output/
    → Creates metadata .json and .txt files
    → Marks file as processed in tracking system
```

### Proposed Flow (n8n)
```
n8n Webhook Trigger (or File System Trigger)
    ↓
[Node 1] Validate & Prepare Image
    ↓
[Node 2] Gemini 2.5 Flash: Dual Prompt Generation
    ↓
[Node 3] Seedream v4 Edit: Image Transformation
    ↓
[Node 4] Kling v2.5 Turbo: Video Generation
    ↓
[Node 5] Metadata Creation & File Organization
    ↓
[Node 6] Success/Failure Notification
```

---

## 🔧 Technical Specification

### Node 1: Validate & Prepare Image

**Purpose:** Receive input image, validate format, extract metadata, resize for APIs

**Inputs:**
- Webhook payload with image URL or file path
- OR File system trigger monitoring `./input/` folder

**Processing:**
```javascript
// Pseudo-code for n8n Code node
const imagePath = $input.item.json.imagePath;
const fs = require('fs');
const sharp = require('sharp');

// Read image and get metadata
const imageBuffer = fs.readFileSync(imagePath);
const metadata = await sharp(imageBuffer).metadata();

// Calculate aspect ratio
const ratio = metadata.width / metadata.height;
let aspectRatio = '16:9'; // fallback
if (ratio > 1.2) aspectRatio = '16:9';      // Landscape
else if (ratio < 0.8) aspectRatio = '9:16'; // Portrait
else aspectRatio = '1:1';                    // Square

// Resize for Gemini (max 1024x1024)
const resizedBuffer = await sharp(imageBuffer)
  .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 80 })
  .toBuffer();

const imageBase64 = resizedBuffer.toString('base64');

return {
  json: {
    originalPath: imagePath,
    originalFileName: imagePath.split('/').pop(),
    imageBase64: imageBase64,
    aspectRatio: aspectRatio,
    dimensions: {
      width: metadata.width,
      height: metadata.height
    },
    timestamp: Date.now()
  }
};
```

**Outputs:**
- `originalPath`: Original file path
- `originalFileName`: Filename without path
- `imageBase64`: Base64-encoded image for Gemini
- `aspectRatio`: Detected aspect ratio ('16:9', '9:16', '1:1')
- `dimensions`: { width, height }
- `timestamp`: Processing timestamp

**n8n Node Type:** Code (JavaScript)

---

### Node 2: Gemini 2.5 Flash - Dual Prompt Generation

**Purpose:** Generate both image editing instruction and video generation prompt using master prompt

**Inputs:**
- `imageBase64` from Node 1
- Master prompt from configuration or file

**API Configuration:**
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- **Method:** POST
- **Headers:**
  - `Content-Type: application/json`
  - `x-goog-api-key: {{$env.GOOGLE_AI_API_KEY}}`

**Request Body:**
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "{{$node['Load_Master_Prompt'].json.masterPrompt}}"
        },
        {
          "inline_data": {
            "mime_type": "image/jpeg",
            "data": "{{$node['Validate_Image'].json.imageBase64}}"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.9,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 1024
  }
}
```

**Processing (Response Parsing):**
```javascript
// n8n Code node to parse Gemini response
const response = $input.item.json;
const responseText = response.candidates[0].content.parts[0].text.trim();

// Remove markdown code blocks if present
let cleanedResponse = responseText;
if (responseText.includes('```json')) {
  const match = responseText.match(/```json\s*(.*?)\s*```/s);
  if (match) {
    cleanedResponse = match[1];
  }
}

// Parse JSON response
let jsonResponse;
try {
  jsonResponse = JSON.parse(cleanedResponse);
} catch (error) {
  // Fallback if parsing fails
  jsonResponse = {
    output_1: "Transform into a moody 90's high school horror scene with dramatic lighting",
    output_2: responseText
  };
}

return {
  json: {
    imageEditPrompt: jsonResponse.output_1,
    videoPrompt: jsonResponse.output_2,
    rawResponse: responseText,
    success: !!jsonResponse.output_1 && !!jsonResponse.output_2
  }
};
```

**Outputs:**
- `imageEditPrompt`: Instruction for Seedream (output_1)
- `videoPrompt`: Prompt for Kling video generation (output_2)
- `rawResponse`: Original Gemini response
- `success`: Boolean indicating successful parsing

**n8n Node Types:**
1. **Read Binary File** (to load master.md) OR **Set** node with master prompt text
2. **HTTP Request** for Gemini API
3. **Code** node for response parsing

**Error Handling:**
- Retry up to 3 times with exponential backoff
- If all retries fail, use fallback prompts from configuration

---

### Node 3: Seedream v4 Edit - Image Transformation

**Purpose:** Apply horror styling to the original image using Seedream

**Inputs:**
- `originalPath` from Node 1 (to read original image)
- `imageEditPrompt` from Node 2
- `dimensions` from Node 1 (for aspect ratio preservation)

**Pre-Processing (Sanitization):**
```javascript
// n8n Code node for prompt sanitization
const rawPrompt = $node['Gemini_Dual_Prompts'].json.imageEditPrompt;

// Sanitize to avoid content policy violations
let sanitized = rawPrompt
  .replace(/blood/gi, 'dark red paint')
  .replace(/bloody/gi, 'dark red colored')
  .replace(/blood\s+streaks/gi, 'dark red artistic streaks')
  .replace(/blood\s+splatters/gi, 'dark red paint splatters')
  .replace(/terror/gi, 'dramatic suspense')
  .replace(/slasher/gi, '90s movie')
  .replace(/kill/gi, 'dramatic scene')
  .replace(/murder/gi, 'mystery movie')
  .replace(/death/gi, 'dramatic scene')
  .replace(/violence/gi, 'action movie style')
  .replace(/scary/gi, 'atmospheric and moody')
  .replace(/horror/gi, '90s thriller movie')
  .replace(/frightening/gi, 'mysteriously atmospheric')
  .replace(/menacing/gi, 'dramatically lit')
  .replace(/grimy/gi, 'vintage styled')
  .replace(/abandoned/gi, 'retro')
  .replace(/gritty/gi, 'vintage');

return { json: { sanitizedPrompt: sanitized } };
```

**Image Size Selection:**
```javascript
// n8n Code node for image size calculation
const dimensions = $node['Validate_Image'].json.dimensions;
const ratio = dimensions.width / dimensions.height;

let imageSize = '2048x2048'; // Default square
if (ratio > 1.2) {
  imageSize = '2048x1536';  // Landscape (~4:3)
} else if (ratio < 0.8) {
  imageSize = '1536x2048';  // Portrait (~3:4)
} else {
  imageSize = '2048x2048';  // Square
}

return { json: { imageSize } };
```

**API Configuration:**
- **Endpoint:** `https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit`
- **Method:** POST
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Key {{$env.FAL_KEY}}`

**Request Body:**
```json
{
  "image_urls": [
    "data:image/jpeg;base64,{{$node['Validate_Image'].json.imageBase64}}"
  ],
  "prompt": "{{$node['Sanitize_Prompt'].json.sanitizedPrompt}}",
  "image_size": "{{$node['Calculate_Image_Size'].json.imageSize}}",
  "num_images": "{{$env.IMAGE_VARIATIONS || 1}}",
  "enable_safety_checker": true
}
```

**Response Processing:**
```javascript
// n8n Code node to handle Seedream response
const response = $input.item.json;
const imageUrl = response?.data?.images?.[0]?.url
  || response?.data?.image?.url
  || response?.data?.output?.[0]?.url
  || response?.data?.url;

if (!imageUrl) {
  throw new Error('No image URL in Seedream response');
}

return {
  json: {
    editedImageUrl: imageUrl,
    seedreamSuccess: true
  }
};
```

**Download Edited Image:**
- Use n8n's **HTTP Request** node to download image
- Save to temporary location or pass as binary data to next node

**Outputs:**
- `editedImageUrl`: URL of edited image from Seedream
- `editedImageBase64`: Base64 of edited image (for Kling)
- `editedImagePath`: Local path if downloaded
- `seedreamSuccess`: Boolean

**n8n Node Types:**
1. **Code** node for sanitization
2. **Code** node for image size calculation
3. **HTTP Request** for Seedream API
4. **Code** node for response parsing
5. **HTTP Request** to download edited image

**Error Handling:**
- If Seedream fails, use original image and set `seedreamSuccess: false`
- Continue workflow with original image as fallback

---

### Node 4: Kling v2.5 Turbo - Video Generation

**Purpose:** Generate 5-10 second video from edited image using Kling

**Inputs:**
- `editedImageBase64` from Node 3 (or original from Node 1 if Seedream failed)
- `videoPrompt` from Node 2
- `aspectRatio` from Node 1
- Duration setting from configuration

**API Configuration:**
- **Endpoint:** Try multiple endpoints in sequence:
  1. `https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video`
  2. `https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/image-to-video`
- **Method:** POST
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Key {{$env.FAL_KEY}}`

**Request Body:**
```json
{
  "image_url": "data:image/jpeg;base64,{{$node['Seedream_Edit'].json.editedImageBase64}}",
  "prompt": "{{$node['Gemini_Dual_Prompts'].json.videoPrompt}}",
  "duration": "{{$env.VIDEO_DURATION || '5'}}",
  "aspect_ratio": "{{$node['Validate_Image'].json.aspectRatio}}",
  "negative_prompt": "blur, distort, and low quality"
}
```

**Response Processing:**
```javascript
// n8n Code node to handle Kling response
const response = $input.item.json;
const videoUrl = response?.data?.video?.url
  || response?.data?.output?.video?.url
  || response?.data?.url;

if (!videoUrl) {
  throw new Error('No video URL in Kling response');
}

return {
  json: {
    videoUrl: videoUrl,
    klingSuccess: true
  }
};
```

**Download Video:**
- Use n8n's **HTTP Request** node to download video
- Save to `./temp/` with timestamp filename

**Outputs:**
- `videoUrl`: URL of generated video
- `videoPath`: Local path to downloaded video
- `videoSize`: File size in bytes
- `klingSuccess`: Boolean

**n8n Node Types:**
1. **HTTP Request** for Kling API (with retry logic)
2. **Code** node for response parsing
3. **HTTP Request** to download video
4. **Code** node to save file locally

**Error Handling:**
- Retry up to 2 times with different endpoints
- If all fail, mark workflow as failed and send notification

---

### Node 5: Metadata Creation & File Organization

**Purpose:** Create metadata files, move files to output folder, update tracking system

**Processing:**
```javascript
// n8n Code node for file organization
const fs = require('fs');
const path = require('path');

const originalFileName = $node['Validate_Image'].json.originalFileName;
const timestamp = $node['Validate_Image'].json.timestamp;
const videoPath = $node['Kling_Video'].json.videoPath;
const editedImagePath = $node['Seedream_Edit'].json.editedImagePath;
const imageEditPrompt = $node['Gemini_Dual_Prompts'].json.imageEditPrompt;
const videoPrompt = $node['Gemini_Dual_Prompts'].json.videoPrompt;

// Generate output filenames
const baseFileName = originalFileName.split('.')[0];
const videoFileName = `${timestamp}_${baseFileName}_halloween.mp4`;
const jsonFileName = videoFileName.replace('.mp4', '.json');
const txtFileName = videoFileName.replace('.mp4', '.txt');

// Move video to output folder
const outputVideoPath = `./output/${videoFileName}`;
fs.copyFileSync(videoPath, outputVideoPath);

// Move edited image to output folder
if (editedImagePath && fs.existsSync(editedImagePath)) {
  const editedImageFileName = `${timestamp}_${baseFileName}_edited.jpg`;
  fs.copyFileSync(editedImagePath, `./output/${editedImageFileName}`);
}

// Create JSON metadata
const metadata = {
  model: 'kling-v2.5-turbo',
  modelName: 'Kling Video v2.5 Turbo Pro',
  provider: 'fal.ai',
  type: 'image-to-video',
  imageEditModel: 'seedream-v4-edit',
  source: {
    originalFileName: originalFileName,
    uploadedAt: new Date().toISOString(),
    dimensions: $node['Validate_Image'].json.dimensions,
    aspectRatio: $node['Validate_Image'].json.aspectRatio
  },
  prompts: {
    imageEdit: imageEditPrompt,
    videoGeneration: videoPrompt
  },
  generation: {
    videoFile: videoFileName,
    generatedAt: new Date().toISOString(),
    duration: process.env.VIDEO_DURATION || '5',
    seedreamSuccess: $node['Seedream_Edit'].json.seedreamSuccess
  },
  workflow: {
    executionId: $execution.id,
    workflowId: $workflow.id
  }
};

fs.writeFileSync(`./output/${jsonFileName}`, JSON.stringify(metadata, null, 2));

// Create TXT metadata (for backward compatibility)
const txtContent = `# Halloween Video - Generated
Generated from: ${originalFileName}
Timestamp: ${new Date().toISOString()}
Video file: ${videoFileName}
Image Edit Prompt: ${imageEditPrompt}
Image-to-Video Prompt: ${videoPrompt}
Prompts JSON: ${JSON.stringify({ output_1: imageEditPrompt, output_2: videoPrompt })}
`;

fs.writeFileSync(`./output/${txtFileName}`, txtContent);

// Clean up temp files
try {
  fs.unlinkSync(videoPath);
  if (editedImagePath && editedImagePath !== $node['Validate_Image'].json.originalPath) {
    fs.unlinkSync(editedImagePath);
  }
} catch (error) {
  console.warn('Cleanup failed:', error.message);
}

// Update processed file tracker
const processedTrackerPath = './processed-files.json';
let tracker = {};
try {
  tracker = JSON.parse(fs.readFileSync(processedTrackerPath, 'utf8'));
} catch {}

tracker[originalFileName] = {
  processedAt: new Date().toISOString(),
  outputVideo: videoFileName,
  executionId: $execution.id
};

fs.writeFileSync(processedTrackerPath, JSON.stringify(tracker, null, 2));

return {
  json: {
    success: true,
    outputVideoPath: outputVideoPath,
    videoFileName: videoFileName,
    metadataCreated: true
  }
};
```

**Outputs:**
- `success`: Boolean
- `outputVideoPath`: Final video path
- `videoFileName`: Video filename
- `metadataCreated`: Boolean

**n8n Node Type:** Code (JavaScript)

---

### Node 6: Success/Failure Notification

**Purpose:** Send notifications about workflow completion

**Success Path:**
```javascript
// n8n Code node for success notification
return {
  json: {
    status: 'success',
    message: `✅ Video generated successfully: ${$node['File_Organization'].json.videoFileName}`,
    processingTime: (Date.now() - $node['Validate_Image'].json.timestamp) / 1000,
    costs: {
      gemini: '~$0.001',
      seedream: '~$0.02',
      kling: '~$0.10'
    }
  }
};
```

**Failure Path:**
```javascript
// n8n Code node for failure notification
return {
  json: {
    status: 'failed',
    message: `❌ Workflow failed at node: ${$executionData.lastNodeExecuted}`,
    error: $executionData.error.message,
    originalFile: $node['Validate_Image'].json.originalFileName
  }
};
```

**Notification Methods:**
- Console log (n8n execution log)
- Webhook to monitoring system (optional)
- Email notification (optional)
- Slack/Discord webhook (optional)

**n8n Node Types:**
- **Code** node for notification payload
- **HTTP Request** node for webhook (optional)

---

## 🔐 Configuration & Environment Variables

### Required Environment Variables

```bash
# API Keys
GOOGLE_AI_API_KEY=your_gemini_api_key
FAL_KEY=your_fal_api_key

# Workflow Settings
VIDEO_DURATION=5                    # 5 or 10 seconds
IMAGE_VARIATIONS=1                  # 1-4 Seedream variations
VIDEO_MODEL=kling-v2.5-turbo       # Currently only Kling for n8n workflow

# File Paths
INPUT_FOLDER=./input
OUTPUT_FOLDER=./output
TEMP_FOLDER=./temp

# Processing Settings
MAX_CONCURRENT_JOBS=3               # Not directly used in n8n, but for Node.js fallback
```

### Master Prompt Storage

**Option 1: Store in n8n Credential**
- Create a custom credential type for master prompt
- Store entire master.md content as encrypted credential
- Access via `{{$credentials.masterPrompt}}`

**Option 2: Read from File System**
- Use **Read Binary File** node at workflow start
- Path: `./master.md`
- Convert to text and use throughout workflow

**Option 3: Hard-code in Workflow Variable**
- Create a workflow variable `masterPrompt`
- Paste the full master.md content
- Easier to modify via n8n UI, but less maintainable

**Recommendation:** Option 2 (read from file) for maintainability

---

## 🔄 Workflow Triggers

### Option 1: Webhook Trigger (Recommended)

**Setup:**
- Create n8n webhook endpoint: `https://your-n8n.com/webhook/halloween-photobooth`
- Modify FileWatcherService to POST to webhook instead of processing locally

**Modified FileWatcherService:**
```javascript
async processNewPhoto(file) {
  // Instead of calling services directly, POST to n8n webhook
  const response = await fetch(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imagePath: file.path,
      originalFileName: file.name,
      timestamp: Date.now()
    })
  });

  console.log('✅ Sent to n8n workflow:', file.name);
}
```

**Pros:**
- Clean separation between file watching and processing
- Easy to test individual images via Postman/curl
- Can scale horizontally (multiple n8n instances)

**Cons:**
- Requires n8n to be accessible via HTTP
- Network dependency

---

### Option 2: File System Trigger (Alternative)

**Setup:**
- Use n8n's **File System Trigger** node
- Monitor `./input/` folder for new files
- Automatically trigger workflow on new file detection

**Configuration:**
```json
{
  "path": "./input",
  "watch": true,
  "events": ["add"],
  "ignored": ["*.txt", "*.json", ".DS_Store"],
  "persistent": true
}
```

**Pros:**
- No need to modify FileWatcherService
- Direct file system integration
- No network calls required

**Cons:**
- n8n must have file system access to `./input/` folder
- Can't easily track "already processed" files without custom logic
- May trigger multiple times for same file

**Recommendation:** Use Option 1 (Webhook) with modified FileWatcherService for better control

---

## 📊 Monitoring & Observability

### Execution Tracking

n8n provides built-in execution logs showing:
- Execution time per node
- Success/failure status
- Data flowing between nodes
- Error messages and stack traces

**Custom Metrics to Track:**
```javascript
// Add to Node 5 (File Organization)
const metrics = {
  executionId: $execution.id,
  totalTime: Date.now() - $node['Validate_Image'].json.timestamp,
  nodeTimes: {
    validation: $node['Validate_Image'].json.executionTime,
    gemini: $node['Gemini_Dual_Prompts'].json.executionTime,
    seedream: $node['Seedream_Edit'].json.executionTime,
    kling: $node['Kling_Video'].json.executionTime
  },
  costs: {
    gemini: 0.001,  // Approximate cost in USD
    seedream: 0.02,
    kling: 0.10,
    total: 0.121
  },
  apiCalls: {
    gemini: 1,
    seedream: 1,
    kling: 1
  }
};

// Send to monitoring system (optional)
// await fetch(process.env.METRICS_WEBHOOK_URL, {
//   method: 'POST',
//   body: JSON.stringify(metrics)
// });
```

### Error Handling Strategy

**Per-Node Error Handling:**

1. **Node 2 (Gemini):**
   - Retry 3 times with exponential backoff (2s, 4s, 8s)
   - If all fail, use fallback prompts
   - Continue workflow

2. **Node 3 (Seedream):**
   - Single attempt
   - If fails, set `seedreamSuccess: false`
   - Use original image for Node 4
   - Continue workflow

3. **Node 4 (Kling):**
   - Try 2 different endpoints
   - Retry each endpoint once
   - If all fail, STOP workflow and send failure notification

4. **Node 5 (File Organization):**
   - No retries (deterministic file operations)
   - If fails, STOP workflow to prevent data loss

**Global Error Handler:**
- Add error notification node connected to all critical nodes
- Send webhook/email with execution details on any failure

---

## 🚀 Deployment Strategy

### Phase 1: Parallel Testing (Week 1-2)

**Goal:** Run n8n workflow alongside existing Node.js implementation

**Setup:**
1. Deploy n8n instance (Docker or cloud)
2. Create workflow as described above
3. Modify FileWatcherService to send BOTH to Node.js services AND n8n webhook
4. Compare outputs for consistency
5. Track success rates, timing, and costs

**Validation Criteria:**
- 95%+ success rate for n8n workflow
- Video output quality matches Node.js implementation
- Processing time within 20% of Node.js implementation
- No data loss or corruption

---

### Phase 2: Gradual Migration (Week 3-4)

**Goal:** Shift 50% of traffic to n8n, monitor for issues

**Setup:**
1. Implement A/B testing in FileWatcherService
2. Route odd-numbered files to n8n, even-numbered to Node.js
3. Monitor error rates and performance
4. Fine-tune n8n workflow based on real usage

**Rollback Plan:**
- If n8n success rate drops below 90%, route all traffic back to Node.js
- Keep Node.js services running as fallback for 4 weeks minimum

---

### Phase 3: Full Migration (Week 5-6)

**Goal:** Route 100% of traffic to n8n, deprecate Node.js services

**Setup:**
1. Update FileWatcherService to ONLY call n8n webhook
2. Keep Node.js services inactive but available for emergency rollback
3. Monitor for 2 weeks
4. If stable, remove Node.js service code

**Success Metrics:**
- 95%+ success rate maintained for 2 consecutive weeks
- No critical incidents requiring rollback
- User-visible quality remains consistent

---

## 💡 Advanced Features (Future Enhancements)

### A/B Testing for Prompts

**Setup:**
- Create 2 parallel workflows in n8n
- Workflow A: Uses master.md prompt (current)
- Workflow B: Uses alternative prompt template
- Route 50% traffic to each via random selection node
- Compare video quality scores and user engagement

**Implementation:**
```javascript
// Add to Node 1
const useVariantB = Math.random() < 0.5;
return {
  json: {
    ...existingData,
    promptVariant: useVariantB ? 'B' : 'A'
  }
};
```

**Routing:**
- Use n8n's **IF** node to route to different Gemini nodes based on `promptVariant`

---

### Multiple Model Support

**Extend Node 4** to support switching between:
- Kling v2.5 Turbo (current)
- WAN 2.5 Preview (future)
- Other video generation models

**Configuration:**
```javascript
// Add model selection logic
const videoModel = process.env.VIDEO_MODEL || 'kling-v2.5-turbo';

switch(videoModel) {
  case 'kling-v2.5-turbo':
    // Use Kling endpoint
    break;
  case 'wan-2.5-preview':
    // Use WAN endpoint
    break;
  default:
    // Fallback to Kling
}
```

---

### Batch Processing

**Setup:**
- Modify workflow to accept array of images
- Process multiple images in parallel using n8n's **Split In Batches** node
- Set max concurrency via n8n settings

**Benefits:**
- Process accumulated images overnight
- Better API rate limiting management
- Reduced per-image overhead

---

### Quality Scoring & Filtering

**Add Quality Check Node:**
```javascript
// After Node 3 (Seedream Edit)
const editedImage = $node['Seedream_Edit'].json.editedImageBase64;

// Call image quality API (e.g., Cloudinary, AWS Rekognition)
const qualityScore = await analyzeImageQuality(editedImage);

if (qualityScore < 0.7) {
  // Re-run Seedream with different parameters
  return { json: { retryEdit: true, qualityScore } };
}

return { json: { retryEdit: false, qualityScore } };
```

**Routing:**
- Use **IF** node to conditionally retry Seedream with adjusted parameters
- Limit retries to 2 attempts maximum

---

## 📈 Cost Analysis

### Current Costs (Node.js Implementation)

**Per Image Processed:**
- Gemini 2.5 Flash API: ~$0.001 (1 image + text prompt)
- Seedream v4 Edit: ~$0.02 (1 image edit)
- Kling v2.5 Turbo: ~$0.10 (5-10s video generation)
- **Total: ~$0.121 per image**

**Monthly (100 images):**
- API costs: ~$12.10
- Server costs (Node.js): ~$10-20 (small VPS)
- **Total: ~$22-32/month**

---

### n8n Implementation Costs

**Per Image Processed:**
- API costs: Same as above (~$0.121)
- n8n execution: $0 (self-hosted) or ~$0.001 (n8n Cloud)
- **Total: ~$0.121-0.122 per image**

**Monthly (100 images):**
- API costs: ~$12.10
- n8n hosting:
  - **Self-hosted:** ~$10-30 (Docker VPS, 2GB RAM minimum)
  - **n8n Cloud:** ~$20/month (Starter plan, 2,500 executions)
- **Total: ~$22-42/month**

**Conclusion:** Similar costs, but n8n provides better visibility and maintainability

---

## 🔐 Security Considerations

### API Key Management

**Current (Node.js):** Environment variables in `.env` file

**n8n Implementation:**
1. **Credentials Store:** Use n8n's encrypted credential storage
2. **Environment Variables:** Fall back to env vars for self-hosted
3. **Secrets Manager:** Integrate with AWS Secrets Manager / HashiCorp Vault

**Recommendation:** Use n8n Credentials for all API keys

---

### File System Access

**Risks:**
- n8n needs read/write access to `./input/`, `./output/`, `./temp/`
- Potential for path traversal attacks via malicious filenames

**Mitigations:**
1. **Input Validation:** Sanitize filenames in Node 1
2. **Sandboxing:** Run n8n in Docker container with limited file system access
3. **Permissions:** Set strict folder permissions (read-only for input, write-only for output)

**Example Sanitization:**
```javascript
// Node 1: Validate & Prepare Image
const fileName = $input.item.json.originalFileName;

// Remove path traversal attempts
const sanitizedName = fileName.replace(/\.\.\//g, '').replace(/\//g, '_');

// Validate file extension
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const ext = path.extname(sanitizedName).toLowerCase();
if (!allowedExtensions.includes(ext)) {
  throw new Error('Invalid file type');
}

return { json: { sanitizedFileName: sanitizedName } };
```

---

### Network Security

**If using Webhook Trigger:**
1. **Authentication:** Add HMAC signature validation to webhook
2. **Rate Limiting:** Limit webhook calls to 10/minute per IP
3. **HTTPS Only:** Enforce TLS for all webhook requests
4. **IP Whitelist:** Only accept calls from known IPs (FileWatcherService server)

**Example HMAC Validation:**
```javascript
// Node 1: Validate Webhook Signature
const crypto = require('crypto');
const receivedSignature = $node['Webhook'].json.headers['x-signature'];
const payload = JSON.stringify($node['Webhook'].json.body);
const secret = process.env.WEBHOOK_SECRET;

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (receivedSignature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

---

## 📚 Dependencies & Requirements

### n8n Server Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 2GB
- Storage: 10GB SSD
- Node.js: v18+ (for Code nodes)

**Recommended:**
- CPU: 4 cores
- RAM: 4GB
- Storage: 50GB SSD
- Node.js: v20+

---

### n8n Installation Options

**Option 1: Docker (Recommended)**
```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your_password \
  -e GOOGLE_AI_API_KEY=your_key \
  -e FAL_KEY=your_key \
  -v ~/.n8n:/home/node/.n8n \
  -v /path/to/halloween-photobooth:/data \
  n8nio/n8n:latest
```

**Option 2: n8n Cloud**
- Sign up at https://n8n.io/cloud
- No infrastructure management
- Built-in monitoring and backups
- $20/month minimum

**Option 3: npm Global Install**
```bash
npm install -g n8n
n8n start
```

---

### Required npm Packages (for Code Nodes)

The following packages must be available in n8n's execution environment:

```json
{
  "sharp": "^0.32.0",     // Image processing
  "fs": "built-in",       // File system operations
  "path": "built-in",     // Path utilities
  "https": "built-in",    // HTTP downloads
  "crypto": "built-in"    // HMAC validation
}
```

**Note:** `sharp` requires native binaries. Ensure n8n Docker image has proper build tools.

---

## 🎨 n8n Workflow JSON Export

After building the workflow in n8n UI, export as JSON for version control:

**File:** `n8n-halloween-photobooth-workflow.json`

**Structure Preview:**
```json
{
  "name": "Halloween Photobooth - Image Edit to Video",
  "nodes": [
    {
      "parameters": {},
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "functionCode": "// Node 1: Validate & Prepare Image\n..."
      },
      "name": "Validate_Image",
      "type": "n8n-nodes-base.code",
      "position": [450, 300]
    }
    // ... more nodes
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "Validate_Image", "type": "main", "index": 0}]]
    }
    // ... more connections
  }
}
```

**Version Control:**
```bash
git add n8n-halloween-photobooth-workflow.json
git commit -m "Add n8n workflow for image-to-video pipeline"
```

---

## 📝 Testing Strategy

### Unit Testing (Individual Nodes)

**Test Each Node Independently:**

1. **Node 1 (Validation):**
   - Input: Sample image path
   - Expected: Base64 image, aspect ratio, dimensions
   - Test with: Portrait, landscape, square images

2. **Node 2 (Gemini):**
   - Input: Sample base64 image + master prompt
   - Expected: Valid JSON with output_1 and output_2
   - Test with: Various image types, edge cases

3. **Node 3 (Seedream):**
   - Input: Image + sanitized prompt
   - Expected: Edited image URL
   - Test with: Various prompts, check safety filter

4. **Node 4 (Kling):**
   - Input: Edited image + video prompt + aspect ratio
   - Expected: Video URL
   - Test with: Different durations, aspect ratios

5. **Node 5 (File Organization):**
   - Input: All previous outputs
   - Expected: Files in correct locations, metadata created
   - Test with: Cleanup verification

---

### Integration Testing (Full Workflow)

**End-to-End Tests:**

1. **Happy Path:**
   - Input: Valid image file
   - Expected: Video in `./output/`, metadata created, original file tracked
   - Verify: Video quality, duration, aspect ratio

2. **Seedream Failure:**
   - Input: Image with prompt that triggers safety filter
   - Expected: Workflow continues with original image, video still generated

3. **Kling Failure:**
   - Input: Invalid aspect ratio
   - Expected: Workflow fails gracefully, notification sent

4. **Gemini Parsing Failure:**
   - Input: Image that produces non-JSON response
   - Expected: Fallback prompts used, workflow continues

---

### Performance Testing

**Load Test Scenarios:**

1. **Single Image:** Measure baseline processing time
2. **10 Images in Parallel:** Test concurrency handling
3. **100 Images Queued:** Test queue management and throughput

**Metrics to Track:**
- Average processing time per image
- API call latency (Gemini, Seedream, Kling)
- Memory usage
- CPU usage
- Success rate

**Tools:**
- n8n built-in execution logs
- Custom monitoring webhooks
- Grafana dashboards (optional)

---

## 📖 Documentation for Team

### n8n Workflow Documentation

**Location:** Add detailed comments in each Code node explaining:
- Purpose of the node
- Input parameters
- Output format
- Error handling
- Example data

**External Documentation:**
- Create `docs/N8N_WORKFLOW_GUIDE.md` with:
  - Workflow overview diagram
  - Node-by-node explanation
  - Troubleshooting guide
  - FAQ section

---

### Runbook for Operations

**Daily Operations:**
1. Check n8n execution logs for failures
2. Monitor API cost dashboard
3. Review video output quality sample

**Weekly Maintenance:**
1. Review and optimize slow nodes
2. Update master prompt if needed
3. Check for n8n version updates

**Monthly Tasks:**
1. Audit API costs vs budget
2. Review A/B test results (if implemented)
3. Backup n8n workflow JSON to git

---

## ✅ Success Criteria

### Functional Requirements

- [ ] Workflow accepts image file path via webhook
- [ ] Gemini generates dual prompts (image edit + video)
- [ ] Seedream applies horror styling to image
- [ ] Kling generates video from edited image
- [ ] Metadata files created in correct format
- [ ] Original image tracked to prevent reprocessing
- [ ] Error handling and fallbacks work correctly
- [ ] Processing time < 3 minutes per image

---

### Non-Functional Requirements

- [ ] Workflow is visually documented in n8n UI
- [ ] Success rate > 95% over 100 images
- [ ] No data loss or file corruption
- [ ] Secure API key storage
- [ ] Costs remain within budget ($0.15 per image max)
- [ ] Easy to modify prompts via n8n UI
- [ ] Can rollback to Node.js if needed

---

## 📞 Support & Escalation

### Common Issues & Solutions

**Issue 1: Gemini returns non-JSON response**
- **Symptom:** Node 2 fails with parse error
- **Solution:** Check master prompt format, ensure JSON response requested
- **Fallback:** Use default prompts from configuration

**Issue 2: Seedream safety filter triggered**
- **Symptom:** Node 3 returns error about content policy
- **Solution:** Review sanitization logic, adjust prompt templates
- **Fallback:** Use original image for video generation

**Issue 3: Kling video quality poor**
- **Symptom:** Generated videos are blurry or distorted
- **Solution:** Check aspect ratio preservation, adjust video prompt
- **Escalation:** Contact fal.ai support with sample outputs

**Issue 4: n8n workflow stuck**
- **Symptom:** Execution doesn't complete after 10 minutes
- **Solution:** Check n8n logs for timeout errors, restart n8n service
- **Escalation:** Review n8n server resources (CPU, RAM)

---

## 🎯 Next Steps

### Immediate (Week 1)

1. **Set up n8n instance** (Docker recommended)
2. **Create workflow skeleton** with all 6 nodes
3. **Test Node 1** with sample images
4. **Test Node 2** with Gemini API
5. **Document findings** and adjust brief as needed

---

### Short-term (Week 2-4)

1. **Complete workflow implementation**
2. **Run parallel testing** alongside Node.js
3. **Collect metrics** (success rate, timing, costs)
4. **Fine-tune error handling**
5. **Create team documentation**

---

### Long-term (Month 2+)

1. **Full migration to n8n**
2. **Implement A/B testing** for prompts
3. **Add quality scoring** and filtering
4. **Build monitoring dashboard**
5. **Optimize costs** and performance

---

## 📎 Appendices

### Appendix A: API Documentation Links

- **Gemini 2.5 Flash:** https://ai.google.dev/gemini-api/docs
- **Seedream v4 Edit:** https://fal.ai/models/bytedance/seedream/v4/edit
- **Kling Video v2.5 Turbo:** https://fal.ai/models/kling-video/v2.5-turbo
- **n8n Documentation:** https://docs.n8n.io/

---

### Appendix B: Sample Webhook Payloads

**Input Webhook (from FileWatcherService):**
```json
{
  "imagePath": "./input/P1466584.jpg",
  "originalFileName": "P1466584.jpg",
  "timestamp": 1738272497566
}
```

**Output Webhook (to monitoring system):**
```json
{
  "status": "success",
  "executionId": "abc123",
  "videoFileName": "1738272497566_P1466584_halloween.mp4",
  "processingTime": 127.4,
  "costs": {
    "gemini": 0.001,
    "seedream": 0.02,
    "kling": 0.10,
    "total": 0.121
  }
}
```

---

### Appendix C: Environment Variable Template

```bash
# Copy to .env and fill in your values

# API Keys (Required)
GOOGLE_AI_API_KEY=your_gemini_api_key_here
FAL_KEY=your_fal_api_key_here

# Webhook Configuration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/halloween-photobooth
WEBHOOK_SECRET=your_webhook_hmac_secret_here

# Video Generation Settings
VIDEO_MODEL=kling-v2.5-turbo
VIDEO_DURATION=5
IMAGE_VARIATIONS=1

# File Paths
INPUT_FOLDER=./input
OUTPUT_FOLDER=./output
TEMP_FOLDER=./temp

# Processing Settings
MAX_CONCURRENT_JOBS=3

# Monitoring (Optional)
METRICS_WEBHOOK_URL=https://your-monitoring-system.com/webhook
```

---

**End of Brief**

---

## 📌 Summary Checklist

Before starting implementation, ensure:

- [ ] n8n server is set up and accessible
- [ ] All API keys are available and tested
- [ ] File system paths are configured correctly
- [ ] Master prompt (master.md) is accessible to n8n
- [ ] Node.js services are ready for parallel testing
- [ ] Monitoring and alerting is configured
- [ ] Team has access to n8n UI
- [ ] Documentation is prepared for handoff
- [ ] Rollback plan is documented and tested

**Estimated Implementation Time:** 2-4 weeks (including testing and migration)

**Estimated Cost Impact:** Neutral to +20% (improved visibility worth the cost)

**Risk Level:** Medium (mitigated by parallel testing and gradual migration)
