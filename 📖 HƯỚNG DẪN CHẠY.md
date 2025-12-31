# 🚀 HƯỚNG DẪN CHẠY BACKEND - SIÊU ĐƠN GIẢN

## Cách 1: DOUBLE-CLICK FILE (ĐƠN GIẢN NHẤT) ⭐⭐⭐

### Bước 1: Tìm file này
```
C:\Users\khanhlee\OneDrive\Desktop\dự án new\AUTO_START.bat
```

### Bước 2: DOUBLE-CLICK vào file đó

### Bước 3: Chờ
- Cửa sổ đen (terminal) sẽ xuất hiện
- Nếu lần đầu: Chờ 1-2 phút (đang cài thư viện)
- Sẽ thấy: `🚀 Server running on http://localhost:3000`

### Bước 4: ✅ XONG!
- **ĐỪNG TẮT cửa sổ đen**
- Quay lại browser
- Reload trang TikDown (F5)
- Thử tải video

---

## Cách 2: Dùng Terminal Manual

### Bước 1: Mở PowerShell
- Nhấn `Windows + R`
- Gõ: `powershell`
- Nhấn Enter

### Bước 2: Copy-paste TỪNG lệnh (nhấn Enter sau mỗi lệnh)

**Lệnh 1:** Di chuyển vào thư mục backend
```powershell
cd "C:\Users\khanhlee\OneDrive\Desktop\dự án new\backend"
```

**Lệnh 2:** Cài đặt thư viện (chỉ lần đầu)
```powershell
npm install
```
⏰ Chờ 30 giây - 2 phút

**Lệnh 3:** Khởi động server
```powershell
npm start
```

### Bước 3: Kiểm tra
Bạn sẽ thấy:
```
🚀 Server running on http://localhost:3000
📝 Environment: development
```

✅ **XONG! ĐỪNG TẮT cửa sổ PowerShell này**

---

## ✅ Kiểm tra Backend đã chạy chưa

Mở trình duyệt mới, vào:
```
http://localhost:3000
```

**Nếu thấy code JSON** (giống như này):
```json
{
  "message": "TikTok Downloader API",
  "version": "1.0.0",
  ...
}
```
→ ✅ **BACKEND ĐÃ CHẠY!**

**Nếu vẫn thấy:** "This site can't be reached"
→ ❌ Làm lại các bước, hoặc gửi screenshot lỗi cho tôi

---

## 🎯 Sau khi Backend chạy

1. Quay lại trang: `file:///C:/Users/khanhlee/OneDrive/Desktop/dự%20án%20new/index.html`
2. Reload (F5)
3. Paste link TikTok vào ô input
4. Click "Tải xuống"
5. ✅ Sẽ thấy video info và có thể download!

---

## ❌ Nếu gặp lỗi

### Lỗi: "npm is not recognized"
**Nguyên nhân:** Chưa cài Node.js

**Giải pháp:**
1. Vào: https://nodejs.org
2. Download bản LTS (nút xanh bên trái)
3. Cài đặt
4. **KHỞI ĐỘNG LẠI MÁY**
5. Thử lại

### Lỗi: "Cannot find module"
**Nguyên nhân:** Dependencies chưa cài

**Giải pháp:**
```powershell
cd "C:\Users\khanhlee\OneDrive\Desktop\dự án new\backend"
npm install
```

### Lỗi: "Port 3000 already in use"
**Nguyên nhân:** Có app khác đang dùng port 3000

**Giải pháp:** Tắt app đó, hoặc:
1. Mở `backend/.env`
2. Đổi `PORT=3000` thành `PORT=3001`
3. Mở `script.js`
4. Đổi `http://localhost:3000` thành `http://localhost:3001`

---

## 📞 Cần giúp thêm?

Chụp screenshot lỗi và gửi cho tôi, tôi sẽ giúp fix ngay!
