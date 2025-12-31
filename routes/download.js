const express = require('express');
const router = express.Router();
const { getTikTokVideo } = require('../utils/tiktok');
const { getCache, setCache } = require('../utils/cache');
const { extractAudio, downloadVideo } = require('../utils/videoFlipper');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');

// POST /api/download
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

        // Validate TikTok URL format
        const tiktokRegex = /^https?:\/\/(www\.)?(vm\.|vt\.)?tiktok\.com\/.+/i;
        if (!tiktokRegex.test(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid TikTok URL. Please provide a valid TikTok video link.'
            });
        }

        // Check cache first
        const cacheKey = crypto.createHash('md5').update(url).digest('hex');
        const cachedData = getCache(cacheKey);

        if (cachedData) {
            console.log('📦 Cache hit for:', url);
            return res.json({
                success: true,
                data: cachedData,
                cached: true
            });
        }

        // Fetch video info
        console.log('🔍 Fetching video info for:', url);
        const videoData = await getTikTokVideo(url);

        if (!videoData) {
            return res.status(404).json({
                success: false,
                error: 'Video not found or unavailable'
            });
        }

        // Add download proxy URLs
        videoData.downloadUrl = `/api/proxy-download?url=${encodeURIComponent(videoData.videoNoWatermark)}`;
        videoData.audioDownloadUrl = `/api/proxy-download?url=${encodeURIComponent(videoData.audioUrl)}&type=audio`;

        // Cache the result
        setCache(cacheKey, videoData);

        res.json({
            success: true,
            data: videoData,
            cached: false
        });

    } catch (error) {
        console.error('Download error:', error.message);

        let errorMessage = 'Failed to download video';
        let statusCode = 500;

        if (error.message.includes('not found')) {
            errorMessage = 'Video not found or has been removed';
            statusCode = 404;
        } else if (error.message.includes('private')) {
            errorMessage = 'This video is private';
            statusCode = 403;
        } else if (error.message.includes('rate limit')) {
            errorMessage = 'Too many requests. Please try again later.';
            statusCode = 429;
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

// GET /api/proxy-download - Proxy video download to avoid CORS
router.get('/proxy-download', async (req, res) => {
    try {
        const { url, type } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        const isAudio = type === 'audio' || (url && url.toLowerCase().endsWith('.mp3'));
        console.log(`🎬 Proxying ${isAudio ? 'audio' : 'video'} download for:`, url);

        // Stream the video through our server
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 15000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.tikwm.com/'
            }
        });

        // Set headers based on type
        const contentType = isAudio ? 'audio/mpeg' : (response.headers['content-type'] || 'video/mp4');
        const extension = isAudio ? 'mp3' : 'mp4';
        const filename = `tiktok-${isAudio ? 'audio' : 'video'}-${Date.now()}.${extension}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // Pipe the video stream to response
        response.data.pipe(res);

    } catch (error) {
        console.error('Proxy download error:', error.message);

        // Fallback: If proxy fails, try to redirect the user directly to the source
        if (req.query.url) {
            console.log('🔄 Proxy failed, falling back to direct redirect:', req.query.url);
            return res.redirect(req.query.url);
        }

        res.status(500).json({
            success: false,
            error: 'Failed to download video'
        });
    }
});

// POST /api/convert-mp3 - Convert video to MP3 (Integrated)
router.post('/convert-mp3', async (req, res) => {
    let downloadedPath = null;
    let audioPath = null;

    try {
        const { videoUrl } = req.body;

        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'Video URL is required'
            });
        }

        console.log('🎵 Extracting audio from:', videoUrl);

        // 1. Download video first
        downloadedPath = await downloadVideo(videoUrl);

        // 2. Extract audio
        audioPath = await extractAudio(downloadedPath);

        // 3. Send file to client
        res.download(audioPath, `tiktok-audio-${Date.now()}.mp3`, (err) => {
            // Cleanup files after download
            try {
                if (downloadedPath && fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
                if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }

            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to send audio file'
                    });
                }
            }
        });

    } catch (error) {
        console.error('Conversion error:', error.message);

        // Cleanup on error
        try {
            if (downloadedPath && fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
            if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        } catch (cleanupErr) { }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract audio'
        });
    }
});

module.exports = router;
