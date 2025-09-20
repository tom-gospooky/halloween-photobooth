#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs';

async function setupGoogleDrive() {
  console.log('\n🎃 Halloween AI Photobooth - Automated Setup\n');
  
  try {
    // Check for service account credentials
    const credentialsPath = './credentials/service-account.json';
    if (!fs.existsSync(credentialsPath)) {
      console.log('❌ Google Service Account credentials not found at:', credentialsPath);
      console.log('\nPlease:');
      console.log('1. Download your service account JSON from Google Cloud Console');
      console.log('2. Save it as ./credentials/service-account.json');
      console.log('3. Run this setup again');
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

    // Test Google Drive access
    console.log('🔍 Testing Google Drive access...');
    await drive.files.list({ pageSize: 1 });
    console.log('✅ Google Drive access confirmed');

    // Use default folder name
    const actualFolderName = 'Halloween-Photobooth-2025';
    
    console.log(`🔨 Creating root folder: ${actualFolderName}`);
    const rootFolder = await drive.files.create({
      requestBody: {
        name: actualFolderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    
    const rootFolderId = rootFolder.data.id;
    console.log(`✅ Created root folder with ID: ${rootFolderId}`);
    
    // Update .env file
    let envContent = fs.readFileSync('.env.example', 'utf8');
    envContent = envContent.replace('your_drive_folder_id_here', rootFolderId);
    fs.writeFileSync('.env', envContent);
    console.log('✅ Updated .env file with folder ID');

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

    // Permissions - no additional setup needed since you have full access
    console.log('🔐 Permissions: Using your Google account with full access');

    // Create screensaver info file
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

    // Find screensaver folder and add README
    const screensaverQuery = `name='screensaver' and parents='${rootFolderId}' and mimeType='application/vnd.google-apps.folder'`;
    const screensaverResponse = await drive.files.list({ q: screensaverQuery });
    const screensaverFolderId = screensaverResponse.data.files[0].id;

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
    console.log('\nGoogle Drive folders created:');
    console.log(`📁 Root folder: ${actualFolderName}`);
    console.log(`🆔 Folder ID: ${rootFolderId}`);
    console.log('📸 Input folder: Ready for photo uploads');
    console.log('🎬 Output folder: Will store generated videos');
    console.log('📺 Screensaver folder: Add your fallback videos');
    console.log('📦 Archive folder: Long-term storage');
    
    console.log('\n📋 Next steps:');
    console.log('1. Add your Gemini API key to .env file');
    console.log('2. Upload some fallback videos to the screensaver folder');
    console.log('3. Test the system: npm run test');
    console.log('4. Start the photobooth: npm run dev');
    console.log('\n💡 You can upload photos directly to the input folder in Google Drive!');
    
    console.log(`\n🔗 Access your folders at: https://drive.google.com/drive/folders/${rootFolderId}`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n🔑 API Key Issue:');
      console.log('- Verify your service account JSON is correct');
      console.log('- Check that Google Drive API is enabled in Google Cloud Console');
    } else if (error.message.includes('permission') || error.message.includes('403')) {
      console.log('\n🔐 Permission Issue:');
      console.log('- Ensure your service account has proper roles');
      console.log('- Try giving it "Editor" role in Google Cloud Console');
    } else if (error.message.includes('quota') || error.message.includes('429')) {
      console.log('\n⏰ Quota Issue:');
      console.log('- Google Drive API quota exceeded');
      console.log('- Wait a few minutes and try again');
    } else {
      console.log('\n🔧 General troubleshooting:');
      console.log('- Check your internet connection');
      console.log('- Verify Google Cloud project is active');
      console.log('- Make sure service account JSON is valid');
    }
  }
}

setupGoogleDrive();