const jobManager = require('./services/tiktok-automation/queue/jobManager');
const fs = require('fs');
const path = require('path');

async function testScheduler() {
    console.log('--- Testing Scheduler & Persistence ---');

    const userId = 'test_user_' + Date.now();
    const futureTime = new Date(Date.now() + 60000 * 5).toISOString(); // 5 mins later

    // 1. Add Immediate Job
    console.log('1. Adding Immediate Job...');
    jobManager.addJob(userId, 'WARM_UP', { duration: 1000 });

    // 2. Add Scheduled Job
    console.log(`2. Adding Scheduled Job for ${futureTime}...`);
    jobManager.addJob(userId, 'UPLOAD', { filePath: 'test.mp4', caption: 'Future' }, futureTime);

    // 3. Verify Internal State
    const status = jobManager.getQueueStatus();
    console.log('Queue Status:', {
        pending: status.pendingCount,
        scheduled: status.scheduledCount,
        next: status.nextScheduled?.scheduledTime
    });

    if (status.pendingCount >= 1 && status.scheduledCount === 1) {
        console.log('✅ In-memory state correct');
    } else {
        console.error('❌ In-memory state INCORRECT');
    }

    // 4. Verify Persistence File
    const queueFile = path.join(__dirname, 'services/tiktok-automation/queue/queue_state.json');
    if (fs.existsSync(queueFile)) {
        const fileContent = fs.readFileSync(queueFile, 'utf8');
        const state = JSON.parse(fileContent);
        console.log('File Content Summary:', {
            savedPending: state.queue.length,
            savedScheduled: state.scheduledJobs.length
        });

        if (state.queue.length >= 1 && state.scheduledJobs.length === 1) {
            console.log('✅ Persistence file check passed');
        } else {
            console.error('❌ Persistence file content INCORRECT');
        }

    } else {
        console.error('❌ Queue file not found');
    }

    // Cleanup (optional, stop scheduler to exit)
    process.exit(0);
}

testScheduler();
