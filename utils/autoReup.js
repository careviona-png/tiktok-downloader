/**
 * Auto Reup Safe Mode - Video Transformation Utility
 * Applies subtle, randomized transformations to reduce duplicate detection
 */

const { exec, spawn } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const execPromise = util.promisify(exec);

// Configuration
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DURATION = 30 * 60; // 30 minutes

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Generate random transformation parameters
 * All values are subtle and human-unnoticeable
 */
function generateRandomTransforms() {
    return {
        // Speed: 0.97x - 1.03x (±3%)
        speed: 0.97 + Math.random() * 0.06,

        // Brightness: -0.02 to +0.02
        brightness: (-0.02 + Math.random() * 0.04).toFixed(3),

        // Contrast: 0.98 - 1.02
        contrast: (0.98 + Math.random() * 0.04).toFixed(3),

        // Saturation: 0.98 - 1.02
        saturation: (0.98 + Math.random() * 0.04).toFixed(3),

        // Horizontal flip: 50% chance
        mirror: Math.random() > 0.5,

        // Crop percentage: 1-2% from edges
        cropPercent: (0.01 + Math.random() * 0.01).toFixed(3),

        // Gamma: 0.98 - 1.02
        gamma: (0.98 + Math.random() * 0.04).toFixed(3),

        // Unique ID for metadata
        uniqueId: crypto.randomBytes(8).toString('hex')
    };
}

/**
 * Get video information using ffprobe
 */
async function getVideoInfo(inputPath) {
    const ffprobeCmd = process.platform === 'win32' ? 'ffprobe' : 'ffprobe';
    const command = `${ffprobeCmd} -v quiet -print_format json -show_format -show_streams "${inputPath}"`;

    try {
        const { stdout } = await execPromise(command);
        return JSON.parse(stdout);
    } catch (error) {
        throw new Error('Failed to analyze video: ' + error.message);
    }
}

/**
 * Validate video file
 */
async function validateVideo(inputPath) {
    // Check file exists
    if (!fs.existsSync(inputPath)) {
        throw new Error('Video file not found');
    }

    // Check file size
    const stats = fs.statSync(inputPath);
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Get video info
    const info = await getVideoInfo(inputPath);

    if (!info.streams || !info.streams.some(s => s.codec_type === 'video')) {
        throw new Error('No valid video stream found');
    }

    // Check duration
    const duration = parseFloat(info.format?.duration || 0);
    if (duration > MAX_DURATION) {
        throw new Error(`Video too long. Maximum duration is ${MAX_DURATION / 60} minutes`);
    }

    return {
        duration,
        size: stats.size,
        format: info.format?.format_name,
        videoStream: info.streams.find(s => s.codec_type === 'video'),
        audioStream: info.streams.find(s => s.codec_type === 'audio')
    };
}

/**
 * Process video with Auto Reup transformations
 */
async function processAutoReup(inputPath, onProgress = null) {
    // Validate input
    const videoInfo = await validateVideo(inputPath);

    // Generate random transformations
    const transforms = generateRandomTransforms();

    // Create unique output filename
    const outputFilename = `reup-${Date.now()}-${transforms.uniqueId}.mp4`;
    const outputPath = path.join(TEMP_DIR, outputFilename);

    // Build filter chain
    const filters = [];

    // 1. Crop (subtle edge removal)
    const cropFactor = 1 - parseFloat(transforms.cropPercent);
    filters.push(`crop=iw*${cropFactor}:ih*${cropFactor}`);

    // 2. Scale back to original size to maintain resolution
    if (videoInfo.videoStream) {
        const width = videoInfo.videoStream.width;
        const height = videoInfo.videoStream.height;
        filters.push(`scale=${width}:${height}`);
    }

    // 3. Color adjustments (brightness, contrast, saturation, gamma)
    filters.push(`eq=brightness=${transforms.brightness}:contrast=${transforms.contrast}:saturation=${transforms.saturation}:gamma=${transforms.gamma}`);

    // 4. Horizontal flip (random)
    if (transforms.mirror) {
        filters.push('hflip');
    }

    // 5. Speed adjustment (affects video)
    const speedFactor = transforms.speed.toFixed(4);
    filters.push(`setpts=${(1 / transforms.speed).toFixed(4)}*PTS`);

    // Build audio filter (tempo for speed)
    const audioFilters = [];
    if (videoInfo.audioStream) {
        // atempo only accepts 0.5 - 2.0
        audioFilters.push(`atempo=${speedFactor}`);
    }

    // Build FFmpeg command
    const ffmpegCmd = process.platform === 'win32' ? 'ffmpeg' : 'ffmpeg';

    const args = [
        '-y',
        '-i', inputPath,
        '-vf', filters.join(','),
    ];

    // Add audio filter if audio exists
    if (audioFilters.length > 0) {
        args.push('-af', audioFilters.join(','));
    }

    // Output settings - high quality, fast encoding
    args.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18', // High quality
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        // Update metadata
        '-metadata', `creation_time=${new Date().toISOString()}`,
        '-metadata', `encoder=TikDown-Reup-${transforms.uniqueId}`,
        '-metadata', `comment=Processed by TikDown Auto Reup`,
        outputPath
    );

    console.log(`🔄 Auto Reup Processing...`);
    console.log(`   Speed: ${(transforms.speed * 100).toFixed(1)}%`);
    console.log(`   Brightness: ${transforms.brightness}`);
    console.log(`   Contrast: ${transforms.contrast}`);
    console.log(`   Mirror: ${transforms.mirror ? 'Yes' : 'No'}`);
    console.log(`   Crop: ${(parseFloat(transforms.cropPercent) * 100).toFixed(1)}%`);

    return new Promise((resolve, reject) => {
        const process = spawn(ffmpegCmd, args);

        let stderr = '';

        process.stderr.on('data', (data) => {
            stderr += data.toString();

            // Parse progress if callback provided
            if (onProgress) {
                const timeMatch = stderr.match(/time=(\d+):(\d+):(\d+)/);
                if (timeMatch && videoInfo.duration > 0) {
                    const currentTime = parseInt(timeMatch[1]) * 3600 +
                        parseInt(timeMatch[2]) * 60 +
                        parseInt(timeMatch[3]);
                    const progress = Math.min(95, (currentTime / videoInfo.duration) * 100);
                    onProgress(progress);
                }
            }
        });

        process.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Auto Reup completed: ${outputFilename}`);
                resolve({
                    outputPath,
                    filename: outputFilename,
                    transforms,
                    originalSize: videoInfo.size,
                    originalDuration: videoInfo.duration
                });
            } else {
                console.error(`❌ Auto Reup failed: ${stderr.slice(-500)}`);
                reject(new Error('Video processing failed'));
            }
        });

        process.on('error', (err) => {
            reject(new Error('FFmpeg not found or failed to start: ' + err.message));
        });
    });
}

/**
 * Delete a file safely
 */
function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted: ${path.basename(filePath)}`);
            return true;
        }
    } catch (err) {
        console.error(`Failed to delete ${filePath}:`, err.message);
    }
    return false;
}

/**
 * Cleanup old temporary files (older than 30 minutes)
 */
function cleanupOldFiles() {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    try {
        const files = fs.readdirSync(TEMP_DIR);
        let cleaned = 0;

        for (const file of files) {
            if (file.startsWith('reup-')) {
                const filePath = path.join(TEMP_DIR, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtimeMs > maxAge) {
                    deleteFile(filePath);
                    cleaned++;
                }
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old reup files`);
        }
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldFiles, 15 * 60 * 1000);

// Initial cleanup on module load
cleanupOldFiles();

module.exports = {
    processAutoReup,
    validateVideo,
    getVideoInfo,
    generateRandomTransforms,
    deleteFile,
    cleanupOldFiles,
    TEMP_DIR,
    MAX_FILE_SIZE,
    MAX_DURATION
};
