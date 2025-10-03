#!/bin/bash

# Settings API Integration Test
# Tests all settings API endpoints

BASE_URL="http://localhost:3000/api"

echo "🧪 Testing Settings API Endpoints"
echo "======================================"
echo ""

# Check if server is running
echo "📋 Test 0: Check server status"
if curl -s -f "$BASE_URL/status" > /dev/null; then
  echo "✅ Server is running"
else
  echo "❌ Server is not running. Start with: npm run dev"
  exit 1
fi
echo ""

# Test 1: Get current settings
echo "📋 Test 1: GET /api/settings"
RESPONSE=$(curl -s "$BASE_URL/settings")
if echo "$RESPONSE" | jq -e '.videoModel' > /dev/null 2>&1; then
  echo "✅ Settings retrieved successfully"
  echo "   Current model: $(echo $RESPONSE | jq -r '.videoModel')"
else
  echo "❌ Failed to retrieve settings"
  exit 1
fi
echo ""

# Test 2: Get settings schema
echo "📋 Test 2: GET /api/settings/schema"
SCHEMA=$(curl -s "$BASE_URL/settings/schema")
if echo "$SCHEMA" | jq -e '.videoModel' > /dev/null 2>&1; then
  echo "✅ Schema retrieved successfully"
  PARAM_COUNT=$(echo "$SCHEMA" | jq '[.videoModel, .seedream, ."wan-2.2-turbo", ."wan-2.5-preview", ."kling-v2.5-turbo"] | length')
  echo "   Schema sections: $PARAM_COUNT"
else
  echo "❌ Failed to retrieve schema"
  exit 1
fi
echo ""

# Test 3: Update video model
echo "📋 Test 3: POST /api/settings/video-model"
RESPONSE=$(curl -s -X POST "$BASE_URL/settings/video-model" \
  -H "Content-Type: application/json" \
  -d '{"model": "wan-2.5-preview"}')
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ Video model updated successfully"
  echo "   New model: $(echo $RESPONSE | jq -r '.currentModel')"
else
  echo "❌ Failed to update video model"
  exit 1
fi
echo ""

# Test 4: Update model-specific settings
echo "📋 Test 4: POST /api/settings/wan-2.5-preview"
RESPONSE=$(curl -s -X POST "$BASE_URL/settings/wan-2.5-preview" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "1080p",
    "duration": "10",
    "negativePrompt": "test prompt"
  }')
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ WAN 2.5 settings updated successfully"
  echo "   Resolution: $(echo $RESPONSE | jq -r '.settings.resolution')"
  echo "   Duration: $(echo $RESPONSE | jq -r '.settings.duration')"
else
  echo "❌ Failed to update WAN 2.5 settings"
  exit 1
fi
echo ""

# Test 5: Update Seedream settings
echo "📋 Test 5: POST /api/settings/seedream"
RESPONSE=$(curl -s -X POST "$BASE_URL/settings/seedream" \
  -H "Content-Type: application/json" \
  -d '{
    "numImages": 2,
    "imageSize": "1024x1024",
    "seed": 999
  }')
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ Seedream settings updated successfully"
  echo "   Num Images: $(echo $RESPONSE | jq -r '.settings.numImages')"
  echo "   Image Size: $(echo $RESPONSE | jq -r '.settings.imageSize')"
  echo "   Seed: $(echo $RESPONSE | jq -r '.settings.seed')"
else
  echo "❌ Failed to update Seedream settings"
  exit 1
fi
echo ""

# Test 6: Update all settings at once
echo "📋 Test 6: POST /api/settings (update all)"
RESPONSE=$(curl -s -X POST "$BASE_URL/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "videoModel": "wan-2.2-turbo",
    "wan-2.2-turbo": {
      "resolution": "720p",
      "aspectRatio": "16:9",
      "numFrames": 100
    }
  }')
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ All settings updated successfully"
  NEW_MODEL=$(echo $RESPONSE | jq -r '.settings.videoModel')
  echo "   Video model: $NEW_MODEL"
  echo "   WAN 2.2 numFrames: $(echo $RESPONSE | jq -r '.settings."wan-2.2-turbo".numFrames')"
else
  echo "❌ Failed to update all settings"
  exit 1
fi
echo ""

# Test 7: Validation - invalid settings
echo "📋 Test 7: Validation test (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "videoModel": "invalid-model",
    "wan-2.2-turbo": {
      "numFrames": 999
    }
  }')
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "✅ Validation correctly rejected invalid settings"
  ERROR_COUNT=$(echo $RESPONSE | jq '.validationErrors | length')
  echo "   Validation errors: $ERROR_COUNT"
else
  echo "❌ Validation did not reject invalid settings"
  exit 1
fi
echo ""

# Test 8: Verify persistence
echo "📋 Test 8: Verify settings persistence"
BEFORE=$(curl -s "$BASE_URL/settings" | jq -r '.videoModel')
echo "   Model before: $BEFORE"

# Check settings.json file
if [ -f "./settings.json" ]; then
  FILE_MODEL=$(jq -r '.videoModel' ./settings.json)
  if [ "$FILE_MODEL" == "$BEFORE" ]; then
    echo "✅ Settings persisted to file correctly"
    echo "   File matches API: $FILE_MODEL"
  else
    echo "⚠️  File model ($FILE_MODEL) differs from API ($BEFORE)"
  fi
else
  echo "❌ settings.json file not found"
  exit 1
fi
echo ""

# Summary
echo "======================================"
echo "✨ All API endpoint tests passed!"
echo ""
echo "📚 For full documentation, see:"
echo "   docs/SETTINGS_API.md"
echo ""
