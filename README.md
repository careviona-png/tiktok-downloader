# 🎵 TikTok Downloader - Tải Video TikTok Không Logo

Web application cho phép tải video TikTok không watermark, chất lượng HD, hoàn toàn miễn phí.

## 🌟 Tính năng

- ✅ Tải video TikTok không logo/watermark
- ✅ Chất lượng HD (Full HD)
- ✅ Tải audio riêng biệt
- ✅ Hiển thị preview video trước khi tải
- ✅ Cache kết quả để tăng tốc độ
- ✅ Giao diện đẹp, hiện đại với animations
- ✅ Responsive - hoạt động tốt trên mobile
- ✅ Không giới hạn số lượng tải

## 🛠️ Công nghệ sử dụng

### Backend
- **Node.js** + **Express.js** - Web framework
- **@tobyg74/tiktok-api-dl** - TikTok API library
- **node-cache** - Caching mechanism
- **CORS** - Cross-origin requests

### Frontend
- **HTML5** - Structure
- **CSS3** - Modern styling (Gradients, Glassmorphism, Animations)
- **Vanilla JavaScript** - Logic và API calls
- **Google Fonts (Inter)** - Typography

## 📁 Cấu trúc dự án

```
tiktok-downloader/
├── backend/
│   ├── server.js          # Express server chính
│   ├── package.json       # Dependencies
│   ├── .env              # Environment variables
│   ├── routes/
│   │   └── download.js   # API routes
│   └── utils/
│       ├── tiktok.js     # TikTok API helper
│       └── cache.js      # Caching logic
├── index.html            # Frontend HTML
├── style.css             # Styles
├── script.js             # Frontend logic
└── README.md             # Documentation
```

## 🚀 Hướng dẫn cài đặt và chạy

### Bước 1: Cài đặt Backend

```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt dependencies
npm install

# Chạy server (development mode)
npm run dev

# Hoặc chạy production mode
npm start
```

Backend sẽ chạy tại: **http://localhost:3000**

### Bước 2: Chạy Frontend

**Option 1: Sử dụng Live Server (VS Code)**
1. Cài extension "Live Server" trong VS Code
2. Right-click vào file `index.html`
3. Chọn "Open with Live Server"
4. Trình duyệt sẽ tự động mở tại: **http://127.0.0.1:5500**

**Option 2: Sử dụng Python HTTP Server**
```bash
# Từ thư mục gốc dự án
python -m http.server 5500
```

**Option 3: Mở trực tiếp file HTML**
- Double-click file `index.html`
- **LƯU Ý:** Cần update `API_URL` trong `script.js` nếu backend chạy ở port khác

### Bước 3: Sử dụng

1. Mở trình duyệt vào địa chỉ frontend
2. Dán link TikTok vào ô input (ví dụ: `https://www.tiktok.com/@username/video/1234567890`)
3. Click nút "Tải xuống"
4. Xem preview video
5. Click "Tải Video (Không Logo)" để download

## 🔧 Cấu hình

### Backend (.env)

```env
PORT=3000                    # Port của backend server
CACHE_TTL=3600              # Thời gian cache (giây) - mặc định 1 giờ
FRONTEND_URL=http://127.0.0.1:5500  # URL của frontend (cho CORS)
```

### Frontend (script.js)

```javascript
const API_URL = 'http://localhost:3000/api/download';  // URL của backend API
```

## 📡 API Documentation

### POST /api/download

**Request:**
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "title": "Video title",
    "author": {
      "username": "username",
      "nickname": "Display Name",
      "avatar": "https://..."
    },
    "thumbnail": "https://...",
    "videoUrl": "https://...",
    "videoNoWatermark": "https://...",
    "audioUrl": "https://...",
    "stats": {
      "plays": 1000000,
      "likes": 50000,
      "comments": 500,
      "shares": 200
    }
  },
  "cached": false
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Video not found or unavailable"
}
```

## ⚠️ Lưu ý quan trọng

### 1. API TikTok không chính thức
- TikTok không cung cấp API công khai để tải video
- Sử dụng thư viện bên thứ 3 (`@tobyg74/tiktok-api-dl`)
- API có thể bị chặn hoặc ngưng hoạt động bất kỳ lúc nào
- Nếu API ngưng hoạt động, cần tìm thư viện thay thế

### 2. Vấn đề pháp lý
- Tải video TikTok có thể vi phạm bản quyền
- Website cần có disclaimer rõ ràng
- Khuyến khích người dùng chỉ tải video của chính họ

### 3. CORS Issues
- Nếu gặp lỗi CORS, kiểm tra `FRONTEND_URL` trong `.env`
- Đảm bảo frontend và backend đang chạy

## 🐛 Troubleshooting

### Lỗi: "Cannot connect to backend"
- Kiểm tra backend đã chạy chưa (`npm run dev`)
- Kiểm tra `API_URL` trong `script.js` đúng chưa
- Kiểm tra port 3000 có bị chiếm không

### Lỗi: "Video not found"
- Link TikTok có thể không hợp lệ
- Video có thể đã bị xóa hoặc private
- Thử với link TikTok khác

### Lỗi: "CORS policy"
- Update `FRONTEND_URL` trong file `.env`
- Restart backend server

### Video không tải xuống
- Một số browser chặn download tự động
- Thử click phải vào nút download → "Save link as..."
- Hoặc mở link trong tab mới

## 🚢 Deployment

### Backend Deployment (Railway/Render)

1. **Railway.app** (Khuyến nghị - Free tier)
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Deploy
   cd backend
   railway login
   railway init
   railway up
   ```

2. **Render.com**
   - Tạo Web Service mới
   - Connect GitHub repo
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && npm start`

### Frontend Deployment (Netlify/Vercel)

1. **Netlify** (Khuyến nghị)
   - Drag & drop folder chứa `index.html`, `style.css`, `script.js`
   - Hoặc connect GitHub repo

2. **Vercel**
   ```bash
   npm install -g vercel
   vercel
   ```

### Sau khi deploy:
- Update `API_URL` trong `script.js` thành URL backend production
- Update `FRONTEND_URL` trong `.env` thành URL frontend production

## 💰 Monetization (Tùy chọn)

### Google AdSense
1. Đăng ký tài khoản AdSense
2. Thêm code vào `index.html`:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXX"></script>
   ```
3. Thêm ad units vào vị trí mong muốn

### Shopee Affiliate
1. Đăng ký Shopee Affiliate
2. Tạo banner sản phẩm (điện thoại, tripod, mic)
3. Thêm vào `index.html`

## 📝 License

MIT License - Tự do sử dụng cho mục đích cá nhân và thương mại

## 🤝 Contributing

Mọi đóng góp đều được chào đón! Tạo Pull Request hoặc báo lỗi qua Issues.

## 📧 Support

Nếu gặp vấn đề, tạo issue trên GitHub hoặc liên hệ support.

---

**Made with ❤️ by TikDown Team**
