const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class ShopeeExtractor {
    constructor() {
        this.browser = null;
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: "new",
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Extract product details from Shopee URL
     * @param {string} url 
     */
    async extract(url) {
        // Validate URL
        if (!url || !url.includes('shopee.vn')) {
            throw new Error('Invalid Shopee URL');
        }

        let page = null;
        try {
            await this.initBrowser();
            page = await this.browser.newPage();

            // Set Viewport and User Agent to appear as a real desktop user
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log(`[Shopee] Navigating to ${url}`);
            // Remove specific networkidle2 timeout to avoid crashing on slow loads, rely on general timeout
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Scroll down to trigger lazy loading
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= 2000) { // Scroll a bit
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });

            // Wait a bit for images to populate
            await new Promise(r => setTimeout(r, 2000));

            // Extract using JSON-LD application/ld+json if available (Most reliable)
            const jsonLd = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of scripts) {
                    try {
                        const data = JSON.parse(script.innerText);
                        if (data['@type'] === 'Product') {
                            return data;
                        }
                    } catch (e) { }
                }
                return null;
            });

            if (jsonLd) {
                console.log('[Shopee] Found JSON-LD Product data');
                // Ensure images are absolute URLs
                let images = jsonLd.image ? (Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]) : [];
                return {
                    title: jsonLd.name,
                    price: jsonLd.offers ? (jsonLd.offers.price || jsonLd.offers.lowPrice) : 0,
                    description: jsonLd.description,
                    images: images,
                    rating: jsonLd.aggregateRating ? jsonLd.aggregateRating.ratingValue : 0,
                    url: url
                };
            }

            // Fallback to DOM Scraping if JSON-LD fails
            const data = await page.evaluate(() => {
                // Try grabbing from meta tags
                const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
                const ogImage = document.querySelector('meta[property="og:image"]')?.content;

                // Title
                const titleSelector = document.querySelector('div.product-briefing span') || document.querySelector('.attM6y') || document.querySelector('span._44qnta');
                const title = ogTitle || (titleSelector ? titleSelector.innerText : document.title);

                // Images
                // 1. Look for background-image in carousel
                const images = [];
                if (ogImage) images.push(ogImage);

                const bgDivs = document.querySelectorAll('div[style*="background-image"]');
                bgDivs.forEach(div => {
                    const match = div.style.backgroundImage.match(/url\("?(.*?)"?\)/);
                    if (match && match[1]) {
                        // Filter out small icons or sprites if possible
                        if (match[1].includes('shopee') && !images.includes(match[1])) {
                            images.push(match[1]);
                        }
                    }
                });

                // 2. Look for <img src=...> in product gallery (generic approach)
                document.querySelectorAll('img').forEach(img => {
                    if (img.src && (img.src.includes('cf.shopee.vn') || img.src.includes('down-vn.img')) && img.width > 300) {
                        if (!images.includes(img.src)) images.push(img.src);
                    }
                });

                return {
                    title: title,
                    images: images.slice(0, 5), // Top 5 images
                    price: "Check Link",
                    url: document.location.href
                };
            });

            return { ...data, url };

        } catch (error) {
            console.error('[Shopee] Extraction Error:', error.message);
            throw error;
        } finally {
            if (page) await page.close();
            // Keep browser open? For now close to save resources.
            // In heavy load, we'd keep it pool.
            await this.closeBrowser();
        }
    }
}

module.exports = new ShopeeExtractor();
