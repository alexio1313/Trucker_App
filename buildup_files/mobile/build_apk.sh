#!/bin/bash
set -e
echo "=== Building Android APK for TruckPlatform ==="

# Set up environment
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/root/android-sdk
export ANDROID_SDK_ROOT=/root/android-sdk
export PATH=$PATH:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0
export EXPO_PUBLIC_API_URL="http://192.168.8.101:3000/api/v1"

# Verify tools
echo "Java: $(java -version 2>&1 | head -1)"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"

# Build directory - use the full platform directory
BUILD_DIR=/root/truck-platform
echo "Working in: $BUILD_DIR"

cd $BUILD_DIR

echo "=== Installing top-level workspace dependencies ==="
npm install --legacy-peer-deps 2>&1 | tail -5

echo "=== Compiling packages ==="
cd $BUILD_DIR/packages/shared && npx tsc 2>&1 | tail -5
cd $BUILD_DIR/packages/api-client && npx tsc 2>&1 | tail -5
cd $BUILD_DIR/packages/state && npx tsc 2>&1 | tail -5
cd $BUILD_DIR/packages/ui-kit && npx tsc 2>&1 | tail -5 || echo "ui-kit type errors ignored"

echo "=== Running Expo Prebuild ==="
cd $BUILD_DIR/apps/mobile
export EXPO_NO_GIT_STATUS=1
npx expo prebuild --platform android --no-install --clean 2>&1

echo "=== Building Debug APK ==="
cd $BUILD_DIR/apps/mobile/android
chmod +x gradlew
./gradlew assembleDebug --no-daemon --stacktrace 2>&1 | tail -80

echo ""
echo "=== APK Build Complete ==="
find "$BUILD_DIR/apps/mobile/android" -name "*.apk" 2>/dev/null | while IFS= read -r f; do
  echo "APK: $f ($(du -sh "$f" | cut -f1))"
done
