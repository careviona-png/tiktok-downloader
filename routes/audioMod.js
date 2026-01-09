/**
 * Safe Audio Modifier - API Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const {
    processAudioSafe,
    deleteFile,
    TEMP_DIR,
    MAX_FILE_SIZE
} = require('../utils/audioModifier');

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `audio-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav'];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|mp3|wav|m4a)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only video/audio files allowed'));
        }
    }
});

// Rate limiter
const audioLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

/**
 * POST /api/audio-mod/process
 * Upload and process video/audio with safe modifications
 */
router.post('/process', audioLimiter, upload.single('file'), async (req, res) => {
    let inputPath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        inputPath = req.file.path;

        console.log(`🔊 Audio Safe: ${req.file.originalname}`);

        // Process audio
        const result = await processAudioSafe(inputPath);

        // Generate download name
        const ext = path.extname(req.file.originalname);
        const base = path.basename(req.file.originalname, ext);
        const downloadName = `${base}-audio-safe-${Date.now()}.mp4`;

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
        console.error('Audio mod error:', error);
        if (inputPath) deleteFile(inputPath);
        res.status(500).json({ success: false, error: 'Processing failed: ' + error.message });
    }
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
