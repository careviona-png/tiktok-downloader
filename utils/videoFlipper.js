const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Temp directory for video processing
const TEMP_DIR = path.join(__dirname, '../../temp');
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://www.tikwm.com/',
    'Cache-Control': 'max-age=0'
};

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Download video from URL (with redirect support)
 * @param {string} videoUrl - URL of video to download
 * @returns {Promise<string>} Path to downloaded video
 */
async function downloadVideo(videoUrl) {
    const tempPath = path.join(TEMP_DIR, `temp-${Date.now()}.mp4`);

    try {
        console.log('📥 Downloading video from:', videoUrl);

        // Use axios to handle redirects automatically
        const response = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream',
            maxRedirects: 5,
            timeout: 60000, // 60s
            headers: BROWSER_HEADERS
        });

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log('✅ Video downloaded successfully');
                resolve(tempPath);
            });
            writer.on('error', (err) => {
                fs.unlink(tempPath, () => { });
                reject(err);
            });
        });

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        throw new Error(`Failed to download video: ${error.message}`);
    }
}

/**
 * Flip video horizontally using ffmpeg
 * @param {string} inputPath - Path to input video
 * @returns {Promise<string>} Path to flipped video
 */
async function flipVideo(inputPath) {
    const outputPath = path.join(TEMP_DIR, `flipped-${Date.now()}.mp4`);

    try {
        // Check if ffmpeg is installed (try global first, then local)
        let ffmpegCmd = 'ffmpeg';
        try {
            await execPromise('ffmpeg -version');
        } catch (err) {
            // Check if ffmpeg.exe exists in backend folder
            const localFfmpeg = path.join(__dirname, '../ffmpeg.exe');
            if (fs.existsSync(localFfmpeg)) {
                ffmpegCmd = `"${localFfmpeg}"`;
                console.log('📂 Using local ffmpeg from:', localFfmpeg);
            } else {
                throw new Error('ffmpeg is not installed. Please install ffmpeg or copy ffmpeg.exe to backend folder.');
            }
        }

        // Flip video horizontally with high quality
        const command = `${ffmpegCmd} -i "${inputPath}" -vf "hflip" -c:v libx264 -crf 18 -preset fast -c:a copy "${outputPath}"`;

        console.log('🎬 Running ffmpeg command...');
        const { stdout, stderr } = await execPromise(command);

        console.log('✅ Video flipped successfully');

        return outputPath;

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        throw new Error(`ffmpeg error: ${error.message}`);
    }
}

/**
 * Extract audio from video using ffmpeg
 * @param {string} inputPath - Path to input video
 * @returns {Promise<string>} Path to extracted audio
 */
async function extractAudio(inputPath) {
    const outputPath = path.join(TEMP_DIR, `audio-${Date.now()}.mp3`);

    try {
        // Check if ffmpeg is installed (try global first, then local)
        let ffmpegCmd = 'ffmpeg';
        try {
            await execPromise('ffmpeg -version');
        } catch (err) {
            const localFfmpeg = path.join(__dirname, '../ffmpeg.exe');
            if (fs.existsSync(localFfmpeg)) {
                ffmpegCmd = `"${localFfmpeg}"`;
            } else {
                throw new Error('ffmpeg is not installed. Please install ffmpeg or copy ffmpeg.exe to backend folder.');
            }
        }

        // Extract audio with high quality
        const command = `${ffmpegCmd} -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`;

        console.log('🎬 Running ffmpeg extract audio command...');
        const { stdout, stderr } = await execPromise(command);

        console.log('✅ Audio extracted successfully');

        return outputPath;

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        throw new Error(`ffmpeg audio extraction error: ${error.message}`);
    }
}

/**
 * Cleanup old temp files (older than 1 hour)
 */
function cleanupOldFiles() {
    if (!fs.existsSync(TEMP_DIR)) return;

    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    fs.readdir(TEMP_DIR, (err, files) => {
        if (err) return;

        files.forEach(file => {
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

// Run cleanup every 30 minutes
setInterval(cleanupOldFiles, 30 * 60 * 1000);

module.exports = {
    downloadVideo,
    flipVideo,
    extractAudio,
    cleanupOldFiles
};
