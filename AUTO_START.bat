@echo off
chcp 65001 >nul
title TikDown - Auto Start
color 0A

echo ========================================
echo     TIKDOWN - AUTO START
echo ========================================
echo.

:: Check Node.js
echo [1/4] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ NODE.JS CHUA DUOC CAI DAT!
    echo.
    echo Vui long lam theo huong dan:
    echo 1. Mo trinh duyet va truy cap: https://nodejs.org
    echo 2. Tai ban LTS (ben trai)
    echo 3. Cai dat Node.js
    echo 4. Khoi dong lai may tinh
    echo 5. Chay lai file nay
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js da co san
node --version
echo.

:: Move to backend folder
cd /d "%~dp0backend"

:: Install dependencies if needed
echo [2/4] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies for the first time...
    echo This may take 1-2 minutes...
    call npm install --silent
    if %errorlevel% neq 0 (
        echo.
        echo ❌ Loi khi cai dat dependencies!
        echo Kiem tra ket noi internet va thu lai.
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed
) else (
    echo ✅ Dependencies already installed
)
echo.

:: Start backend server
echo [3/4] Starting backend server...
echo.
echo ========================================
echo     SERVER DANG CHAY
echo ========================================
echo.
echo 🚀 Backend: http://localhost:3000
echo 🌐 Frontend: file:///c:/Users/khanhlee/OneDrive/Desktop/dự án new/index.html
echo.
echo ⚠️  DUNG TAT CUA SO NAY!
echo     Press Ctrl+C de dung server
echo.
echo ========================================
echo.

:: Start Node.js server
node server.js

:: If server stops
echo.
echo Server stopped.
pause
