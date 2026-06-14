# Deploy Journey Management System
# Run from project root: .\deploy_journey.ps1

$SERVER = "ubuntu@192.168.8.101"
$WSL_PROJ = "/mnt/f/AI_BOT/AI Trucker App"

Write-Host "`n=== Journey Management Deploy ===" -ForegroundColor Cyan
Write-Host "Server: $SERVER" -ForegroundColor Gray

# ──────────────────────────────────────────────
# 1. Copy frontend source files to server
# ──────────────────────────────────────────────
Write-Host "`n[1/4] Copying frontend source files to server..." -ForegroundColor Yellow

# Find the project dir on the server
$REMOTE_DIR = wsl bash -c "ssh ubuntu@192.168.8.101 'find /home /root -name docker-compose.yml -maxdepth 4 2>/dev/null | head -1 | xargs dirname'"
if (-not $REMOTE_DIR) { $REMOTE_DIR = "/home/ubuntu/truck-platform" }
Write-Host "    Remote project dir: $REMOTE_DIR" -ForegroundColor Gray

$FILES = @(
    @{ local = "apps/web/src/pages/trucker/JourneyPage.tsx"; remote = "apps/web/src/pages/trucker/JourneyPage.tsx" },
    @{ local = "apps/web/src/App.tsx";                        remote = "apps/web/src/App.tsx" },
    @{ local = "apps/web/src/components/Layout.tsx";          remote = "apps/web/src/components/Layout.tsx" },
    @{ local = "apps/web/src/pages/trucker/DashboardPage.tsx";remote = "apps/web/src/pages/trucker/DashboardPage.tsx" },
    @{ local = "apps/web/src/i18n/translations.ts";           remote = "apps/web/src/i18n/translations.ts" },
    @{ local = "apps/web/src/i18n/useI18n.ts";                remote = "apps/web/src/i18n/useI18n.ts" },
    @{ local = "apps/web/src/i18n/I18nProvider.tsx";          remote = "apps/web/src/i18n/I18nProvider.tsx" },
    @{ local = "apps/web/src/components/LanguageSelector.tsx"; remote = "apps/web/src/components/LanguageSelector.tsx" }
)

foreach ($f in $FILES) {
    $localPath  = "/mnt/f/AI_BOT/AI Trucker App/$($f.local)"
    $remotePath = "$REMOTE_DIR/$($f.remote)"
    $remoteDir  = $remotePath -replace '/[^/]+$',''
    Write-Host "    $($f.local)" -ForegroundColor Gray
    wsl bash -c "ssh $SERVER 'mkdir -p $remoteDir' && scp '$localPath' '${SERVER}:$remotePath'"
    if ($LASTEXITCODE -ne 0) { Write-Host "    ERROR copying $($f.local)" -ForegroundColor Red }
}

# ──────────────────────────────────────────────
# 2. Rebuild web container on server
# ──────────────────────────────────────────────
Write-Host "`n[2/4] Rebuilding truck_web container (takes 2-3 min)..." -ForegroundColor Yellow
wsl ssh $SERVER "cd $REMOTE_DIR && docker compose build --no-cache web && docker compose up -d web"
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Build failed — trying without --no-cache" -ForegroundColor Red
    wsl ssh $SERVER "cd $REMOTE_DIR && docker compose build web && docker compose up -d web"
}
Write-Host "    Web container rebuilt and restarted" -ForegroundColor Green

# ──────────────────────────────────────────────
# 3. Deploy backend journey patch
# ──────────────────────────────────────────────
Write-Host "`n[3/4] Deploying backend journey endpoints..." -ForegroundColor Yellow

# Copy patch to server
wsl bash -c "scp '/mnt/f/AI_BOT/AI Trucker App/patch_journey_backend.js' '${SERVER}:/tmp/'"

# Patch load service (active load lock)
Write-Host "    Patching load service..." -ForegroundColor Gray
wsl ssh $SERVER @"
docker cp /tmp/patch_journey_backend.js truck_load_service:/tmp/ &&
docker exec truck_load_service node /tmp/patch_journey_backend.js load &&
docker restart truck_load_service
"@
if ($LASTEXITCODE -eq 0) { Write-Host "    Load service patched OK" -ForegroundColor Green }
else { Write-Host "    Load service patch failed" -ForegroundColor Red }

# Patch trucker service (journey endpoints)
Write-Host "    Patching trucker service..." -ForegroundColor Gray
wsl ssh $SERVER @"
docker cp /tmp/patch_journey_backend.js truck_trucker_service:/tmp/ &&
docker exec truck_trucker_service node /tmp/patch_journey_backend.js trucker &&
docker restart truck_trucker_service
"@
if ($LASTEXITCODE -eq 0) { Write-Host "    Trucker service patched OK" -ForegroundColor Green }
else { Write-Host "    Trucker service patch failed" -ForegroundColor Red }

# ──────────────────────────────────────────────
# 4. Verify
# ──────────────────────────────────────────────
Write-Host "`n[4/4] Verifying..." -ForegroundColor Yellow

Start-Sleep -Seconds 5

$status = wsl ssh $SERVER "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'truck_web|truck_trucker|truck_load'"
Write-Host $status

Write-Host "`n=== Deploy Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Web Portal:     http://192.168.8.101:3010" -ForegroundColor Cyan
Write-Host "New endpoints:"
Write-Host "  GET  /api/v1/truckers/my/active-load"      -ForegroundColor White
Write-Host "  POST /api/v1/truckers/my/journey/start"    -ForegroundColor White
Write-Host "  POST /api/v1/truckers/my/journey/fuel-stop"-ForegroundColor White
Write-Host "  POST /api/v1/truckers/my/journey/deliver"  -ForegroundColor White
Write-Host "  GET  /api/v1/truckers/my/journey/stats"    -ForegroundColor White
Write-Host ""
Write-Host "Trucker flow:"
Write-Host "  1. Find load → Accept (blocked if already has active load)"
Write-Host "  2. Dashboard shows active load banner with 'View Journey' button"
Write-Host "  3. Journey page: map, toll/fuel estimates, fuel stop logging"
Write-Host "  4. Start Journey → status changes to in_transit, km tracking begins"
Write-Host "  5. Log fuel stops during trip"
Write-Host "  6. Mark Delivered → journey completed, stats updated"
Write-Host ""
Write-Host "Language selector: bottom of sidebar (trucker portal only)" -ForegroundColor Yellow
Write-Host "Languages: English, हिन्दी, ਪੰਜਾਬੀ, ગુજરાતી, मराठी, தமிழ், తెలుగు, ಕನ್ನಡ, বাংলা" -ForegroundColor Yellow
