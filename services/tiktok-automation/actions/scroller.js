const safety = require('../core/safety');

class Scroller {
    /**
     * Scroll the feed for a specified duration
     * @param {Page} page - Puppeteer page instance
     * @param {number} durationMs - How long to scroll in milliseconds
     */
    async scrollFeed(page, durationMs = 600000) { // Default 10 mins
        console.log(`[Scroller] Starting feed scroll for ${durationMs / 1000}s`);
        const startTime = Date.now();

        try {
            while (Date.now() - startTime < durationMs) {
                // Check if page is still open
                if (page.isClosed()) break;

                // 1. Scroll down a bit
                await this.performScroll(page);

                // 2. Randomly pause to "watch" a video
                // 70% chance to watch a video for 5-15 seconds
                if (Math.random() < 0.7) {
                    await safety.randomSleep(5000, 15000);
                }

                // 3. Occasional longer pause (human distraction)
                // 10% chance
                if (Math.random() < 0.1) {
                    console.log('[Scroller] User distraction pause...');
                    await safety.randomSleep(10000, 30000);
                }

                // 4. Check for blocking checks
                if (await safety.checkSecurityChallenge(page)) {
                    console.warn('[Scroller] Security challenge detected, pausing scroll.');
                    // In a real system, we'd trigger a pause state and notify user
                    break;
                }
            }
        } catch (error) {
            console.error('[Scroller] Error during scrolling:', error);
        }

        console.log('[Scroller] Feed scroll session finished');
    }

    async performScroll(page) {
        try {
            // Random scroll distance
            const distance = Math.floor(Math.random() * (800 - 300 + 1) + 300);

            await page.mouse.wheel({ deltaY: distance });

            // Micro-pause after scroll
            await safety.randomSleep(500, 2000);
        } catch (e) {
            // modify logic if page closed
        }
    }
}

module.exports = new Scroller();
