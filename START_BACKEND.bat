@echo off
chcp 65001 >nul
echo ====================================
echo    TikTok Downloader - Backend
echo ====================================
echo.

cd /d "%~dp0backend"

echo [Bước 1/3] Kiểm tra Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ CHUA CAI NODE.JS!
    echo.
    echo Vui long tai va cai Node.js tu: https://nodejs.org/
    echo Chon ban LTS va cai dat xong khoi dong lai may tinh.
    pause
    exit /b
)
echo ✅ Node.js đã cài đặt
echo.

echo [Bước 2/3] Cài đặt dependencies...
if not exist "node_modules" (
    echo Đang cài đặt lần đầu, vui lòng đợi...
    call npm install
    if errorlevel 1 (
        echo ❌ Lỗi khi cài đặt! Kiểm tra kết nối mạng.
        pause
        exit /b
    )
) else (
    echo ✅ Dependencies đã có sẵn
)
echo.

echo [Bước 3/3] Khởi động server...
echo.
echo ====================================
echo    SERVER ĐANG CHẠY
echo ====================================
echo.
echo 🚀 Backend: http://localhost:3000
echo 🌐 Frontend: Mở file index.html bằng Live Server
echo.
echo ⚠️  ĐỪNG TẮT CỬA SỔ NÀY!
echo    (Nhấn Ctrl+C để dừng server)
echo.
echo ====================================
echo.

node server.js

pause
