/**
 * Runway ML API Service
 * API Docs: https://docs.runwayml.com/
 * 
 * Requires: RUNWAY_API_KEY in .env
 * Pricing: ~$0.05-0.10 per second of video generated
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class RunwayService {
    constructor() {
        this.baseUrl = 'https://api.runwayml.com/v1';
    }

    /**
     * Get API key from env or settings
     */
    getApiKey() {
        // First check env
        if (process.env.RUNWAY_API_KEY && process.env.RUNWAY_API_KEY.length > 10) {
            return process.env.RUNWAY_API_KEY;
        }
        // Then check settings file
        try {
            const settingsManager = require('./settings-manager');
            const settings = settingsManager.getSettings();
            return settings.runwayApiKey || '';
        } catch (e) {
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
     * Generate video from image using Runway Gen-3
     * @param {string} imagePath - Local path to image
     * @param {string} prompt - Text prompt for video generation
     * @param {number} duration - Video duration in seconds (5 or 10)
     * @returns {Promise<string>} - URL to generated video
     */
    async generateVideoFromImage(imagePath, prompt, duration = 5) {
        const apiKey = this.getApiKey();
        if (!apiKey || apiKey.length < 10) {
            throw new Error('Runway API key not configured. Please add in Settings tab or .env file.');
        }

        try {
            // Step 1: Upload image to get a hosted URL (or use base64)
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const dataUri = `data:${mimeType};base64,${base64Image}`;

            console.log('[Runway] Starting video generation...');

            // Step 2: Create generation task
            const response = await axios.post(
                `${this.baseUrl}/image_to_video`,
                {
                    model: 'gen3a_turbo', // or 'gen3a' for higher quality
                    promptImage: dataUri,
                    promptText: prompt || 'Smooth cinematic motion, professional product advertisement, subtle zoom and pan',
                    duration: duration, // 5 or 10 seconds
                    ratio: '9:16', // Vertical for TikTok/Shorts
                    seed: Math.floor(Math.random() * 1000000),
                    watermark: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'X-Runway-Version': '2024-11-06'
                    },
                    timeout: 30000
                }
            );

            const taskId = response.data.id;
            console.log(`[Runway] Task created: ${taskId}`);

            // Step 3: Poll for completion
            const videoUrl = await this.pollForCompletion(taskId);
            return videoUrl;

        } catch (error) {
            console.error('[Runway] API Error:', error.response?.data || error.message);
            throw new Error(`Runway API Error: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Poll task status until complete
     */
    async pollForCompletion(taskId, maxAttempts = 60) {
        const apiKey = this.getApiKey();
        for (let i = 0; i < maxAttempts; i++) {
            await this.sleep(5000); // Wait 5 seconds between polls

            try {
                const response = await axios.get(
                    `${this.baseUrl}/tasks/${taskId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'X-Runway-Version': '2024-11-06'
                        }
                    }
                );

                const status = response.data.status;
                console.log(`[Runway] Task ${taskId} status: ${status}`);

                if (status === 'SUCCEEDED') {
                    return response.data.output[0]; // Video URL
                } else if (status === 'FAILED') {
                    throw new Error('Video generation failed: ' + (response.data.failure || 'Unknown error'));
                }
                // Continue polling if PENDING or RUNNING

            } catch (error) {
                if (error.response?.status === 404) {
                    console.log('[Runway] Task not found yet, retrying...');
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

module.exports = new RunwayService();
