/**
 * Auto Subtitle Tool - Client-side JavaScript
 */

(function () {
    'use strict';

    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const languageSelect = document.getElementById('languageSelect');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const processBtn = document.getElementById('processBtn');
    const statusContainer = document.getElementById('statusContainer');
    const progressFill = document.getElementById('progressFill');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    const steps = {
        1: document.getElementById('step1'),
        2: document.getElementById('step2'),
        3: document.getElementById('step3')
    };

    // State
    let selectedFile = null;
    let isProcessing = false;

    function init() {
        // Load saved API Key
        const savedKey = localStorage.getItem('groq_api_key');
        if (savedKey) apiKeyInput.value = savedKey;

        setupEventListeners();
    }

    function setupEventListeners() {
        if (uploadArea) {
            uploadArea.addEventListener('click', () => videoInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
            });
        }

        if (videoInput) {
            videoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
            });
        }

        if (processBtn) {
            processBtn.addEventListener('click', handleProcess);
        }

        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', (e) => {
                localStorage.setItem('groq_api_key', e.target.value.trim());
            });
        }
    }

    function handleFileSelect(file) {
        if (!file.type.startsWith('video/')) {
            showError('Vui lòng chọn file video (MP4, WebM, MOV)');
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            showError('File quá lớn. Tối đa 100MB cho phụ đề tự động.');
            return;
        }

        selectedFile = file;
        fileName.textContent = file.name;
        fileInfo.style.display = 'block';
        uploadArea.classList.add('has-file');
        hideError();
        hideSuccess();
    }

    async function handleProcess() {
        if (isProcessing || !selectedFile) {
            if (!selectedFile) showError('Vui lòng chọn video trước!');
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showError('Bạn cần nhập Groq API Key để sử dụng tính năng này (nhận diện giọng nói)');
            apiKeyInput.focus();
            return;
        }

        setProcessing(true);
        hideError();
        hideSuccess();
        showStatus();
        updateSteps(1); // Step 1: Upload & Extract

        try {
            const formData = new FormData();
            formData.append('video', selectedFile);
            formData.append('language', languageSelect.value);
            formData.append('apiKey', apiKey);

            // Start API call
            // Note: Since this can take 30-120 seconds, we show progress
            updateProgress(20);

            // Artificial delay stimulation for steps if server doesn't send partials
            // (In a real app, SSE or WebSockets would be better, but for simplicity we simulate)
            const stepInterval = setInterval(() => {
                const currentWidth = parseFloat(progressFill.style.width);
                if (currentWidth < 90) {
                    updateProgress(currentWidth + 1);
                    if (currentWidth > 30) updateSteps(2);
                    if (currentWidth > 60) updateSteps(3);
                }
            }, 1000);

            const response = await fetch('/api/subtitle/process', {
                method: 'POST',
                body: formData
            });

            clearInterval(stepInterval);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Xử lý thất bại');
            }

            updateProgress(100);
            updateSteps(4); // All done

            // Download result
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = selectedFile.name.replace(/\.[^/.]+$/, '') + '-subtitled.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            showSuccess();
            resetUI();

        } catch (error) {
            console.error('Subtitle Error:', error);
            showError(error.message || 'Đã xảy ra lỗi');
            hideStatus();
        } finally {
            setProcessing(false);
        }
    }

    function setProcessing(processing) {
        isProcessing = processing;
        processBtn.disabled = processing;
        processBtn.innerHTML = processing ? '<span>Đang xử lý...</span>' : `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Bắt Đầu Tạo Phụ Đề</span>
        `;
    }

    function showStatus() {
        statusContainer.classList.add('show');
        Object.values(steps).forEach(s => {
            s.classList.remove('active', 'done');
            s.querySelector('.icon').textContent = '⏳';
        });
    }

    function hideStatus() {
        statusContainer.classList.remove('show');
    }

    function updateSteps(currentStep) {
        for (let i = 1; i <= 3; i++) {
            if (i < currentStep) {
                steps[i].classList.add('done');
                steps[i].classList.remove('active');
                steps[i].querySelector('.icon').textContent = '✅';
            } else if (i === currentStep) {
                steps[i].classList.add('active');
                steps[i].classList.remove('done');
                const icons = ['⏳', '🤖', '🎬'];
                steps[i].querySelector('.icon').textContent = icons[i - 1];
            } else {
                steps[i].classList.remove('active', 'done');
                steps[i].querySelector('.icon').textContent = '⚪';
            }
        }
        if (currentStep > 3) {
            Object.values(steps).forEach(s => {
                s.classList.add('done');
                s.querySelector('.icon').textContent = '✅';
            });
        }
    }

    function updateProgress(percent) {
        progressFill.style.width = percent + '%';
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.add('show');
    }

    function hideError() {
        errorMessage.classList.remove('show');
    }

    function showSuccess() {
        successMessage.classList.add('show');
    }

    function hideSuccess() {
        successMessage.classList.remove('show');
    }

    function resetUI() {
        selectedFile = null;
        videoInput.value = '';
        fileInfo.style.display = 'none';
        uploadArea.classList.remove('has-file');
    }

    init();
})();
