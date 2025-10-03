# Complete Parameter Reference

Quick reference for all 27 configurable parameters across 4 AI models.

---

## 🎨 Seedream v4 Edit (Image-to-Image) - 6 Parameters

| Parameter | Type | Range/Values | Default | Description |
|-----------|------|--------------|---------|-------------|
| `numImages` | integer | 1-6 | 1 | Number of image variations to generate |
| `imageSize` | string | 1024-4096 or presets | "2048x2048" | Output image dimensions |
| `maxImages` | integer | 1-6 | 1 | Maximum images per generation |
| `seed` | integer/null | any integer | null | Random seed (null = random) |
| `syncMode` | boolean | true/false | false | Return data URI (true) or URL (false) |
| `enableSafetyChecker` | boolean | true/false | true | Enable content safety checking |

**Use Case:** Transform source images with AI-guided edits

---

## 🎬 WAN 2.2 Turbo (Image-to-Video) - 10 Parameters

| Parameter | Type | Range/Values | Default | Description |
|-----------|------|--------------|---------|-------------|
| `numFrames` | integer | 17-161 | 81 | Total frames (more = longer video) |
| `framesPerSecond` | integer | 4-60 | 16 | Video frame rate |
| `resolution` | enum | 480p, 580p, 720p | 720p | Video resolution |
| `aspectRatio` | enum | auto, 16:9, 9:16, 1:1 | auto | Video aspect ratio |
| `negativePrompt` | string | any | "" | Content to avoid |
| `seed` | integer/null | any integer | null | Random seed (null = random) |
| `numInferenceSteps` | integer | positive int | 27 | Denoising steps (advanced) |
| `guidanceScale` | float | positive float | 3.5 | Prompt adherence strength (advanced) |
| `interpolatorModel` | string | model name | "film" | Frame interpolation method (advanced) |
| `videoQuality` | string | quality level | "high" | Video encoding quality (advanced) |

**Use Case:** Maximum control over video generation with advanced tuning

---

## 🎬 WAN 2.5 Preview (Image-to-Video) - 6 Parameters

| Parameter | Type | Range/Values | Default | Description |
|-----------|------|--------------|---------|-------------|
| `resolution` | enum | 480p, 720p, 1080p | 1080p | Video resolution (up to Full HD) |
| `duration` | enum | "5", "10" | "5" | Video length in seconds |
| `negativePrompt` | string | max 500 chars | "" | Content to avoid |
| `enablePromptExpansion` | boolean | true/false | true | Use LLM to enhance prompts |
| `seed` | integer/null | any integer | null | Random seed (null = random) |
| `audioUrl` | string/null | URL | null | Audio track (WAV/MP3, 3-30s, max 15MB) |

**Use Case:** High-quality video with prompt enhancement and optional audio

---

## 🎬 Kling Video v2.5 Turbo Pro (Image-to-Video) - 5 Parameters

| Parameter | Type | Range/Values | Default | Description |
|-----------|------|--------------|---------|-------------|
| `duration` | enum | "5", "10" | "5" | Video length in seconds |
| `aspectRatio` | enum | 16:9, 9:16, 1:1 | 16:9 | Video aspect ratio |
| `negativePrompt` | string | max 2500 chars | "blur, distort, and low quality" | Content to avoid |
| `cfgScale` | float | 0.0-1.0 | 0.5 | Classifier Free Guidance (0=creative, 1=precise) |
| `tailImageUrl` | string/null | URL | null | End frame image URL |

**Use Case:** Fast generation with flexible aspect ratios and guidance control

---

## 📊 Parameter Categories

### Video Quality Settings
| Parameter | Models | Values |
|-----------|--------|--------|
| Resolution | WAN 2.2, WAN 2.5 | 480p, 580p, 720p, 1080p |
| Aspect Ratio | WAN 2.2, Kling | auto, 16:9, 9:16, 1:1 |
| FPS | WAN 2.2 | 4-60 |
| Video Quality | WAN 2.2 | string (e.g., "high") |

### Duration Control
| Parameter | Models | Values |
|-----------|--------|--------|
| Duration (seconds) | WAN 2.5, Kling | "5", "10" |
| Num Frames | WAN 2.2 | 17-161 |
| Frames Per Second | WAN 2.2 | 4-60 |

### Image Settings
| Parameter | Models | Values |
|-----------|--------|--------|
| Image Size | Seedream | 1024x1024 to 4096x4096 |
| Num Images | Seedream | 1-6 |
| Max Images | Seedream | 1-6 |

### Prompt Control
| Parameter | Models | Purpose |
|-----------|--------|---------|
| Negative Prompt | WAN 2.2, WAN 2.5, Kling | Avoid unwanted content |
| Prompt Expansion | WAN 2.5 | LLM enhancement |
| CFG Scale | Kling | Prompt adherence (0-1) |
| Guidance Scale | WAN 2.2 | Prompt adherence strength |

### Reproducibility
| Parameter | Models | Values |
|-----------|--------|--------|
| Seed | All models | null (random) or integer |

### Advanced Features
| Parameter | Models | Purpose |
|-----------|--------|---------|
| Audio URL | WAN 2.5 | Add audio track |
| Tail Image | Kling | Set end frame |
| Sync Mode | Seedream | Data URI vs URL |
| Safety Checker | Seedream | Content moderation |
| Inference Steps | WAN 2.2 | Denoising control |
| Interpolator | WAN 2.2 | Frame blending |

---

## 🎯 Common Configurations

### Preset 1: High Quality Production
```json
{
  "videoModel": "wan-2.5-preview",
  "wan-2.5-preview": {
    "resolution": "1080p",
    "duration": "10",
    "enablePromptExpansion": true,
    "negativePrompt": "blurry, low quality, artifacts"
  }
}
```

### Preset 2: Social Media (Portrait)
```json
{
  "videoModel": "kling-v2.5-turbo",
  "kling-v2.5-turbo": {
    "duration": "5",
    "aspectRatio": "9:16",
    "cfgScale": 0.7
  }
}
```

### Preset 3: Social Media (Square)
```json
{
  "videoModel": "kling-v2.5-turbo",
  "kling-v2.5-turbo": {
    "duration": "5",
    "aspectRatio": "1:1",
    "cfgScale": 0.6
  }
}
```

### Preset 4: Fast Draft
```json
{
  "videoModel": "wan-2.2-turbo",
  "wan-2.2-turbo": {
    "resolution": "480p",
    "numFrames": 40,
    "framesPerSecond": 8
  }
}
```

### Preset 5: Maximum Control
```json
{
  "videoModel": "wan-2.2-turbo",
  "wan-2.2-turbo": {
    "numFrames": 120,
    "framesPerSecond": 24,
    "resolution": "720p",
    "aspectRatio": "16:9",
    "numInferenceSteps": 35,
    "guidanceScale": 4.0,
    "negativePrompt": "blur, artifacts",
    "seed": 42
  }
}
```

### Preset 6: Multiple Image Variations
```json
{
  "seedream": {
    "numImages": 4,
    "imageSize": "2048x2048",
    "maxImages": 4,
    "enableSafetyChecker": true
  }
}
```

---

## 🔍 Parameter Details

### CFG Scale (Classifier Free Guidance)
**Available in:** Kling v2.5 Turbo

- **0.0-0.3:** Very creative, may deviate from prompt
- **0.4-0.6:** Balanced creativity and accuracy
- **0.7-0.9:** Close adherence to prompt
- **0.9-1.0:** Maximum prompt fidelity

### Guidance Scale
**Available in:** WAN 2.2 Turbo

- Lower values: More creative interpretation
- Default (3.5): Balanced
- Higher values: Stricter prompt following

### Num Inference Steps
**Available in:** WAN 2.2 Turbo

- Fewer steps (15-25): Faster, less refined
- Default (27): Good balance
- More steps (30-50): Slower, more refined

### Frame Calculations

**WAN 2.2 Turbo:**
```
Video Duration = numFrames / framesPerSecond

Examples:
- 81 frames @ 16 FPS = ~5 seconds
- 120 frames @ 24 FPS = 5 seconds
- 161 frames @ 16 FPS = ~10 seconds
```

**WAN 2.5 / Kling:**
```
Duration = "5" or "10" (in seconds)
```

### Resolution Comparison

| Resolution | Dimensions | Aspect Ratio | Use Case |
|------------|------------|--------------|----------|
| 480p | 854×480 | 16:9 | Draft, fast preview |
| 580p | 1024×580 | 16:9 | Mid-quality |
| 720p | 1280×720 | 16:9 | Standard HD |
| 1080p | 1920×1080 | 16:9 | Full HD, production |

### Aspect Ratios

| Ratio | Dimensions Example | Use Case |
|-------|-------------------|----------|
| 16:9 | 1920×1080 | Landscape, YouTube, TV |
| 9:16 | 1080×1920 | Portrait, TikTok, Stories |
| 1:1 | 1080×1080 | Square, Instagram |
| auto | Matches input | Dynamic sizing |

---

## 💡 Tips & Best Practices

### For Best Quality
- Use WAN 2.5 Preview with 1080p
- Enable prompt expansion
- Use negative prompts to avoid artifacts
- Set duration to 10 seconds for more motion

### For Speed
- Use Kling v2.5 Turbo
- Lower resolution (480p-720p)
- Shorter duration (5 seconds)

### For Consistency
- Use fixed seeds
- Keep CFG/guidance scales moderate
- Use same model across project

### For Experimentation
- Generate multiple variations with Seedream
- Use null seeds for variety
- Try different CFG scales
- Vary negative prompts

---

## 📈 Performance Impact

### High Quality (Slower)
- ✓ 1080p resolution
- ✓ 10 second duration
- ✓ 30+ inference steps
- ✓ Multiple image generations

### Balanced (Recommended)
- ✓ 720p resolution
- ✓ 5 second duration
- ✓ Default inference steps
- ✓ Single generation

### Fast (Faster)
- ✓ 480p resolution
- ✓ 5 second duration
- ✓ Minimal inference steps
- ✓ Lower CFG scale

---

*For API usage and code examples, see [SETTINGS_API.md](./SETTINGS_API.md)*
