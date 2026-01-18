const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Enable stealth plugin to evade detection
puppeteer.use(StealthPlugin());

class BrowserService {
    constructor() {
        this.browser = null;
    }

    /**
     * Launch a browser instance
     * @param {boolean} headless - Whether to run in headless mode (default: true)
     * @param {boolean} userDataDir - Path to user data directory for caching (optional)
     */
    async launch(headless = true, userDataDir = null) {
        if (this.browser) {
            return this.browser;
        }

        const launchOptions = {
            headless: headless ? 'new' : false,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--disable-acceleration',
                '--disable-gpu',
                '--window-size=1280,800' // Standard resolution
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: null
        };

        if (userDataDir) {
            launchOptions.userDataDir = userDataDir;
        }

        try {
            console.log(`[BrowserService] Launching browser (Headless: ${headless})...`);
            this.browser = await puppeteer.launch(launchOptions);

            // Set up default closing behavior
            this.browser.on('disconnected', () => {
                console.log('[BrowserService] Browser disconnected');
                this.browser = null;
            });

            return this.browser;
        } catch (error) {
            console.error('[BrowserService] Failed to launch browser:', error);
            throw error;
        }
    }

    /**
     * Create a new page with standard fingerprinting protections
     */
    async newPage() {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call launch() first.');
        }

        const page = await this.browser.newPage();

        // Additional stealth measures
        await page.evaluateOnNewDocument(() => {
            // Overwrite the `plugins` property to use a custom getter.
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            // Pass the Webdriver Test.
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        return page;
    }

    /**
     * Close the browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('[BrowserService] Browser closed');
        }
    }

    /**
     * Check if browser is active
     */
    isConnected() {
        return this.browser && this.browser.isConnected();
    }
}

module.exports = new BrowserService();
