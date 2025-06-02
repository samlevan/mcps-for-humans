#!/bin/bash

# Simple build script for MCPs for Humans
# This loads environment variables from .env and runs electron-builder

set -e

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Verify notarization credentials are available
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_ID_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "⚠️  Warning: Notarization credentials not found"
    echo "   Make sure your .env file contains APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID"
fi

# Run the build
echo "🔨 Building MCPs for Humans..."
npm run build:mac

echo "✅ Build complete!"
echo "   Your app is in the dist/ folder"