#!/bin/bash
# Sync mobile app and required workspace packages to server
SERVER="root@192.168.8.101"
REMOTE="/root/truck-platform"

echo "=== Syncing mobile app and packages to server ==="

# Create remote directory structure
ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p $REMOTE/apps/mobile $REMOTE/packages"

# Sync mobile app
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='android' \
  --exclude='ios' \
  --exclude='.expo' \
  -e "ssh -o StrictHostKeyChecking=no" \
  "/mnt/f/AI_BOT/AI Trucker App/apps/mobile/" \
  "$SERVER:$REMOTE/apps/mobile/"

# Sync required packages
for pkg in shared api-client state ui-kit; do
  rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    -e "ssh -o StrictHostKeyChecking=no" \
    "/mnt/f/AI_BOT/AI Trucker App/packages/$pkg/" \
    "$SERVER:$REMOTE/packages/$pkg/"
done

# Sync root package.json and tsconfig
scp -o StrictHostKeyChecking=no \
  "/mnt/f/AI_BOT/AI Trucker App/package.json" \
  "/mnt/f/AI_BOT/AI Trucker App/tsconfig.base.json" \
  "$SERVER:$REMOTE/"

echo "=== Sync complete ==="
