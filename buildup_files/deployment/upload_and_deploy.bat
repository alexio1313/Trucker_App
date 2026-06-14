@echo off
echo ========================================
echo  Uploading patches to server
echo ========================================

REM Upload all patch files and source changes to server
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/server_deploy_all.sh' ubuntu@192.168.8.101:/tmp/"
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/seed_demo_data.js' ubuntu@192.168.8.101:/tmp/"
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/patch_all_fixes.js' ubuntu@192.168.8.101:/tmp/"

REM Upload updated source files for rebuild
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/apps/admin/src/app/admin/loads/LoadsContent.tsx' ubuntu@192.168.8.101:/tmp/LoadsContent.tsx"
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/apps/web/src/pages/trucker/JourneyPage.tsx' ubuntu@192.168.8.101:/tmp/JourneyPage.tsx"
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/apps/web/src/pages/trucker/ProfilePage.tsx' ubuntu@192.168.8.101:/tmp/ProfilePage.tsx"
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/apps/web/src/i18n/translations.ts' ubuntu@192.168.8.101:/tmp/translations.ts"
wsl -e bash -c "scp 'f:/AI_BOT/AI Trucker App/services/social-publishing/src/ai/caption.generator.ts' ubuntu@192.168.8.101:/tmp/caption.generator.ts"

echo.
echo Files uploaded. Now copying source files into project and running deployment...
echo.

REM Copy source files into the project on server
wsl -e bash -c "ssh ubuntu@192.168.8.101 'cp /tmp/LoadsContent.tsx ~/truck-platform/apps/admin/src/app/admin/loads/LoadsContent.tsx && cp /tmp/JourneyPage.tsx ~/truck-platform/apps/web/src/pages/trucker/JourneyPage.tsx && cp /tmp/ProfilePage.tsx ~/truck-platform/apps/web/src/pages/trucker/ProfilePage.tsx && cp /tmp/translations.ts ~/truck-platform/apps/web/src/i18n/translations.ts && cp /tmp/caption.generator.ts ~/truck-platform/services/social-publishing/src/ai/caption.generator.ts && echo Source files copied OK'"

REM Run the deployment script
echo.
echo Running deployment script on server...
wsl -e bash -c "ssh ubuntu@192.168.8.101 'bash /tmp/server_deploy_all.sh 2>&1 | tee /tmp/deploy.log'"

echo.
echo ========================================
echo  DONE - Check output above for errors
echo ========================================
pause
