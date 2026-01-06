/**
 * Video Flip Handler for Frontend
 * Handles communication with backend flip API
 */

// Configuration
const FLIP_API_URL = '/api/flip';

/**
 * Flip video horizontally (mirror effect)
 * @param {string} videoUrl - URL of video to flip
 */
async function flipVideo(videoUrl) {
    if (!videoUrl) {
        showMessage('Không tìm thấy link video. Vui lòng thử lại.', 'error');
        return;
    }

    // Show processing message
    const processingDiv = document.createElement('div');
    processingDiv.className = 'message message-info fade-in';
    processingDiv.id = 'flip-progress';
    processingDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
            <span class="loading"></span>
            <span>Đang đảo ngược video (lật ngang)...</span>
        </div>
        <div style="margin-top: 10px; font-size: 0.875rem; color: var(--text-muted);">
            ⏱️ Quá trình xử lý có thể mất 10-30 giây tùy độ dài video
        </div>
    `;

    const downloadCard = document.querySelector('.download-card');
    downloadCard.appendChild(processingDiv);

    try {
        const response = await fetch(FLIP_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoUrl })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Không thể đảo ngược video');
        }

        // Get the flipped video as blob
        const blob = await response.blob();

        // Download the flipped video
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `tiktok-flipped-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

        // Remove processing message
        processingDiv.remove();

        // Show success
        showMessage('✅ Video đã được đảo ngược (lật ngang) và tải xuống! Perfect cho reup 🎉', 'success');

    } catch (error) {
        console.error('Flip error:', error);

        // Remove processing message
        if (processingDiv.parentNode) {
            processingDiv.remove();
        }

        // Check if ffmpeg is not installed
        if (error.message.includes('ffmpeg')) {
            showMessage('❌ Lỗi: Backend chưa cài ffmpeg. Vui lòng xem hướng dẫn cài đặt trong README.md', 'error');
        } else {
            showMessage('❌ Lỗi khi đảo ngược video: ' + error.message, 'error');
        }
    }
}
