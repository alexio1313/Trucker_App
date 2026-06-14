#!/bin/bash
set -e
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/root/android-sdk
export ANDROID_SDK_ROOT=/root/android-sdk

echo "=== Completing Android SDK setup ==="

# Check if zip exists or needs to be downloaded
cd $ANDROID_HOME/cmdline-tools
if [ -f "cmdline-tools.zip" ]; then
  echo "Zip exists, extracting..."
  unzip -q cmdline-tools.zip
  mv cmdline-tools latest
  rm -f cmdline-tools.zip
elif [ -d "latest" ]; then
  echo "Already extracted"
else
  echo "Downloading cmdline-tools..."
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
  unzip -q cmdline-tools.zip
  mv cmdline-tools latest
  rm cmdline-tools.zip
fi

export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

echo "sdkmanager version: $(sdkmanager --version 2>&1 | head -1)"

echo ""
echo "=== Accepting licenses ==="
yes | sdkmanager --licenses 2>/dev/null | tail -5

echo ""
echo "=== Installing Android SDK components ==="
sdkmanager --install "platform-tools" "platforms;android-34" "build-tools;34.0.0"
echo "Core SDK installed"

echo ""
echo "=== Installed components ==="
sdkmanager --list_installed 2>/dev/null | grep -v "^$" | head -20

echo ""
echo "=== Setup complete ==="
java -version 2>&1 | head -1
node --version
echo "ANDROID_HOME: $ANDROID_HOME"
