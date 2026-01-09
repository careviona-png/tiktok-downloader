// Video Splitter Client-Side Logic
// API Endpoints
const SPLIT_API_URL = '/api/split';

// State
let currentUploadId = null;
let videoDuration = 0;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const videoEditor = document.getElementById('videoEditor');
const videoPreview = document.getElementById('videoPreview');
const videoDurationEl = document.getElementById('videoDuration');
const startMinInput = document.getElementById('startMin');
const startSecInput = document.getElementById('startSec');
const endMinInput = document.getElementById('endMin');
const endSecInput = document.getElementById('endSec');
const startTimeLabel = document.getElementById('startTimeLabel');
const endTimeLabel = document.getElementById('endTimeLabel');
const cutBtn = document.getElementById('cutBtn');
const resetBtn = document.getElementById('resetBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Upload area click
    if (uploadArea) {
        uploadArea.addEventListener('click', () => videoInput.click());

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
    }

    // File input change
    if (videoInput) {
        videoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    // Time inputs
    [startMinInput, startSecInput, endMinInput, endSecInput].forEach(input => {
        if (input) {
            input.addEventListener('input', updateTimeLabels);
            input.addEventListener('change', validateTimeInputs);
        }
    });

    // Cut button
    if (cutBtn) {
        cutBtn.addEventListener('click', handleCutVideo);
    }

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', resetEditor);
    }

    // Video preview loadedmetadata
    if (videoPreview) {
        videoPreview.addEventListener('loadedmetadata', () => {
            videoDuration = videoPreview.duration;
            updateEndTimeFromDuration();
        });
    }
}

/**
 * Handle file selection
 * @param {File} file - Selected video file
 */
async function handleFileSelect(file) {
    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const validExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        showMessage('Định dạng không hỗ trợ. Vui lòng chọn MP4, WebM, MOV, AVI hoặc MKV.', 'error');
        return;
    }

    // Validate file size (200MB max)
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
        showMessage('File quá lớn. Tối đa 200MB.', 'error');
        return;
    }

    // Show loading state
    uploadArea.classList.add('has-file');
    uploadArea.querySelector('.upload-text').textContent = 'Đang tải video...';
    uploadArea.querySelector('.upload-hint').textContent = file.name;

    try {
        // Upload file
        const formData = new FormData();
        formData.append('video', file);

        const response = await fetch(`${SPLIT_API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Lỗi khi upload video');
        }

        // Store upload ID
        currentUploadId = data.uploadId;
        videoDuration = data.info.duration;

        // Set video preview
        const videoURL = URL.createObjectURL(file);
        videoPreview.src = videoURL;

        // Update duration display
        videoDurationEl.textContent = `Thời lượng: ${data.info.durationFormatted}`;

        // Set end time to video duration
        updateEndTimeFromDuration();

        // Show editor
        uploadArea.style.display = 'none';
        videoEditor.classList.add('active');

        showMessage('Video đã sẵn sàng! Chọn thời gian và nhấn "Cắt Video".', 'success');

    } catch (error) {
        console.error('Upload error:', error);
        showMessage(error.message || 'Lỗi khi upload video. Vui lòng thử lại.', 'error');
        resetUploadArea();
    }
}

/**
 * Update end time inputs from video duration
 */
function updateEndTimeFromDuration() {
    const mins = Math.floor(videoDuration / 60);
    const secs = Math.floor(videoDuration % 60);

    endMinInput.value = mins;
    endSecInput.value = secs;

    updateTimeLabels();
}

/**
 * Update time labels based on inputs
 */
function updateTimeLabels() {
    const startMins = parseInt(startMinInput.value) || 0;
    const startSecs = parseInt(startSecInput.value) || 0;
    const endMins = parseInt(endMinInput.value) || 0;
    const endSecs = parseInt(endSecInput.value) || 0;

    startTimeLabel.textContent = formatTime(startMins * 60 + startSecs);
    endTimeLabel.textContent = formatTime(endMins * 60 + endSecs);
}

/**
 * Validate time inputs
 */
function validateTimeInputs() {
    // Ensure seconds are 0-59
    if (parseInt(startSecInput.value) > 59) startSecInput.value = 59;
    if (parseInt(endSecInput.value) > 59) endSecInput.value = 59;
    if (parseInt(startSecInput.value) < 0) startSecInput.value = 0;
    if (parseInt(endSecInput.value) < 0) endSecInput.value = 0;

    // Ensure positive minutes
    if (parseInt(startMinInput.value) < 0) startMinInput.value = 0;
    if (parseInt(endMinInput.value) < 0) endMinInput.value = 0;

    updateTimeLabels();
}

/**
 * Format seconds to MM:SS
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Handle cut video button click
 */
async function handleCutVideo() {
    if (!currentUploadId) {
        showMessage('Vui lòng upload video trước.', 'error');
        return;
    }

    // Calculate times in seconds
    const startTime = (parseInt(startMinInput.value) || 0) * 60 + (parseInt(startSecInput.value) || 0);
    const endTime = (parseInt(endMinInput.value) || 0) * 60 + (parseInt(endSecInput.value) || 0);

    // Validate
    if (endTime <= startTime) {
        showMessage('Thời gian kết thúc phải lớn hơn thời gian bắt đầu.', 'error');
        return;
    }

    if (endTime - startTime < 1) {
        showMessage('Đoạn video phải dài ít nhất 1 giây.', 'error');
        return;
    }

    if (endTime > videoDuration) {
        showMessage('Thời gian kết thúc vượt quá độ dài video.', 'error');
        return;
    }

    // Show progress
    cutBtn.disabled = true;
    progressContainer.classList.add('active');
    progressFill.style.width = '0%';
    progressText.textContent = 'Đang xử lý... 0%';

    // Simulate progress (since we can't get real progress from server)
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `Đang xử lý... ${Math.floor(progress)}%`;
    }, 500);

    try {
        const response = await fetch(`${SPLIT_API_URL}/cut`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId: currentUploadId,
                startTime: startTime,
                endTime: endTime
            })
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Lỗi khi cắt video');
        }

        // Download the file
        progressFill.style.width = '100%';
        progressText.textContent = 'Đang tải xuống...';

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tikdown-cut-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        progressText.textContent = 'Hoàn thành! ✓';
        showMessage('Video đã được cắt thành công!', 'success');

        // Show success modal (if available)
        if (typeof showSuccessModal === 'function') {
            showSuccessModal();
        }

    } catch (error) {
        console.error('Cut error:', error);
        clearInterval(progressInterval);
        progressContainer.classList.remove('active');
        showMessage(error.message || 'Lỗi khi cắt video. Vui lòng thử lại.', 'error');
    } finally {
        cutBtn.disabled = false;
    }
}

/**
 * Reset editor to initial state
 */
function resetEditor() {
    // Cleanup on server
    if (currentUploadId) {
        fetch(`${SPLIT_API_URL}/cleanup/${currentUploadId}`, { method: 'DELETE' })
            .catch(err => console.error('Cleanup error:', err));
    }

    // Reset state
    currentUploadId = null;
    videoDuration = 0;

    // Reset video
    videoPreview.src = '';
    videoPreview.load();

    // Reset inputs
    startMinInput.value = 0;
    startSecInput.value = 0;
    endMinInput.value = 0;
    endSecInput.value = 0;

    // Reset UI
    videoEditor.classList.remove('active');
    uploadArea.style.display = 'block';
    resetUploadArea();
    progressContainer.classList.remove('active');

    // Clear file input
    videoInput.value = '';

    clearMessages();
}

/**
 * Reset upload area to initial state
 */
function resetUploadArea() {
    uploadArea.classList.remove('has-file');
    uploadArea.querySelector('.upload-text').textContent = 'Kéo thả video vào đây hoặc nhấn để chọn';
    uploadArea.querySelector('.upload-hint').textContent = 'Hỗ trợ: MP4, WebM, MOV, AVI, MKV • Tối đa 200MB / 10 phút';
}

/**
 * Show message to user
 * @param {string} message
 * @param {string} type - 'success', 'error', 'info'
 */
function showMessage(message, type = 'info') {
    // Remove existing messages
    clearMessages();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' :
            type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' :
                '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}
        </svg>
        <span>${message}</span>
    `;

    // Insert after download card
    const downloadCard = document.querySelector('.download-card');
    if (downloadCard) {
        downloadCard.insertAdjacentElement('afterend', messageDiv);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

/**
 * Clear all messages
 */
function clearMessages() {
    document.querySelectorAll('.message').forEach(msg => msg.remove());
}

// Track affiliate clicks (reuse from main script)
function trackAffiliateClick(source) {
    console.log('Affiliate click:', source);
}

// Close sticky banner
function closeStickyBanner() {
    const banner = document.getElementById('stickyBanner');
    if (banner) {
        banner.classList.remove('show');
        sessionStorage.setItem('stickyBannerClosed', 'true');
    }
}
