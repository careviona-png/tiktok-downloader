const express = require('express');
const router = express.Router();
const { getFacebookVideo } = require('../utils/facebook');
const { getCache, setCache } = require('../utils/cache');
const crypto = require('crypto');
const axios = require('axios');

// POST /api/facebook/download
router.post('/download', async (req, res) => {
    try {
        const { url } = req.body;

        // Validate URL
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        // Validate Facebook URL format
        const facebookRegex = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch|fb\.com|m\.facebook\.com)\/.+/i;
        if (!facebookRegex.test(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Facebook URL. Please provide a valid Facebook video link.'
            });
        }

        // Check cache first
        const cacheKey = crypto.createHash('md5').update(url).digest('hex');
        const cachedData = getCache(cacheKey);

        if (cachedData) {
            console.log('📦 Cache hit for Facebook:', url);
            return res.json({
                success: true,
                data: cachedData,
                cached: true
            });
        }

        // Fetch video info
        console.log('🔍 Fetching Facebook video info for:', url);
        const videoData = await getFacebookVideo(url);

        if (!videoData) {
            return res.status(404).json({
                success: false,
                error: 'Video not found or unavailable'
            });
        }

        // Add download proxy URLs
        if (videoData.videoHD) {
            videoData.downloadUrlHD = `/api/facebook/proxy-download?url=${encodeURIComponent(videoData.videoHD)}&quality=hd`;
        }
        if (videoData.videoSD) {
            videoData.downloadUrlSD = `/api/facebook/proxy-download?url=${encodeURIComponent(videoData.videoSD)}&quality=sd`;
        }

        // Cache the result
        setCache(cacheKey, videoData);

        res.json({
            success: true,
            data: videoData,
            cached: false
        });

    } catch (error) {
        console.error('Facebook download error:', error.message);

        let errorMessage = 'Failed to download video';
        let statusCode = 500;

        if (error.message.includes('not found')) {
            errorMessage = 'Video not found or has been removed';
            statusCode = 404;
        } else if (error.message.includes('private')) {
            errorMessage = 'This video is private';
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

// GET /api/facebook/proxy-download - Proxy video download to avoid CORS
router.get('/proxy-download', async (req, res) => {
    try {
        const { url, quality } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        // --- SECURITY: SSRF PROTECTION ---
        try {
            const parsedUrl = new URL(url);
            const allowedDomains = [
                'facebook.com', 'fbcdn.net', 'fna.fbcdn.net'
            ];

            const isAllowed = allowedDomains.some(domain =>
                parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
            );

            if (!isAllowed) {
                console.warn('❌ Blocked suspicious FB proxy request to:', parsedUrl.hostname);
                return res.status(403).json({
                    success: false,
                    error: 'Domain not allowed for proxying'
                });
            }

            // Block local addresses
            const host = parsedUrl.hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('192.168.') || host.startsWith('10.')) {
                return res.status(403).json({ success: false, error: 'Restricted address' });
            }
        } catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid URL' });
        }
        // --- END SECURITY ---

        console.log(`🎬 Proxying Facebook ${quality || 'video'} download`);

        // Stream the video through our server
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 3,
            maxContentLength: 200 * 1024 * 1024, // 200MB limit for FB high quality
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.facebook.com/'
            }
        });

        // Set headers
        const filename = `facebook-video-${quality || 'download'}-${Date.now()}.mp4`;
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // Pipe the video stream to response
        response.data.pipe(res);

    } catch (error) {
        console.error('Facebook proxy download error:', error.message);

        // Fallback: redirect directly
        if (req.query.url) {
            console.log('🔄 Proxy failed, falling back to direct redirect');
            return res.redirect(req.query.url);
        }

        res.status(500).json({
            success: false,
            error: 'Failed to download video'
        });
    }
});

module.exports = router;
