# Product Requirements Document (PRD)  
**Project:** Halloween AI Photobooth  
**Owner:** Tech Director (Tom Geurts)  
**Date:** September 2025  
**Version:** v1.1  

---

## 1. Overview  
For the 2025 Halloween party, GoSpooky will create a **live AI-powered photobooth experience**. Guests are photographed on entry, and their photo is instantly transformed into a **short, spooky or funny AI animation** that matches their costumes, group composition, and the party’s **high school Halloween theme**.  

Videos are displayed silently on a large screen throughout the party, creating a continuous spectacle and memorable experience for employees. Originals and generated media are archived for internal use in Google Drive.  

---

## 2. Goals & Success Criteria  
- **Primary Goal:** Create a fun, engaging spectacle for employees.  
- **Secondary Goal:** Capture footage to inspire/tease partners with GoSpooky’s creative tech capabilities.  
- **Success Definition:** Guests laugh, talk about it, and gather around the screen — strong experiential impact.  

---

## 3. Scope  
- **In-scope:** One-off prototype for Halloween 2025, not a reusable product.  
- **Out-of-scope:** Long-term SaaS-style deployment, enterprise-grade reliability, external client delivery.  

---

## 4. Roles & Responsibilities  
- **Photobooth Operation (camera & photo selection):** Photographer  
- **AI Pipeline & Private Server Setup:** Tech Director  
- **On-site Monitoring:** Tech Director  
- **Big Screen/Beamer Setup & Playback:** Tech Director  

---

## 5. System Flow  

### Input & Capture  
1. Photographer takes and selects photos (RAW + JPEG supported).  
2. Photos uploaded directly to **Google Drive `/input` folder**.  
3. Google Drive also serves as **long-term archive**.  

### File Watching & Analysis  
4. **Private server backend** monitors the Google Drive `/input` folder via Drive API.  
5. On new photo:  
   - Visual analysis extracts details (costumes, group size, composition, mood).  
   - Hybrid narrative prompt generated (Haunted High School theme).  

### Optional Wildcards (Gemini 2.5 Flash Image)  
6. Backend triggers Gemini 2.5 Flash Image when wildcard transformation is requested (CEO cameo, photo merge, costume upgrades).  

### Video Generation (Veo3 Fast)  
7. Narrative prompt + (optionally enhanced) image → Veo3 Fast API.  
8. Output saved in **Google Drive `/output` folder**.  

### Playback  
9. **Web-based player** hosted on the private server streams videos from `/output` folder.  
   - Responsive scaling, aspect ratio preserved.  
   - No playback controls visible.  
   - Supports transparent PNG overlay for branding/frames.  
10. Playback rules:  
   - New videos appended to end of loop.  
   - If loop finishes without new content → shuffle/randomize existing clips.  
   - New videos always injected with priority.  
11. Silent playback.  

### Failure Handling  
- If Veo3/Gemini API fails or times out, the player defaults to a **Google Drive `/screensaver` folder** with preloaded spooky videos.  

---

## 6. Technical Requirements  

- **Storage:** Google Drive (folders: `/input`, `/output`, `/screensaver`, `/archive`).  
- **Pipeline:** Runs entirely on **private server** (no local laptop scripts).  
- **Playback:** Web-based fullscreen player served from private server, sourcing Google Drive videos.  
- **Latency target:** ≤2 minutes (as fast as APIs allow).  
- **Archive:** All photos + videos remain in Google Drive indefinitely.  

---

## 7. Google Drive Folder Structure & Permissions  

/Halloween-Photobooth-2025
/input → photographer uploads photos here
/output → AI-generated videos saved here
/screensaver → preloaded fallback videos
/archive → long-term storage (copy of all inputs + outputs)

yaml
Copy code

**Permissions:**  
- **Photographer:** Write access to `/input`. Read-only elsewhere.  
- **Tech Director:** Full access to all folders.  
- **Private Server Service Account:**  
  - Read `/input` (to detect new photos).  
  - Write `/output` (to store generated videos).  
  - Read `/screensaver` (to serve fallback videos).  
  - Write `/archive` (to auto-backup originals + outputs).  
- **General Staff/Guests:** No direct access (only see videos on big screen).  

---

## 8. Constraints & Assumptions  
- Internet required for API calls.  
- Limited to API guardrails (no extra content filters).  
- One video per photo, no variations.  
- Silent playback only.  

---

## 9. Risks & Mitigations  
| Risk | Mitigation |
|------|------------|
| API latency >2 min | Screensaver fallback until video arrives |
| API failure / credits exhausted | Default to preloaded screensaver videos |
| Poor lighting/RAW-only capture | Gemini 2.5 Flash Image optional enhancement |
| Guests expect multiple versions | Set expectation: 1 video per photo |
| Aspect ratio mismatch on projector | Browser player auto-scale w/ ratio preserved |

---

## 10. Deliverables  
- **Private server backend**:  
  - Google Drive API integration (file watching + media handling)  
  - Visual analysis & hybrid prompt generation  
  - Gemini 2.5 wildcards (optional transformations)  
  - Veo3 Fast API integration  
  - Error handling & logging  
- **Web-based fullscreen video player** with overlay support.  
- **Google Drive folder structure** (see §7).  
- **Prompt template library** (Haunted High School theme).  
- **Screensaver fallback videos** for continuous playback.  

---

## 11. Future Opportunities (Out of Scope)  
- Adding sound design (spooky audio).  
- Real-time self-service booth (guests trigger photos themselves).  
- Client-ready reusable product with polished UI/UX.  

---