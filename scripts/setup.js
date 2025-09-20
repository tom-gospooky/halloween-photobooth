#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupGoogleDrive() {
  console.log('\n🎃 Halloween AI Photobooth Setup\n');
  console.log('This script will help you set up the Google Drive integration.\n');
  
  try {
    // Check for service account credentials
    const credentialsPath = './credentials/service-account.json';
    if (!fs.existsSync(credentialsPath)) {
      console.log('❌ Google Service Account credentials not found.');
      console.log('Please follow these steps:');
      console.log('1. Go to https://console.cloud.google.com/');
      console.log('2. Create a new project or select existing one');
      console.log('3. Enable Google Drive API');
      console.log('4. Create a Service Account');
      console.log('5. Download the JSON key file');
      console.log(`6. Save it as: ${credentialsPath}`);
      console.log('\nRun this setup script again once you have the credentials file.\n');
      return;
    }

    console.log('✅ Found service account credentials');

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Check if we can access Drive
    console.log('🔍 Testing Google Drive access...');
    await drive.files.list({ pageSize: 1 });
    console.log('✅ Google Drive access confirmed');

    // Get or create root folder
    let rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!rootFolderId) {
      const folderName = await askQuestion('📁 Enter the name for the root Halloween folder (default: Halloween-Photobooth-2025): ');
      const actualFolderName = folderName.trim() || 'Halloween-Photobooth-2025';
      
      console.log(`🔨 Creating root folder: ${actualFolderName}`);
      const rootFolder = await drive.files.create({
        requestBody: {
          name: actualFolderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      
      rootFolderId = rootFolder.data.id;
      console.log(`✅ Created root folder with ID: ${rootFolderId}`);
      
      // Update .env file
      let envContent = fs.readFileSync('.env.example', 'utf8');
      envContent = envContent.replace('your_drive_folder_id_here', rootFolderId);
      fs.writeFileSync('.env', envContent);
      console.log('✅ Updated .env file with folder ID');
    }

    // Create subfolders
    const subfolders = ['input', 'output', 'screensaver', 'archive'];
    console.log('📁 Creating subfolders...');
    
    for (const folderName of subfolders) {
      const folder = await drive.files.create({
        requestBody: {
          name: folderName,
          parents: [rootFolderId],
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      
      console.log(`✅ Created ${folderName} folder: ${folder.data.id}`);
    }

    // Skip photographer permissions setup since you have full access
    console.log('🔐 Permissions: Using your Google account with full access (no additional permissions needed)');

    // Create some sample screensaver files
    console.log('🎬 Setting up screensaver folder...');
    
    const screensaverInfo = `# Halloween Screensaver Videos

Add your spooky fallback videos to this folder!

Supported formats:
- MP4 (recommended)
- MOV
- AVI

These videos will play when:
- No new photos are being processed
- API services are temporarily unavailable
- During system startup

For best results:
- Use 16:9 aspect ratio
- Keep videos between 10-30 seconds
- Ensure videos can loop seamlessly
`;

    const screensaverQuery = `name='screensaver' and parents='${rootFolderId}' and mimeType='application/vnd.google-apps.folder'`;
    const screensaverResponse = await drive.files.list({ q: screensaverQuery });
    const screensaverFolderId = screensaverResponse.data.files[0].id;

    // Upload readme file to screensaver folder
    await drive.files.create({
      requestBody: {
        name: 'README.txt',
        parents: [screensaverFolderId]
      },
      media: {
        mimeType: 'text/plain',
        body: screensaverInfo
      }
    });

    console.log('\n🎉 Setup Complete!');
    console.log('\nNext steps:');
    console.log('1. Add your Gemini API key to .env file');
    console.log('2. Upload some fallback videos to the screensaver folder');
    console.log('3. Test the system with: npm run test');
    console.log('4. Start the photobooth with: npm run dev');
    console.log('\nGoogle Drive folders created:');
    console.log(`📁 Root folder ID: ${rootFolderId}`);
    console.log('📸 Input folder: Ready for photo uploads');
    console.log('🎬 Output folder: Will store generated videos');
    console.log('📺 Screensaver folder: Add your fallback videos');
    console.log('📦 Archive folder: Long-term storage');
    console.log('\n💡 Since you have full access, you can upload photos directly to any folder!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\nPlease check:');
    console.log('- Service account credentials are valid');
    console.log('- Google Drive API is enabled');
    console.log('- Service account has necessary permissions');
  } finally {
    rl.close();
  }
}

// Check if .env exists, if not copy from example
if (!fs.existsSync('.env')) {
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ Created .env file from example');
  }
}

// Create credentials directory
if (!fs.existsSync('./credentials')) {
  fs.mkdirSync('./credentials');
}

// Create temp directory
if (!fs.existsSync('./temp')) {
  fs.mkdirSync('./temp');
}

setupGoogleDrive();