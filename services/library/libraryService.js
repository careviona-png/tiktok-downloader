const fs = require('fs').promises;
const path = require('path');
const { getTikTokVideo } = require('../../utils/tiktok'); // Reuse existing downloader logic

class LibraryService {
    constructor() {
        this.libraryFile = path.join(__dirname, '..', '..', 'data', 'library.json');
        this.ensureDataDir();
    }

    async ensureDataDir() {
        try {
            const dataDir = path.dirname(this.libraryFile);
            await fs.mkdir(dataDir, { recursive: true });

            try {
                await fs.access(this.libraryFile);
            } catch {
                await fs.writeFile(this.libraryFile, JSON.stringify({ saved: [] }, null, 2));
            }
        } catch (error) {
            console.error('[LibraryService] Init error:', error);
        }
    }

    async readLibrary() {
        try {
            const data = await fs.readFile(this.libraryFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return { saved: [] };
        }
    }

    async saveLibrary(data) {
        await fs.writeFile(this.libraryFile, JSON.stringify(data, null, 2));
    }

    /**
     * Save a video to the user's library
     * @param {string} userId 
     * @param {string} url - TikTok Video URL
     */
    async saveVideo(userId, url) {
        const data = await this.readLibrary();

        // Check duplication
        const exists = data.saved.find(v => v.userId === userId && v.url === url);
        if (exists) {
            return { success: false, error: 'Video already saved' };
        }

        // Fetch metadata using existing utility
        console.log(`[Library] Fetching metadata for ${url}`);
        let metadata;
        try {
            metadata = await getTikTokVideo(url);
        } catch (e) {
            return { success: false, error: 'Failed to fetch video info: ' + e.message };
        }

        const newItem = {
            id: Date.now().toString(),
            userId,
            url,
            title: metadata.title || metadata.desc || 'No Title',
            cover: metadata.cover,
            author: metadata.author,
            videoUrl: metadata.videoNoWatermark || metadata.videoUrl, // high quality link
            duration: metadata.duration,
            savedAt: new Date().toISOString()
        };

        data.saved.unshift(newItem); // Add to top
        await this.saveLibrary(data);

        return { success: true, item: newItem };
    }

    /**
     * Get user's library
     */
    async getLibrary(userId) {
        const data = await this.readLibrary();
        return data.saved.filter(v => v.userId === userId);
    }

    /**
     * Remove video
     */
    async deleteVideo(userId, videoId) {
        const data = await this.readLibrary();
        const initialLen = data.saved.length;

        data.saved = data.saved.filter(v => !(v.userId === userId && v.id === videoId));

        if (data.saved.length !== initialLen) {
            await this.saveLibrary(data);
            return true;
        }
        return false;
    }
}

module.exports = new LibraryService();
