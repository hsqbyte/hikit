#!/bin/bash
# HiKit Build Script
# Builds the app and bundles go-music-dl into the .app

set -e

echo "🔨 Building HiKit..."
wails build

APP_BUNDLE="build/bin/HiKit.app"
if [ ! -d "$APP_BUNDLE" ]; then
    # Try lowercase
    APP_BUNDLE="build/bin/hikit.app"
fi

if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ App bundle not found in build/bin/"
    exit 1
fi

MACOS_DIR="$APP_BUNDLE/Contents/MacOS"

# Bundle go-music-dl
MUSIC_DL="$HOME/go/bin/go-music-dl"
if [ -f "$MUSIC_DL" ]; then
    echo "📦 Bundling go-music-dl into app..."
    cp "$MUSIC_DL" "$MACOS_DIR/go-music-dl"
    chmod +x "$MACOS_DIR/go-music-dl"
    echo "✅ go-music-dl bundled successfully"
else
    echo "⚠️  go-music-dl not found at $MUSIC_DL, skipping bundle"
fi

echo ""
echo "📊 App bundle contents:"
ls -lh "$MACOS_DIR/"
echo ""
echo "✅ Build complete: $APP_BUNDLE"
