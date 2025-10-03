# Settings API Documentation

Complete reference for all configurable parameters across 4 AI models (3 video, 1 image).

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Model Selection](#model-selection)
3. [Seedream v4 Settings](#seedream-v4-settings)
4. [WAN 2.2 Turbo Settings](#wan-22-turbo-settings)
5. [WAN 2.5 Preview Settings](#wan-25-preview-settings)
6. [Kling Video v2.5 Turbo Settings](#kling-video-v25-turbo-settings)
7. [Examples](#examples)

---

## API Endpoints

### Get All Settings
```http
GET /api/settings
```

**Response:**
```json
{
  "videoModel": "wan-2.2-turbo",
  "seedream": { ... },
  "wan-2.2-turbo": { ... },
  "wan-2.5-preview": { ... },
  "kling-v2.5-turbo": { ... }
}
```

### Get Settings Schema
```http
GET /api/settings/schema
```

Returns schema with parameter types, ranges, defaults, and descriptions for UI generation.

### Update All Settings
```http
POST /api/settings
Content-Type: application/json

{
  "videoModel": "wan-2.5-preview",
  "wan-2.5-preview": {
    "resolution": "1080p",
    "duration": "10"
  }
}
```

### Update Specific Model Settings
```http
POST /api/settings/:model
Content-Type: application/json

{
  "resolution": "1080p",
  "duration": "10"
}
```

Valid models: `wan-2.2-turbo`, `wan-2.5-preview`, `kling-v2.5-turbo`, `seedream`

### Change Video Model
```http
POST /api/settings/video-model
Content-Type: application/json

{
  "model": "kling-v2.5-turbo"
}
```

---

## Model Selection

### `videoModel`
**Type:** `enum`
**Values:** `"wan-2.2-turbo"` | `"wan-2.5-preview"` | `"kling-v2.5-turbo"`
**Default:** `"wan-2.2-turbo"`
**Description:** Video generation model to use

---

## Seedream v4 Settings

Image-to-image editing with ByteDance Seedream v4.

### Parameters

#### `numImages`
- **Type:** `integer`
- **Range:** `1-6`
- **Default:** `1`
- **Description:** Number of separate model generations

#### `imageSize`
- **Type:** `string`
- **Default:** `"2048x2048"`
- **Options:**
  - Predefined: `"square_hd"`, `"portrait_4_3"`, etc.
  - Custom: `"WIDTHxHEIGHT"` (1024-4096)
- **Description:** Output image dimensions

#### `maxImages`
- **Type:** `integer`
- **Range:** `1-6`
- **Default:** `1`
- **Description:** Maximum images per generation

#### `seed`
- **Type:** `integer | null`
- **Default:** `null`
- **Description:** Random seed for reproducibility (null for random)

#### `syncMode`
- **Type:** `boolean`
- **Default:** `false`
- **Description:**
  - `true`: Return image as data URI
  - `false`: Return image as URL

#### `enableSafetyChecker`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable content safety checking

### Example Configuration
```json
{
  "seedream": {
    "numImages": 2,
    "imageSize": "2048x2048",
    "maxImages": 2,
    "seed": 42,
    "syncMode": false,
    "enableSafetyChecker": true
  }
}
```

---

## WAN 2.2 Turbo Settings

High-quality image-to-video generation with extensive customization.

### Parameters

#### `numFrames`
- **Type:** `integer`
- **Range:** `17-161`
- **Default:** `81`
- **Description:** Number of frames to generate
- **Note:** More frames = longer video

#### `framesPerSecond`
- **Type:** `integer`
- **Range:** `4-60`
- **Default:** `16`
- **Description:** Video frame rate (FPS)

#### `resolution`
- **Type:** `enum`
- **Values:** `"480p"` | `"580p"` | `"720p"`
- **Default:** `"720p"`
- **Description:** Video resolution

#### `aspectRatio`
- **Type:** `enum`
- **Values:** `"auto"` | `"16:9"` | `"9:16"` | `"1:1"`
- **Default:** `"auto"`
- **Description:** Video aspect ratio

#### `negativePrompt`
- **Type:** `string`
- **Default:** `""`
- **Description:** Content to avoid in generation

#### `seed`
- **Type:** `integer | null`
- **Default:** `null`
- **Description:** Random seed for reproducibility

#### `numInferenceSteps`
- **Type:** `integer`
- **Default:** `27`
- **Description:** Number of denoising steps (advanced)

#### `guidanceScale`
- **Type:** `float`
- **Default:** `3.5`
- **Description:** How closely to follow the prompt (advanced)

#### `interpolatorModel`
- **Type:** `string`
- **Default:** `"film"`
- **Description:** Frame interpolation model (advanced)

#### `videoQuality`
- **Type:** `string`
- **Default:** `"high"`
- **Description:** Video encoding quality (advanced)

### Example Configuration
```json
{
  "wan-2.2-turbo": {
    "numFrames": 120,
    "framesPerSecond": 24,
    "resolution": "720p",
    "aspectRatio": "16:9",
    "negativePrompt": "blurry, low quality",
    "seed": 12345,
    "guidanceScale": 4.0
  }
}
```

---

## WAN 2.5 Preview Settings

Latest WAN model with improved quality and features.

### Parameters

#### `resolution`
- **Type:** `enum`
- **Values:** `"480p"` | `"720p"` | `"1080p"`
- **Default:** `"1080p"`
- **Description:** Video resolution

#### `duration`
- **Type:** `enum`
- **Values:** `"5"` | `"10"`
- **Default:** `"5"`
- **Description:** Video duration in seconds

#### `negativePrompt`
- **Type:** `string`
- **Max Length:** `500`
- **Default:** `""`
- **Description:** Content to avoid in generation

#### `enablePromptExpansion`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable LLM prompt rewriting for better results

#### `seed`
- **Type:** `integer | null`
- **Default:** `null`
- **Description:** Random seed for reproducibility

#### `audioUrl`
- **Type:** `string | null`
- **Default:** `null`
- **Description:** Audio URL (WAV/MP3, 3-30s, max 15MB)
- **Note:** Optional audio track for video

### Example Configuration
```json
{
  "wan-2.5-preview": {
    "resolution": "1080p",
    "duration": "10",
    "negativePrompt": "static, boring",
    "enablePromptExpansion": true,
    "seed": null,
    "audioUrl": "https://example.com/audio.mp3"
  }
}
```

---

## Kling Video v2.5 Turbo Settings

High-speed video generation with aspect ratio options.

### Parameters

#### `duration`
- **Type:** `enum`
- **Values:** `"5"` | `"10"`
- **Default:** `"5"`
- **Description:** Video duration in seconds

#### `aspectRatio`
- **Type:** `enum`
- **Values:** `"16:9"` | `"9:16"` | `"1:1"`
- **Default:** `"16:9"`
- **Description:** Video aspect ratio

#### `negativePrompt`
- **Type:** `string`
- **Max Length:** `2500`
- **Default:** `"blur, distort, and low quality"`
- **Description:** Content to avoid in generation

#### `cfgScale`
- **Type:** `float`
- **Range:** `0-1`
- **Default:** `0.5`
- **Description:** Classifier Free Guidance scale (how closely to follow prompt)
- **Note:** Higher = more faithful to prompt, lower = more creative

#### `tailImageUrl`
- **Type:** `string | null`
- **Default:** `null`
- **Description:** End frame image URL
- **Note:** Optional image for video end frame

### Example Configuration
```json
{
  "kling-v2.5-turbo": {
    "duration": "10",
    "aspectRatio": "9:16",
    "negativePrompt": "static, boring, low quality",
    "cfgScale": 0.7,
    "tailImageUrl": null
  }
}
```

---

## Examples

### Example 1: Configure for High-Quality Portrait Videos

```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "videoModel": "wan-2.5-preview",
    "wan-2.5-preview": {
      "resolution": "1080p",
      "duration": "10",
      "enablePromptExpansion": true
    }
  }'
```

### Example 2: Configure for Fast Social Media Videos

```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "videoModel": "kling-v2.5-turbo",
    "kling-v2.5-turbo": {
      "duration": "5",
      "aspectRatio": "9:16",
      "cfgScale": 0.6
    }
  }'
```

### Example 3: Configure Image Editing

```bash
curl -X POST http://localhost:3000/api/settings/seedream \
  -H "Content-Type: application/json" \
  -d '{
    "numImages": 3,
    "imageSize": "2048x2048",
    "seed": 42
  }'
```

### Example 4: Update Only WAN 2.2 Settings

```bash
curl -X POST http://localhost:3000/api/settings/wan-2.2-turbo \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "720p",
    "aspectRatio": "16:9",
    "numFrames": 120,
    "framesPerSecond": 24
  }'
```

### Example 5: Switch Models

```bash
curl -X POST http://localhost:3000/api/settings/video-model \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan-2.5-preview"
  }'
```

### Example 6: Get Current Settings

```bash
curl http://localhost:3000/api/settings
```

### Example 7: Get Settings Schema for UI

```bash
curl http://localhost:3000/api/settings/schema
```

---

## Settings File Location

Settings are persisted to: `./settings.json`

You can manually edit this file or use the API endpoints.

---

## Validation

All settings are validated before saving. Invalid settings will return:

```json
{
  "error": "Invalid settings",
  "validationErrors": [
    "WAN 2.2 numFrames must be 17-161",
    "Invalid videoModel: invalid-model"
  ]
}
```

---

## API References

- **Seedream v4 Edit:** https://fal.ai/models/fal-ai/bytedance/seedream/v4/edit
- **WAN 2.2 Turbo:** https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/api
- **WAN 2.5 Preview:** https://fal.ai/models/fal-ai/wan-25-preview/image-to-video/api
- **Kling Video v2.5 Turbo:** https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/api
