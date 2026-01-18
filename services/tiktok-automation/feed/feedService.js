const browserService = require('../core/browser');
const sessionManager = require('../core/session');

class FeedService {
    constructor() {
        this.cache = [];
        this.isFetching = false;
    }

    /**
     * Fetch the 'For You' feed items
     * @param {string} userId - To use the logged-in session
     * @param {number} count - Approximate number of items to return
     */
    async getForYouFeed(userId, count = 10) {
        // Return cached items if we have enough
        if (this.cache.length >= count) {
            const items = this.cache.splice(0, count);
            // Trigger background fetch to replenish cache
            this.fetchBackground(userId);
            return items;
        }

        // Otherwise fetch live
        return await this.fetchLive(userId);
    }

    /**
     * Perform live fetch via Puppeteer Interception
     */
    async fetchLive(userId) {
        if (this.isFetching) {
            // Wait briefly for existing fetch or return empty to signal "loading"
            return [];
        }

        this.isFetching = true;
        let browser = null;
        const items = [];

        try {
            console.log('[FeedService] Starting live fetch...');

            // 1. Setup Browser
            browser = await browserService.launch(true); // Headless
            const page = await browserService.newPage();

            // Load session if available
            if (userId && await sessionManager.sessionExists(userId)) {
                const cookies = await sessionManager.loadSession(userId);
                await page.setCookie(...cookies);
            }

            // 2. Setup Interception
            // We listen for the 'response' event to capture API data
            page.on('response', async (response) => {
                const url = response.url();
                // Common endpoints for feed data (web)
                if (url.includes('/api/recommend/item_list') || url.includes('/api/item_list')) {
                    try {
                        const json = await response.json();
                        if (json && json.itemList) {
                            console.log(`[FeedService] Intercepted ${json.itemList.length} items`);
                            json.itemList.forEach(item => {
                                const standardized = this.normalizeItem(item);
                                if (standardized) items.push(standardized);
                            });
                        }
                    } catch (e) {
                        // ignore non-json or failed parses
                    }
                }
            });

            // 3. Navigate
            await page.goto('https://www.tiktok.com/foryou', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // 4. Scroll to trigger more data if needed
            if (items.length < 5) {
                await page.evaluate(() => window.scrollBy(0, 500));
                await new Promise(r => setTimeout(r, 2000));
            }

            // Save to cache
            this.cache.push(...items);

            // Return what we found
            return items;

        } catch (error) {
            console.error('[FeedService] Fetch error:', error);
            return [];
        } finally {
            if (browser) {
                await browserService.close();
            }
            this.isFetching = false;
        }
    }

    async fetchBackground(userId) {
        // Run fetch without waiting
        this.fetchLive(userId).catch(e => console.error(e));
    }

    /**
     * Extract relevant data from raw TikTok response
     */
    normalizeItem(item) {
        try {
            return {
                id: item.id,
                desc: item.desc,
                createTime: item.createTime,
                video: {
                    url: item.video?.playAddr || item.video?.downloadAddr, // Note: Browsers might need Referer to play this
                    cover: item.video?.cover,
                    duration: item.video?.duration
                },
                author: {
                    id: item.author?.id,
                    uniqueId: item.author?.uniqueId,
                    nickname: item.author?.nickname,
                    avatar: item.author?.avatarThumb
                },
                stats: {
                    playCount: item.stats?.playCount,
                    diggCount: item.stats?.diggCount,
                    commentCount: item.stats?.commentCount,
                    shareCount: item.stats?.shareCount
                },
                music: {
                    title: item.music?.title,
                    author: item.music?.authorName,
                    url: item.music?.playUrl
                }
            };
        } catch (e) {
            return null;
        }
    }
}

module.exports = new FeedService();
