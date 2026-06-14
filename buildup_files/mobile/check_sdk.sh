#!/bin/bash
export ANDROID_HOME=/root/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

echo "Android SDK dir:"
ls $ANDROID_HOME/ 2>/dev/null

echo ""
echo "cmdline-tools:"
ls $ANDROID_HOME/cmdline-tools/ 2>/dev/null

echo ""
echo "sdkmanager version:"
sdkmanager --version 2>&1 | head -2

echo ""
echo "Installed SDK components:"
sdkmanager --list_installed 2>/dev/null | head -20
