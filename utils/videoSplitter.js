const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Temp directory for video processing
const TEMP_DIR = path.join(__dirname, '../temp');

// Limits
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_DURATION = 10 * 60; // 10 minutes in seconds

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Get FFmpeg command - handles both system and local FFmpeg
 * @returns {Promise<string>} FFmpeg command path
 */
async function getFFmpegCmd() {
    try {
        await execPromise('ffmpeg -version');
        return 'ffmpeg';
    } catch (err) {
        const isWindows = process.platform === 'win32';
        const localFfmpeg = path.join(__dirname, isWindows ? '../ffmpeg.exe' : '../ffmpeg');

        if (fs.existsSync(localFfmpeg)) {
            return `"${localFfmpeg}"`;
        }

        try {
            await execPromise('which ffmpeg');
            return 'ffmpeg';
        } catch (whichErr) {
            throw new Error('ffmpeg is not installed. On Railway, make sure nixpacks.toml includes ffmpeg.');
        }
    }
}

/**
 * Get video duration in seconds
 * @param {string} inputPath - Path to video file
 * @returns {Promise<number>} Duration in seconds
 */
async function getVideoDuration(inputPath) {
    const ffmpegCmd = await getFFmpegCmd();
    const ffprobeCmd = ffmpegCmd.replace('ffmpeg', 'ffprobe');

    const command = `${ffprobeCmd} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;

    try {
        const { stdout } = await execPromise(command);
        const duration = parseFloat(stdout.trim());
        return isNaN(duration) ? 0 : duration;
    } catch (error) {
        console.error('Error getting video duration:', error.message);
        return 0;
    }
}

/**
 * Get video info (duration, size, format)
 * @param {string} inputPath - Path to video file
 * @returns {Promise<object>} Video info object
 */
async function getVideoInfo(inputPath) {
    const duration = await getVideoDuration(inputPath);
    const stats = fs.statSync(inputPath);

    return {
        duration: duration,
        durationFormatted: formatDuration(duration),
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        filename: path.basename(inputPath)
    };
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size to human readable
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Validate file before processing
 * @param {string} filePath - Path to video file
 * @returns {Promise<object>} Validation result with isValid and error
 */
async function validateVideo(filePath) {
    const stats = fs.statSync(filePath);

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
        return {
            isValid: false,
            error: `File quá lớn. Tối đa ${formatFileSize(MAX_FILE_SIZE)}`
        };
    }

    // Check duration
    const duration = await getVideoDuration(filePath);
    if (duration > MAX_DURATION) {
        return {
            isValid: false,
            error: `Video quá dài. Tối đa ${MAX_DURATION / 60} phút`
        };
    }

    if (duration === 0) {
        return {
            isValid: false,
            error: 'Không thể đọc được video. Vui lòng kiểm tra định dạng file.'
        };
    }

    return {
        isValid: true,
        duration: duration,
        size: stats.size
    };
}

/**
 * Split video by time range
 * @param {string} inputPath - Path to input video
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {function} onProgress - Progress callback (optional)
 * @returns {Promise<string>} Path to output video
 */
async function splitVideoByTime(inputPath, startTime, endTime, onProgress = null) {
    const outputPath = path.join(TEMP_DIR, `split-${Date.now()}.mp4`);

    // Validate times
    if (startTime < 0) startTime = 0;
    if (endTime <= startTime) {
        throw new Error('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
    }

    const duration = endTime - startTime;
    if (duration < 1) {
        throw new Error('Đoạn video phải dài ít nhất 1 giây');
    }

    try {
        const ffmpegCmd = await getFFmpegCmd();

        // Use -ss before -i for faster seeking, -t for duration
        // -c:v libx264 for compatibility, -crf 18 for quality, -preset fast for speed
        const command = `${ffmpegCmd} -ss ${startTime} -i "${inputPath}" -t ${duration} -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

        console.log('🎬 Running FFmpeg split command...');
        console.log(`   Start: ${formatDuration(startTime)}, End: ${formatDuration(endTime)}, Duration: ${formatDuration(duration)}`);

        const { stdout, stderr } = await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

        console.log('✅ Video split successfully');

        return outputPath;

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        throw new Error(`Lỗi khi cắt video: ${error.message}`);
    }
}

/**
 * Cleanup old temp files (older than 30 minutes)
 */
function cleanupOldFiles() {
    if (!fs.existsSync(TEMP_DIR)) return;

    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    fs.readdir(TEMP_DIR, (err, files) => {
        if (err) return;

        files.forEach(file => {
            // Only cleanup split-* files
            if (!file.startsWith('split-') && !file.startsWith('upload-')) return;

            const filePath = path.join(TEMP_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;

                if (now - stats.mtimeMs > maxAge) {
                    fs.unlink(filePath, (err) => {
                        if (!err) console.log('🗑️ Cleaned up old file:', file);
                    });
                }
            });
        });
    });
}

/**
 * Delete a specific file
 * @param {string} filePath - Path to file to delete
 */
function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('🗑️ Deleted file:', path.basename(filePath));
        }
    } catch (err) {
        console.error('Error deleting file:', err.message);
    }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldFiles, 15 * 60 * 1000);

module.exports = {
    splitVideoByTime,
    getVideoDuration,
    getVideoInfo,
    validateVideo,
    cleanupOldFiles,
    deleteFile,
    formatDuration,
    formatFileSize,
    MAX_FILE_SIZE,
    MAX_DURATION,
    TEMP_DIR
};
