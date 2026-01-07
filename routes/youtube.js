const express = require('express');
const router = express.Router();
const { getYoutubeInfo } = require('../utils/youtube');
const { getCache, setCache } = require('../utils/cache');

// POST /api/youtube/download
router.post('/download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL không được để trống' });
    }

    // Basic URL validation
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return res.status(400).json({ error: 'URL không hợp lệ. Vui lòng dán link YouTube Shorts.' });
    }

    try {
        // Check cache first
        const cachedData = getCache(url);
        if (cachedData) {
            return res.json(cachedData);
        }

        // Get info from YouTube
        const videoData = await getYoutubeInfo(url);

        // Cache the result for 1 hour
        setCache(url, videoData);

        res.json({
            success: true,
            data: videoData
        });
    } catch (error) {
        console.error('YouTube Route Error:', error.message);
        res.status(500).json({ error: error.message || 'Lỗi xử lý video YouTube' });
    }
});

module.exports = router;
