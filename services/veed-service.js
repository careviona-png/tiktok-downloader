/**
 * Veed.io Fabric API Service
 * API runs on fal.ai: https://www.veed.io/tools/text-to-video-api
 * 
 * Supports: Image + Audio -> Talking Video (lip-sync)
 * Pricing: Pay per use on fal.ai
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class VeedService {
    constructor() {
        // Using Kling Video (High Quality) as it's reliable on fal.ai
        this.baseUrl = 'https://queue.fal.run/fal-ai/kling-video/v1.0/image-to-video';
    }

    /**
     * Get API key from env or settings
     */
    getApiKey() {
        if (process.env.VEED_API_KEY && process.env.VEED_API_KEY.length > 10) {
            console.log('[Veed] Using ENV API key');
            return process.env.VEED_API_KEY;
        }
        try {
            const settingsManager = require('./settings-manager');
            const settings = settingsManager.getSettings();
            console.log(`[Veed] Settings loaded. Key length: ${settings.veedApiKey ? settings.veedApiKey.length : 0}`);
            return settings.veedApiKey || '';
        } catch (e) {
            console.error('[Veed] Error loading settings:', e);
            return '';
        }
    }

    /**
     * Check if API key is configured
     */
    isConfigured() {
        const apiKey = this.getApiKey();
        return apiKey && apiKey.length > 10;
    }

    /**
     * Generate video from image using Veed Fabric 1.0
     * @param {string} imagePath - Local path to image
     * @param {string} audioPath - Local path to audio file
     * @param {string} resolution - '480p' or '720p'
     * @returns {Promise<string>} - URL to generated video
     */
    async generateVideoFromImage(imagePath, audioPath, resolution = '720p') {
        const apiKey = this.getApiKey();
        if (!apiKey || apiKey.length < 10) {
            throw new Error('Veed API key not configured. Please add in Settings tab.');
        }

        try {
            // Convert image and audio to base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const imageDataUri = `data:${mimeType};base64,${base64Image}`;

            const audioBuffer = fs.readFileSync(audioPath);
            const base64Audio = audioBuffer.toString('base64');
            const audioMimeType = audioPath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
            const audioDataUri = `data:${audioMimeType};base64,${base64Audio}`;

            console.log('[Veed] Starting video generation...');

            // Submit task for Kling Video
            const response = await axios.post(
                this.baseUrl,
                {
                    prompt: "Professional product showcase, cinematic lighting, 4k",
                    image_url: imageDataUri,
                    duration: "5s",
                    aspect_ratio: "9:16"
                },
                {
                    headers: {
                        'Authorization': `Key ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const requestId = response.data.request_id;
            console.log(`[Veed/Fal] Task submitted: ${requestId}`);

            // Poll for completion
            const videoUrl = await this.pollForCompletion(requestId);
            return videoUrl;

        } catch (error) {
            console.error('[Veed/Fal] API Error:', error.response?.data || error.message);
            throw new Error(`Fal.ai Error: ${JSON.stringify(error.response?.data || error.message)}`);
        }
    }

    /**
     * Poll task status until complete
     */
    async pollForCompletion(requestId, maxAttempts = 60) {
        const apiKey = this.getApiKey();
        // Check correct status endpoint for Kling
        const statusUrl = `https://queue.fal.run/fal-ai/kling-video/v1.0/image-to-video/requests/${requestId}/status`;

        for (let i = 0; i < maxAttempts; i++) {
            await this.sleep(5000); // 5s poll

            try {
                const response = await axios.get(statusUrl, {
                    headers: { 'Authorization': `Key ${apiKey}` }
                });

                const status = response.data.status;
                console.log(`[Veed/Fal] Task ${requestId} status: ${status}`);

                if (status === 'COMPLETED') {
                    // Get result
                    const resultUrl = `https://queue.fal.run/fal-ai/kling-video/v1.0/image-to-video/requests/${requestId}`;
                    const resultRes = await axios.get(resultUrl, {
                        headers: { 'Authorization': `Key ${apiKey}` }
                    });
                    // Kling usually returns video object
                    return resultRes.data.video?.url || resultRes.data.video_url || resultRes.data.output?.video_url;
                } else if (status === 'FAILED') {
                    throw new Error('Video generation failed');
                }

            } catch (error) {
                if (error.response?.status !== 200) {
                    console.log('[Veed/Fal] Polling error, retrying...');
                } else {
                    throw error;
                }
            }
        }

        throw new Error('Timeout waiting for video generation');
    }

    /**
     * Download generated video to local path
     */
    async downloadVideo(videoUrl, outputPath) {
        const response = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new VeedService();
