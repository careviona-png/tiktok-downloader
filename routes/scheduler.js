/**
 * Scheduler API Routes
 * Handles license key validation and scheduler operations
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const automationService = require('../services/tiktok-automation');
const router = express.Router();

// Data file for keys (simple JSON storage)
const DATA_DIR = path.join(__dirname, '..', 'data');
const KEYS_FILE = path.join(DATA_DIR, 'license-keys.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize keys file if not exists
if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: [] }, null, 2));
}

// Rate limiting for key validation
const keyAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Helper: Read keys from file
function readKeys() {
    try {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading keys file:', error);
        return { keys: [] };
    }
}

// Helper: Write keys to file
function writeKeys(data) {
    try {
        fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing keys file:', error);
        return false;
    }
}

// Helper: Generate license key
function generateKey(prefix = 'TK') {
    const segments = [];
    for (let i = 0; i < 4; i++) {
        segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
    }
    return `${prefix}${segments.join('-')}`;
}

// Helper: Check rate limit
function checkRateLimit(userId) {
    const now = Date.now();
    const attempts = keyAttempts.get(userId) || { count: 0, firstAttempt: now };

    // Reset if window expired
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        keyAttempts.set(userId, { count: 1, firstAttempt: now });
        return true;
    }

    // Check if over limit
    if (attempts.count >= MAX_ATTEMPTS) {
        return false;
    }

    // Increment attempts
    attempts.count++;
    keyAttempts.set(userId, attempts);
    return true;
}

/**
 * POST /api/scheduler/validate-key
 * Validate a license key and bind it to user
 */
router.post('/validate-key', (req, res) => {
    try {
        const { key, userId, tiktokUsername } = req.body;

        // Input validation
        if (!key || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Rate limiting check
        if (!checkRateLimit(userId)) {
            return res.status(429).json({
                success: false,
                error: 'Too many attempts. Please try again in 15 minutes.'
            });
        }

        // Clean key format
        const cleanKey = key.replace(/[^A-Z0-9]/g, '').toUpperCase();
        const formattedKey = cleanKey.match(/.{1,4}/g)?.join('-') || cleanKey;

        // Read keys database
        const data = readKeys();
        const keyRecord = data.keys.find(k =>
            k.key.replace(/[^A-Z0-9]/g, '').toUpperCase() === cleanKey
        );

        // Key not found
        if (!keyRecord) {
            return res.json({
                success: false,
                error: 'Invalid license key. Please check and try again.'
            });
        }

        // Key revoked
        if (keyRecord.status === 'revoked') {
            return res.json({
                success: false,
                error: 'This license key has been revoked.'
            });
        }

        // Key expired
        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
            return res.json({
                success: false,
                error: 'This license key has expired.'
            });
        }

        // Check activation limits
        const maxActivations = keyRecord.maxActivations || 1;
        const activations = keyRecord.activations || [];

        // Check if user already activated
        const existingActivation = activations.find(a => a.userId === userId);
        if (!existingActivation && activations.length >= maxActivations) {
            return res.json({
                success: false,
                error: `This key has reached its activation limit (${maxActivations} device${maxActivations > 1 ? 's' : ''}).`
            });
        }

        // Activate the key for this user
        if (!existingActivation) {
            activations.push({
                userId,
                tiktokUsername: tiktokUsername || '',
                activatedAt: new Date().toISOString(),
                userAgent: req.get('User-Agent') || 'Unknown'
            });
            keyRecord.activations = activations;
            keyRecord.status = 'active';
            writeKeys(data);
        }

        // Success response
        res.json({
            success: true,
            message: 'License key activated successfully!',
            plan: keyRecord.plan || 'standard',
            expiresAt: keyRecord.expiresAt || null
        });

    } catch (error) {
        console.error('Key validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error. Please try again.'
        });
    }
});

/**
 * GET /api/scheduler/trial-status
 * Get trial status for a user
 */
router.get('/trial-status', (req, res) => {
    const { userId } = req.query;

    // Trial info is managed client-side in localStorage
    // This endpoint can be used for server-side validation if needed
    res.json({
        success: true,
        trialDays: 7,
        message: 'Trial managed client-side'
    });
});

// ============================================
// AUTOMATION ENDPOINTS (Task Scheduling)
// ============================================

/**
 * POST /api/scheduler/warmup
 * Schedule a warming session
 */
router.post('/warmup', (req, res) => {
    const { userId, duration = 10 } = req.body;

    // Check if user has valid license (re-verify here if strict)
    // For now assuming previous license check passed or trial active

    automationService.scheduleWarming(userId, duration);

    res.json({
        success: true,
        message: `Warming session scheduled for ${duration} minutes. Check dashboard for status.`
    });
});

/**
 * POST /api/scheduler/upload
 * Schedule a video upload
 */
router.post('/upload', (req, res) => {
    const { userId, filePath, caption } = req.body;

    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    automationService.scheduleUpload(userId, filePath, caption);

    res.json({
        success: true,
        message: 'Video upload scheduled.'
    });
});

/**
 * GET /api/scheduler/status/:userId
 * Get automation system status
 */
router.get('/status/:userId', (req, res) => {
    const status = automationService.getStatus();
    res.json({ success: true, status });
});

// ============================================
// ADMIN ENDPOINTS (Protected by ADMIN_TOKEN)
// ============================================

// Admin auth middleware
function adminAuth(req, res, next) {
    const adminToken = process.env.ADMIN_TOKEN;
    const providedToken = req.headers['x-admin-token'] || req.query.token;

    if (!adminToken) {
        return res.status(500).json({
            success: false,
            error: 'Admin token not configured on server'
        });
    }

    if (providedToken !== adminToken) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized'
        });
    }

    next();
}

/**
 * POST /api/scheduler/admin/generate-keys
 * Generate new license keys (bulk)
 */
router.post('/admin/generate-keys', adminAuth, (req, res) => {
    try {
        const {
            count = 1,
            prefix = 'TK',
            plan = 'standard',
            maxActivations = 1,
            expiresInDays = null
        } = req.body;

        const data = readKeys();
        const newKeys = [];

        for (let i = 0; i < Math.min(count, 100); i++) {
            const key = generateKey(prefix);
            const keyRecord = {
                key,
                plan,
                maxActivations,
                status: 'unused',
                activations: [],
                createdAt: new Date().toISOString(),
                expiresAt: expiresInDays
                    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
                    : null
            };
            data.keys.push(keyRecord);
            newKeys.push(keyRecord);
        }

        writeKeys(data);

        res.json({
            success: true,
            message: `Generated ${newKeys.length} key(s)`,
            keys: newKeys.map(k => ({
                key: k.key,
                plan: k.plan,
                expiresAt: k.expiresAt
            }))
        });

    } catch (error) {
        console.error('Key generation error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate keys' });
    }
});

/**
 * POST /api/scheduler/admin/revoke-key
 * Revoke a license key
 */
router.post('/admin/revoke-key', adminAuth, (req, res) => {
    try {
        const { key } = req.body;

        if (!key) {
            return res.status(400).json({ success: false, error: 'Key required' });
        }

        const data = readKeys();
        const cleanKey = key.replace(/[^A-Z0-9]/g, '').toUpperCase();
        const keyRecord = data.keys.find(k =>
            k.key.replace(/[^A-Z0-9]/g, '').toUpperCase() === cleanKey
        );

        if (!keyRecord) {
            return res.status(404).json({ success: false, error: 'Key not found' });
        }

        keyRecord.status = 'revoked';
        keyRecord.revokedAt = new Date().toISOString();
        writeKeys(data);

        res.json({
            success: true,
            message: 'Key revoked successfully'
        });

    } catch (error) {
        console.error('Key revocation error:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke key' });
    }
});

/**
 * GET /api/scheduler/admin/keys
 * List all keys with usage info
 */
router.get('/admin/keys', adminAuth, (req, res) => {
    try {
        const data = readKeys();

        res.json({
            success: true,
            total: data.keys.length,
            keys: data.keys.map(k => ({
                key: k.key,
                plan: k.plan,
                status: k.status,
                maxActivations: k.maxActivations,
                activationCount: k.activations?.length || 0,
                activations: k.activations || [],
                createdAt: k.createdAt,
                expiresAt: k.expiresAt
            }))
        });

    } catch (error) {
        console.error('Keys listing error:', error);
        res.status(500).json({ success: false, error: 'Failed to list keys' });
    }
});

module.exports = router;
