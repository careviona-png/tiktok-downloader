/**
 * Auto Subtitle Tool - Utility Module
 * Handles audio extraction, transcription via AI, and subtitle burning
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for subtitle tool (processing takes longer)

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Extract audio from video as WAV (required for some STT engines)
 */
async function extractAudio(videoPath) {
    const outputWav = path.join(TEMP_DIR, `audio-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.wav`);

    // FFmpeg command to extract mono 16khz wav (optimized for STT)
    const args = [
        '-y',
        '-i', videoPath,
        '-vn',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        outputWav
    ];

    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', args);
        process.on('close', (code) => {
            if (code === 0) resolve(outputWav);
            else reject(new Error('Audio extraction failed'));
        });
    });
}

/**
 * Transcribe audio using Groq Whisper API (High speed & Free beta tier)
 */
async function transcribeWithGroq(audioPath, language = 'vi', apiKey) {
    if (!apiKey) throw new Error('Groq API Key is required');

    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'verbose_json'); // verbose_json gives segments with timestamps
    if (language) form.append('language', language);

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${apiKey}`
            }
        });

        return response.data; // Includes segments
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        throw new Error('STT failed: ' + msg);
    }
}

/**
 * Convert Whisper segments to SRT format
 */
function segmentsToSRT(segments) {
    let srt = '';

    segments.forEach((seg, i) => {
        const start = formatSRTTime(seg.start);
        const end = formatSRTTime(seg.end);
        const text = seg.text.trim();

        srt += `${i + 1}\n${start} --> ${end}\n${text}\n\n`;
    });

    return srt;
}

function formatSRTTime(seconds) {
    const date = new Date(seconds * 1000);
    const hh = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * Burn subtitles into video
 */
async function burnSubtitles(videoPath, srtPath) {
    const outputVideo = path.join(TEMP_DIR, `subtitled-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`);

    // FFmpeg subtitle filter needs escaped path for Windows
    // subtitles='C\:\\path\\to\\subs.srt'
    const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    const subtitleFilter = `subtitles='${escapedSrtPath}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=20'`;

    const args = [
        '-y',
        '-i', videoPath,
        '-vf', subtitleFilter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        outputVideo
    ];

    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', args);

        let stderr = '';
        process.stderr.on('data', (d) => stderr += d.toString());

        process.on('close', (code) => {
            if (code === 0) resolve(outputVideo);
            else {
                console.error('FFmpeg burn error:', stderr);
                reject(new Error('Subtitle burning failed'));
            }
        });
    });
}

/**
 * Main process pipeline
 */
async function processAutoSubtitles(videoPath, options = {}) {
    const { language = 'vi', apiKey } = options;
    let audioPath = null;
    let srtPath = null;

    try {
        // 1. Extract Audio
        console.log('--- Step 1: Extracting Audio');
        audioPath = await extractAudio(videoPath);

        // 2. Transcribe
        console.log('--- Step 2: Transcribing');
        const transcription = await transcribeWithGroq(audioPath, language, apiKey);

        // 3. Generate SRT
        console.log('--- Step 3: Generating SRT');
        const srtContent = segmentsToSRT(transcription.segments);
        srtPath = path.join(TEMP_DIR, `subs-${Date.now()}.srt`);
        fs.writeFileSync(srtPath, srtContent);

        // 4. Burn into video
        console.log('--- Step 4: Burning Subtitles');
        const resultVideo = await burnSubtitles(videoPath, srtPath);

        return {
            outputPath: resultVideo,
            srtPath: srtPath,
            filename: path.basename(resultVideo)
        };

    } finally {
        // Cleanup intermediates
        if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        // Keep result files for the route to send, then delete there
    }
}

module.exports = {
    processAutoSubtitles,
    deleteFile: (p) => fs.existsSync(p) && fs.unlinkSync(p)
};
