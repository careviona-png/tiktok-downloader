# 🎬 HƯỚNG DẪN CÀI ĐẶT FFMPEG

Để sử dụng tính năng **Đảo ngang video (Reup)**, bạn cần cài đặt **ffmpeg**.

---

## Windows 🪟

### Cách 1: Dùng Chocolatey (Khuyến nghị - Dễ nhất)

1. **Cài Chocolatey** (nếu chưa có):
   - Mở PowerShell **với quyền Administrator**
   - Chạy lệnh:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Cài ffmpeg**:
   ```powershell
   choco install ffmpeg
   ```

3. **Kiểm tra**:
   ```powershell
   ffmpeg -version
   ```

### Cách 2: Tải thủ công

1. Tải ffmpeg từ: https://www.gyan.dev/ffmpeg/builds/
2. Chọn **ffmpeg-release-essentials.zip**
3. Giải nén vào `C:\ffmpeg`
4. Thêm vào PATH:
   - Mở **System Properties** → **Environment Variables**
   - Edit **Path** → Thêm `C:\ffmpeg\bin`
5. Restart Terminal
6. Kiểm tra: `ffmpeg -version`

---

## ✅ Sau khi cài xong

1. **Restart Terminal/PowerShell**
2. **Chạy backend**:
   ```powershell
   cd backend
   npm run dev
   ```
3. **Test tính năng đảo ngang** trên web!

---

**🎯 Lưu ý:** Nếu chưa cài ffmpeg, tính năng "Đảo Ngang (Reup)" sẽ báo lỗi. Các tính năng khác vẫn hoạt động bình thường!
