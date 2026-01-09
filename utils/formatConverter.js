/**
 * Video Format Converter - Utility Module
 * Converts 16:9 videos to 9:16 for TikTok/Shorts/Reels
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Configuration
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Convert mode options
 */
const CONVERT_MODES = {
    CROP_CENTER: 'crop',      // Crop to 9:16, centered
    BLUR_BACKGROUND: 'blur',   // Add blurred background
    FIT_BLACK: 'black'         // Fit with black bars (pillarbox)
};

/**
 * Convert video from landscape (16:9) to portrait (9:16)
 * @param {string} inputPath - Input video path
 * @param {string} mode - Conversion mode: 'crop', 'blur', 'black'
 */
async function convertToPortrait(inputPath, mode = 'blur') {
    // Validate file
    if (!fs.existsSync(inputPath)) {
        throw new Error('File not found');
    }

    const stats = fs.statSync(inputPath);
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const uniqueId = crypto.randomBytes(6).toString('hex');
    const outputFilename = `portrait-${Date.now()}-${uniqueId}.mp4`;
    const outputPath = path.join(TEMP_DIR, outputFilename);

    // Build filter based on mode
    let videoFilter;

    switch (mode) {
        case CONVERT_MODES.CROP_CENTER:
            // Crop center to 9:16 ratio
            // Calculate: height stays, width = height * 9/16
            videoFilter = 'crop=ih*9/16:ih,scale=1080:1920';
            break;

        case CONVERT_MODES.FIT_BLACK:
            // Fit inside 9:16 with black bars
            videoFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';
            break;

        case CONVERT_MODES.BLUR_BACKGROUND:
        default:
            // Blurred background effect (most popular for Shorts)
            // 1. Create blurred background scaled to fill 9:16
            // 2. Overlay original video centered
            videoFilter = [
                'split[original][forblur]',
                '[forblur]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[blurred]',
                '[original]scale=1080:-2:force_original_aspect_ratio=decrease[scaled]',
                '[blurred][scaled]overlay=(W-w)/2:(H-h)/2'
            ].join(';');
            break;
    }

    console.log(`🎬 Format Convert: ${mode} mode`);
    console.log(`   Output: 1080x1920 (9:16)`);

    const ffmpegCmd = 'ffmpeg';
    const args = [
        '-y',
        '-i', inputPath,
        '-vf', videoFilter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-metadata', `creation_time=${new Date().toISOString()}`,
        '-metadata', 'encoder=TikDown-FormatConverter',
        outputPath
    ];

    return new Promise((resolve, reject) => {
        const process = spawn(ffmpegCmd, args);

        let stderr = '';
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Format Convert completed: ${outputFilename}`);
                resolve({
                    outputPath,
                    filename: outputFilename,
                    mode
                });
            } else {
                console.error(`❌ Format Convert failed: ${stderr.slice(-500)}`);
                reject(new Error('Video conversion failed'));
            }
        });

        process.on('error', (err) => {
            reject(new Error('FFmpeg not found: ' + err.message));
        });
    });
}

/**
 * Delete file safely
 */
function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch (err) {
        console.error(`Delete error: ${err.message}`);
    }
    return false;
}

/**
 * Cleanup old files
 */
function cleanupOldFiles() {
    const maxAge = 30 * 60 * 1000;
    const now = Date.now();

    try {
        const files = fs.readdirSync(TEMP_DIR);
        let cleaned = 0;

        for (const file of files) {
            if (file.startsWith('portrait-')) {
                const filePath = path.join(TEMP_DIR, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtimeMs > maxAge) {
                    deleteFile(filePath);
                    cleaned++;
                }
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old portrait files`);
        }
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
}

// Cleanup every 15 minutes
setInterval(cleanupOldFiles, 15 * 60 * 1000);
cleanupOldFiles();

module.exports = {
    convertToPortrait,
    deleteFile,
    CONVERT_MODES,
    TEMP_DIR,
    MAX_FILE_SIZE
};
