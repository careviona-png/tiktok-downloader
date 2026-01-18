const safety = require('../core/safety');

class Interaction {
    /**
     * Like a visible video on the feed
     * @param {Page} page 
     */
    async likeVisibleVideo(page) {
        console.log('[Interaction] Attempting to like a video...');
        try {
            // Selectors for Like button (Heart icon)
            // Note: TikTok classes change often, resilient selectors needed
            // Looking for common attributes or SVGs
            const likeSelector = 'span[data-e2e="like-icon"]';

            // Find all visible like buttons
            const buttons = await page.$$(likeSelector);

            if (buttons.length > 0) {
                // Pick a random one from the visible set (usually the main one in view)
                const btn = buttons[Math.floor(Math.random() * Math.min(buttons.length, 3))];

                // Scroll into view if needed
                await btn.scrollIntoView();
                await safety.randomSleep(500, 1500);

                // Click
                await btn.click();
                console.log('[Interaction] Liked a video');

                // Post-action delay
                await safety.randomSleep(2000, 5000);
                return true;
            } else {
                console.log('[Interaction] No like buttons found');
                return false;
            }
        } catch (error) {
            console.error('[Interaction] Like failed:', error);
            return false;
        }
    }

    /**
     * Watch the current video for a specific duration
     */
    async watchVideo(page, durationSeconds) {
        console.log(`[Interaction] Watching video for ${durationSeconds}s`);
        await safety.randomSleep(durationSeconds * 1000, durationSeconds * 1000 + 2000);
    }
}

module.exports = new Interaction();
