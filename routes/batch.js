/**
 * Batch Video Cutter - API Routes
 * Handles video upload, splitting, and ZIP download
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const {
    splitByDuration,
    splitByCount,
    createZipArchive,
    cleanupJob,
    validateVideo,
    getVideoDuration,
    TEMP_DIR,
    MAX_FILE_SIZE
} = require('../utils/batchCutter');

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `batch-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Rate limiter
const batchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

// Store uploaded files
const uploadedFiles = new Map();
const completedJobs = new Map();

// Cleanup old entries
setInterval(() => {
    const maxAge = 30 * 60 * 1000;
    const now = Date.now();

    for (const [id, info] of uploadedFiles.entries()) {
        if (now - info.uploadTime > maxAge) {
            try { fs.unlinkSync(info.path); } catch (e) { }
            uploadedFiles.delete(id);
        }
    }

    for (const [id, info] of completedJobs.entries()) {
        if (now - info.completedTime > maxAge) {
            cleanupJob(id);
            completedJobs.delete(id);
        }
    }
}, 5 * 60 * 1000);

/**
 * POST /api/batch/upload
 */
router.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No video file uploaded' });
        }

        const filePath = req.file.path;

        let videoInfo;
        try {
            videoInfo = await validateVideo(filePath);
        } catch (err) {
            try { fs.unlinkSync(filePath); } catch (e) { }
            return res.status(400).json({ success: false, error: err.message });
        }

        const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        uploadedFiles.set(uploadId, {
            path: filePath,
            originalName: req.file.originalname,
            size: req.file.size,
            duration: videoInfo.duration,
            uploadTime: Date.now()
        });

        console.log(`📤 Batch upload: ${req.file.originalname} (${videoInfo.duration.toFixed(1)}s)`);

        res.json({
            success: true,
            uploadId,
            originalName: req.file.originalname,
            duration: videoInfo.duration,
            size: req.file.size
        });

    } catch (error) {
        console.error('Batch upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
    }
});

/**
 * POST /api/batch/split
 */
router.post('/split', batchLimiter, async (req, res) => {
    try {
        const { uploadId, segmentDuration, splitMode } = req.body;

        if (!uploadId) {
            return res.status(400).json({ success: false, error: 'Upload ID required' });
        }

        const uploadInfo = uploadedFiles.get(uploadId);
        if (!uploadInfo) {
            return res.status(404).json({ success: false, error: 'Upload not found or expired' });
        }

        if (!fs.existsSync(uploadInfo.path)) {
            uploadedFiles.delete(uploadId);
            return res.status(404).json({ success: false, error: 'File expired. Please upload again.' });
        }

        const duration = parseInt(segmentDuration) || 30;
        if (duration < 5 || duration > 300) {
            return res.status(400).json({ success: false, error: 'Segment duration must be 5-300 seconds' });
        }

        console.log(`✂️ Batch split: ${uploadInfo.originalName} into ${duration}s clips`);

        // Split video
        const jobId = uploadId;
        const result = await splitByDuration(uploadInfo.path, duration, jobId);

        // Create ZIP
        const zipResult = await createZipArchive(result.jobDir, jobId);

        // Store job info
        completedJobs.set(jobId, {
            ...result,
            zipPath: zipResult.zipPath,
            zipSize: zipResult.size,
            completedTime: Date.now()
        });

        // Cleanup original upload
        try { fs.unlinkSync(uploadInfo.path); } catch (e) { }
        uploadedFiles.delete(uploadId);

        res.json({
            success: true,
            jobId,
            clipCount: result.clips.length,
            totalDuration: result.totalDuration,
            segmentDuration: result.segmentDuration,
            zipSize: zipResult.size
        });

    } catch (error) {
        console.error('Batch split error:', error);
        res.status(500).json({ success: false, error: 'Split failed: ' + error.message });
    }
});

/**
 * GET /api/batch/download/:jobId
 */
router.get('/download/:jobId', (req, res) => {
    const { jobId } = req.params;

    const jobInfo = completedJobs.get(jobId);
    if (!jobInfo) {
        return res.status(404).json({ success: false, error: 'Job not found or expired' });
    }

    if (!fs.existsSync(jobInfo.zipPath)) {
        completedJobs.delete(jobId);
        return res.status(404).json({ success: false, error: 'Download expired. Please process again.' });
    }

    const downloadName = `clips-${jobInfo.clipCount}pcs-${Date.now()}.zip`;

    res.download(jobInfo.zipPath, downloadName, (err) => {
        if (err && !res.headersSent) {
            console.error('Download error:', err);
        }
    });
});

/**
 * DELETE /api/batch/cleanup/:jobId
 */
router.delete('/cleanup/:jobId', (req, res) => {
    const { jobId } = req.params;
    cleanupJob(jobId);
    completedJobs.delete(jobId);
    res.json({ success: true });
});

// Error handling
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: `File too large. Max ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
        }
        return res.status(400).json({ success: false, error: 'Upload error: ' + err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
    next();
});

module.exports = router;
