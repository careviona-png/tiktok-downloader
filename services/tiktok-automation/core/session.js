const fs = require('fs').promises;
const path = require('path');

class SessionManager {
    constructor() {
        this.sessionsDir = path.join(__dirname, '..', 'sessions');
        this.ensureSessionsDir();
    }

    /**
     * Ensure sessions directory exists
     */
    async ensureSessionsDir() {
        try {
            await fs.mkdir(this.sessionsDir, { recursive: true });
        } catch (error) {
            console.error('[SessionManager] Failed to create sessions directory:', error);
        }
    }

    /**
     * Get path for a specific session file
     * @param {string} sessionId - Unique identifier for the session (e.g. username)
     */
    getSessionPath(sessionId) {
        return path.join(this.sessionsDir, `${sessionId}.json`);
    }

    /**
     * Save cookies to a session file
     * @param {string} sessionId - Unique identifier
     * @param {Array} cookies - Array of cookie objects from Puppeteer
     */
    async saveSession(sessionId, cookies) {
        try {
            const filePath = this.getSessionPath(sessionId);
            await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
            console.log(`[SessionManager] Saved session for ${sessionId}`);
            return true;
        } catch (error) {
            console.error(`[SessionManager] Failed to save session for ${sessionId}:`, error);
            return false;
        }
    }

    /**
     * Load cookies from a session file
     * @param {string} sessionId 
     */
    async loadSession(sessionId) {
        try {
            const filePath = this.getSessionPath(sessionId);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`[SessionManager] Failed to load session for ${sessionId}:`, error);
            }
            return null;
        }
    }

    /**
     * Check if a session exists
     * @param {string} sessionId 
     */
    async sessionExists(sessionId) {
        try {
            const filePath = this.getSessionPath(sessionId);
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete a session
     * @param {string} sessionId 
     */
    async deleteSession(sessionId) {
        try {
            const filePath = this.getSessionPath(sessionId);
            await fs.unlink(filePath);
            console.log(`[SessionManager] Deleted session for ${sessionId}`);
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new SessionManager();
