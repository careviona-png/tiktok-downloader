const express = require('express');
const router = express.Router();
const libraryService = require('../services/library/libraryService');

// Middleware: Verify userId exists in query or body
const requireUser = (req, res, next) => {
    const userId = req.body.userId || req.query.userId;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID required' });
    }
    next();
};

/**
 * GET /api/library/list
 * Get all saved videos
 */
router.get('/list', requireUser, async (req, res) => {
    try {
        const { userId } = req.query;
        const items = await libraryService.getLibrary(userId);
        res.json({ success: true, items });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load library' });
    }
});

/**
 * POST /api/library/save
 * Save a video URL
 */
router.post('/save', requireUser, async (req, res) => {
    try {
        const { userId, url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const result = await libraryService.saveVideo(userId, url);

        if (result.success) {
            res.json({ success: true, item: result.item });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to save video' });
    }
});

/**
 * DELETE /api/library/delete/:id
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { userId } = req.body; // In DELETE, often needs to be in body or query for auth
        const { id } = req.params;

        if (!userId) return res.status(400).json({ error: 'User ID required' });

        const success = await libraryService.deleteVideo(userId, id);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete' });
    }
});

module.exports = router;
