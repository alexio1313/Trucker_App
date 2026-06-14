# deploy.ps1 — Push all web/admin changes to server and rebuild containers
# Usage: .\deploy.ps1 [server-ip] [ssh-user]
# Example: .\deploy.ps1 192.168.8.101 ubuntu

param(
    [string]$Server   = "192.168.8.101",
    [string]$SSHUser  = "ubuntu",
    [string]$RemoteDir = "~/truck-platform"
)

$ErrorActionPreference = "Stop"
$SSHTarget  = "${SSHUser}@${Server}"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TruckPlatform Web Deployment" -ForegroundColor Cyan
Write-Host "  Server: $SSHTarget" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Sync web app source ───────────────────────────────
Write-Host "Step 1/5  Syncing web app source..." -ForegroundColor Yellow

# Sync entire apps/web/src (trucker pages, App.tsx, Layout.tsx, LoginPage.tsx)
scp -r "$ProjectDir\apps\web\src" "${SSHTarget}:${RemoteDir}/apps/web/"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP failed for apps/web/src"; exit 1 }

Write-Host "         web/src synced" -ForegroundColor Green

# ── Step 2: Sync admin source ─────────────────────────────────
Write-Host "Step 2/5  Syncing admin source..." -ForegroundColor Yellow

scp -r "$ProjectDir\apps\admin\src" "${SSHTarget}:${RemoteDir}/apps/admin/"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP failed for apps/admin/src"; exit 1 }

Write-Host "         admin/src synced" -ForegroundColor Green

# ── Step 3: Sync simulation routes patch ─────────────────────
Write-Host "Step 3/5  Syncing simulation routes patch..." -ForegroundColor Yellow

scp "$ProjectDir\simulation_routes_patch.js" "${SSHTarget}:${RemoteDir}/"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP failed for simulation_routes_patch.js"; exit 1 }

Write-Host "         simulation_routes_patch.js synced" -ForegroundColor Green

# ── Step 4: Rebuild web + admin Docker containers ─────────────
Write-Host "Step 4/5  Rebuilding Docker containers on server..." -ForegroundColor Yellow
Write-Host "         (this takes 2-4 minutes)" -ForegroundColor Gray

$buildCmd = @"
set -e
cd $RemoteDir

echo '[1/3] Stopping web and admin containers...'
docker-compose stop web admin_panel 2>/dev/null || true

echo '[2/3] Rebuilding web container (Vite build)...'
docker-compose build --no-cache web
docker-compose up -d web

echo '[3/3] Rebuilding admin container (Next.js build)...'
docker-compose build --no-cache admin_panel
docker-compose up -d admin_panel

echo 'Containers rebuilt and started.'
docker-compose ps web admin_panel
"@

ssh $SSHTarget $buildCmd
if ($LASTEXITCODE -ne 0) { Write-Error "Docker rebuild failed"; exit 1 }

Write-Host "         Containers rebuilt" -ForegroundColor Green

# ── Step 5: Deploy simulation routes to trucker service ───────
Write-Host "Step 5/5  Deploying simulation routes to trucker service..." -ForegroundColor Yellow

$simCmd = @"
set -e
CONTAINER=truck_trucker_service

# Copy simulation routes into the container
docker cp $RemoteDir/simulation_routes_patch.js \${CONTAINER}:/app/dist/simulation.routes.js
echo 'File copied to container'

# Register simulation routes in app.js if not already registered
if docker exec \${CONTAINER} grep -q 'simulation.routes' /app/dist/app.js 2>/dev/null; then
  echo 'Simulation route already registered in app.js'
else
  echo 'Patching app.js...'
  docker exec \${CONTAINER} sh -c "
    # Try arrow-function form first
    sed -i 's|app\.use((_req, res)|app.use(\"/api/v1/simulation\", require(\"./simulation.routes\"));\napp.use((_req, res)|' /app/dist/app.js
    # Try regular function form
    if ! grep -q simulation.routes /app/dist/app.js; then
      sed -i 's|app\.use(function(_req|app.use(\"/api/v1/simulation\", require(\"./simulation.routes\"));\napp.use(function(_req|' /app/dist/app.js
    fi
  "
  echo 'app.js patched'
fi

echo 'Restarting trucker service...'
docker restart \${CONTAINER}
sleep 4

# Verify simulation endpoint
STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/api/v1/simulation/status 2>/dev/null)
echo "Simulation endpoint status: HTTP \${STATUS}"
"@

ssh $SSHTarget $simCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: simulation routes deployment had issues — check manually" -ForegroundColor Yellow
} else {
    Write-Host "         Simulation routes deployed" -ForegroundColor Green
}

# ── Health check ──────────────────────────────────────────────
Write-Host ""
Write-Host "Verifying deployments..." -ForegroundColor Yellow

$healthCmd = @"
echo ""
echo "=== Health Checks ==="
WEB=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3010 2>/dev/null)
ADMIN=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3011/admin 2>/dev/null)
SIM=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/api/v1/simulation/status 2>/dev/null)

echo "Web portal      http://$Server:3010         HTTP \$WEB"
echo "Admin panel     http://$Server:3011/admin   HTTP \$ADMIN"
echo "Simulation API  :3002/simulation/status     HTTP \$SIM"
echo ""
"@

ssh $SSHTarget $healthCmd

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Web portal:   http://$Server:3010" -ForegroundColor White
Write-Host "  Admin panel:  http://$Server:3011/admin" -ForegroundColor White
Write-Host "  Simulation:   http://$Server:3011/admin/simulation" -ForegroundColor White
Write-Host ""
Write-Host "  Trucker login (web):  +919860001001 / Admin@123" -ForegroundColor Gray
Write-Host "  Merchant login:       +919880001001 / TruckQA@2024" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
