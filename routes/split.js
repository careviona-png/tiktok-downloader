const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const {
    splitVideoByTime,
    getVideoInfo,
    validateVideo,
    deleteFile,
    MAX_FILE_SIZE,
    TEMP_DIR
} = require('../utils/videoSplitter');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        const allowedExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ hỗ trợ các định dạng: MP4, WebM, MOV, AVI, MKV'));
        }
    }
});

// Rate limiting - CPU intensive operation
const splitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 splits per hour per IP
    message: {
        success: false,
        error: 'Bạn đã đạt giới hạn 10 lần cắt video/giờ. Vui lòng thử lại sau.'
    }
});

// Track uploaded files for cleanup
const uploadedFiles = new Map();

/**
 * POST /api/split/upload
 * Upload video and get info
 */
router.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Không có file được upload'
            });
        }

        const filePath = req.file.path;
        console.log('📤 Video uploaded:', req.file.originalname, `(${(req.file.size / (1024 * 1024)).toFixed(2)} MB)`);

        // Validate video
        const validation = await validateVideo(filePath);
        if (!validation.isValid) {
            deleteFile(filePath);
            return res.status(400).json({
                success: false,
                error: validation.error
            });
        }

        // Get video info
        const info = await getVideoInfo(filePath);

        // Generate unique ID for this upload
        const uploadId = path.basename(filePath, path.extname(filePath));

        // Store file path for later use
        uploadedFiles.set(uploadId, {
            path: filePath,
            createdAt: Date.now(),
            info: info
        });

        // Cleanup old entries after 30 minutes
        setTimeout(() => {
            const upload = uploadedFiles.get(uploadId);
            if (upload) {
                deleteFile(upload.path);
                uploadedFiles.delete(uploadId);
            }
        }, 30 * 60 * 1000);

        res.json({
            success: true,
            uploadId: uploadId,
            info: info
        });

    } catch (error) {
        console.error('Upload error:', error.message);
        if (req.file && req.file.path) {
            deleteFile(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi khi upload video'
        });
    }
});

/**
 * POST /api/split/cut
 * Cut video by time range
 */
router.post('/cut', splitLimiter, async (req, res) => {
    try {
        const { uploadId, startTime, endTime } = req.body;

        if (!uploadId) {
            return res.status(400).json({
                success: false,
                error: 'Upload ID không hợp lệ'
            });
        }

        const upload = uploadedFiles.get(uploadId);
        if (!upload || !fs.existsSync(upload.path)) {
            return res.status(400).json({
                success: false,
                error: 'Video không tồn tại hoặc đã hết hạn. Vui lòng upload lại.'
            });
        }

        // Parse times
        const start = parseFloat(startTime) || 0;
        const end = parseFloat(endTime) || upload.info.duration;

        // Validate times
        if (start < 0 || end <= start || end > upload.info.duration) {
            return res.status(400).json({
                success: false,
                error: 'Thời gian không hợp lệ'
            });
        }

        console.log(`✂️ Cutting video: ${start}s - ${end}s`);

        // Split video
        const outputPath = await splitVideoByTime(upload.path, start, end);

        // Generate download filename
        const downloadName = `tikdown-cut-${Date.now()}.mp4`;

        // Send file to client
        res.download(outputPath, downloadName, (err) => {
            // Cleanup output file after download
            deleteFile(outputPath);

            if (err && !res.headersSent) {
                console.error('Download error:', err);
                res.status(500).json({
                    success: false,
                    error: 'Lỗi khi tải video'
                });
            }
        });

    } catch (error) {
        console.error('Cut error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi khi cắt video'
        });
    }
});

/**
 * DELETE /api/split/cleanup/:uploadId
 * Cleanup uploaded file
 */
router.delete('/cleanup/:uploadId', (req, res) => {
    const { uploadId } = req.params;

    const upload = uploadedFiles.get(uploadId);
    if (upload) {
        deleteFile(upload.path);
        uploadedFiles.delete(uploadId);
    }

    res.json({ success: true });
});

// Error handling for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File quá lớn. Tối đa 200MB'
            });
        }
    }

    if (err.message) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    next(err);
});

module.exports = router;
