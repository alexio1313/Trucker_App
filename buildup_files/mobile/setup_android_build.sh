#!/bin/bash
set -e
echo "=== Setting up Android Build Environment ==="

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Java 17
echo "Installing Java 17..."
sudo apt-get install -y openjdk-17-jdk

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64" >> ~/.bashrc
echo "export PATH=\$PATH:\$JAVA_HOME/bin" >> ~/.bashrc

# Download Android SDK command-line tools
echo "Downloading Android SDK command-line tools..."
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
unzip -q cmdline-tools.zip
mv cmdline-tools latest
rm cmdline-tools.zip

# Set Android environment variables
export ANDROID_HOME=~/android-sdk
export ANDROID_SDK_ROOT=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

echo "export ANDROID_HOME=\$HOME/android-sdk" >> ~/.bashrc
echo "export ANDROID_SDK_ROOT=\$HOME/android-sdk" >> ~/.bashrc
echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools" >> ~/.bashrc

# Accept licenses
echo "Accepting Android SDK licenses..."
yes | sdkmanager --licenses 2>/dev/null || true

# Install required Android SDK components
echo "Installing Android SDK components..."
sdkmanager --install "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125"

echo "=== Android build environment ready ==="
java -version
node --version
npm --version
sdkmanager --list_installed 2>/dev/null | grep -E "platform-tools|build-tools|platforms;android"
