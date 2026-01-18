const browserService = require('../core/browser');
const sessionManager = require('../core/session');
const scroller = require('../actions/scroller');
const uploader = require('../actions/uploader');
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'queue_state.json');

class JobManager {
    constructor() {
        this.queue = [];
        this.scheduledJobs = [];
        this.isProcessing = false;
        this.currentJob = null;
        this.schedulerInterval = null;

        // Restore state on startup
        this.loadState();

        // Start the scheduler loop
        this.startScheduler();
    }

    /**
     * Save current state to disk
     */
    saveState() {
        try {
            const state = {
                queue: this.queue,
                scheduledJobs: this.scheduledJobs
            };
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('[JobManager] Failed to save state:', error);
        }
    }

    /**
     * Load state from disk
     */
    loadState() {
        try {
            if (fs.existsSync(QUEUE_FILE)) {
                const data = fs.readFileSync(QUEUE_FILE, 'utf8');
                const state = JSON.parse(data);
                this.queue = state.queue || [];
                this.scheduledJobs = state.scheduledJobs || [];
                console.log(`[JobManager] Restored ${this.queue.length} pending and ${this.scheduledJobs.length} scheduled jobs`);
            }
        } catch (error) {
            console.error('[JobManager] Failed to load state:', error);
        }
    }

    /**
     * Start the scheduler to check for due jobs
     */
    startScheduler() {
        if (this.schedulerInterval) clearInterval(this.schedulerInterval);

        console.log('[JobManager] Scheduler started');
        this.schedulerInterval = setInterval(() => {
            const now = new Date().toISOString();

            // Find jobs that are due
            const dueJobs = this.scheduledJobs.filter(job => job.scheduledTime <= now);

            if (dueJobs.length > 0) {
                console.log(`[JobManager] Moving ${dueJobs.length} due jobs to queue`);

                // Remove from scheduled
                this.scheduledJobs = this.scheduledJobs.filter(job => job.scheduledTime > now);

                // Add to main queue
                dueJobs.forEach(job => {
                    job.status = 'PENDING';
                    this.queue.push(job);
                });

                this.saveState();
                this.processQueue();
            }
        }, 60000); // Check every minute
    }

    /**
     * Add a job to the queue
     * @param {string} userId 
     * @param {string} type - 'WARM_UP' | 'UPLOAD'
     * @param {object} data - Job specific data
     * @param {string|Date} [scheduledTime] - Optional time to run the job
     */
    addJob(userId, type, data = {}, scheduledTime = null) {
        const job = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            userId,
            type,
            data,
            status: scheduledTime ? 'SCHEDULED' : 'PENDING',
            createdAt: new Date().toISOString(),
            scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null
        };

        if (scheduledTime && new Date(scheduledTime) > new Date()) {
            this.scheduledJobs.push(job);
            console.log(`[JobManager] Scheduled job ${type} for ${userId} at ${job.scheduledTime}`);
        } else {
            this.queue.push(job);
            console.log(`[JobManager] Added job ${type} for ${userId} to immediate queue`);
            // Trigger processing asynchronously
            setTimeout(() => this.processQueue(), 100);
        }

        this.saveState();
        return job;
    }

    /**
     * Process the next job in queue
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        this.currentJob = this.queue.shift();
        this.saveState(); // Save state after removing from queue

        try {
            console.log(`[JobManager] Processing job ${this.currentJob.id} (${this.currentJob.type})`);

            // 1. Prepare Browser
            const { userId } = this.currentJob;

            // Check session
            if (!await sessionManager.sessionExists(userId)) {
                throw new Error('No session found for user');
            }
            const cookies = await sessionManager.loadSession(userId);

            // Launch Browser (Headless for jobs)
            const browser = await browserService.launch(true);
            const page = await browserService.newPage();

            // Set Cookies
            await page.setCookie(...cookies);

            // Navigate to TikTok to verify session
            await page.goto('https://www.tiktok.com/@', { waitUntil: 'domcontentloaded' });

            // 2. Execute Action
            switch (this.currentJob.type) {
                case 'WARM_UP':
                    // Default warm up: 10 mins scroll
                    await scroller.scrollFeed(page, this.currentJob.data.duration || 600000);
                    break;

                case 'UPLOAD':
                    await uploader.uploadVideo(
                        page,
                        this.currentJob.data.filePath,
                        this.currentJob.data.caption
                    );
                    break;

                default:
                    console.warn('Unknown job type:', this.currentJob.type);
            }

            // 3. Cleanup
            this.currentJob.status = 'COMPLETED';
            console.log(`[JobManager] Job ${this.currentJob.id} completed`);

            await browserService.close();

        } catch (error) {
            console.error(`[JobManager] Job ${this.currentJob.id} failed:`, error);
            this.currentJob.status = 'FAILED';
            this.currentJob.error = error.message;

            try { await browserService.close(); } catch { }
        } finally {
            this.isProcessing = false;
            this.currentJob = null; // Clear current job
            this.saveState(); // Save ready for next
            // Process next job
            this.processQueue();
        }
    }

    getQueueStatus() {
        return {
            isProcessing: this.isProcessing,
            pendingCount: this.queue.length,
            scheduledCount: this.scheduledJobs.length,
            currentJob: this.currentJob,
            nextScheduled: this.scheduledJobs.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))[0] || null
        };
    }
}

module.exports = new JobManager();
