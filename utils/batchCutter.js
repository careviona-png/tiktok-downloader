/**
 * Batch Video Cutter - Utility Module
 * Automatically splits videos into multiple clips
 */

const { exec, spawn } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const execPromise = util.promisify(exec);

// Configuration
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DURATION = 60 * 60; // 60 minutes
const MIN_SEGMENT = 5; // 5 seconds minimum
const MAX_SEGMENTS = 100; // Maximum clips per job

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(inputPath) {
    const ffprobeCmd = 'ffprobe';
    const command = `${ffprobeCmd} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;

    try {
        const { stdout } = await execPromise(command);
        return parseFloat(stdout.trim());
    } catch (error) {
        throw new Error('Failed to get video duration: ' + error.message);
    }
}

/**
 * Validate video for batch cutting
 */
async function validateVideo(inputPath) {
    if (!fs.existsSync(inputPath)) {
        throw new Error('Video file not found');
    }

    const stats = fs.statSync(inputPath);
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const duration = await getVideoDuration(inputPath);
    if (duration > MAX_DURATION) {
        throw new Error(`Video too long. Maximum duration is ${MAX_DURATION / 60} minutes`);
    }

    if (duration < MIN_SEGMENT) {
        throw new Error(`Video too short. Minimum duration is ${MIN_SEGMENT} seconds`);
    }

    return { duration, size: stats.size };
}

/**
 * Split video by duration (e.g., every 30 seconds)
 */
async function splitByDuration(inputPath, segmentSeconds, jobId) {
    const videoInfo = await validateVideo(inputPath);
    const duration = videoInfo.duration;

    // Calculate number of segments
    const numSegments = Math.ceil(duration / segmentSeconds);
    if (numSegments > MAX_SEGMENTS) {
        throw new Error(`Too many segments (${numSegments}). Maximum is ${MAX_SEGMENTS}. Try a longer segment duration.`);
    }

    // Create job directory
    const jobDir = path.join(TEMP_DIR, `batch-${jobId}`);
    if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
    }

    const outputPattern = path.join(jobDir, 'clip_%03d.mp4');

    console.log(`✂️ Batch cutting: ${numSegments} clips of ${segmentSeconds}s each`);

    // FFmpeg segment command - fast copy mode
    const ffmpegCmd = 'ffmpeg';
    const args = [
        '-y',
        '-i', inputPath,
        '-f', 'segment',
        '-segment_time', segmentSeconds.toString(),
        '-c', 'copy', // Fast copy, no re-encoding
        '-reset_timestamps', '1',
        '-map', '0',
        outputPattern
    ];

    return new Promise((resolve, reject) => {
        const process = spawn(ffmpegCmd, args);

        let stderr = '';
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                // Get list of created clips
                const clips = fs.readdirSync(jobDir)
                    .filter(f => f.startsWith('clip_') && f.endsWith('.mp4'))
                    .sort()
                    .map(f => ({
                        name: f,
                        path: path.join(jobDir, f),
                        size: fs.statSync(path.join(jobDir, f)).size
                    }));

                console.log(`✅ Created ${clips.length} clips`);

                resolve({
                    jobId,
                    jobDir,
                    clips,
                    totalDuration: duration,
                    segmentDuration: segmentSeconds
                });
            } else {
                console.error(`❌ Batch cut failed: ${stderr.slice(-500)}`);
                reject(new Error('Video splitting failed'));
            }
        });

        process.on('error', (err) => {
            reject(new Error('FFmpeg not found: ' + err.message));
        });
    });
}

/**
 * Split video by number of clips
 */
async function splitByCount(inputPath, numClips, jobId) {
    const videoInfo = await validateVideo(inputPath);
    const duration = videoInfo.duration;

    if (numClips > MAX_SEGMENTS) {
        throw new Error(`Too many clips. Maximum is ${MAX_SEGMENTS}`);
    }

    const segmentSeconds = Math.floor(duration / numClips);
    if (segmentSeconds < MIN_SEGMENT) {
        throw new Error(`Segments would be too short. Minimum is ${MIN_SEGMENT}s per clip`);
    }

    return splitByDuration(inputPath, segmentSeconds, jobId);
}

/**
 * Create ZIP archive from clips
 */
async function createZipArchive(jobDir, jobId) {
    const zipPath = path.join(TEMP_DIR, `clips-${jobId}.zip`);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 5 } });

        output.on('close', () => {
            console.log(`📦 ZIP created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
            resolve({
                zipPath,
                size: archive.pointer()
            });
        });

        archive.on('error', (err) => {
            reject(new Error('Failed to create ZIP: ' + err.message));
        });

        archive.pipe(output);

        // Add all clips to archive
        const clips = fs.readdirSync(jobDir).filter(f => f.endsWith('.mp4'));
        clips.forEach(clip => {
            archive.file(path.join(jobDir, clip), { name: clip });
        });

        archive.finalize();
    });
}

/**
 * Cleanup job files
 */
function cleanupJob(jobId) {
    const jobDir = path.join(TEMP_DIR, `batch-${jobId}`);
    const zipPath = path.join(TEMP_DIR, `clips-${jobId}.zip`);

    try {
        if (fs.existsSync(jobDir)) {
            fs.rmSync(jobDir, { recursive: true });
        }
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
        console.log(`🗑️ Cleaned up job: ${jobId}`);
    } catch (err) {
        console.error(`Cleanup error for ${jobId}:`, err.message);
    }
}

/**
 * Cleanup old jobs (older than 30 minutes)
 */
function cleanupOldJobs() {
    const maxAge = 30 * 60 * 1000;
    const now = Date.now();

    try {
        const items = fs.readdirSync(TEMP_DIR);
        let cleaned = 0;

        for (const item of items) {
            if (item.startsWith('batch-') || item.startsWith('clips-')) {
                const itemPath = path.join(TEMP_DIR, item);
                const stats = fs.statSync(itemPath);

                if (now - stats.mtimeMs > maxAge) {
                    if (stats.isDirectory()) {
                        fs.rmSync(itemPath, { recursive: true });
                    } else {
                        fs.unlinkSync(itemPath);
                    }
                    cleaned++;
                }
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old batch jobs`);
        }
    } catch (err) {
        console.error('Batch cleanup error:', err.message);
    }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldJobs, 15 * 60 * 1000);
cleanupOldJobs();

module.exports = {
    splitByDuration,
    splitByCount,
    createZipArchive,
    cleanupJob,
    getVideoDuration,
    validateVideo,
    TEMP_DIR,
    MAX_FILE_SIZE,
    MAX_DURATION,
    MIN_SEGMENT,
    MAX_SEGMENTS
};
