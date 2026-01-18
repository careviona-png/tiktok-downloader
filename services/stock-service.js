/**
 * Pexels Stock Video/Image Service
 * Free API: https://www.pexels.com/api/
 * 
 * Usage: Get API key from pexels.com/api (Free, 200 requests/hour)
 */
const axios = require('axios');

class StockService {
    constructor() {
        this.baseUrl = 'https://api.pexels.com';
    }

    /**
     * Get API key from env or settings
     */
    getApiKey() {
        if (process.env.PEXELS_API_KEY && process.env.PEXELS_API_KEY.length > 10) {
            return process.env.PEXELS_API_KEY;
        }
        try {
            const settingsManager = require('./settings-manager');
            const settings = settingsManager.getSettings();
            return settings.pexelsApiKey || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * Search for stock videos related to a query
     * @param {string} query - Search term (e.g., "running shoes", "beauty")
     * @param {number} perPage - Number of results
     * @returns {Promise<Array>} Array of video objects
     */
    async searchVideos(query, perPage = 3) {
        const apiKey = this.getApiKey();
        if (!apiKey || apiKey.length < 10) {
            console.warn('[StockService] No Pexels API key set. Using fallback.');
            return this.getFallbackVideos();
        }

        try {
            const response = await axios.get(`${this.baseUrl}/videos/search`, {
                headers: { Authorization: apiKey },
                params: {
                    query: query,
                    per_page: perPage,
                    orientation: 'portrait', // For TikTok/Shorts format
                    size: 'medium'
                }
            });

            return response.data.videos.map(video => ({
                id: video.id,
                type: 'video',
                url: video.video_files.find(v => v.quality === 'hd')?.link || video.video_files[0]?.link,
                thumbnail: video.image,
                duration: video.duration,
                source: 'pexels'
            }));

        } catch (error) {
            console.error('[StockService] Pexels API Error:', error.message);
            return this.getFallbackVideos();
        }
    }

    /**
     * Search for stock images
     */
    async searchImages(query, perPage = 5) {
        if (this.apiKey === 'YOUR_PEXELS_API_KEY') {
            return [];
        }

        try {
            const response = await axios.get(`${this.baseUrl}/v1/search`, {
                headers: { Authorization: this.apiKey },
                params: {
                    query: query,
                    per_page: perPage,
                    orientation: 'portrait'
                }
            });

            return response.data.photos.map(photo => ({
                id: photo.id,
                type: 'image',
                url: photo.src.large2x || photo.src.large,
                thumbnail: photo.src.medium,
                source: 'pexels'
            }));

        } catch (error) {
            console.error('[StockService] Pexels Image Error:', error.message);
            return [];
        }
    }

    /**
     * Fallback videos when API is not configured
     * These are public domain / CC0 videos
     */
    getFallbackVideos() {
        return [
            {
                id: 'fallback_1',
                type: 'video',
                url: 'https://cdn.pixabay.com/video/2021/02/22/65935-516403927_tiny.mp4',
                thumbnail: null,
                duration: 10,
                source: 'fallback'
            }
        ];
    }

    /**
     * Extract keywords from product title for better search
     */
    extractSearchTerms(title) {
        // Remove Vietnamese common words and Shopee-specific text
        const stopWords = ['shopee', 'việt', 'nam', 'mua', 'bán', 'ứng', 'dụng', 'website', 'giá', 'rẻ', 'hot', 'sale', 'freeship'];

        const words = title.toLowerCase()
            .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.includes(w));

        // Return top 2-3 meaningful keywords
        return words.slice(0, 3).join(' ') || 'product showcase';
    }
}

module.exports = new StockService();
