/**
 * Safe Audio Modifier - Utility Module
 * Applies subtle random audio transformations to avoid duplicate detection
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
 * Generate random audio transformation parameters
 * All values are subtle and imperceptible to human ears
 */
function generateRandomAudioParams() {
    return {
        // Pitch shift: 0.97 - 1.03 (±3%)
        pitch: (0.97 + Math.random() * 0.06).toFixed(4),

        // Tempo/speed: 0.97 - 1.03 (±3%)
        tempo: (0.97 + Math.random() * 0.06).toFixed(4),

        // Very subtle echo (almost imperceptible)
        echoEnabled: Math.random() > 0.7,
        echoDelay: (2 + Math.random() * 4).toFixed(0), // 2-6ms
        echoDecay: (0.1 + Math.random() * 0.1).toFixed(2), // 0.1-0.2

        // Subtle bass/treble adjustment
        bass: (-1 + Math.random() * 2).toFixed(1), // -1 to +1 dB
        treble: (-1 + Math.random() * 2).toFixed(1), // -1 to +1 dB

        // Unique ID
        uniqueId: crypto.randomBytes(6).toString('hex')
    };
}

/**
 * Process video/audio with safe audio modifications
 */
async function processAudioSafe(inputPath) {
    // Validate file
    if (!fs.existsSync(inputPath)) {
        throw new Error('File not found');
    }

    const stats = fs.statSync(inputPath);
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Generate random params
    const params = generateRandomAudioParams();

    // Output path
    const outputFilename = `audio-safe-${Date.now()}-${params.uniqueId}.mp4`;
    const outputPath = path.join(TEMP_DIR, outputFilename);

    // Build audio filter chain
    const audioFilters = [];

    // 1. Pitch shift using asetrate + atempo combo
    // asetrate changes pitch, atempo compensates for speed change
    const pitchFactor = parseFloat(params.pitch);
    audioFilters.push(`asetrate=44100*${pitchFactor}`);
    audioFilters.push(`atempo=${(1 / pitchFactor).toFixed(4)}`);

    // 2. Apply tempo change
    const tempoFactor = parseFloat(params.tempo);
    audioFilters.push(`atempo=${tempoFactor}`);

    // 3. Subtle echo (if enabled)
    if (params.echoEnabled) {
        audioFilters.push(`aecho=0.8:0.8:${params.echoDelay}:${params.echoDecay}`);
    }

    // 4. Subtle EQ adjustment
    audioFilters.push(`bass=g=${params.bass}`);
    audioFilters.push(`treble=g=${params.treble}`);

    // 5. Normalize to prevent clipping
    audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');

    console.log(`🔊 Safe Audio Processing...`);
    console.log(`   Pitch: ${(parseFloat(params.pitch) * 100).toFixed(1)}%`);
    console.log(`   Tempo: ${(parseFloat(params.tempo) * 100).toFixed(1)}%`);
    console.log(`   Echo: ${params.echoEnabled ? 'Yes' : 'No'}`);
    console.log(`   Bass: ${params.bass}dB, Treble: ${params.treble}dB`);

    const ffmpegCmd = 'ffmpeg';
    const args = [
        '-y',
        '-i', inputPath,
        '-af', audioFilters.join(','),
        '-c:v', 'copy', // Copy video stream without re-encoding
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-metadata', `creation_time=${new Date().toISOString()}`,
        '-metadata', `encoder=TikDown-AudioSafe-${params.uniqueId}`,
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
                console.log(`✅ Audio Safe completed: ${outputFilename}`);
                resolve({
                    outputPath,
                    filename: outputFilename,
                    params
                });
            } else {
                console.error(`❌ Audio Safe failed: ${stderr.slice(-500)}`);
                reject(new Error('Audio processing failed'));
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
            if (file.startsWith('audio-safe-')) {
                const filePath = path.join(TEMP_DIR, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtimeMs > maxAge) {
                    deleteFile(filePath);
                    cleaned++;
                }
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old audio-safe files`);
        }
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
}

// Cleanup every 15 minutes
setInterval(cleanupOldFiles, 15 * 60 * 1000);
cleanupOldFiles();

module.exports = {
    processAudioSafe,
    generateRandomAudioParams,
    deleteFile,
    TEMP_DIR,
    MAX_FILE_SIZE
};
