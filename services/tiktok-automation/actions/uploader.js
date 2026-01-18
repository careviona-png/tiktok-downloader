const safety = require('../core/safety');
const fs = require('fs').promises;

class Uploader {
    /**
     * Upload a video to TikTok
     * @param {Page} page 
     * @param {string} filePath - Absolute path to video file
     * @param {string} caption - Video caption
     */
    async uploadVideo(page, filePath, caption) {
        console.log(`[Uploader] Starting upload for ${filePath}`);

        try {
            // 1. Verify file exists
            await fs.access(filePath);

            // 2. Go to upload page
            await page.goto('https://www.tiktok.com/upload?lang=en', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            await safety.humanDelay();

            // 3. Handle File Upload
            // Look for the file input
            const fileInput = await page.$('input[type="file"]');
            if (!fileInput) {
                throw new Error('Upload input not found');
            }

            console.log('[Uploader] Uploading file...');
            await fileInput.uploadFile(filePath);

            // 4. Wait for upload to complete
            // We look for the "Change video" or similar indicator that upload is processing/done
            // Or wait for the caption editor to appear/be active
            console.log('[Uploader] Waiting for processing...');
            await page.waitForSelector('.captcha-disable', { hidden: true, timeout: 0 }); // Wait if captcha blocks

            // Wait for caption input to be ready
            const captionSelector = '.public-DraftEditor-content'; // Common DraftJS editor class
            await page.waitForSelector(captionSelector, { timeout: 120000 });
            await safety.humanDelay(); // Wait a bit after upload finishes

            // 5. Enter Caption
            console.log('[Uploader] Writing caption...');
            const captionBox = await page.$(captionSelector);

            // Clear existing text if any (sometimes filename is auto-added)
            await captionBox.click();
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');

            await safety.randomSleep(500, 1000);

            // Type caption with human delays
            await page.type(captionSelector, caption, { delay: 100 });
            await safety.humanDelay();

            // 6. Post Video
            console.log('[Uploader] Clicking Post...');
            // Try to find the Post button (usually "Post" text or specific class)
            // Strategy: Find a button with text "Post"
            const buttons = await page.$$('button');
            let postBtn = null;

            for (const btn of buttons) {
                const text = await page.evaluate(el => el.textContent, btn);
                if (text && text.trim() === 'Post') {
                    postBtn = btn;
                    break;
                }
            }

            if (!postBtn) {
                // Fallback selector
                postBtn = await page.$('button[data-e2e="post_video_button"]');
            }

            if (postBtn) {
                await postBtn.click();

                // 7. Verification
                console.log('[Uploader] Waiting for post confirmation...');
                // Wait for "Your video is being uploaded" or redirect to profile

                // Wait for either success modal or redirect
                await Promise.race([
                    page.waitForSelector('.tiktok-modal__modal-button', { timeout: 30000 }), // "Upload another video" modal
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
                ]);

                console.log('[Uploader] Upload sequence completed');
                return true;
            } else {
                throw new Error('Post button not found');
            }

        } catch (error) {
            console.error('[Uploader] Upload failed:', error);
            // Snapshot for debugging
            await page.screenshot({ path: 'upload_error.png' });
            throw error;
        }
    }
}

module.exports = new Uploader();
