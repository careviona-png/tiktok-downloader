const express = require('express');
const router = express.Router();
const browserService = require('../services/tiktok-automation/core/browser');
const sessionManager = require('../services/tiktok-automation/core/session');

// Middleware to check if user is allowed (e.g. valid license)
// For now, we assume basic license check is done on frontend or global middleware

/**
 * Endpoint to launch a visible browser for manual login
 */
router.post('/login-browser', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    try {
        // prevent multiple instances
        if (browserService.isConnected()) {
            return res.status(409).json({ success: false, error: 'Browser is already open.' });
        }

        const browser = await browserService.launch(false); // Headless = false for manual login
        const page = await browserService.newPage();

        await page.goto('https://www.tiktok.com/login', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Start a background polling to check for login success
        // This is a simplified version. In production, we'd use a more robust job manager.
        waitForLoginCompletion(page, userId);

        res.json({ success: true, message: 'Browser launched. Please log in manually.' });

    } catch (error) {
        console.error('Login launch error:', error);
        res.status(500).json({ success: false, error: 'Failed to launch browser' });
    }
});

/**
 * Check if the user has a saved session
 */
router.get('/status/:userId', async (req, res) => {
    const { userId } = req.params;
    const exists = await sessionManager.sessionExists(userId);
    res.json({ isLoggedIn: exists });
});

/**
 * Import cookies manually (JSON format)
 */
router.post('/import-cookies', async (req, res) => {
    const { userId, cookies } = req.body;

    if (!cookies || !Array.isArray(cookies)) {
        return res.status(400).json({ success: false, error: 'Invalid cookie format. Must be an array.' });
    }

    // Basic validation of connection
    try {
        await sessionManager.saveSession(userId, cookies);
        res.json({ success: true, message: 'Cookies imported successfully!' });
    } catch (error) {
        console.error('Cookie import error:', error);
        res.status(500).json({ success: false, error: 'Failed to save cookies' });
    }
});

/**
 * Logout (delete session)
 */
router.post('/logout', async (req, res) => {
    const { userId } = req.body;
    await sessionManager.deleteSession(userId);
    res.json({ success: true });
});

/**
 * Helper to monitor the login process
 */
async function waitForLoginCompletion(page, userId) {
    try {
        // Wait for user to be redirected to a logged-in page (e.g., /foryou or /@username)
        // Or wait for a specific cookie "sessionid"
        let isLoggedIn = false;
        const maxTime = 300000; // 5 minutes to login
        const startTime = Date.now();

        while (Date.now() - startTime < maxTime) {
            if (page.isClosed()) {
                console.log('Browser closed by user.');
                break;
            }

            const cookies = await page.cookies();
            const sessionCookie = cookies.find(c => c.name === 'sessionid'); // TikTok uses 'sessionid' or 'sid_tt'

            if (sessionCookie) {
                console.log('Login detected! Saving session...');
                await sessionManager.saveSession(userId, cookies);
                isLoggedIn = true;
                break;
            }

            // Also check URL
            const url = page.url();
            if (url.includes('/foryou') || url.includes('/@')) {
                // Double check cookies just in case
                const finalCookies = await page.cookies();
                await sessionManager.saveSession(userId, finalCookies);
                isLoggedIn = true;
                break;
            }

            await new Promise(r => setTimeout(r, 2000));
        }

        if (isLoggedIn) {
            console.log(`User ${userId} logged in successfully.`);
            // Optional: Close browser automatically or let user close it?
            // Usually better to close it to save resources.
            await browserService.close();
        } else {
            console.log('Login timed out or browser closed.');
        }

    } catch (error) {
        console.error('Error monitoring login:', error);
        try { await browserService.close(); } catch { }
    }
}

module.exports = router;
