/**
 * Safe Audio Modifier - Client-side JavaScript
 */

(function () {
    'use strict';

    const DAILY_FREE_USES = 5;
    const STORAGE_KEY_PREFIX = 'audio_mod_usage_';

    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const processBtn = document.getElementById('processBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const remainingUses = document.getElementById('remainingUses');

    // State
    let selectedFile = null;
    let isProcessing = false;

    function init() {
        updateUsageDisplay();
        setupEventListeners();
    }

    function getStorageKey() {
        return STORAGE_KEY_PREFIX + new Date().toDateString();
    }

    function getRemainingUses() {
        const used = parseInt(localStorage.getItem(getStorageKey()) || '0');
        return Math.max(0, DAILY_FREE_USES - used);
    }

    function incrementUsage() {
        const key = getStorageKey();
        const used = parseInt(localStorage.getItem(key) || '0');
        localStorage.setItem(key, used + 1);
        updateUsageDisplay();
    }

    function updateUsageDisplay() {
        const remaining = getRemainingUses();
        if (remainingUses) remainingUses.textContent = remaining;

        if (remaining <= 0 && processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = '<span>Hết lượt miễn phí hôm nay</span>';
        }
    }

    function setupEventListeners() {
        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput.click());

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
                if (e.dataTransfer.files.length > 0) {
                    handleFileSelect(e.dataTransfer.files[0]);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                }
            });
        }

        if (processBtn) {
            processBtn.addEventListener('click', handleProcess);
        }
    }

    function handleFileSelect(file) {
        const validTypes = ['video/', 'audio/'];
        const validExts = /\.(mp4|webm|mov|mp3|wav|m4a)$/i;

        if (!validTypes.some(t => file.type.startsWith(t)) && !file.name.match(validExts)) {
            showError('Vui lòng chọn file video hoặc audio');
            return;
        }

        if (file.size > 500 * 1024 * 1024) {
            showError('File quá lớn. Tối đa 500MB');
            return;
        }

        selectedFile = file;
        fileName.textContent = file.name;
        fileInfo.classList.add('show');
        uploadArea.classList.add('has-file');
        hideError();
        updateProcessButton();
    }

    function updateProcessButton() {
        if (!processBtn) return;
        processBtn.disabled = isProcessing || !selectedFile || getRemainingUses() <= 0;
    }

    async function handleProcess() {
        if (isProcessing || !selectedFile) return;

        if (getRemainingUses() <= 0) {
            showError('Bạn đã hết lượt miễn phí hôm nay.');
            return;
        }

        setProcessing(true);
        hideError();
        hideSuccess();
        showProgress('Đang tải lên và xử lý...');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            updateProgress(30, 'Đang xử lý audio...');

            const response = await fetch('/api/audio-mod/process', {
                method: 'POST',
                body: formData
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
            const ext = selectedFile.name.includes('.mp3') ? '.mp3' : '.mp4';
            a.download = selectedFile.name.replace(/\.[^/.]+$/, '') + '-audio-safe' + ext;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            // Success
            incrementUsage();
            updateProgress(100, 'Hoàn thành!');
            showSuccess();

            // Reset
            selectedFile = null;
            fileInput.value = '';
            fileInfo.classList.remove('show');
            uploadArea.classList.remove('has-file');

        } catch (error) {
            console.error('Audio mod error:', error);
            showError(error.message || 'Đã xảy ra lỗi');
        } finally {
            setProcessing(false);
            hideProgress();
        }
    }

    function setProcessing(processing) {
        isProcessing = processing;
        if (processBtn) {
            processBtn.disabled = processing;
            if (processing) {
                processBtn.innerHTML = '<span>Đang xử lý...</span>';
            } else {
                processBtn.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                    </svg>
                    <span>Xử Lý Audio Safe</span>
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

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
