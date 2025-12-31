/**
 * Client-side Video Reverser
 * This script handles video reversing in the browser without server dependencies
 */

class VideoReverser {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.videoElement = null;
        this.mediaRecorder = null;
        this.chunks = [];
    }

    /**
     * Reverse a video URL
     * @param {string} videoUrl - URL of the video to reverse
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<Blob>} Reversed video blob
     */
    async reverseVideo(videoUrl, progressCallback = null) {
        try {
            // Create video element
            this.videoElement = document.createElement('video');
            this.videoElement.crossOrigin = 'anonymous';
            this.videoElement.src = videoUrl;
            this.videoElement.muted = true;

            // Wait for video to load
            await new Promise((resolve, reject) => {
                this.videoElement.onloadedmetadata = resolve;
                this.videoElement.onerror = reject;
            });

            const width = this.videoElement.videoWidth;
            const height = this.videoElement.videoHeight;
            const duration = this.videoElement.duration;
            const fps = 30; // Target FPS

            // Create canvas
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx = this.canvas.getContext('2d');

            // Setup MediaRecorder
            const stream = this.canvas.captureStream(fps);
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 2500000
            });

            this.chunks = [];
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.chunks.push(e.data);
                }
            };

            // Start recording
            this.mediaRecorder.start();

            // Render frames in reverse
            const totalFrames = Math.floor(duration * fps);
            const frameInterval = 1 / fps;

            for (let i = totalFrames; i >= 0; i--) {
                const time = i * frameInterval;
                this.videoElement.currentTime = time;

                await new Promise(resolve => {
                    this.videoElement.onseeked = resolve;
                });

                // Draw frame to canvas
                this.ctx.drawImage(this.videoElement, 0, 0, width, height);

                // Update progress
                if (progressCallback) {
                    const progress = ((totalFrames - i) / totalFrames) * 100;
                    progressCallback(progress);
                }

                // Small delay to ensure frame is captured
                await new Promise(resolve => setTimeout(resolve, 1000 / fps));
            }

            // Stop recording
            this.mediaRecorder.stop();

            // Wait for recording to finish
            const reversedBlob = await new Promise(resolve => {
                this.mediaRecorder.onstop = () => {
                    resolve(new Blob(this.chunks, { type: 'video/webm' }));
                };
            });

            // Cleanup
            this.cleanup();

            return reversedBlob;

        } catch (error) {
            this.cleanup();
            throw new Error(`Failed to reverse video: ${error.message}`);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.videoElement) {
            this.videoElement.src = '';
            this.videoElement = null;
        }
        if (this.canvas) {
            this.canvas = null;
            this.ctx = null;
        }
        this.chunks = [];
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoReverser;
}
