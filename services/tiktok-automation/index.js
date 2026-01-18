const jobManager = require('./queue/jobManager');

class AutomationService {
    /**
     * Start a warming session for a user
     * @param {string} userId 
     * @param {number} durationMinutes 
     */
    scheduleWarming(userId, durationMinutes = 10, scheduledTime = null) {
        return jobManager.addJob(userId, 'WARM_UP', {
            duration: durationMinutes * 60 * 1000
        }, scheduledTime);
    }

    /**
     * Schedule a video upload
     * @param {string} userId 
     * @param {string} filePath 
     * @param {string} caption 
     * @param {string|Date} [scheduledTime]
     */
    scheduleUpload(userId, filePath, caption, scheduledTime = null) {
        return jobManager.addJob(userId, 'UPLOAD', {
            filePath,
            caption
        }, scheduledTime);
    }

    /**
     * Get current system status
     */
    getStatus() {
        return jobManager.getQueueStatus();
    }
}

module.exports = new AutomationService();
