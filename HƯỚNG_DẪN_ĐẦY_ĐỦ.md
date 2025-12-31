# 📚 HƯỚNG DẪN SỬ DỤNG TIKTOK DOWNLOADER - ĐẦY ĐỦ

## 🎯 YÊU CẦU HỆ THỐNG

- ✅ **Node.js** (v16 trở lên) - [Tải tại đây](https://nodejs.org/)
- ✅ **Trình duyệt web** (Chrome, Edge, Firefox)
- ⚠️ **ffmpeg** (chỉ cần cho tính năng Đảo Ngang) - Xem `FFMPEG_INSTALL.md`

---

## 🚀 CÁCH CHẠY (3 BƯỚC ĐƠN GIẢN)

### **Bước 1: Chạy Backend** ⚙️

**Cách A: Tự động (Dễ nhất)**
```
Double-click file START_BACKEND.bat
```

**Cách B: Thủ công**
```powershell
cd backend
npm install
npm start
```

➡️ **Kết quả:** Bạn sẽ thấy:
```
🚀 Server running on http://localhost:3000
```

⚠️ **LƯU Ý:** ĐỪNG TẮT cửa sổ này! Backend cần chạy liên tục.

---

### **Bước 2: Mở Frontend** 🌐

**Cách A: Dùng Live Server (VS Code)**
1. Mở VS Code
2. Cài extension "Live Server"
3. Right-click file `index.html` → "Open with Live Server"

**Cách B: Mở trực tiếp**
```
Double-click file index.html
```

➡️ **Kết quả:** Trình duyệt mở trang TikTok Downloader

---

### **Bước 3: Test tải video** 🎬

1. Copy link TikTok (ví dụ: `https://www.tiktok.com/@user/video/123...`)
2. Paste vào ô input trên web
3. Click nút **"Tải xuống"**
4. Chờ xử lý → Xem preview
5. Click **"Tải Video (Không Logo)"** hoặc **"🔄 Đảo Ngang (Reup)"**

✅ **Hoàn thành!** Video sẽ được tải về máy.

---

## 🎨 TÍNH NĂNG

### 1. **Tải Video Không Logo** ✨
- Tải video TikTok không watermark
- Chất lượng HD (Full HD)
- Nhanh chóng, không giới hạn

### 2. **Tải Audio** 🎵
- Tách audio từ video
- Format MP3/M4A

### 3. **Đảo Ngang (Reup)** 🔄 ⭐ TÍNH NĂNG ĐỘC QUYỀN
- Lật video theo chiều ngang (mirror)
- Dành cho reup video tránh vi phạm bản quyền
- Giữ nguyên chất lượng HD
- ⚠️ **Yêu cầu:** Cần cài ffmpeg (xem `FFMPEG_INSTALL.md`)

---

## 📁 CẤU TRÚC DỰ ÁN

```
dự án new/
├── START_BACKEND.bat         ⭐ Click để chạy backend
├── index.html                Frontend chính
├── style.css                 Styles
├── script.js                 Logic chính
├── flip.js                   Logic đảo ngang
├── backend/                  Backend server
│   ├── server.js            Main server
│   ├── routes/              API routes
│   ├── utils/               Utilities
│   └── package.json         Dependencies
├── README.md                 Documentation đầy đủ
├── QUICK_START.md           Hướng dẫn nhanh
├── FFMPEG_INSTALL.md        Hướng dẫn cài ffmpeg
└── HƯỚNG_DẪN_ĐẦY_ĐỦ.md     ⭐ File này
```

---

## ❌ KHẮC PHỤC LỖI THƯỜNG GẶP

### ❗ "Đang xử lý..." mãi không xong
**Nguyên nhân:** Backend chưa chạy
**Giải pháp:** 
1. Kiểm tra backend đã chạy chưa
2. Xem có dòng `🚀 Server running...` không
3. Nếu chưa → Chạy lại `START_BACKEND.bat`

### ❗ "Cannot connect to backend"
**Nguyên nhân:** Backend tắt hoặc lỗi
**Giải pháp:**
1. Reload trang (F5)
2. Restart backend
3. Kiểm tra port 3000 có bị chiếm không

### ❗ "Video not found"
**Nguyên nhân:** 
- Link TikTok không hợp lệ
- Video đã bị xóa
- Video private

**Giải pháp:** Thử link TikTok khác

### ❗ "npm is not recognized"
**Nguyên nhân:** Chưa cài Node.js
**Giải pháp:** 
1. Tải Node.js từ https://nodejs.org/
2. Cài đặt (chọn bản LTS)
3. Restart máy tính
4. Thử lại

### ❗ "ffmpeg is not installed" (khi dùng Đảo Ngang)
**Nguyên nhân:** Chưa cài ffmpeg
**Giải pháp:** Xem file `FFMPEG_INSTALL.md`
**Lưu ý:** Các tính năng khác vẫn hoạt động bình thường

---

## 🎓 WORKFLOW HOÀN CHỈNH

```
1. Chạy Backend (START_BACKEND.bat)
   ↓
2. Mở Frontend (index.html)
   ↓
3. Paste link TikTok
   ↓
4. Click "Tải xuống"
   ↓
5. Chọn:
   - "Tải Video" → Download thường
   - "Tải Audio" → Chỉ lấy âm thanh
   - "Đảo Ngang" → Lật video cho reup
   ↓
6. Video tải về máy
```

---

## 💡 TIPS

1. **Cache:** Video đã tải sẽ được cache 1 giờ → Lần 2 nhanh hơn
2. **Backend:** Chỉ cần chạy 1 lần, dùng cả ngày
3. **Reup:** Dùng tính năng "Đảo Ngang" để tránh vi phạm bản quyền
4. **Quality:** Video tải về giữ 100% chất lượng gốc

---

## 🆘 HỖ TRỢ

Nếu vẫn gặp vấn đề:
1. Xem file `README.md` (chi tiết hơn)
2. Xem `backend/MANUAL_START.md` (hướng dẫn backend)
3. Check browser console (F12) để xem lỗi cụ thể

---

## 📝 LƯU Ý QUAN TRỌNG

⚠️ **Pháp lý:** Chỉ tải video của bạn hoặc có sự cho phép. Tôn trọng bản quyền!

⚠️ **API:** TikTok không cung cấp API chính thức. Dự án sử dụng thư viện bên thứ 3, có thể ngưng hoạt động bất kỳ lúc nào.

✅ **Privacy:** Mọi dữ liệu xử lý local, không lưu trữ video trên server.

---

**🎉 Chúc bạn sử dụng vui vẻ!**
