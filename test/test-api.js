#!/usr/bin/env node

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

console.log('🔑 Testing Gemini API Key...\n');

const apiKey = process.env.GOOGLE_AI_API_KEY;
console.log('API Key loaded:', apiKey ? 'Yes' : 'No');
console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'None');

if (!apiKey) {
  console.log('❌ No API key found in environment variables');
  console.log('Please check your .env file');
  process.exit(1);
}

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  console.log('\n🧪 Testing simple text generation...');
  
  const result = await model.generateContent('Hello, can you respond with just "API working"?');
  const response = result.response.text();
  
  console.log('✅ API Response:', response.trim());
  console.log('✅ Gemini API is working correctly!');
  
} catch (error) {
  console.log('❌ API Test failed:', error.message);
  
  if (error.message.includes('API key not valid')) {
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if your API key is correct');
    console.log('2. Make sure you created it from Google AI Studio');
    console.log('3. Verify the API key has Gemini API access');
    console.log('4. Check if there are any usage restrictions');
  }
}