/**
 * Video Format Converter - API Routes
 * Converts 16:9 videos to 9:16 for Shorts/Reels/TikTok
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const {
    convertToPortrait,
    deleteFile,
    CONVERT_MODES,
    TEMP_DIR,
    MAX_FILE_SIZE
} = require('../utils/formatConverter');

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `convert-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files allowed (MP4, WebM, MOV)'));
        }
    }
});

// Rate limiter
const convertLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

/**
 * POST /api/convert/process
 * Upload and convert video to portrait format
 */
router.post('/process', convertLimiter, upload.single('video'), async (req, res) => {
    let inputPath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No video file uploaded' });
        }

        inputPath = req.file.path;

        // Get conversion mode from request
        const mode = req.body.mode || 'blur';

        // Validate mode
        const validModes = Object.values(CONVERT_MODES);
        if (!validModes.includes(mode)) {
            deleteFile(inputPath);
            return res.status(400).json({
                success: false,
                error: `Invalid mode. Use: ${validModes.join(', ')}`
            });
        }

        console.log(`🎬 Format Convert: ${req.file.originalname} → ${mode} mode`);

        // Convert video
        const result = await convertToPortrait(inputPath, mode);

        // Generate download name
        const ext = path.extname(req.file.originalname);
        const base = path.basename(req.file.originalname, ext);
        const downloadName = `${base}-portrait-${mode}-${Date.now()}.mp4`;

        // Send file
        res.download(result.outputPath, downloadName, (err) => {
            // Cleanup
            deleteFile(inputPath);
            deleteFile(result.outputPath);

            if (err && !res.headersSent) {
                console.error('Download error:', err);
            }
        });

    } catch (error) {
        console.error('Format convert error:', error);
        if (inputPath) deleteFile(inputPath);
        res.status(500).json({ success: false, error: 'Conversion failed: ' + error.message });
    }
});

/**
 * GET /api/convert/modes
 * Get available conversion modes
 */
router.get('/modes', (req, res) => {
    res.json({
        success: true,
        modes: [
            { id: 'blur', name: 'Blur Background', description: 'Video ở giữa, nền mờ xung quanh (phổ biến nhất)' },
            { id: 'crop', name: 'Crop Center', description: 'Cắt giữa video để fit 9:16' },
            { id: 'black', name: 'Black Bars', description: 'Thêm viền đen trên dưới' }
        ]
    });
});

// Error handling
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: `File too large. Max ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
        }
        return res.status(400).json({ success: false, error: err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
    next();
});

module.exports = router;
