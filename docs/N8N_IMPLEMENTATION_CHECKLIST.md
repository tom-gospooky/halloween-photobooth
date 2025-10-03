# n8n Implementation Checklist
## Halloween Photobooth - Image Edit to Video Pipeline

Use this checklist to track your n8n workflow implementation progress.

---

## 📋 Pre-Implementation Setup

### Environment & Infrastructure
- [ ] n8n server installed (Docker/Cloud/npm)
- [ ] n8n accessible via browser (default: http://localhost:5678)
- [ ] n8n basic authentication configured
- [ ] File system mounted correctly (./input, ./output, ./temp accessible)
- [ ] Node.js packages available for Code nodes (sharp, fs, path, https)

### API Keys & Credentials
- [ ] Google AI API Key obtained (Gemini 2.5 Flash)
- [ ] FAL API Key obtained (fal.ai)
- [ ] API keys tested independently (Postman/curl)
- [ ] API keys stored in n8n Credentials (recommended) or environment variables
- [ ] Webhook secret generated (for HMAC authentication)

### Configuration Files
- [ ] master.md accessible to n8n
- [ ] settings.json readable by n8n (optional, for advanced settings)
- [ ] processed-files.json writable by n8n
- [ ] .env file configured with all required variables

---

## 🏗️ Workflow Construction (Week 1)

### Node 1: Validate & Prepare Image
- [ ] Create webhook trigger node
- [ ] Configure webhook path: `/webhook/halloween-photobooth`
- [ ] Add Code node for image validation
- [ ] Implement filename sanitization
- [ ] Implement aspect ratio detection logic
- [ ] Implement image resize for Gemini (1024x1024 max)
- [ ] Implement base64 encoding
- [ ] Test with sample images (landscape, portrait, square)
- [ ] Verify outputs: `imageBase64`, `aspectRatio`, `dimensions`, `originalFileName`

**Test Command:**
```bash
curl -X POST http://localhost:5678/webhook/halloween-photobooth \
  -H "Content-Type: application/json" \
  -d '{"imagePath": "./input/test-image.jpg", "timestamp": 1234567890}'
```

---

### Node 2: Gemini 2.5 Flash - Dual Prompt Generation
- [ ] Add "Read Binary File" node for master.md
- [ ] Convert master.md to text
- [ ] Add HTTP Request node for Gemini API
- [ ] Configure endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- [ ] Add authentication header: `x-goog-api-key: {{$credentials.gemini.apiKey}}`
- [ ] Configure request body with master prompt + image
- [ ] Add Code node for response parsing
- [ ] Implement JSON extraction (handle markdown code blocks)
- [ ] Implement fallback logic if parsing fails
- [ ] Test with various images
- [ ] Verify outputs: `imageEditPrompt` (output_1), `videoPrompt` (output_2)

**Test Data:**
```json
{
  "contents": [{
    "role": "user",
    "parts": [
      {"text": "...master prompt..."},
      {"inline_data": {"mime_type": "image/jpeg", "data": "...base64..."}}
    ]
  }]
}
```

---

### Node 3: Seedream v4 Edit - Image Transformation
- [ ] Add Code node for prompt sanitization
- [ ] Implement content safety replacements (blood→dark red paint, etc.)
- [ ] Add Code node for image size calculation
- [ ] Implement aspect ratio preservation logic (2048x1536, 1536x2048, 2048x2048)
- [ ] Add HTTP Request node for Seedream API
- [ ] Configure endpoint: `https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit`
- [ ] Add authentication header: `Authorization: Key {{$credentials.fal.apiKey}}`
- [ ] Configure request body with image_urls array, prompt, image_size
- [ ] Add Code node for response parsing
- [ ] Add HTTP Request node to download edited image
- [ ] Implement fallback to original image on failure
- [ ] Test with various prompts
- [ ] Verify outputs: `editedImageUrl`, `editedImageBase64`, `seedreamSuccess`

**Test Sanitization:**
```javascript
// Input: "blood streaks and slasher horror atmosphere"
// Output: "dark red artistic streaks and 90s movie atmosphere"
```

---

### Node 4: Kling v2.5 Turbo - Video Generation
- [ ] Add IF node to check `seedreamSuccess`
- [ ] Add Code node to select image source (edited vs original)
- [ ] Add HTTP Request node for Kling API (endpoint 1)
- [ ] Configure endpoint: `.../kling-video/v2.5-turbo/pro/image-to-video`
- [ ] Add authentication header: `Authorization: Key {{$credentials.fal.apiKey}}`
- [ ] Configure request body with image_url, prompt, duration, aspect_ratio
- [ ] Add error handling node
- [ ] Add HTTP Request node for Kling API (endpoint 2 - fallback)
- [ ] Configure fallback endpoint: `.../kling-video/v2.5-turbo/image-to-video`
- [ ] Add Code node for response parsing
- [ ] Add HTTP Request node to download video
- [ ] Test with both endpoints
- [ ] Test with different aspect ratios (16:9, 9:16, 1:1)
- [ ] Verify outputs: `videoUrl`, `videoPath`, `klingSuccess`

**Test Durations:**
- [ ] 5 seconds (default)
- [ ] 10 seconds (optional)

---

### Node 5: Metadata Creation & File Organization
- [ ] Add Code node for file organization
- [ ] Implement timestamp-based filename generation
- [ ] Implement video file copy to ./output/
- [ ] Implement edited image copy to ./output/ (if different from original)
- [ ] Implement JSON metadata creation
- [ ] Include all required fields: model, prompts, source, generation, workflow
- [ ] Implement TXT metadata creation (backward compatibility)
- [ ] Implement processed-files.json update
- [ ] Implement temp file cleanup
- [ ] Test file operations
- [ ] Verify no data loss
- [ ] Verify correct permissions

**Metadata Schema:**
```json
{
  "model": "kling-v2.5-turbo",
  "modelName": "Kling Video v2.5 Turbo Pro",
  "provider": "fal.ai",
  "type": "image-to-video",
  "imageEditModel": "seedream-v4-edit",
  "source": {...},
  "prompts": {...},
  "generation": {...},
  "workflow": {...}
}
```

---

### Node 6: Success/Failure Notification
- [ ] Add Code node for success notification payload
- [ ] Calculate processing time
- [ ] Calculate total costs
- [ ] Format notification message
- [ ] Add HTTP Request node for webhook notification (optional)
- [ ] Configure webhook URL (if using external monitoring)
- [ ] Add error catching node for failure path
- [ ] Format failure notification
- [ ] Test both success and failure paths

**Notification Format:**
```json
{
  "status": "success|failed",
  "videoFileName": "...",
  "processingTime": 127.4,
  "costs": {"total": 0.121}
}
```

---

## 🔗 Node Connections

- [ ] Connect Webhook → Node 1 (Validate Image)
- [ ] Connect Node 1 → Load Master Prompt
- [ ] Connect Load Master Prompt → Node 2 (Gemini)
- [ ] Connect Node 1 → Node 2 (Gemini) - for image data
- [ ] Connect Node 2 → Node 3 (Sanitize Prompt)
- [ ] Connect Node 1 → Node 3 (Calculate Image Size) - for dimensions
- [ ] Connect Node 3 → Seedream API
- [ ] Connect Seedream → IF node (check success)
- [ ] Connect IF (true) → Download Edited Image
- [ ] Connect IF (false) → Use Original Image
- [ ] Connect both paths → Node 4 (Kling)
- [ ] Connect Node 4 → Node 5 (File Organization)
- [ ] Connect Node 5 → Node 6 (Success Notification)
- [ ] Connect error outputs → Node 6 (Failure Notification)

---

## 🧪 Testing (Week 2)

### Unit Tests (Individual Nodes)
- [ ] Node 1: Test with 10 different images (various sizes, formats)
- [ ] Node 2: Test with 5 different master prompts
- [ ] Node 3: Test sanitization with 10 edge cases
- [ ] Node 3: Test image size calculation with all aspect ratios
- [ ] Node 4: Test with both Kling endpoints
- [ ] Node 5: Test file operations (create, move, cleanup)
- [ ] Node 6: Test notification format

### Integration Tests (Full Workflow)
- [ ] Happy path: Valid image → successful video generation
- [ ] Seedream failure: Workflow continues with original image
- [ ] Kling failure: Workflow stops and notifies
- [ ] Gemini parsing error: Fallback prompts used
- [ ] Large image: Resize works correctly
- [ ] Portrait image: Aspect ratio preserved
- [ ] Landscape image: Aspect ratio preserved
- [ ] Square image: Aspect ratio detected correctly
- [ ] Duplicate file: Tracked correctly (if tracking implemented)
- [ ] Concurrent processing: Multiple images handled correctly

### Edge Cases
- [ ] Image with special characters in filename
- [ ] Image with no EXIF data
- [ ] Corrupted image file
- [ ] Image in unsupported format (e.g., TIFF)
- [ ] Very large image (>10MB)
- [ ] Very small image (<100x100)
- [ ] API rate limit hit (Gemini/Seedream/Kling)
- [ ] Network timeout during download
- [ ] Disk full when saving output
- [ ] master.md file missing or corrupted

---

## 🔒 Security Implementation

- [ ] HMAC signature validation in webhook trigger
- [ ] Webhook secret stored securely
- [ ] IP whitelist configured (optional)
- [ ] Rate limiting enabled on webhook (10 req/min)
- [ ] Filename sanitization removes `../` attempts
- [ ] File extension whitelist enforced (.jpg, .jpeg, .png, .webp only)
- [ ] API keys never logged or exposed in workflow data
- [ ] API keys stored in n8n Credentials (encrypted)
- [ ] Docker container has limited filesystem access
- [ ] Input folder is read-only
- [ ] Output folder is write-only
- [ ] Temp folder is cleared regularly

**HMAC Validation Code:**
```javascript
const crypto = require('crypto');
const receivedSig = $node['Webhook'].json.headers['x-signature'];
const payload = JSON.stringify($node['Webhook'].json.body);
const expectedSig = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(payload).digest('hex');
if (receivedSig !== expectedSig) throw new Error('Invalid signature');
```

---

## 🔄 Error Handling Implementation

### Retry Logic
- [ ] Gemini API: 3 retries with exponential backoff (2s, 4s, 8s)
- [ ] Seedream API: No retries, fallback to original image
- [ ] Kling API: Try endpoint 1, if fails try endpoint 2
- [ ] File downloads: 2 retries with 5s delay

### Fallback Logic
- [ ] Gemini parse failure → Use default prompts
- [ ] Seedream failure → Use original image
- [ ] Kling endpoint 1 fails → Try endpoint 2
- [ ] Kling all endpoints fail → STOP workflow, send notification

### Error Notifications
- [ ] Workflow failure sends notification with error details
- [ ] Notification includes: execution ID, failed node, error message, original filename
- [ ] Error logged to n8n execution log (always enabled)
- [ ] Optional: Send to webhook/Slack/email

---

## 📊 Monitoring Setup

### n8n Built-in Monitoring
- [ ] Enable execution logging
- [ ] Set retention period (30 days recommended)
- [ ] Enable error workflow (for automated error handling)
- [ ] Set up execution tags (for filtering by image type, model, etc.)

### Custom Metrics
- [ ] Add timing metrics to each node
- [ ] Calculate per-node processing time
- [ ] Track API call counts
- [ ] Track success/failure rates
- [ ] Calculate costs per execution
- [ ] Log to external monitoring system (optional)

### Dashboards (Optional)
- [ ] Create Grafana dashboard for workflow metrics
- [ ] Create success rate chart (daily/weekly)
- [ ] Create processing time chart
- [ ] Create cost analysis chart
- [ ] Create API failure rate chart

---

## 🚀 Deployment (Weeks 3-4)

### Phase 1: Parallel Testing
- [ ] Deploy n8n workflow to production environment
- [ ] Modify FileWatcherService.js to send to n8n webhook
- [ ] Keep Node.js services running in parallel
- [ ] Route 10% of traffic to n8n
- [ ] Monitor for 3 days
- [ ] Compare outputs: n8n vs Node.js
- [ ] Track success rates (target: 95%+)
- [ ] Track processing times (target: within 20% of Node.js)
- [ ] Track costs (should be same as Node.js)
- [ ] Fix any issues found
- [ ] Route 50% of traffic to n8n
- [ ] Monitor for 7 days

**Modified FileWatcherService Code:**
```javascript
async processNewPhoto(file) {
  const useN8n = Math.random() < 0.5; // 50% traffic

  if (useN8n) {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePath: file.path,
        originalFileName: file.name,
        timestamp: Date.now()
      })
    });
  } else {
    // Existing Node.js processing
  }
}
```

---

### Phase 2: Full Migration
- [ ] Route 100% of traffic to n8n
- [ ] Monitor for 14 days
- [ ] Verify success rate remains >95%
- [ ] Verify no data loss
- [ ] Keep Node.js services inactive but available
- [ ] Document any issues and resolutions
- [ ] Train team on n8n workflow management
- [ ] Create runbook for common issues

---

### Phase 3: Deprecation
- [ ] Remove A/B testing code from FileWatcherService
- [ ] Update FileWatcherService to only call n8n
- [ ] Remove unused Node.js service code (keep for 1 month as backup)
- [ ] Update documentation to reflect n8n as primary
- [ ] Archive Node.js implementation code in git
- [ ] Celebrate successful migration! 🎉

---

## 📚 Documentation

- [ ] Create workflow diagram (use n8n's built-in export)
- [ ] Export workflow JSON to git repository
- [ ] Document environment variables in README
- [ ] Create troubleshooting guide
- [ ] Document common error codes and solutions
- [ ] Create video walkthrough of workflow (5-10 minutes)
- [ ] Update team wiki with n8n links and credentials
- [ ] Schedule team training session (1 hour)

**Workflow Export:**
```bash
# Export from n8n UI: Settings → Export Workflow → JSON
# Save to: ./n8n-workflows/halloween-photobooth.json
git add n8n-workflows/halloween-photobooth.json
git commit -m "Add n8n workflow for Halloween photobooth"
```

---

## 🎯 Success Criteria

### Functional
- [x] Workflow processes images end-to-end
- [x] Gemini generates dual prompts correctly
- [x] Seedream applies horror styling
- [x] Kling generates video with correct duration and aspect ratio
- [x] Metadata files created in correct format
- [x] Files organized in output folder
- [x] Processed files tracked correctly
- [x] No duplicate processing

### Performance
- [x] Success rate >95% over 100 images
- [x] Processing time <3 minutes per image
- [x] No data loss or corruption
- [x] Costs remain ≤$0.15 per image

### Operational
- [x] Workflow is visually documented
- [x] Team can modify prompts via UI
- [x] Error handling works correctly
- [x] Monitoring provides useful insights
- [x] Rollback plan tested and ready
- [x] Documentation complete

---

## 🔧 Maintenance Checklist (Ongoing)

### Daily
- [ ] Check n8n execution log for failures
- [ ] Verify output folder has new videos
- [ ] Monitor API costs

### Weekly
- [ ] Review workflow performance metrics
- [ ] Check for n8n updates
- [ ] Review and optimize slow nodes
- [ ] Clear old execution logs (if needed)

### Monthly
- [ ] Audit API costs vs budget
- [ ] Review and update master prompt (if needed)
- [ ] Test workflow with new edge cases
- [ ] Backup workflow JSON to git
- [ ] Review security settings

---

## 📞 Support Resources

- **n8n Documentation:** https://docs.n8n.io/
- **n8n Community Forum:** https://community.n8n.io/
- **Internal Documentation:** [N8N_WORKFLOW_BRIEF.md](./N8N_WORKFLOW_BRIEF.md)
- **Visual Guide:** [N8N_WORKFLOW_VISUAL.md](./N8N_WORKFLOW_VISUAL.md)
- **Team Wiki:** [Add your internal wiki link]
- **Slack Channel:** [Add your Slack channel]

---

## 🏁 Final Sign-off

Implementation completed by: ___________________
Date: ___________________
Reviewed by: ___________________
Production deployment date: ___________________

**Notes:**
```
[Add any final notes, learnings, or recommendations for future improvements]
```

---

**Good luck with your n8n implementation! 🚀**
