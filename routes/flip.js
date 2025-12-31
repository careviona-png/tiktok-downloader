const express = require('express');
const router = express.Router();
const { flipVideo, downloadVideo } = require('../utils/videoFlipper');
const path = require('path');
const fs = require('fs');

// POST /api/flip - Flip video horizontally
router.post('/flip', async (req, res) => {
    try {
        const { videoUrl } = req.body;

        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'Video URL is required'
            });
        }

        console.log('🔄 Flipping video:', videoUrl);

        // Download video first
        const downloadedPath = await downloadVideo(videoUrl);

        // Flip video
        const flippedPath = await flipVideo(downloadedPath);

        // Send file to client
        res.download(flippedPath, `tiktok-flipped-${Date.now()}.mp4`, (err) => {
            // Cleanup files after download
            try {
                if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
                if (fs.existsSync(flippedPath)) fs.unlinkSync(flippedPath);
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }

            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to send flipped video'
                    });
                }
            }
        });

    } catch (error) {
        console.error('Flip error:', error.message);

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to flip video'
        });
    }
});

module.exports = router;
