/**
 * Caption & Hashtag Generator - Client-side JavaScript
 */

(function () {
    'use strict';

    // DOM Elements
    const topicInput = document.getElementById('topicInput');
    const nicheBtns = document.querySelectorAll('.niche-btn');
    const generateBtn = document.getElementById('generateBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');

    // State
    let selectedNiche = 'trending';
    let isGenerating = false;

    function init() {
        setupEventListeners();
    }

    function setupEventListeners() {
        // Niche selection
        nicheBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                nicheBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedNiche = btn.dataset.niche;
            });
        });

        // Generate button
        if (generateBtn) {
            generateBtn.addEventListener('click', handleGenerate);
        }

        // Enter key to generate
        if (topicInput) {
            topicInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleGenerate();
            });
        }
    }

    async function handleGenerate() {
        const topic = topicInput.value.trim();
        if (!topic) {
            alert('Vui lòng nhập chủ đề video!');
            topicInput.focus();
            return;
        }

        if (isGenerating) return;
        setGenerating(true);

        try {
            const response = await fetch('/api/caption/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    niche: selectedNiche
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Lỗi khi tạo caption');
            }

            renderResults(data.results);
            resultsSection.classList.add('show');
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Generation error:', error);
            alert(error.message || 'Đã xảy ra lỗi khi tạo caption');
        } finally {
            setGenerating(false);
        }
    }

    function setGenerating(generating) {
        isGenerating = generating;
        if (generateBtn) {
            generateBtn.disabled = generating;
            generateBtn.innerHTML = generating ? '<span>Đang tạo...</span>' : `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Tạo Caption Ngay</span>
            `;
        }
    }

    function renderResults(results) {
        resultsList.innerHTML = '';

        results.forEach((res, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="caption-text">${res.caption}</div>
                <div class="hashtag-text">${res.hashtags}</div>
                <button class="copy-btn" data-text="${res.fullText.replace(/"/g, '&quot;')}">Copy</button>
            `;
            resultsList.appendChild(card);
        });

        // Copy functionality
        const copyBtns = resultsList.querySelectorAll('.copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.style.background = 'var(--success-color)';
                    btn.style.borderColor = 'var(--success-color)';
                    btn.style.color = 'white';

                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                        btn.style.borderColor = '';
                        btn.style.color = '';
                    }, 2000);
                });
            });
        });
    }

    init();
})();
