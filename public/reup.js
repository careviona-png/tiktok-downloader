/**
 * Auto Reup Safe Mode - Client-side JavaScript
 * Handles file upload, processing, and usage limit tracking
 */

(function () {
    'use strict';

    // Configuration
    const DAILY_FREE_USES = 3;
    const STORAGE_KEY_PREFIX = 'reup_usage_';

    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');
    const videoUrl = document.getElementById('videoUrl');
    const processBtn = document.getElementById('processBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const remainingUses = document.getElementById('remainingUses');

    // State
    let selectedFile = null;
    let uploadId = null;
    let isProcessing = false;

    // Initialize
    function init() {
        updateUsageDisplay();
        setupEventListeners();
    }

    // Get today's storage key
    function getStorageKey() {
        const today = new Date().toDateString();
        return STORAGE_KEY_PREFIX + today;
    }

    // Get remaining uses
    function getRemainingUses() {
        const used = parseInt(localStorage.getItem(getStorageKey()) || '0');
        return Math.max(0, DAILY_FREE_USES - used);
    }

    // Increment usage count
    function incrementUsage() {
        const key = getStorageKey();
        const used = parseInt(localStorage.getItem(key) || '0');
        localStorage.setItem(key, used + 1);
        updateUsageDisplay();
    }

    // Update usage display
    function updateUsageDisplay() {
        const remaining = getRemainingUses();
        if (remainingUses) {
            remainingUses.textContent = remaining;
        }

        // Disable process button if no remaining uses
        if (remaining <= 0 && processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <span>Hết lượt miễn phí hôm nay</span>
            `;
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Upload area click
        if (uploadArea) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target !== removeFile && !removeFile.contains(e.target)) {
                    videoInput.click();
                }
            });

            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('video/')) {
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

        // Remove file button
        if (removeFile) {
            removeFile.addEventListener('click', (e) => {
                e.stopPropagation();
                clearFile();
            });
        }

        // URL input
        if (videoUrl) {
            videoUrl.addEventListener('input', updateProcessButton);
        }

        // Process button
        if (processBtn) {
            processBtn.addEventListener('click', handleProcess);
        }
    }

    // Handle file selection
    function handleFileSelect(file) {
        // Validate file type
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
            showError('Vui lòng chọn file video (MP4, WebM, MOV, AVI, MKV)');
            return;
        }

        // Validate file size (500MB)
        if (file.size > 500 * 1024 * 1024) {
            showError('File quá lớn. Tối đa 500MB');
            return;
        }

        selectedFile = file;

        // Show file info
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.classList.add('show');
        uploadArea.classList.add('has-file');

        // Clear URL input
        videoUrl.value = '';

        updateProcessButton();
        hideError();
    }

    // Clear selected file
    function clearFile() {
        selectedFile = null;
        uploadId = null;
        videoInput.value = '';
        fileInfo.classList.remove('show');
        uploadArea.classList.remove('has-file');
        updateProcessButton();
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Update process button state
    function updateProcessButton() {
        if (!processBtn) return;

        const hasFile = selectedFile !== null;
        const hasUrl = videoUrl.value.trim().length > 0;
        const hasRemaining = getRemainingUses() > 0;

        processBtn.disabled = isProcessing || (!hasFile && !hasUrl) || !hasRemaining;
    }

    // Handle processing
    async function handleProcess() {
        if (isProcessing) return;

        // Check usage limit
        if (getRemainingUses() <= 0) {
            showError('Bạn đã hết lượt miễn phí hôm nay. Vui lòng quay lại vào ngày mai.');
            return;
        }

        const urlValue = videoUrl.value.trim();

        if (selectedFile) {
            await processFile();
        } else if (urlValue) {
            await processUrl(urlValue);
        } else {
            showError('Vui lòng upload file hoặc nhập URL video');
        }
    }

    // Process uploaded file
    async function processFile() {
        setProcessing(true);
        hideError();
        hideSuccess();
        showProgress('Đang tải lên...');

        try {
            // Step 1: Upload file
            const formData = new FormData();
            formData.append('video', selectedFile);

            const uploadResponse = await fetch('/api/reup/upload', {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadResponse.json();

            if (!uploadData.success) {
                throw new Error(uploadData.error || 'Upload thất bại');
            }

            uploadId = uploadData.uploadId;
            updateProgress(30, 'Đang xử lý Auto Reup...');

            // Step 2: Process video
            const processResponse = await fetch('/api/reup/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadId })
            });

            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.error || 'Xử lý thất bại');
            }

            updateProgress(90, 'Đang tải xuống...');

            // Step 3: Download result
            const blob = await processResponse.blob();
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${selectedFile.name.replace(/\.[^/.]+$/, '')}-reup-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            // Success
            incrementUsage();
            updateProgress(100, 'Hoàn thành!');
            showSuccess();
            clearFile();

        } catch (error) {
            console.error('Process error:', error);
            showError(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setProcessing(false);
            hideProgress();
        }
    }

    // Process video from URL
    async function processUrl(url) {
        setProcessing(true);
        hideError();
        hideSuccess();
        showProgress('Đang tải video từ URL...');

        try {
            // Validate URL
            try {
                new URL(url);
            } catch {
                throw new Error('URL không hợp lệ');
            }

            updateProgress(20, 'Đang xử lý Auto Reup...');

            const response = await fetch('/api/reup/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl: url })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Xử lý thất bại');
            }

            updateProgress(90, 'Đang tải xuống...');

            // Download result
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `video-reup-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            // Success
            incrementUsage();
            updateProgress(100, 'Hoàn thành!');
            showSuccess();
            videoUrl.value = '';

        } catch (error) {
            console.error('URL process error:', error);
            showError(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setProcessing(false);
            hideProgress();
        }
    }

    // UI Helpers
    function setProcessing(processing) {
        isProcessing = processing;
        if (processBtn) {
            processBtn.disabled = processing;
            if (processing) {
                processBtn.innerHTML = `
                    <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
                    </svg>
                    <span>Đang xử lý...</span>
                `;
            } else {
                processBtn.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>Xử Lý Auto Reup</span>
                `;
            }
        }
        updateProcessButton();
    }

    function showProgress(text) {
        if (progressContainer) progressContainer.classList.add('show');
        if (progressText) progressText.textContent = text;
        if (progressFill) progressFill.style.width = '0%';
    }

    function updateProgress(percent, text) {
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressText && text) progressText.textContent = text;
    }

    function hideProgress() {
        setTimeout(() => {
            if (progressContainer) progressContainer.classList.remove('show');
        }, 1000);
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
        }
    }

    function hideError() {
        if (errorMessage) errorMessage.classList.remove('show');
    }

    function showSuccess() {
        if (successMessage) successMessage.classList.add('show');
    }

    function hideSuccess() {
        if (successMessage) successMessage.classList.remove('show');
    }

    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
