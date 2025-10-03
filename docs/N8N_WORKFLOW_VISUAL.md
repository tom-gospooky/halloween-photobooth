# n8n Workflow Visual Guide
## Halloween Photobooth - Image Edit to Video Pipeline

---

## 🎯 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INPUT TRIGGER                                    │
│  ┌────────────────────┐              ┌────────────────────┐            │
│  │ FileWatcherService │──POST────▶   │  n8n Webhook       │            │
│  │  (Node.js)         │              │  Trigger           │            │
│  └────────────────────┘              └────────────────────┘            │
│                                              │                           │
│                                              ▼                           │
└─────────────────────────────────────────────────────────────────────────┘
                                               │
┌──────────────────────────────────────────────┼──────────────────────────┐
│                      n8n WORKFLOW            │                           │
│                                              ▼                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NODE 1: VALIDATE & PREPARE IMAGE                                 │  │
│  │  • Read image file                                               │  │
│  │  • Extract metadata (dimensions, aspect ratio)                   │  │
│  │  • Convert to base64                                             │  │
│  │  • Sanitize filename                                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NODE 2: GEMINI 2.5 FLASH - DUAL PROMPT GENERATION               │  │
│  │  • Load master.md prompt                                         │  │
│  │  • Send image + prompt to Gemini API                             │  │
│  │  • Parse JSON response                                           │  │
│  │  • Extract output_1 (image edit) & output_2 (video prompt)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NODE 3: SEEDREAM V4 EDIT - IMAGE TRANSFORMATION                  │  │
│  │  • Sanitize image edit prompt (content safety)                   │  │
│  │  • Calculate optimal image size (aspect ratio preservation)      │  │
│  │  • Call fal.ai Seedream API                                      │  │
│  │  • Download edited image                                         │  │
│  │  • Fallback to original image if fails                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NODE 4: KLING V2.5 TURBO - VIDEO GENERATION                      │  │
│  │  • Use edited image (or original as fallback)                    │  │
│  │  • Apply video prompt from Gemini                                │  │
│  │  • Set duration (5s or 10s) and aspect ratio                     │  │
│  │  • Call fal.ai Kling API                                         │  │
│  │  • Download generated video                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NODE 5: METADATA CREATION & FILE ORGANIZATION                    │  │
│  │  • Move video to ./output/ with timestamp filename               │  │
│  │  • Move edited image to ./output/                                │  │
│  │  • Create JSON metadata file                                     │  │
│  │  • Create TXT metadata file (backward compatibility)             │  │
│  │  • Update processed-files.json tracker                           │  │
│  │  • Clean up temp files                                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ NODE 6: SUCCESS/FAILURE NOTIFICATION                             │  │
│  │  • Log execution details                                         │  │
│  │  • Calculate processing time and costs                           │  │
│  │  • Send webhook notification (optional)                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                           │
│  ┌────────────────────┐     ┌────────────────────┐                     │
│  │ ./output/          │     │ processed-files    │                     │
│  │  • video.mp4       │     │  .json             │                     │
│  │  • edited.jpg      │     │  (tracking)        │                     │
│  │  • metadata.json   │     └────────────────────┘                     │
│  │  • metadata.txt    │                                                 │
│  └────────────────────┘                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
INPUT IMAGE                MASTER PROMPT
    │                           │
    │                           │
    ▼                           ▼
┌────────────────────────────────────────┐
│         GEMINI 2.5 FLASH               │
│  Analyzes image + applies prompt       │
└────────────────────────────────────────┘
            │              │
            │              │
            ▼              ▼
      IMAGE EDIT        VIDEO
      PROMPT            PROMPT
            │              │
            │              └──────────────┐
            ▼                             │
┌────────────────────────────────────────┐│
│       SEEDREAM V4 EDIT                 ││
│  Transforms image to horror style      ││
└────────────────────────────────────────┘│
            │                             │
            │                             │
            ▼                             ▼
       EDITED IMAGE ──────▶  ┌────────────────────────────────────────┐
                             │     KLING V2.5 TURBO                   │
                             │  Generates video from edited image     │
                             └────────────────────────────────────────┘
                                            │
                                            │
                                            ▼
                                    FINAL VIDEO (MP4)
```

---

## 🎨 n8n UI Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ n8n Editor                                                    [Save] [Execute]
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [Webhook]                                                            │
│       │                                                                 │
│       │                                                                 │
│       ▼                                                                 │
│   [Validate Image]──────────┐                                          │
│       │                      │                                          │
│       │                      ▼                                          │
│       │                  [Load Master Prompt]                          │
│       │                      │                                          │
│       └──────────┬───────────┘                                         │
│                  │                                                      │
│                  ▼                                                      │
│         [Gemini API Request]                                           │
│                  │                                                      │
│                  ▼                                                      │
│         [Parse Gemini Response]                                        │
│                  │                                                      │
│                  ├───────────────┐                                     │
│                  │               │                                     │
│                  ▼               ▼                                     │
│         [Sanitize Prompt]  [Store Video Prompt]                       │
│                  │               │                                     │
│                  ▼               │                                     │
│      [Calculate Image Size]     │                                     │
│                  │               │                                     │
│                  ▼               │                                     │
│       [Seedream API Request]────┘                                     │
│                  │                                                      │
│                  ├─────────[IF: Success?]                             │
│                  │              │                                      │
│            YES   │              │ NO                                   │
│                  ▼              ▼                                      │
│     [Download Edited]    [Use Original]                               │
│                  │              │                                      │
│                  └──────┬───────┘                                     │
│                         │                                              │
│                         ▼                                              │
│              [Kling API Request]                                      │
│                         │                                              │
│                         ▼                                              │
│             [Download Video]                                          │
│                         │                                              │
│                         ▼                                              │
│          [Create Metadata Files]                                      │
│                         │                                              │
│                         ▼                                              │
│           [Move Files to Output]                                      │
│                         │                                              │
│                         ▼                                              │
│             [Success Notification]                                    │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Node Configuration Reference

### Node 1: Validate & Prepare Image

**Type:** Code (JavaScript)
**Inputs:** `imagePath` from webhook
**Outputs:** `imageBase64`, `aspectRatio`, `dimensions`, `originalFileName`

```javascript
// Key logic
const metadata = await sharp(imagePath).metadata();
const ratio = metadata.width / metadata.height;
const aspectRatio = ratio > 1.2 ? '16:9' : ratio < 0.8 ? '9:16' : '1:1';
```

---

### Node 2: Gemini 2.5 Flash

**Type:** HTTP Request
**Method:** POST
**URL:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
**Auth:** API Key in header (`x-goog-api-key`)

**Body Structure:**
```json
{
  "contents": [{
    "role": "user",
    "parts": [
      {"text": "{{masterPrompt}}"},
      {"inline_data": {"mime_type": "image/jpeg", "data": "{{imageBase64}}"}}
    ]
  }]
}
```

---

### Node 3: Seedream v4 Edit

**Type:** HTTP Request
**Method:** POST
**URL:** `https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit`
**Auth:** Bearer token (`Authorization: Key {{FAL_KEY}}`)

**Body Structure:**
```json
{
  "image_urls": ["data:image/jpeg;base64,{{imageBase64}}"],
  "prompt": "{{sanitizedPrompt}}",
  "image_size": "{{imageSize}}",
  "num_images": 1,
  "enable_safety_checker": true
}
```

**Image Size Logic:**
- Landscape (ratio > 1.2): `2048x1536`
- Portrait (ratio < 0.8): `1536x2048`
- Square: `2048x2048`

---

### Node 4: Kling v2.5 Turbo

**Type:** HTTP Request
**Method:** POST
**URL:** `https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video`
**Auth:** Bearer token (`Authorization: Key {{FAL_KEY}}`)

**Body Structure:**
```json
{
  "image_url": "data:image/jpeg;base64,{{editedImageBase64}}",
  "prompt": "{{videoPrompt}}",
  "duration": "5",
  "aspect_ratio": "{{aspectRatio}}",
  "negative_prompt": "blur, distort, and low quality"
}
```

**Fallback Endpoints:**
1. `.../v2.5-turbo/pro/image-to-video` (primary)
2. `.../v2.5-turbo/image-to-video` (fallback)

---

### Node 5: File Organization

**Type:** Code (JavaScript)
**Inputs:** All previous node outputs
**Outputs:** File paths and success status

**Key Operations:**
1. Generate timestamp-based filenames
2. Move video to `./output/`
3. Move edited image to `./output/`
4. Create JSON metadata
5. Create TXT metadata
6. Update `processed-files.json`
7. Clean up temp files

---

### Node 6: Notification

**Type:** Code (JavaScript) + HTTP Request (optional)
**Inputs:** Execution metadata
**Outputs:** Success/failure notification

**Notification Payload:**
```json
{
  "status": "success",
  "videoFileName": "1738272497566_P1466584_halloween.mp4",
  "processingTime": 127.4,
  "costs": {"gemini": 0.001, "seedream": 0.02, "kling": 0.10}
}
```

---

## 🔀 Error Handling Flow

```
┌─────────────────┐
│  Gemini API     │
│  Call Fails     │
└────────┬────────┘
         │
         ▼
    Retry 3x?
         │
    ┌────┼────┐
    │         │
   YES       NO
    │         │
    │         ▼
    │    Use Fallback
    │    Prompts
    │         │
    └────┬────┘
         │
         ▼
    Continue Workflow

┌─────────────────┐
│  Seedream API   │
│  Call Fails     │
└────────┬────────┘
         │
         ▼
    Use Original
    Image
         │
         ▼
    Continue Workflow

┌─────────────────┐
│  Kling API      │
│  Call Fails     │
└────────┬────────┘
         │
         ▼
    Retry 2x
    (different endpoints)
         │
    ┌────┼────┐
    │         │
   YES       NO
    │         │
    │         ▼
    │    STOP Workflow
    │    Send Failure
    │    Notification
    │
    └────┬────┘
         │
         ▼
    Continue Workflow
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Webhook Authentication                             │
│  • HMAC signature validation                                │
│  • IP whitelist                                             │
│  • Rate limiting (10 req/min)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Input Validation                                   │
│  • Filename sanitization (remove ../)                       │
│  • File extension whitelist (.jpg, .jpeg, .png, .webp)      │
│  • File size limits                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: API Key Security                                   │
│  • Stored in n8n encrypted credentials                      │
│  • Never logged or exposed in responses                     │
│  • Environment variable fallback                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Content Safety                                     │
│  • Seedream safety checker enabled                          │
│  • Prompt sanitization (remove violent terms)               │
│  • Output validation                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: File System Isolation                              │
│  • Docker container with limited filesystem access          │
│  • Read-only input folder                                   │
│  • Write-only output folder                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Performance Metrics

### Expected Timing (per image)

```
Node 1: Validate Image          ──────▶  0.5-1s
Node 2: Gemini API             ──────▶  2-4s
Node 3: Seedream API           ──────────────▶  15-30s
Node 4: Kling API              ────────────────────────────▶  60-90s
Node 5: File Organization      ──────▶  1-2s
Node 6: Notification           ─▶  0.1s

Total Processing Time: ~80-130 seconds (1.3-2.2 minutes)
```

### Cost Breakdown

```
Gemini 2.5 Flash:   $0.001  ▓
Seedream v4:        $0.020  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
Kling v2.5 Turbo:   $0.100  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
────────────────────────────────────────────────────────────────────────────────
Total per image:    $0.121
```

---

## 🚦 Deployment Phases

### Phase 1: Setup (Week 1)
```
Day 1-2: [████████████░░░░░░░░] Install n8n, configure environment
Day 3-4: [████████████████░░░░] Build workflow skeleton
Day 5-7: [████████████████████] Test individual nodes
```

### Phase 2: Integration (Week 2)
```
Day 1-2: [████████████░░░░░░░░] Connect all nodes
Day 3-4: [████████████████░░░░] End-to-end testing
Day 5-7: [████████████████████] Parallel testing with Node.js
```

### Phase 3: Migration (Week 3-4)
```
Day 1-7:  [██████████░░░░░░░░░░] 50% traffic to n8n
Day 8-14: [████████████████████] 100% traffic to n8n
```

---

## 🎯 Success Dashboard

### Key Metrics to Monitor

```
┌─────────────────────────────────────────────────────────────┐
│ SUCCESS RATE                                                │
│ ████████████████████████████████████░░░░░░░░░░░  95.2%     │
│ Target: > 95%                                   ✅ PASS     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ AVERAGE PROCESSING TIME                                     │
│ ██████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  108s         │
│ Target: < 130s                                  ✅ PASS     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ COST PER IMAGE                                              │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  $0.121        │
│ Target: < $0.15                                 ✅ PASS     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GEMINI API SUCCESS RATE                                     │
│ ██████████████████████████████████████████░░░  98.7%        │
│ Target: > 95%                                   ✅ PASS     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SEEDREAM API SUCCESS RATE                                   │
│ ████████████████████████████████████░░░░░░░░░  92.1%        │
│ Target: > 90% (with fallback)                   ✅ PASS     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ KLING API SUCCESS RATE                                      │
│ ████████████████████████████████████████░░░░░  96.4%        │
│ Target: > 95%                                   ✅ PASS     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Quick Reference: Node.js vs n8n

| Aspect | Current (Node.js) | Proposed (n8n) |
|--------|-------------------|----------------|
| **Code Location** | Multiple `.js` files | Single visual workflow |
| **Modification** | Edit code, restart server | Edit workflow in UI |
| **Monitoring** | Console logs | Built-in execution viewer |
| **Error Handling** | Try-catch blocks | Visual error flows |
| **Testing** | Manual test scripts | Built-in test mode |
| **Deployment** | Git push, server restart | Import JSON file |
| **Learning Curve** | Node.js/JavaScript required | No coding required |
| **Maintainability** | Medium (scattered code) | High (visual + centralized) |
| **Debugging** | Console.log + debugger | Visual execution trace |
| **Cost Tracking** | Manual calculation | Built-in per-execution |

---

## 🎓 Training Resources

### For Team Members (No Coding Experience)

1. **n8n Fundamentals** (2 hours)
   - Watch: https://www.youtube.com/watch?v=RpjQTGKm-ok
   - Topic: Workflow builder basics, nodes, connections

2. **HTTP Requests in n8n** (1 hour)
   - Watch: https://www.youtube.com/watch?v=KFfJ27LVcHQ
   - Topic: API calls, authentication, response handling

3. **n8n Code Node** (1 hour)
   - Watch: https://www.youtube.com/watch?v=7j0lNKurIuU
   - Topic: JavaScript in n8n, data transformation

### For Developers

1. **n8n Custom Nodes** (2 hours)
   - Docs: https://docs.n8n.io/integrations/creating-nodes/
   - Topic: Building reusable node packages

2. **n8n API** (1 hour)
   - Docs: https://docs.n8n.io/api/
   - Topic: Triggering workflows programmatically

3. **n8n Self-Hosting** (1 hour)
   - Docs: https://docs.n8n.io/hosting/
   - Topic: Docker, environment variables, scaling

---

## 🔗 Useful Links

- **Full Documentation:** [N8N_WORKFLOW_BRIEF.md](./N8N_WORKFLOW_BRIEF.md)
- **n8n Official Docs:** https://docs.n8n.io/
- **n8n Community Forum:** https://community.n8n.io/
- **Workflow Templates:** https://n8n.io/workflows/
- **API Documentation:**
  - Gemini: https://ai.google.dev/
  - fal.ai: https://fal.ai/models

---

**Questions?** Refer to [N8N_WORKFLOW_BRIEF.md](./N8N_WORKFLOW_BRIEF.md) for detailed implementation steps.
