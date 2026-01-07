/**
 * YouTube DMCA Blocklist Manager
 * Quản lý danh sách URL bị chặn do vi phạm bản quyền
 */

const fs = require('fs');
const path = require('path');

// Path to blocklist file
const BLOCKLIST_FILE = path.join(__dirname, '../data/dmca-blocklist.json');

// In-memory cache
let blocklist = new Set();
let lastLoaded = null;

/**
 * Load blocklist from file
 */
function loadBlocklist() {
    try {
        if (fs.existsSync(BLOCKLIST_FILE)) {
            const data = JSON.parse(fs.readFileSync(BLOCKLIST_FILE, 'utf8'));
            blocklist = new Set(data.urls || []);
            lastLoaded = new Date();
            console.log(`[DMCA] Loaded ${blocklist.size} blocked URLs`);
        } else {
            // Create empty blocklist file
            ensureBlocklistFile();
        }
    } catch (error) {
        console.error('[DMCA] Error loading blocklist:', error.message);
        blocklist = new Set();
    }
}

/**
 * Ensure blocklist file exists
 */
function ensureBlocklistFile() {
    const dir = path.dirname(BLOCKLIST_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(BLOCKLIST_FILE)) {
        fs.writeFileSync(BLOCKLIST_FILE, JSON.stringify({
            urls: [],
            lastUpdated: new Date().toISOString(),
            dmcaReports: []
        }, null, 2));
    }
}

/**
 * Check if a URL or video ID is blocked
 * @param {string} url - YouTube URL to check
 * @returns {boolean} - True if blocked
 */
function isBlocked(url) {
    if (!url) return false;

    // Extract video ID from URL
    const videoId = extractVideoId(url);

    // Check both full URL and video ID
    return blocklist.has(url) || blocklist.has(videoId);
}

/**
 * Extract YouTube video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null
 */
function extractVideoId(url) {
    if (!url) return null;

    // YouTube Shorts format
    const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // Standard YouTube format
    const standardMatch = url.match(/(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (standardMatch) return standardMatch[1];

    return null;
}

/**
 * Add URL to blocklist (called when DMCA received)
 * @param {string} url - URL to block
 * @param {Object} dmcaInfo - DMCA report info
 * @returns {boolean} - Success
 */
function addToBlocklist(url, dmcaInfo = {}) {
    try {
        const videoId = extractVideoId(url);
        if (!videoId) return false;

        // Add to in-memory set
        blocklist.add(videoId);
        blocklist.add(url);

        // Update file
        ensureBlocklistFile();
        const data = JSON.parse(fs.readFileSync(BLOCKLIST_FILE, 'utf8'));

        if (!data.urls.includes(videoId)) {
            data.urls.push(videoId);
        }

        data.dmcaReports.push({
            videoId,
            originalUrl: url,
            reportedAt: new Date().toISOString(),
            reporter: dmcaInfo.reporter || 'Unknown',
            reason: dmcaInfo.reason || 'DMCA Takedown Request'
        });

        data.lastUpdated = new Date().toISOString();

        fs.writeFileSync(BLOCKLIST_FILE, JSON.stringify(data, null, 2));

        console.log(`[DMCA] Added ${videoId} to blocklist`);
        return true;
    } catch (error) {
        console.error('[DMCA] Error adding to blocklist:', error.message);
        return false;
    }
}

/**
 * Get blocklist statistics
 * @returns {Object} - Stats
 */
function getStats() {
    return {
        totalBlocked: blocklist.size,
        lastLoaded
    };
}

/**
 * Middleware to check blocked URLs
 */
function blocklistMiddleware(req, res, next) {
    const url = req.body.url || req.query.url;

    if (url && isBlocked(url)) {
        return res.status(403).json({
            success: false,
            error: 'This video has been blocked due to a copyright claim (DMCA).',
            errorVi: 'Video này đã bị chặn do khiếu nại bản quyền (DMCA).'
        });
    }

    next();
}

// Initialize blocklist on module load
loadBlocklist();

// Reload blocklist every hour
setInterval(loadBlocklist, 60 * 60 * 1000);

module.exports = {
    isBlocked,
    addToBlocklist,
    getStats,
    blocklistMiddleware,
    loadBlocklist,
    extractVideoId
};
