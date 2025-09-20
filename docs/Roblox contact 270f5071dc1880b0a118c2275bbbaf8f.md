# Roblox contact

Created: September 16, 2025 3:37 PM
Last edited time: September 16, 2025 9:04 PM

# 1) Create an API key with the right access

1. Go to **Google AI Studio** and create a **Gemini API key**. This single key works for text, image, and video (Veo) over the Gemini API. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/api-key))
2. Store it as an env var on your server (recommended):
- macOS/zsh: `echo 'export GEMINI_API_KEY=YOUR_KEY' >> ~/.zshrc && source ~/.zshrc`
- Linux/bash: `echo 'export GEMINI_API_KEY=YOUR_KEY' >> ~/.bashrc && source ~/.bashrc`
    
    (You can also pass it explicitly to the SDKs or as an HTTP header `x-goog-api-key`.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/api-key))
    

**Security tips**

- Never expose keys client-side in production.
- Prefer server calls or ephemeral tokens (for Live API features).
- Consider Google key restrictions if you’re worried about leakage. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/api-key))

**Region check (Netherlands is supported)**

The Gemini API (including AI Studio) is available in the Netherlands. If your team members travel, verify availability per country. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/available-regions))

---

# 2) Install official SDKs

- **Python:** `pip install google-genai pillow`
    
    (`from google import genai` is the new official SDK namespace.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))
    
- **Node/TS:** `npm i @google/genai` ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

You can also use **pure REST** with `x-goog-api-key: $GEMINI_API_KEY`. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

---

# 3) Gemini 2.5 Flash Image (text-to-image & edit)

## Model name

Use `gemini-2.5-flash-image-preview` (swap to the non-preview when GA). ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

## Python — generate an image from text

```python
from google import genai
from io import BytesIO
from PIL import Image

client = genai.Client()  # uses GEMINI_API_KEY env var

prompt = "Ultra-detailed studio photo of a neon-lit banana sculpture on a glossy black plinth, 50mm lens, f/1.8, dramatic rim lighting, square composition."

resp = client.models.generate_content(
    model="gemini-2.5-flash-image-preview",
    contents=[prompt],
)

# Save the first inline image part
for part in resp.candidates[0].content.parts:
    if getattr(part, "inline_data", None):
        img = Image.open(BytesIO(part.inline_data.data))
        img.save("image_out.png")
        break

```

(Structure mirrors the official examples.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

## Node — generate an image from text

```jsx
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({}); // picks up process.env.GEMINI_API_KEY

const prompt = "High-contrast black & white poster of a running cheetah, 35mm film grain, centered subject, square.";

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image-preview",
  contents: prompt,
});

// Save first inline image part
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("image_out.png", buffer);
    break;
  }
}

```

([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

## REST — generate an image from text

```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents":[{"parts":[{"text":"Photorealistic still life of a ceramic mug with subtle steam, soft key light, square."}]}]
  }' \
| grep -o '"data": "[^"]*"' | cut -d'"' -f4 | base64 --decode > image_out.png

```

([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

## Image editing (text + image → image)

Pass the existing image (base64) + an edit instruction. Shown in all three stacks in the docs. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

**Notes / gotchas**

- Image results carry **SynthID** watermarks. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))
- Return format is **interleaved parts** (text or inline image bytes). Iterate parts and save `inline_data`. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))

---

# 4) Veo 3 & Veo 3 Fast (video generation)

## Model names (use exactly)

- **Veo 3 (stable):** `veo-3.0-generate-001`
- **Veo 3 (preview):** `veo-3.0-generate-preview`
- **Veo 3 Fast (stable):** `veo-3.0-fast-generate-001`
- **Veo 3 Fast (preview):** `veo-3.0-fast-generate-preview` ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

**When to use Fast**: for lower latency / higher throughput (e.g., rapid A/B testing, programmatic social cuts) with audio. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

**Asynchronous flow**: Veo returns a **long-running operation**; you must **poll** until `done == true`, then download the video file using the returned file handle/URI. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

### Python — text→video with negative prompt (Veo 3)

```python
import time
from google import genai
from google.genai import types

client = genai.Client()

op = client.models.generate_videos(
    model="veo-3.0-generate-001",
    prompt='Moody dolly-in toward a rusted robot in a rain-soaked alley; subtle neon reflections; "We are not alone," whispers a passerby.',
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",            # or "9:16"
        resolution="1080p",             # "720p" default; 1080p only for 16:9
        negative_prompt="cartoon, low quality, flicker"
    ),
)

while not op.done:
    time.sleep(10)
    op = client.operations.get(op)

video = op.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("veo3_out.mp4")

```

([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

### Node — image→video (Veo 3 Fast)

```jsx
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({});

// Load a PNG/JPG as the starting frame
const imageBytes = fs.readFileSync("start_frame.png").toString("base64");

let operation = await ai.models.generateVideos({
  model: "veo-3.0-fast-generate-001",
  prompt: "Slow push-in on the subject; rain begins; distant thunder; ambient city hum.",
  image: { imageBytes, mimeType: "image/png" },
  config: { aspectRatio: "16:9", negativePrompt: "cartoon, low quality" }
});

// Poll until ready
while (!operation.done) {
  await new Promise(r => setTimeout(r, 10000));
  operation = await ai.operations.getVideosOperation({ operation });
}

// Download
await ai.files.download({
  file: operation.response.generatedVideos[0].video,
  downloadPath: "veo3_fast_out.mp4",
});

```

([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

### REST — text→video (Veo 3)

```bash
BASE_URL="https://generativelanguage.googleapis.com/v1beta"

# Start the job
operation_name=$(
curl -s "${BASE_URL}/models/veo-3.0-generate-001:predictLongRunning" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "instances":[{ "prompt": "Handheld horror shot down a high-school hallway; fluorescent flicker; echoing footsteps; whispered dialogue: \"Who\'s there?\""}],
    "parameters": { "aspectRatio": "16:9", "negativePrompt": "cartoon, low quality" }
  }' | jq -r .name )

# Poll
while true; do
  status_resp=$(curl -s -H "x-goog-api-key: $GEMINI_API_KEY" "${BASE_URL}/${operation_name}")
  is_done=$(echo "$status_resp" | jq .done)
  if [ "$is_done" = "true" ]; then
    video_uri=$(echo "$status_resp" | jq -r '.response.generateVideoResponse.generatedSamples[0].video.uri')
    echo "Downloading: $video_uri"
    curl -L -H "x-goog-api-key: $GEMINI_API_KEY" "$video_uri" -o veo3_out.mp4
    break
  fi
  sleep 10
done

```

([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

**Key Veo parameters & behavior**

- `prompt`, `negativePrompt`, optional `image` (for image→video), `aspectRatio` (`16:9` or `9:16`), `resolution` (`720p` default; `1080p` for 16:9 only), and optional `seed`. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))
- **Person generation (regional rules):** In EU/UK/CH/MENA, Veo 3 allows only `allow_adult` for person generation (image-to-video supports `allow_adult` only; text-to-video supports `allow_all` only outside those regions). Check limits page. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))
- **Watermark:** Veo videos include **SynthID** watermark. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))
- **Retention:** Video files are kept server-side briefly; download promptly. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))

---

# 5) Common mistakes to avoid

- **Using the wrong header**: Use `x-goog-api-key: $GEMINI_API_KEY` or SDK config—not `Authorization: Bearer`. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/api-key))
- **Forgetting to poll Veo**: You must poll the **operation** until `done`. Only then download. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))
- **Parsing image responses**: For image gen/edit, iterate **content.parts** and look for `inline_data` (bytes), not `text`. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))
- **Client-side keys**: Don’t call these APIs from the browser in production with a raw key. Proxy through your backend. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/api-key))

---

# 6) Quick checklist for your prod stack (Vercel + Next.js)

- **Server routes** (Edge/Node): read `process.env.GEMINI_API_KEY`, call Gemini/Veo from server only.
- **n8n**: store the key as a **secret**/credential; call REST with `x-goog-api-key`.
- **Jobs**: Veo runs async—wrap with a worker/poller (e.g., cron or a task queue) to fetch the result and persist to storage.
- **Downloads**: Save returned files to GCS/S3 or your own storage; keep a DB record of the operation name and final URI.

---

# 7) Minimal “it works” smoke tests

### Image (Python)

- Model: `gemini-2.5-flash-image-preview`
- Expect: `image_out.png` saved.
    
    (Use the Python snippet above.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/image-generation))
    

### Video (Node, Veo 3 Fast)

- Model: `veo-3.0-fast-generate-001`
- Expect: `veo3_fast_out.mp4` saved.
    
    (Use the Node snippet above.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video?example=dialogue-))
    
    ## Regions & policy constraints
    
    - **Service availability:** Gemini API (and AI Studio) is available in the Netherlands and most countries; check the official list to verify for teammates/servers. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/available-regions))
    - **People generation (Veo 3):** In **EU/UK/CH/MENA**, `personGeneration` is restricted:
        - **Text→video:** `allow_all` only (policy-driven; see “Limitations”).
        - **Image→video:** **`allow_adult` only**.
            
            Also note: 1080p is only for **16:9**; videos are **8 s** at **24 fps**, and Google keeps generated videos server-side for **2 days** (download promptly). ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video))
            
    
    ## Quotas / rate limits (Gemini API)
    
    Quotas are **per project** (not per API key), and reset **daily at midnight Pacific**. Preview/experimental models are tighter. You can upgrade tiers (Free → Tier 1 → Tier 2 → Tier 3) based on billing and spend; Tier upgrades and increase requests are done in AI Studio. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits))
    
    **What matters for you specifically:**
    
    ### Veo 3 (text/image→video)
    
    - **Tier 1:** **2 RPM**, **10 requests/day**
    - **Tier 2:** **4 RPM**, **50 requests/day**
    - **Tier 3:** **10 RPM**, **500 requests/day**
        
        (“Requests/day” = video generations per day; Veo 3 Fast has the same table values.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits))
        
    
    ### Gemini 2.5 Flash Image (text/image→image)
    
    - **Tier 1:** **500 RPM**, **2,000 requests/day**
    - **Tier 2:** **2,000 RPM**, **50,000 requests/day**
    - **Tier 3:** **5,000 RPM**, *RPD not published (“*”)*
        
        (If you’re still on the **Free** tier, the image model generally available there is **Gemini 2.0 Flash Preview Image Generation** with **10 RPM** and **100 requests/day**.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits))
        
    
    > Tip: The Rate Limits page shows the full table for all models (RPM/TPM/RPD) by tier, plus batch limits and how to request an increase. Keep it bookmarked. (Google AI for Developers)
    > 
    
    ## How to raise limits
    
    1. **Enable Cloud Billing** on your project.
    2. In **AI Studio → API keys**, click **Upgrade** when your spend meets Tier 2/3 criteria (>$250 for Tier 2; >$1,000 for Tier 3, with 30+ days since payment).
    3. If needed, submit the **rate-limit increase** form linked on the docs page. (Approval isn’t guaranteed.) ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits))
    
    ## Gotchas to plan for
    
    - **EU shoots with people:** Remember the `personGeneration` constraint for Veo 3; plan prompts and workflows accordingly. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video))
    - **Async & retention:** Veo is **asynchronous** (you must poll until `done`) and videos expire from server storage after **2 days**. Persist immediately to your own bucket. ([Google AI for Developers](https://ai.google.dev/gemini-api/docs/video))
    - **Project-wide limits:** Limits apply across your whole backend if you share a project among services (e.g., your n8n worker + Next.js API routes). Consider **queueing** and **backoff**.