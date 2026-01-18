const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const watermarkService = require('./watermark');
const captionGenerator = require('../utils/captionGenerator');

class WorkflowService {
    /**
     * Generate a Manual Upload Pack (Video + Caption Text)
     * @param {string} videoPath - Absolute path to original video
     * @param {string} topic - Topic for caption generation
     * @param {object} options - { watermark: boolean, watermarkText: string }
     */
    async generatePack(videoPath, topic, options = {}) {
        try {
            const jobId = Date.now().toString();
            const tempDir = path.join(path.dirname(videoPath), 'packs', jobId);
            await fs.promises.mkdir(tempDir, { recursive: true });

            // 1. Process Video (Watermark)
            let finalVideoPath = videoPath;
            if (options.watermark) {
                try {
                    console.log('[Workflow] Applying watermark...');
                    finalVideoPath = await watermarkService.addWatermark(videoPath, options.watermarkText || "TikDown Automation");
                } catch (e) {
                    console.error('[Workflow] Watermark failed, using original.', e);
                }
            }

            // Copy to pack folder
            const packVideoName = `video_${jobId}.mp4`;
            await fs.promises.copyFile(finalVideoPath, path.join(tempDir, packVideoName));

            // 2. Generate Captions (Compliance + Disclosure included in generator)
            const captions = captionGenerator.generateViralContent(topic, 'mmo'); // Default to MMO niche

            // Check compliance of the first result just to be safe/log
            if (captions[0].compliance && captions[0].compliance.status === 'BLOCK') {
                console.warn('[Workflow] Warning: Content flagged by compliance filter.');
            }

            // Write captions to text files
            const captionText = captions.map((c, i) =>
                `--- Option ${i + 1} ---\n${c.fullText}\n\n`
            ).join('\n');

            await fs.promises.writeFile(path.join(tempDir, 'captions.txt'), captionText, 'utf8');

            // 3. Create ZIP
            const zipPath = path.join(path.dirname(videoPath), `pack_${jobId}.zip`);
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            return new Promise((resolve, reject) => {
                output.on('close', () => {
                    console.log(`[Workflow] Pack created: ${zipPath} (${archive.pointer()} bytes)`);
                    // Cleanup temp dir
                    fs.rm(tempDir, { recursive: true, force: true }, () => { });
                    resolve(zipPath);
                });

                archive.on('error', (err) => reject(err));

                archive.pipe(output);
                archive.directory(tempDir, false);
                archive.finalize();
            });

        } catch (error) {
            console.error('[Workflow] Failed to generate pack:', error);
            throw error;
        }
    }
}

module.exports = new WorkflowService();
