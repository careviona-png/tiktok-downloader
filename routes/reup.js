/**
 * Auto Reup Safe Mode - API Routes
 * Handles video upload, processing, and download for Auto Reup feature
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const {
    processAutoReup,
    validateVideo,
    deleteFile,
    TEMP_DIR,
    MAX_FILE_SIZE
} = require('../utils/autoReup');

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
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed (MP4, WebM, MOV, AVI, MKV)'));
        }
    }
});

// Rate limiter for processing (CPU intensive)
const processLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour per IP
    message: {
        success: false,
        error: 'Too many requests. Please try again later or wait for cooldown.'
    }
});

// Store for uploaded files info
const uploadedFiles = new Map();

// Cleanup old entries periodically
setInterval(() => {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    for (const [id, info] of uploadedFiles.entries()) {
        if (now - info.uploadTime > maxAge) {
            deleteFile(info.path);
            uploadedFiles.delete(id);
        }
    }
}, 5 * 60 * 1000);

/**
 * POST /api/reup/upload
 * Upload a video file for processing
 */
router.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No video file uploaded'
            });
        }

        const filePath = req.file.path;

        // Validate video
        let videoInfo;
        try {
            videoInfo = await validateVideo(filePath);
        } catch (validationError) {
            deleteFile(filePath);
            return res.status(400).json({
                success: false,
                error: validationError.message
            });
        }

        // Generate upload ID
        const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store file info
        uploadedFiles.set(uploadId, {
            path: filePath,
            originalName: req.file.originalname,
            size: req.file.size,
            duration: videoInfo.duration,
            uploadTime: Date.now()
        });

        console.log(`📤 Reup upload: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            uploadId,
            originalName: req.file.originalname,
            size: req.file.size,
            duration: videoInfo.duration,
            message: 'Video uploaded successfully. Ready for processing.'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Upload failed: ' + error.message
        });
    }
});

/**
 * POST /api/reup/process
 * Process uploaded video with Auto Reup transformations
 */
router.post('/process', processLimiter, async (req, res) => {
    try {
        const { uploadId } = req.body;

        if (!uploadId) {
            return res.status(400).json({
                success: false,
                error: 'Upload ID is required'
            });
        }

        const uploadInfo = uploadedFiles.get(uploadId);
        if (!uploadInfo) {
            return res.status(404).json({
                success: false,
                error: 'Upload not found or expired. Please upload again.'
            });
        }

        // Check if file still exists
        if (!fs.existsSync(uploadInfo.path)) {
            uploadedFiles.delete(uploadId);
            return res.status(404).json({
                success: false,
                error: 'Upload file expired. Please upload again.'
            });
        }

        console.log(`🔄 Processing Auto Reup: ${uploadInfo.originalName}`);

        // Process video
        const result = await processAutoReup(uploadInfo.path);

        // Generate download name
        const originalExt = path.extname(uploadInfo.originalName);
        const originalBase = path.basename(uploadInfo.originalName, originalExt);
        const downloadName = `${originalBase}-reup-${Date.now()}.mp4`;

        // Send file for download
        res.download(result.outputPath, downloadName, (err) => {
            // Cleanup after download
            deleteFile(result.outputPath);

            if (err && !res.headersSent) {
                console.error('Download error:', err);
            }
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Processing failed: ' + error.message
        });
    }
});

/**
 * POST /api/reup/url
 * Process video from URL (supports TikTok, Facebook, or direct video URLs)
 */
router.post('/url', processLimiter, async (req, res) => {
    try {
        const { videoUrl } = req.body;

        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'Video URL is required'
            });
        }

        // Validate URL
        let url;
        try {
            url = new URL(videoUrl);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }

        console.log(`📥 Auto Reup from URL: ${videoUrl.substring(0, 60)}...`);

        let downloadUrl = videoUrl;
        let isTikTok = false;
        let isFacebook = false;

        // Check if it's a TikTok URL
        if (videoUrl.includes('tiktok.com') || videoUrl.includes('vm.tiktok.com')) {
            isTikTok = true;
            console.log('🎵 Detected TikTok URL, extracting video...');

            try {
                // Use existing TikTok download logic
                const tiktokUtils = require('../utils/tiktok');
                const videoData = await tiktokUtils.getVideoInfo(videoUrl);

                if (videoData && videoData.videoUrl) {
                    downloadUrl = videoData.videoUrl;
                } else if (videoData && videoData.video && videoData.video.noWatermark) {
                    downloadUrl = videoData.video.noWatermark;
                } else {
                    throw new Error('Could not extract TikTok video URL');
                }
            } catch (tikErr) {
                console.error('TikTok extraction error:', tikErr);
                return res.status(400).json({
                    success: false,
                    error: 'Không thể tải video TikTok. Vui lòng thử lại hoặc upload file trực tiếp.'
                });
            }
        }

        // Check if it's a Facebook URL
        if (videoUrl.includes('facebook.com') || videoUrl.includes('fb.watch')) {
            isFacebook = true;
            console.log('📘 Detected Facebook URL, extracting video...');

            try {
                const facebookUtils = require('../utils/facebook');
                const fbData = await facebookUtils.getVideoInfo(videoUrl);

                if (fbData && fbData.hdUrl) {
                    downloadUrl = fbData.hdUrl;
                } else if (fbData && fbData.sdUrl) {
                    downloadUrl = fbData.sdUrl;
                } else {
                    throw new Error('Could not extract Facebook video URL');
                }
            } catch (fbErr) {
                console.error('Facebook extraction error:', fbErr);
                return res.status(400).json({
                    success: false,
                    error: 'Không thể tải video Facebook. Vui lòng thử lại hoặc upload file trực tiếp.'
                });
            }
        }

        // Download video
        const tempPath = path.join(TEMP_DIR, `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mp4`);

        try {
            const response = await axios({
                method: 'GET',
                url: downloadUrl,
                responseType: 'stream',
                timeout: 120000, // 2 minutes timeout
                maxContentLength: MAX_FILE_SIZE,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': isTikTok ? 'https://www.tiktok.com/' : (isFacebook ? 'https://www.facebook.com/' : ''),
                    'Accept': '*/*'
                }
            });

            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (downloadErr) {
            console.error('Download error:', downloadErr.message);
            deleteFile(tempPath);
            return res.status(400).json({
                success: false,
                error: 'Không thể tải video từ URL. Vui lòng kiểm tra link hoặc upload file trực tiếp.'
            });
        }

        // Check if file was downloaded
        if (!fs.existsSync(tempPath)) {
            return res.status(400).json({
                success: false,
                error: 'Video download failed. Please try uploading the file directly.'
            });
        }

        const stats = fs.statSync(tempPath);
        if (stats.size < 10000) { // Less than 10KB - probably an error page
            deleteFile(tempPath);
            return res.status(400).json({
                success: false,
                error: 'URL không phải video hợp lệ. Vui lòng sử dụng direct video URL hoặc upload file.'
            });
        }

        // Validate downloaded video
        try {
            await validateVideo(tempPath);
        } catch (validationError) {
            deleteFile(tempPath);
            return res.status(400).json({
                success: false,
                error: 'Video không hợp lệ: ' + validationError.message
            });
        }

        console.log(`🔄 Processing Auto Reup from URL...`);

        // Process video
        const result = await processAutoReup(tempPath);

        // Cleanup downloaded file
        deleteFile(tempPath);

        // Generate download name
        const downloadName = `video-reup-${Date.now()}.mp4`;

        // Send file for download
        res.download(result.outputPath, downloadName, (err) => {
            deleteFile(result.outputPath);

            if (err && !res.headersSent) {
                console.error('Download error:', err);
            }
        });

    } catch (error) {
        console.error('URL processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi xử lý: ' + error.message
        });
    }
});

/**
 * DELETE /api/reup/cleanup/:uploadId
 * Clean up uploaded file
 */
router.delete('/cleanup/:uploadId', (req, res) => {
    const { uploadId } = req.params;

    const uploadInfo = uploadedFiles.get(uploadId);
    if (uploadInfo) {
        deleteFile(uploadInfo.path);
        uploadedFiles.delete(uploadId);
    }

    res.json({ success: true, message: 'Cleanup completed' });
});

/**
 * Error handling middleware for multer
 */
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
            });
        }
        return res.status(400).json({
            success: false,
            error: 'Upload error: ' + err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    next();
});

module.exports = router;
