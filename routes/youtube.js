const express = require('express');
const router = express.Router();
const { getYoutubeInfo } = require('../utils/youtube');
const { getCache, setCache } = require('../utils/cache');
const { isBlocked } = require('../utils/youtube-blocklist');

// Rate limiter for YouTube downloads (stricter than global)
const rateLimit = require('express-rate-limit');
const youtubeRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: {
        success: false,
        error: 'Quá nhiều yêu cầu. Vui lòng chờ 1 phút trước khi thử lại.'
    }
});

// POST /api/youtube/download
router.post('/download', youtubeRateLimiter, async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL không được để trống'
        });
    }

    // Normalize URL
    let normalizedUrl = url.trim();

    // Basic URL validation
    if (!normalizedUrl.includes('youtube.com') && !normalizedUrl.includes('youtu.be')) {
        return res.status(400).json({
            success: false,
            error: 'URL không hợp lệ. Vui lòng dán link YouTube.'
        });
    }

    // Check DMCA blocklist
    if (isBlocked(normalizedUrl)) {
        return res.status(403).json({
            success: false,
            error: 'Video này đã bị chặn do khiếu nại bản quyền (DMCA).'
        });
    }

    try {
        // Check cache first
        const cachedData = getCache(normalizedUrl);
        if (cachedData) {
            console.log('[YouTube] Serving from cache:', normalizedUrl);
            return res.json({
                success: true,
                data: cachedData,
                cached: true
            });
        }

        console.log('[YouTube] Processing new request:', normalizedUrl);

        // Get info from YouTube
        const videoData = await getYoutubeInfo(normalizedUrl);

        // Cache the result for 30 minutes (shorter due to expiring URLs)
        setCache(normalizedUrl, videoData, 30 * 60);

        res.json({
            success: true,
            data: videoData
        });
    } catch (error) {
        console.error('[YouTube] Route Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi xử lý video YouTube. Vui lòng thử lại sau.'
        });
    }
});

// GET /api/youtube/info - Alternative endpoint
router.get('/info', youtubeRateLimiter, async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL không được để trống'
        });
    }

    // Redirect to POST handler logic
    req.body = { url };
    return router.handle(req, res);
});

module.exports = router;
