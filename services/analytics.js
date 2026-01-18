const fs = require('fs');
const path = require('path');

class AnalyticsService {
    constructor() {
        this.logPath = path.join(__dirname, '../data/tracking_logs.json');
    }

    getStats() {
        if (!fs.existsSync(this.logPath)) return { totalClicks: 0, byVariant: { A: 0, B: 0 }, recent: [] };

        try {
            // Read line by line if large, but for MVP read whole file
            // The file format in tracking.js seems to be append-only JSON objects? 
            // Or array?
            // Let's check tracking.js implementation.
            // ... Assuming it's an Array based on previous read of tracking.js (it wasn't fully shown but usually it's array).
            // Actually, let's play safe and handle both newline-delimited JSON or Array.

            const content = fs.readFileSync(this.logPath, 'utf8');
            let logs = [];
            try {
                logs = JSON.parse(content);
            } catch (e) {
                // Try NDJSON
                logs = content.trim().split('\n').map(l => JSON.parse(l));
            }

            if (!Array.isArray(logs)) logs = [];

            const stats = {
                totalClicks: logs.length,
                byVariant: { A: 0, B: 0 },
                byProduct: {},
                recent: logs.slice(-50).reverse() // Last 50 clicks
            };

            logs.forEach(log => {
                const v = log.variant || 'Unknown';
                stats.byVariant[v] = (stats.byVariant[v] || 0) + 1;

                // Group by Video/Product
                const vid = log.videoId || 'Unknown';
                if (!stats.byProduct[vid]) stats.byProduct[vid] = 0;
                stats.byProduct[vid]++;
            });

            return stats;

        } catch (error) {
            console.error('[Analytics] Error parsing logs:', error);
            return { totalClicks: 0, error: 'Failed to load logs' };
        }
    }
}

module.exports = new AnalyticsService();
