# Hướng Dẫn Deploy Lên Railway

Dự án đã được cấu hình để chạy trên Railway với hỗ trợ đầy đủ cho Puppeteer (Chrome).

## Cách 1: Deploy qua GitHub (Khuyên dùng)
1. Push code hiện tại lên repository GitHub của bạn.
2. Đăng nhập vào [Railway Dashboard](https://railway.app/).
3. Chọn **New Project** -> **Deploy from GitHub repo**.
4. Chọn repository của bạn.
5. Railway sẽ tự động phát hiện file `nixpacks.toml` và cài đặt các dependencies (Node.js, ffmpeg, Chromium).
6. Sau khi build xong, vào tab **Settings** -> **Networking** -> **Generate Domain** để lấy link truy cập.

## Cách 2: Deploy qua CLI (Nếu đã cài đặt Railway CLI)
1. Mở terminal tại thư mục dự án.
2. Chạy lệnh:
   ```bash
   railway login
   railway up
   ```

## Lưu ý quan trọng
- **Environment Variables**: Hệ thống đã cấu hình sẵn biến `PUPPETEER_EXECUTABLE_PATH` trong file `nixpacks.toml`. Bạn không cần set tay biến này trên Dashboard trừ khi muốn override.
- **Port**: Ứng dụng sẽ chạy trên port do Railway cấp phát (biến `$PORT`). Code đã được xử lý để nhận biến này.
- **Performance**: Puppeteer tốn khá nhiều RAM. Nếu app bị crash, hãy cân nhắc nâng cấp gói phần cứng trên Railway.
