const express = require('express');
const router = express.Router();
const videoGenerator = require('../services/video-gen/video-generator');

// POST /api/affiliate/generate
// 1. Extract & Draft (Step 1)
router.post('/draft', async (req, res) => {
    try {
        const { url, variant } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'Product URL is required' });

        console.log(`[AffiliateAPI] Creating Draft for: ${url}`);
        const draft = await videoGenerator.prepareDraft(url, variant || 'A');

        // Transform local paths to public URLs if needed, but for now we just send back to Client to display
        // Actually, Client can't display local paths. We need to serve the draft images.
        // We'll serve via a temp route or copy to public temporarily?
        // Better: We return the list, and Client confirms. Images are in temp. 
        // We need a route to serve temp images or simple base64? 
        // Let's assume for MVP we serve via a new static route or mapped ID.

        // Hack: We return the absolute paths, but Client can't see them.
        // FIX: Start serving "temp" folder in server.js or move images to public/temp_previews.

        res.json({ success: true, data: draft });

    } catch (error) {
        console.error('[AffiliateAPI] Draft Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Render (Step 2) - FFMPEG
router.post('/render', async (req, res) => {
    try {
        const { draftId, script, selectedImages } = req.body;
        if (!draftId) return res.status(400).json({ success: false, error: 'Draft ID required' });

        console.log(`[AffiliateAPI] Rendering Draft: ${draftId}`);
        const result = await videoGenerator.renderFromDraft(draftId, { script, selectedImages });

        res.json({ success: true, data: result });

    } catch (error) {
        console.error('[AffiliateAPI] Render Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Render with AI (Runway) - NEW
const runwayService = require('../services/runway-service');
const path = require('path');
const fs = require('fs');

router.post('/render-ai', async (req, res) => {
    try {
        const { draftId, script, selectedImages, prompt } = req.body;
        if (!draftId) return res.status(400).json({ success: false, error: 'Draft ID required' });

        // Check if Runway is configured
        if (!runwayService.isConfigured()) {
            return res.status(400).json({
                success: false,
                error: 'Runway API key not configured. Please add RUNWAY_API_KEY to .env file and restart server.'
            });
        }

        console.log(`[AffiliateAPI] AI Rendering Draft: ${draftId}`);

        // Get first image for AI generation
        const sessionDir = path.join(__dirname, '..', 'temp', `draft_${draftId}`);
        let imagePath = selectedImages && selectedImages[0];

        // If it's a URL, download first
        if (imagePath && imagePath.startsWith('http')) {
            const axios = require('axios');
            const localPath = path.join(sessionDir, 'ai_input.jpg');
            const response = await axios({ url: imagePath, responseType: 'stream' });
            const writer = fs.createWriteStream(localPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            imagePath = localPath;
        }

        if (!imagePath || !fs.existsSync(imagePath)) {
            return res.status(400).json({ success: false, error: 'No valid image for AI generation' });
        }

        // Generate AI video
        const aiPrompt = prompt || 'Professional product advertisement, smooth cinematic camera movement, elegant zoom and pan, studio lighting, high quality commercial video';
        const videoUrl = await runwayService.generateVideoFromImage(imagePath, aiPrompt, 5);

        // Download to local
        const outputPath = path.join(__dirname, '..', 'public', 'outputs', `ai_video_${draftId}.mp4`);
        await runwayService.downloadVideo(videoUrl, outputPath);

        res.json({
            success: true,
            data: {
                id: draftId,
                file: `/outputs/ai_video_${draftId}.mp4`,
                aiGenerated: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[AffiliateAPI] AI Render Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Render with Veed (Talking Video)
const veedService = require('../services/veed-service');

router.post('/render-veed', async (req, res) => {
    try {
        const { draftId, script, selectedImages } = req.body;
        if (!draftId) return res.status(400).json({ success: false, error: 'Draft ID required' });

        if (!veedService.isConfigured()) {
            return res.status(400).json({
                success: false,
                error: 'Veed API key not configured. Please add in Settings tab.'
            });
        }

        console.log(`[AffiliateAPI] Veed Rendering Draft: ${draftId}`);

        const sessionDir = path.join(__dirname, '..', 'temp', `draft_${draftId}`);
        let imagePath = selectedImages && selectedImages[0];

        // Download image if URL
        if (imagePath && imagePath.startsWith('http')) {
            const axios = require('axios');
            const localPath = path.join(sessionDir, 'veed_input.jpg');
            const response = await axios({ url: imagePath, responseType: 'stream' });
            const writer = fs.createWriteStream(localPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            imagePath = localPath;
        }

        if (!imagePath || !fs.existsSync(imagePath)) {
            return res.status(400).json({ success: false, error: 'No valid image for Veed generation' });
        }

        // Generate audio from script first
        const audioPath = path.join(sessionDir, 'veed_audio.mp3');
        await videoGenerator.generateAudio(script, audioPath);

        // Generate Veed talking video
        const videoUrl = await veedService.generateVideoFromImage(imagePath, audioPath, '720p');

        // Download to local
        const outputPath = path.join(__dirname, '..', 'public', 'outputs', `veed_video_${draftId}.mp4`);
        await veedService.downloadVideo(videoUrl, outputPath);

        res.json({
            success: true,
            data: {
                id: draftId,
                file: `/outputs/veed_video_${draftId}.mp4`,
                veedGenerated: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[AffiliateAPI] Veed Render Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
