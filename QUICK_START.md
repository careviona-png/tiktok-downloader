# 🚀 HƯỚNG DẪN CHẠY NHANH

## Bước 1: Cài đặt Backend ⚙️

```powershell
# Mở Terminal/PowerShell, di chuyển vào thư mục backend
cd backend

# Cài đặt tất cả dependencies
npm install

# Chạy server
npm run dev
```

**✅ Backend sẽ chạy tại: http://localhost:3000**

---

## Bước 2: Chạy Frontend 🎨

### Cách 1: Dùng Live Server (KHUYẾN NGHỊ)
1. Mở **VS Code**
2. Cài extension **"Live Server"** (nếu chưa có)
3. Right-click vào file `index.html`
4. Chọn **"Open with Live Server"**
5. Trình duyệt tự động mở tại: **http://127.0.0.1:5500**

### Cách 2: Dùng Python
```powershell
# Từ thư mục gốc dự án (chứa index.html)
python -m http.server 5500
```

### Cách 3: Mở trực tiếp
- Double-click file `index.html`

---

## Bước 3: Sử dụng 🎬

1. **Mở trình duyệt** → Truy cập frontend (http://127.0.0.1:5500)
2. **Copy link TikTok** (ví dụ: `https://www.tiktok.com/@user/video/123`)
3. **Paste vào ô input** và click "Tải xuống"
4. **Xem preview** video
5. **Click nút** "Tải Video (Không Logo)"
6. **Video sẽ được tải về máy** 🎉

---

## ⚠️ Lưu ý

- **Backend PHẢI chạy trước** (port 3000)
- **Frontend chạy sau** (port 5500)
- Nếu gặp lỗi CORS → Kiểm tra backend đã chạy chưa
- Nếu video không tải được → Thử link TikTok khác

---

## 🧪 Test nhanh với link mẫu

```
https://www.tiktok.com/@tiktok/video/7016878398404063494
```

---

## 📁 Cấu trúc Files đã tạo

```
dự án new/
├── backend/
│   ├── server.js          ✅ Main server
│   ├── package.json       ✅ Dependencies
│   ├── .env              ✅ Config
│   ├── routes/
│   │   └── download.js   ✅ API endpoint
│   └── utils/
│       ├── tiktok.js     ✅ TikTok API
│       └── cache.js      ✅ Caching
├── index.html            ✅ Frontend (đã có)
├── style.css             ✅ Styling
├── script.js             ✅ Logic
├── README.md             ✅ Documentation
├── .gitignore           ✅ Git config
└── QUICK_START.md       ✅ File này
```

---

**🎯 Mọi thứ đã sẵn sàng! Bắt đầu ngay thôi! 🚀**
