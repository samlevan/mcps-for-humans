#!/bin/bash

# Build and sign MCPs for Humans for macOS
# Usage: ./build-mac.sh

set -e  # Exit on error

echo "🔨 Building MCPs for Humans..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: .env file not found. Please create one from .env.example"
    exit 1
fi

# Verify required environment variables
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "❌ Error: Missing required environment variables in .env"
    echo "Please ensure APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID are set"
    exit 1
fi

echo "📦 Step 1: Cleaning and installing dependencies..."
rm -rf dist
npm install

echo "🏗️  Step 2: Building unsigned app..."
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac

echo "✍️  Step 3: Signing app components..."
# Use auto-discovery for signing identity
find "dist/mac/MCPs for Humans.app" -type f -perm +111 -exec codesign --force --options runtime --timestamp --entitlements build/entitlements.mac.plist {} \;

echo "✍️  Step 4: Signing main app bundle..."
# Use auto-discovery for signing identity
codesign --force --options runtime --timestamp --entitlements build/entitlements.mac.plist "dist/mac/MCPs for Humans.app"

echo "💿 Step 5: Creating DMG..."
rm -f dist/*.dmg
# Let electron-builder auto-discover the signing identity
npx electron-builder --mac dmg

echo "📤 Step 6: Notarizing DMG..."
# Find the DMG file (handles both arm64 and universal builds)
DMG_FILE=$(find dist -name "*.dmg" -type f | head -n 1)

if [ -z "$DMG_FILE" ]; then
    echo "❌ Error: No DMG file found in dist/"
    exit 1
fi

echo "   Submitting $DMG_FILE for notarization..."
xcrun notarytool submit "$DMG_FILE" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

echo "📎 Step 7: Stapling notarization..."
xcrun stapler staple "$DMG_FILE"

echo "✨ Build complete! Your notarized DMG is ready:"
echo "   $DMG_FILE"

# Open the dist folder
open dist/