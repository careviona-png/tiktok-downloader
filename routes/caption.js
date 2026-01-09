/**
 * Caption & Hashtag Generator - API Routes
 */

const express = require('express');
const router = express.Router();
const { generateViralContent, getNiches } = require('../utils/captionGenerator');

/**
 * POST /api/caption/generate
 * Generate viral captions and hashtags
 */
router.post('/generate', (req, res) => {
    try {
        const { topic, niche } = req.body;

        if (!topic) {
            return res.status(400).json({ success: false, error: 'Topic is required' });
        }

        console.log(`📝 Generating captions for topic: ${topic} [${niche || 'trending'}]`);

        const results = generateViralContent(topic, niche);

        res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('Caption generation error:', error);
        res.status(500).json({ success: false, error: 'Generation failed: ' + error.message });
    }
});

/**
 * GET /api/caption/niches
 */
router.get('/niches', (req, res) => {
    res.json({
        success: true,
        niches: getNiches()
    });
});

module.exports = router;
