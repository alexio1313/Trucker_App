@echo off
echo ========================================
echo  Deploy: Phone Mode + Route Fix
echo ========================================
echo.

REM Upload updated JourneyPage.tsx to server
echo [1/4] Uploading JourneyPage.tsx...
wsl -e bash -c "scp 'f:/AI_BOT/Trucker_App/apps/web/src/pages/trucker/JourneyPage.tsx' ubuntu@192.168.8.101:/tmp/JourneyPage.tsx"
if %ERRORLEVEL% NEQ 0 (echo ERROR: Upload failed. Check SSH connection to 192.168.8.101 & pause & exit /b 1)

REM Upload backend route fix
echo [2/4] Uploading truckers_extra.routes.js...
wsl -e bash -c "scp 'f:/AI_BOT/Trucker_App/buildup_files/hotfix/truckers_extra.routes.js' ubuntu@192.168.8.101:/tmp/truckers_extra.routes.js"

REM Copy source file into project and rebuild web container
echo [3/4] Copying source + rebuilding web app (takes ~5 min)...
wsl -e bash -c "ssh ubuntu@192.168.8.101 'cp /tmp/JourneyPage.tsx ~/truck-platform/apps/web/src/pages/trucker/JourneyPage.tsx && echo Source copied OK'"
wsl -e bash -c "ssh ubuntu@192.168.8.101 'cd ~/truck-platform && docker compose build truck_web 2>&1 | tail -15 && docker compose up -d truck_web --no-deps && echo Web container rebuilt OK'"

REM Deploy backend hotfix (docker cp + restart)
echo [4/4] Deploying backend route fix...
wsl -e bash -c "ssh ubuntu@192.168.8.101 'docker cp /tmp/truckers_extra.routes.js truck_trucker_service:/app/truckers_extra.routes.js && docker restart truck_trucker_service && sleep 3 && echo Backend restarted OK'"

echo.
echo ========================================
echo  DONE!
echo  Open: http://192.168.8.101:3010
echo  Login as trucker, go to My Journey
echo  You will see the [Phone Mode] button
echo ========================================
pause
