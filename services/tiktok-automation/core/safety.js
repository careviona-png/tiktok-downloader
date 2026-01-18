class SafetyManager {
    constructor() {
        // Configuration for delays (in milliseconds)
        this.delays = {
            minScroll: 2000,
            maxScroll: 8000,
            minAction: 1000,
            maxAction: 5000,
            pageLoad: 3000,
            typing: {
                min: 50,
                max: 150
            }
        };
    }

    /**
     * Sleep for a random amount of time between min and max
     * @param {number} min 
     * @param {number} max 
     */
    async randomSleep(min, max) {
        const duration = Math.floor(Math.random() * (max - min + 1) + min);
        console.log(`[Safety] Sleeping for ${duration}ms...`);
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Simulate human reading/viewing time
     */
    async humanDelay(factor = 1.0) {
        const min = this.delays.minAction * factor;
        const max = this.delays.maxAction * factor;
        await this.randomSleep(min, max);
    }

    /**
     * Add noise to mouse movements (future expansion)
     * @param {Page} page 
     */
    async moveMouseRandomly(page) {
        // Basic implementation, can be enhanced with ghost-cursor
        const width = 1280;
        const height = 800;
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);

        try {
            await page.mouse.move(x, y, { steps: 10 });
        } catch (e) {
            // Ignore if page is closed
        }
    }

    /**
     * Check for blocking elements (Captchas)
     * @param {Page} page 
     */
    async checkSecurityChallenge(page) {
        try {
            // Common captcha selectors
            const selectors = [
                '.captcha-container',
                '#captcha-verify-image',
                '[id*="captcha"]'
            ];

            for (const selector of selectors) {
                if (await page.$(selector) !== null) {
                    console.warn(`[Safety] Security challenge detected: ${selector}`);
                    return true;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new SafetyManager();
