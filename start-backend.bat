@echo off
echo Starting Truck Queue Backend...
cd /d "%~dp0"
pm2 start src/server.js --name truck-queue-backend
pm2 save
exit
