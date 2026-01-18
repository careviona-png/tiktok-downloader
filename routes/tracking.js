const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Setup logging
const LOG_FILE = path.join(__dirname, '../data/tracking_logs.json');
// Ensure data dir exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}

// Simple in-memory rate limit: ip_hash -> timestamp
const rateLimit = new Map();

/**
 * Hash utility for anonymization
 */
function hash(str) {
    return crypto.createHash('sha256').update(str || '').digest('hex').substring(0, 16);
}

/**
 * Is Bot Check (Simple UA check)
 */
function isBot(ua) {
    const bots = ['bot', 'crawl', 'spider', 'headless', 'google', 'facebook', 'tiktok'];
    return !ua || bots.some(b => ua.toLowerCase().includes(b));
}

/**
 * GET /r
 * Query: ?to=URL&vid=VIDEO_ID&var=VARIANT
 */
router.get('/', (req, res) => {
    const targetUrl = req.query.to;
    const vid = req.query.vid || 'unknown';
    const variant = req.query.var || 'A';

    // 1. Validate Target URL (Allowlist domain check)
    if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).send('Invalid destination');
    }

    try {
        const urlObj = new URL(targetUrl);
        const allowedDomains = ['shopee.vn', 'shope.ee', 'vn.shp.ee'];
        if (!allowedDomains.some(d => urlObj.hostname.endsWith(d))) {
            // For safety, we block non-shopee for now as per "Shopee Only" requirement.
            return res.status(403).send('Domain not allowed');
        }
    } catch (e) {
        return res.status(400).send('Invalid URL format');
    }

    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get('User-Agent');
    const ipHash = hash(ip);

    // 2. Anti-spam / Rate Limit (1 click per 5 seconds per IP)
    const now = Date.now();
    const lastClick = rateLimit.get(ipHash) || 0;

    let isValid = true;

    if (now - lastClick < 5000) {
        isValid = false; // Spam click
    }

    if (isBot(ua)) {
        isValid = false; // Bot click
    }

    if (isValid) {
        rateLimit.set(ipHash, now);
    }

    // 3. Log
    const logEntry = {
        timestamp: new Date().toISOString(),
        vid,
        variant,
        referrer: req.get('Referrer') || 'direct',
        ip_hash: ipHash,
        ua_hash: hash(ua),
        is_valid: isValid,
        target: targetUrl
    };

    // Append to file (JSONL style)
    fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', (err) => {
        if (err) console.error('Tracking log error:', err);
    });

    // 4. Redirect
    res.redirect(302, targetUrl);
});

module.exports = router;
