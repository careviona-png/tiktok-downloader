# 🔑 BƯỚC TIẾP THEO - Lấy API Key và Tích Hợp

Bạn đã đăng ký RapidAPI xong! Bây giờ làm theo 5 bước sau:

---

## BƯỚC 1: Lấy API Key từ RapidAPI

1. Vào: https://rapidapi.com/yi005/api/tiktok-scraper7
2. Click tab **"Endpoints"** hoặc **"Code Snippets"**
3. Bên phải màn hình, tìm dòng:
   ```
   'X-RapidAPI-Key': 'YOUR_KEY_HERE'
   ```
4. **Copy** cái key đó (dài khoảng 50 ký tự)
5. Lưu lại để dùng ở bước tiếp theo

📸 **Screenshot**: Key sẽ giống như này:
```
'X-RapidAPI-Key': 'a1b2c3d4e5f6g7h8i9...'
```

---

## BƯỚC 2: Cài Package Axios

Mở PowerShell/Terminal và chạy:

```powershell
cd "C:\Users\khanhlee\OneDrive\Desktop\dự án new\backend"
npm install axios
```

*(Chờ 10-20 giây)*

---

## BƯỚC 3: Gửi API Key cho tôi

**Copy API key từ bước 1 và gửi cho tôi**, tôi sẽ update code ngay!

Hoặc nếu bạn muốn tự làm, xem BƯỚC 4.

---

## BƯỚC 4: (Optional) Tự update code

Nếu muốn tự làm, mở file: `backend\utils\tiktok.js`

Thay toàn bộ nội dung bằng:

```javascript
const axios = require('axios');

async function getTikTokVideo(url) {
    try {
        const options = {
            method: 'GET',
            url: 'https://tiktok-scraper7.p.rapidapi.com/',
            params: {
                url: url,
                hd: '1'
            },
            headers: {
                'X-RapidAPI-Key': 'PASTE_YOUR_API_KEY_HERE',  // ← Thay đây
                'X-RapidAPI-Host': 'tiktok-scraper7.p.rapidapi.com'
            }
        };

        const response = await axios.request(options);
        const data = response.data.data;

        if (!data) {
            throw new Error('Video not found');
        }

        return {
            id: data.id || '',
            title: data.title || 'TikTok Video',
            author: {
                username: data.author?.unique_id || 'Unknown',
                nickname: data.author?.nickname || 'Unknown',
                avatar: data.author?.avatar || ''
            },
            thumbnail: data.cover || '',
            duration: data.duration || 0,
            videoUrl: data.play || '',
            videoNoWatermark: data.hdplay || data.play || '',
            audioUrl: data.music || '',
            stats: {
                plays: data.play_count || 0,
                likes: data.digg_count || 0,
                comments: data.comment_count || 0,
                shares: data.share_count || 0
            }
        };

    } catch (error) {
        console.error('RapidAPI Error:', error.message);
        throw new Error(`Failed to fetch video: ${error.message}`);
    }
}

module.exports = { getTikTokVideo };
```

**Nhớ thay `PASTE_YOUR_API_KEY_HERE` bằng key thật nhé!**

---

## BƯỚC 5: Restart Server và Test

1. Tắt server hiện tại (Ctrl + C)
2. Chạy lại:
   ```powershell
   npm start
   ```
3. Reload browser (F5)
4. Paste link TikTok và click "Tải xuống"
5. ✅ **XONG!** Video sẽ hiển thị!

---

## ⚡ Cách Nhanh Nhất

**GỬI API KEY CHO TÔI**, tôi sẽ update code tự động cho bạn trong 1 phút!

Format gửi:
```
API Key: [paste key here]
```
