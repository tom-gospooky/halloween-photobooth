#!/usr/bin/env node

import fs from 'fs';

async function manualSetup() {
  console.log('\n🎃 Halloween AI Photobooth - Manual Setup Guide\n');
  
  console.log('Due to Google Drive limitations with Service Accounts, please follow these steps:\n');
  
  console.log('📋 STEP 1: Create folders in YOUR Google Drive');
  console.log('1. Go to https://drive.google.com');
  console.log('2. Create a new folder called "Halloween-Photobooth-2025"');
  console.log('3. Inside that folder, create 4 subfolders:');
  console.log('   - input');
  console.log('   - output');  
  console.log('   - screensaver');
  console.log('   - archive');
  
  console.log('\n📋 STEP 2: Share with Service Account');
  
  // Get service account email
  try {
    const credentialsPath = './credentials/service-account.json';
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      const serviceAccountEmail = credentials.client_email;
      
      console.log('1. Right-click on "Halloween-Photobooth-2025" folder');
      console.log('2. Select "Share"');
      console.log('3. Add this service account email as Editor:');
      console.log(`   📧 ${serviceAccountEmail}`);
      console.log('4. Make sure role is set to "Editor"');
      console.log('5. Click "Share"');
    } else {
      console.log('⚠️  Service account file not found - you\'ll need to get the email from your JSON file');
      console.log('1. Look for "client_email" in ./credentials/service-account.json');
      console.log('2. Share the folder with that email address as Editor');
    }
  } catch (error) {
    console.log('⚠️  Could not read service account file');
    console.log('1. Check your ./credentials/service-account.json file');
    console.log('2. Look for "client_email" field');
    console.log('3. Share the Halloween folder with that email as Editor');
  }
  
  console.log('\n📋 STEP 3: Get Folder ID');
  console.log('1. Open the "Halloween-Photobooth-2025" folder in Google Drive');
  console.log('2. Look at the URL in your browser');
  console.log('3. Copy the folder ID from the URL (the long string after /folders/)');
  console.log('   Example: https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  console.log('   The ID is: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  
  console.log('\n📋 STEP 4: Update .env file');
  console.log('1. Edit your .env file');
  console.log('2. Replace "your_drive_folder_id_here" with the actual folder ID');
  console.log('3. Add your Gemini API key');
  
  console.log('\n📋 STEP 5: Test the setup');
  console.log('Run: npm run test');
  
  console.log('\n🎬 OPTIONAL: Add screensaver videos');
  console.log('Upload some Halloween videos to the "screensaver" folder for fallback content.');
  
  console.log('\n✅ Once complete, start with: npm run dev');
  
  console.log('\n💡 Why this approach?');
  console.log('Service Accounts don\'t have their own Google Drive storage.');
  console.log('By creating folders in your personal Drive and sharing them,');
  console.log('the service account can access them for the automation.');
}

manualSetup();