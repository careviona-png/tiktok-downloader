/**
 * Batch Video Cutter - Client-side JavaScript
 */

(function () {
    'use strict';

    const DAILY_FREE_USES = 3;
    const STORAGE_KEY_PREFIX = 'batch_usage_';

    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileDuration = document.getElementById('fileDuration');
    const durationBtns = document.querySelectorAll('.duration-btn');
    const customDuration = document.getElementById('customDuration');
    const previewInfo = document.getElementById('previewInfo');
    const clipCount = document.getElementById('clipCount');
    const processBtn = document.getElementById('processBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const errorMessage = document.getElementById('errorMessage');
    const resultCard = document.getElementById('resultCard');
    const resultClipCount = document.getElementById('resultClipCount');
    const downloadBtn = document.getElementById('downloadBtn');
    const remainingUses = document.getElementById('remainingUses');

    // State
    let selectedFile = null;
    let uploadId = null;
    let videoDuration = 0;
    let selectedDuration = 30;
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
        // Upload area
        if (uploadArea) {
            uploadArea.addEventListener('click', () => videoInput.click());

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

        if (videoInput) {
            videoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                }
            });
        }

        // Duration buttons
        durationBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                durationBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedDuration = parseInt(btn.dataset.duration);
                customDuration.value = '';
                updatePreview();
            });
        });

        // Custom duration
        if (customDuration) {
            customDuration.addEventListener('input', () => {
                const val = parseInt(customDuration.value);
                if (val >= 5 && val <= 300) {
                    durationBtns.forEach(b => b.classList.remove('active'));
                    selectedDuration = val;
                    updatePreview();
                }
            });
        }

        // Process button
        if (processBtn) {
            processBtn.addEventListener('click', handleProcess);
        }
    }

    async function handleFileSelect(file) {
        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
            showError('Vui lòng chọn file video');
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

        // Get duration from video element
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            videoDuration = video.duration;
            fileDuration.textContent = `(${formatDuration(videoDuration)})`;
            URL.revokeObjectURL(video.src);
            updatePreview();
            updateProcessButton();
        };
    }

    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updatePreview() {
        if (videoDuration > 0 && selectedDuration > 0) {
            const count = Math.ceil(videoDuration / selectedDuration);
            clipCount.textContent = count;
            previewInfo.style.display = 'block';
        }
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
        hideResult();
        showProgress('Đang tải lên...');

        try {
            // Upload
            const formData = new FormData();
            formData.append('video', selectedFile);

            updateProgress(20, 'Đang tải lên...');

            const uploadRes = await fetch('/api/batch/upload', {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadRes.json();
            if (!uploadData.success) {
                throw new Error(uploadData.error || 'Upload thất bại');
            }

            uploadId = uploadData.uploadId;
            updateProgress(40, 'Đang cắt video...');

            // Split
            const splitRes = await fetch('/api/batch/split', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uploadId,
                    segmentDuration: selectedDuration
                })
            });

            const splitData = await splitRes.json();
            if (!splitData.success) {
                throw new Error(splitData.error || 'Cắt video thất bại');
            }

            updateProgress(90, 'Đang đóng gói ZIP...');

            // Success
            incrementUsage();
            updateProgress(100, 'Hoàn thành!');

            showResult(splitData.jobId, splitData.clipCount);

        } catch (error) {
            console.error('Batch process error:', error);
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
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                    </svg>
                    <span>Cắt Video Hàng Loạt</span>
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

    function showResult(jobId, count) {
        if (resultCard) resultCard.classList.add('show');
        if (resultClipCount) resultClipCount.textContent = count;
        if (downloadBtn) {
            downloadBtn.href = `/api/batch/download/${jobId}`;
            downloadBtn.download = `clips-${count}pcs.zip`;
        }
    }

    function hideResult() {
        if (resultCard) resultCard.classList.remove('show');
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
