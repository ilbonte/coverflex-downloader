#!/bin/bash

# Build script for Chrome Web Store release
# Creates a zip file with only the necessary extension files

set -e

VERSION=$(node -p "require('./manifest.json').version")
OUTPUT_FILE="coverflex-downloader-v${VERSION}.zip"

echo "Building Coverflex Downloader v${VERSION}..."

# Remove old build if exists
if [ -f "$OUTPUT_FILE" ]; then
  echo "Removing old build: $OUTPUT_FILE"
  rm "$OUTPUT_FILE"
fi

# Create zip with only necessary files
echo "Creating archive..."
zip -r "$OUTPUT_FILE" \
  manifest.json \
  background/ \
  content/ \
  popup/ \
  utils/ \
  icons/ \
  -x "*.test.js" \
  -x "*/__pycache__/*" \
  -x "*.pyc"

# Show file size
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "✓ Build complete: $OUTPUT_FILE ($FILE_SIZE)"

# List contents
echo ""
echo "Archive contents:"
unzip -l "$OUTPUT_FILE"
