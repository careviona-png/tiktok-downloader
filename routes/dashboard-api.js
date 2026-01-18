const express = require('express');
const router = express.Router();
const workflowService = require('../services/workflowService');
const complianceService = require('../services/compliance');
const analyticsService = require('../services/analytics');
const settingsManager = require('../services/settings-manager');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../data/tracking_logs.json');

// --- MODULE 7: WORKFLOW ---

/**
 * Trigger create manual upload pack
 * Body: { videoPath: string, topic: string, watermark: boolean }
 */
router.post('/generate-pack', async (req, res) => {
    try {
        const { videoPath, topic, watermark } = req.body;

        if (!videoPath) {
            return res.status(400).json({ error: 'Missing videoPath' });
        }

        // Generate pack
        const zipPath = await workflowService.generatePack(videoPath, topic, {
            watermark: watermark !== false // Default true
        });

        res.json({
            success: true,
            message: 'Pack created successfully',
            downloadUrl: `/api/workflow/download?path=${encodeURIComponent(zipPath)}`
        });

    } catch (error) {
        console.error('Workflow error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Download generated pack
 */
router.get('/download', (req, res) => {
    const zipPath = req.query.path;
    if (!zipPath || !fs.existsSync(zipPath)) {
        return res.status(404).send('File not found');
    }
    res.download(zipPath);
});

// --- MODULE 5: COMPLIANCE ---

router.post('/compliance/check', (req, res) => {
    const { text } = req.body;
    const result = complianceService.scanText(text);
    res.json(result);
});

// --- MODULE 8: DASHBOARD STATS ---

router.get('/stats', (req, res) => {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            return res.json({ total: 0, valid: 0, suspicious: 0, logs: [] });
        }

        // Read last 100 lines for efficiency (simplified reading whole file for now)
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = data.trim().split('\n');

        const logs = lines
            .filter(line => line)
            .map(line => {
                try { return JSON.parse(line); } catch { return null; }
            })
            .filter(item => item !== null);

        const total = logs.length;
        const valid = logs.filter(l => l.is_valid).length;

        // Return summary + last 20 logs
        res.json({
            total,
            valid,
            suspicious: total - valid,
            logs: logs.reverse().slice(0, 20)
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// --- MODULE 9: SETTINGS ---

router.get('/settings', (req, res) => {
    try {
        const settings = settingsManager.getSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to load settings' });
    }
});

router.post('/settings', (req, res) => {
    try {
        const newSettings = req.body;
        console.log('[Settings] Received update:', JSON.stringify(newSettings, null, 2));

        const updated = settingsManager.saveSettings(newSettings);
        console.log('[Settings] Saved. Veed Key length:', updated.veedApiKey ? updated.veedApiKey.length : 0);

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Save settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
});

module.exports = router;
