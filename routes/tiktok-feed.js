const express = require('express');
const router = express.Router();
const feedService = require('../services/tiktok-automation/feed/feedService');
const axios = require('axios');

/**
 * GET /api/tiktok/feed
 * Get recommendations feed
 */
router.get('/feed', async (req, res) => {
    try {
        const { userId, count = 10 } = req.query;
        // Basic user validation logic here...

        const videos = await feedService.getForYouFeed(userId, parseInt(count));

        res.json({
            success: true,
            items: videos
        });
    } catch (error) {
        console.error('Feed API error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch feed' });
    }
});

/**
 * GET /api/tiktok/proxy/video
 * Proxy video stream to bypass CORS/Referer checks
 */
router.get('/proxy/video', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send('Missing URL');

        // Stream the video with correct headers
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'Referer': 'https://www.tiktok.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Forward headers
        res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Content-Length', response.headers['content-length']);

        response.data.pipe(res);

    } catch (error) {
        console.error('Video proxy error:', error.message);
        res.status(500).send('Proxy error');
    }
});

module.exports = router;
