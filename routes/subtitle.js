/**
 * Auto Subtitle Tool - API Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { processAutoSubtitles, deleteFile } = require('../utils/subtitleGenerator');

const TEMP_DIR = path.join(__dirname, '../temp');

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `subtitle-upload-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const subtitleLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 10, // Higher limit for API, client-side will handle Soft Limit
    message: { success: false, error: 'Too many requests. Please try again tomorrow.' }
});

/**
 * POST /api/subtitle/process
 * Upload video, transcribe, burn subtitles, and download
 */
router.post('/process', subtitleLimiter, upload.single('video'), async (req, res) => {
    let inputPath = null;
    let result = null;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No video file uploaded' });
        }

        inputPath = req.file.path;
        const { language, apiKey } = req.body;

        const finalApiKey = apiKey || process.env.GROQ_API_KEY;

        if (!finalApiKey) {
            deleteFile(inputPath);
            return res.status(400).json({
                success: false,
                error: 'Cần có Groq API Key để sử dụng tính năng này.'
            });
        }

        console.log(`🎙️ Auto Subtitle starting: ${req.file.originalname} [${language}]`);

        // Run the pipeline
        result = await processAutoSubtitles(inputPath, {
            language: language || 'vi',
            apiKey: finalApiKey
        });

        // Send back the subtitled video
        const downloadName = req.file.originalname.replace(/\.[^/.]+$/, '') + '-subtitled.mp4';

        res.download(result.outputPath, downloadName, (err) => {
            // Cleanup all files
            if (inputPath) deleteFile(inputPath);
            if (result && result.outputPath) deleteFile(result.outputPath);
            if (result && result.srtPath) deleteFile(result.srtPath);

            if (err && !res.headersSent) {
                console.error('Download error:', err);
            }
        });

    } catch (error) {
        console.error('Subtitle tool error:', error);
        if (inputPath) deleteFile(inputPath);
        if (result && result.outputPath) deleteFile(result.outputPath);
        if (result && result.srtPath) deleteFile(result.srtPath);

        res.status(500).json({
            success: false,
            error: error.message || 'Xử lý phụ đề thất bại'
        });
    }
});

module.exports = router;
