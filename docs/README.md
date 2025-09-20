# 🎃 Halloween AI Photobooth

An AI-powered Halloween photobooth that transforms party photos into spooky themed video animations using local storage, Gemini AI, and WAN 2.2 Turbo via fal.ai.

## 📋 Overview

This system automatically:
1. **Monitors** local input folder for new party photos
2. **Analyzes** photos with Gemini 2.5 Flash using master prompt
3. **Generates** detailed slasher film direction prompts
4. **Creates** spooky video animations with WAN 2.2 Turbo via fal.ai
5. **Stores** results locally with complete metadata tracking

Perfect for Halloween parties - creates memorable experiences with local storage for privacy and control.

## 🎬 System Flow

```
📸 Photo Upload → 🔍 AI Analysis → 📝 Prompt Generation → 🎥 Video Creation → 📁 Local Storage
     ↓              ↓              ↓                ↓              ↓
  Input Folder   Gemini 2.5 Flash  Master Prompt   WAN 2.2 Turbo  Output Folder
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google AI API key (for Gemini 2.5 Flash)
- FAL API key (for WAN 2.2 Turbo video generation)

#### Setting up Google Cloud & Service Account

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Note your project ID

2. **Enable Google Drive API:**
   - In Google Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it

3. **Create Service Account:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Name: `halloween-photobooth-service`
   - Role: Choose "Editor" for full Drive access
   - Click "Done"

4. **Generate JSON Key:**
   - Click on your new service account
   - Go to "Keys" tab > "Add Key" > "Create New Key"
   - Choose "JSON" format and download
   - Save as `./credentials/service-account.json` in your project

5. **Get Gemini API Key:**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create API key for your project
   - Copy the key for `.env` configuration

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository>
cd halloween-photobooth
npm install
```

2. **Run the setup script:**
```bash
npm run setup
```
This will guide you through:
- Google Drive folder structure creation
- Environment configuration
- Screensaver folder setup

3. **Configure API keys:**
Edit `.env` file with your credentials:
```bash
# Google Drive API
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/service-account.json
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_from_setup

# Google AI (Gemini) API - includes Veo 3 video generation and image generation
GOOGLE_AI_API_KEY=your_gemini_api_key_here
```

**Configuration Details:**
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`: Path to your downloaded JSON credentials file
- `GOOGLE_DRIVE_FOLDER_ID`: The root folder ID created by the setup script (automatically filled)
- `GOOGLE_AI_API_KEY`: Your Gemini API key from Google AI Studio

4. **Start the server:**
```bash
npm run dev
```

5. **Test your setup:**
```bash
npm run test
```
This validates all API connections and configurations.

6. **Open fullscreen player:**
Navigate to `http://localhost:3000` and press F11 for fullscreen mode.

### Quick Configuration Checklist

✅ **Before running the system, verify:**

1. **Files exist:**
   - `./credentials/service-account.json` (downloaded from Google Cloud)
   - `.env` file (copied from `.env.example`)

2. **Google Cloud setup:**
   - Google Drive API is enabled in your project
   - Service account has "Editor" role
   - Service account JSON key is downloaded

3. **Environment variables:**
   ```bash
   # Check your .env file contains:
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/service-account.json
   GOOGLE_DRIVE_FOLDER_ID=1abc123def456... # (from setup script)
   GOOGLE_AI_API_KEY=AIzaSy... # (from Google AI Studio)
   ```

4. **Folder structure:**
   - Run `npm run setup` to create Google Drive folders
   - **Location:** Folders are created in the **root directory** of your Google Drive (not in any subfolder)
   - **Folder name:** You'll be prompted to name it (default: "Halloween-Photobooth-2025")
   - **What you'll see:** A new folder appears at the top level of your Google Drive with 4 subfolders inside
   - Note the root folder ID provided by setup script

## 📁 Google Drive Structure

**Where folders are created:**
The setup script creates a new folder **in the root of your Google Drive** (at the same level as other folders you might have). 

**Folder structure created:**
```
Your Google Drive Root/
└── Halloween-Photobooth-2025/          # 📁 Root folder (you name this)
    ├── input/                           # 📸 Photographer uploads photos here
    ├── output/                          # 🎬 Generated videos appear here  
    ├── screensaver/                     # 📺 Fallback videos for continuous playback
    └── archive/                         # 📦 Long-term storage of all content
```

**What you'll see in Google Drive:**
1. Open [Google Drive](https://drive.google.com) in your browser
2. Look for "Halloween-Photobooth-2025" (or your chosen name) at the top level
3. Click into it to see the 4 subfolders: input, output, screensaver, archive
4. The folder ID in your `.env` file refers to this root "Halloween-Photobooth-2025" folder

### Access:
- **Your Google Account:** Full access to all folders (owner)
- **Service Account:** API access for automation  
- **Party Guests:** No direct access (view videos on big screen only)

**Note:** Since you have full Google Drive access, you can upload photos directly to the `input/` folder or any other folder as needed.

## 🎭 Halloween Themes

The system generates **Haunted High School** scenarios including:

- 🏫 **Ghostly Hallways** - Floating lockers, phantom students
- 🍕 **Spectral Cafeteria** - Flying lunch trays, ethereal lunch ladies  
- 📚 **Haunted Library** - Self-writing books, ghostly librarians
- 🏃 **Phantom Gymnasium** - Invisible sports, spectral cheerleaders
- 🎓 **Supernatural Classrooms** - Ghost teachers, floating desks
- 💃 **Eternal Prom** - Phantom dancers, mystical disco balls

Each theme adapts to:
- Group size and composition
- Costume types and themes
- Photo mood and energy
- Lighting conditions

## 🔧 API Integration

### Gemini AI (Complete AI Pipeline)
- **Vision Analysis:** `gemini-1.5-flash` for photo analysis
  - Costume detection and theme identification
  - Group composition and mood analysis
  - Lighting assessment and enhancement recommendations
  - **Fallback:** Default analysis with error recovery

- **Image Enhancement:** `gemini-native-image` for photo improvement
  - Automatic lighting optimization
  - Atmospheric effects based on costume themes
  - Preserves original people and costumes exactly
  - **Fallback:** Uses original image if enhancement fails

- **Video Generation:** `veo-3-fast` and `veo-3.0-generate-001`
  - Transforms photos into 8-second spooky animations
  - 720p output with 16:9 aspect ratio
  - Includes synchronized audio (atmospheric sounds)
  - **Fallback:** Screensaver content when API unavailable

### Google Drive API
- **Purpose:** File watching, upload/download automation
- **Monitoring:** Polls `input/` folder every 15 seconds
- **Archiving:** Auto-backup of all original photos

### Error Handling & Resilience
- **Smart retry logic** with exponential backoff
- **Rate limit handling** with automatic delays
- **Content filter detection** with alternative prompts
- **Quota monitoring** with admin notifications
- **Multi-tier fallbacks** ensure system never stops

## 📺 Web Player Features

- **Fullscreen playback** with aspect ratio preservation
- **Queue management** - new videos get priority
- **Automatic shuffling** when queue completes
- **Screensaver fallback** when no content available
- **Silent operation** (no audio controls)
- **Loading indicators** during video generation
- **Status monitoring** for system health

## ⚡ Performance

- **Target latency:** ≤2 minutes (photo to video)
- **Video quality:** 720p at 24fps with audio (8 seconds)
- **Queue priority:** New videos inject immediately  
- **Fallback time:** <5 seconds to screensaver mode
- **File cleanup:** Automatic temp file management
- **Error recovery:** Multi-tier fallbacks with smart retry
- **API optimization:** Fast models prioritized for real-time performance

## 🛠️ Development

### Project Structure
```
src/
├── server.js              # Main Express server
├── services/
│   ├── googleDriveService.js    # Drive API integration
│   ├── photoAnalysisService.js  # Gemini AI analysis + image enhancement
│   ├── videoGenerationService.js # Veo 3 video generation
│   └── fileWatcherService.js    # File monitoring
└── utils/
    ├── promptTemplates.js       # Halloween prompt library
    ├── errorHandler.js         # Generic error handling
    └── geminiErrorHandler.js   # Specialized Gemini API error handling

public/
├── index.html             # Fullscreen video player
├── css/style.css          # Player styling
└── js/player.js          # Player logic & queue management
```

### Available Scripts
```bash
npm start      # Production server
npm run dev    # Development with auto-reload  
npm run setup  # Initial Google Drive setup
```

### API Endpoints
- `GET /` - Fullscreen video player
- `GET /api/status` - System health check
- `GET /api/videos` - List generated videos  
- `GET /api/video/:fileId` - Stream video content
- `GET /api/screensaver` - List fallback videos

## 🔒 Security & Privacy

- **Service Account:** Limited Drive API access only
- **No external access:** Videos only viewable on local network
- **Automatic archival:** All content preserved in Google Drive
- **API rate limiting:** Built-in retry logic prevents quota issues
- **Error isolation:** Service failures don't crash entire system

## 🎯 Usage Tips

### For Photo Uploads:
- Upload RAW + JPEG for best results to the `input/` folder
- Ensure good lighting (enhances AI analysis)
- Include clear costume details in frame
- Group shots work great with multiple themes
- **Easy access:** Just drag and drop photos into your Google Drive input folder

### For Party Hosts:
- Start system 30 minutes before party
- Add backup screensaver videos beforehand  
- Monitor status at `/api/status` endpoint
- Videos appear within 2 minutes of photo upload

### For System Management:
- Check Google Drive quotas before event
- Monitor system logs during party
- Have fallback screensaver content ready
- Test full pipeline before live deployment
- **Upload convenience:** Use Google Drive web interface or desktop app to manage all folders

## 🐛 Troubleshooting

### Common Issues:
1. **"Google Drive access failed"**
   - **Service Account Issues:**
     - Verify `./credentials/service-account.json` exists and is valid JSON
     - Ensure service account has "Editor" role in Google Cloud
     - Check that Google Drive API is enabled in your project
   - **Folder ID Issues:**
     - Run `npm run setup` to create folder structure and get correct ID
     - **Manually verify:** Go to [Google Drive](https://drive.google.com) and look for your Halloween folder in the **root directory** (not in any subfolder)
     - The folder should contain 4 subfolders: input, output, screensaver, archive
     - Ensure service account has access to the folder
     - **Wrong ID?** The ID should be a long string like `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
   - **Permissions:**
     - Service account email should have access to the Drive folder
     - Check folder sharing settings in Google Drive

2. **"No videos generating"**
   - Check Gemini API key and quota
   - Verify all Gemini models are enabled (vision, image generation, Veo 3)
   - Look for photos in input folder
   - Check for content filter blocks in logs

3. **"Images not enhancing"**
   - Gemini Native Image may not be available in your region
   - System will automatically use original images
   - Check API quotas and model availability

4. **"Player shows loading forever"**  
   - Check network connectivity
   - Verify server is running on port 3000
   - Clear browser cache and refresh

5. **"Only screensaver videos playing"**
   - Check API service health at `/api/status`
   - Verify new photos are in input folder
   - Review server logs for Gemini API errors
   - Check if Veo 3 is available in your region

### System Health
Monitor via `/api/status`:
```json
{
  "status": "running",
  "services": {
    "googleDrive": true,
    "fileWatcher": true
  },
  "timestamp": "2025-10-31T23:59:59.999Z"
}
```

## 📞 Support

- **Setup Issues:** Run `npm run setup` again
- **API Problems:** Check service account permissions
- **Performance:** Monitor system resources during event
- **Customization:** Edit prompt templates in `src/utils/promptTemplates.js`

---

**🎃 Have a spook-tacular Halloween party! 🎃**