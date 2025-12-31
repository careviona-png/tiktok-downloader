const express = require('express');
const router = express.Router();
const { extractAudio, downloadVideo } = require('../utils/videoFlipper');
const path = require('path');
const fs = require('fs');

// POST /api/convert-mp3 - Convert video to MP3
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
