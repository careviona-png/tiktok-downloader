// Configuration
const API_URL = '/api/download';
const FACEBOOK_API_URL = '/api/facebook/download';
const YOUTUBE_API_URL = '/api/youtube/download';

// DOM Elements
const downloadForm = document.getElementById('downloadForm');
const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = downloadForm.querySelector('.download-btn');
const pasteBtn = document.getElementById('pasteBtn');
const darkModeToggle = document.getElementById('darkModeToggle');

// State
let currentVideoData = null;
let currentLang = localStorage.getItem('lang') || (navigator.language.startsWith('vi') ? 'vi' : 'en');

/**
 * i18n Logic: Update all elements with data-i18n attribute
 */
function updateUI() {
    const langData = window.translations[currentLang];
    if (!langData) return;

    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langData[key]) {
            el.textContent = langData[key];
        }
    });

    // Update attributes (placeholders, titles, etc.)
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const attrName = el.getAttribute('data-i18n-attr');
        const key = el.getAttribute('data-i18n-key') || el.getAttribute('data-i18n');
        if (langData[key]) {
            el.setAttribute(attrName, langData[key]);
        }
    });

    // Update current lang display
    const currentLangDisplay = document.getElementById('currentLang');
    if (currentLangDisplay) {
        currentLangDisplay.textContent = currentLang.toUpperCase();
    }

    // Update document title and meta description
    if (langData['title']) document.title = langData['title'];
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && langData['description']) {
        metaDesc.setAttribute('content', langData['description']);
    }

    console.log(`🌍 UI updated to: ${currentLang}`);
}

/**
 * Switch language function (exposed to window)
 */
window.changeLanguage = function (lang) {
    if (!window.translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('lang', lang);
    updateUI();
};

// Initialize Dark Mode from localStorage
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon(savedTheme);
}

function updateDarkModeIcon(theme) {
    const sunIcon = darkModeToggle?.querySelector('.sun-icon');
    const moonIcon = darkModeToggle?.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
        if (theme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
}

// Dark Mode Toggle Handler
if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateDarkModeIcon(newTheme);
    });
}

// Paste Button Handler
if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            videoUrlInput.value = text;
            videoUrlInput.focus();
            const successMsg = currentLang === 'vi' ? '✅ Đã dán link từ clipboard' : '✅ Pasted link from clipboard';
            showMessage(successMsg, 'success');
        } catch (err) {
            const errMsg = currentLang === 'vi' ? '❌ Không thể truy cập clipboard. Vui lòng dán thủ công.' : '❌ Cannot access clipboard. Please paste manually.';
            showMessage(errMsg, 'error');
        }
    });
}

// Initialize on page load
initDarkMode();
document.addEventListener('DOMContentLoaded', () => {
    updateUI(); // First UI update
});

// Event Listeners
downloadForm.addEventListener('submit', handleDownload);

/**
 * Detect platform from URL
 */
function detectPlatform(url) {
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    if (/facebook\.com|fb\.watch|fb\.com|fbwat\.ch/i.test(url)) return 'facebook';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    return null;
}

/**
 * Validate URL (TikTok or Facebook)
 */
function isValidUrl(url) {
    return detectPlatform(url) !== null;
}

/**
 * Handle download form submission
 */
async function handleDownload(e) {
    e.preventDefault();

    const url = videoUrlInput.value.trim();
    const langData = window.translations[currentLang];

    if (!url) {
        showMessage(langData['error_no_url'], 'error');
        return;
    }

    const platform = detectPlatform(url);

    if (!platform) {
        showMessage(langData['error_invalid_url'], 'error');
        return;
    }


    // Clear previous messages and preview
    clearMessages();
    clearPreview();

    // Show loading state
    setLoadingState(true);

    // Show affiliate interstitial while loading
    const interstitial = showAffiliateInterstitial();

    try {
        // Use correct API based on platform
        let apiUrl = API_URL;
        if (platform === 'facebook') apiUrl = FACEBOOK_API_URL;
        else if (platform === 'youtube') apiUrl = YOUTUBE_API_URL;
        console.log(`📡 Calling ${platform} API:`, apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            const errorMsg = currentLang === 'vi' ? (data.error || 'Không thể tải video') : (data.error || 'Cannot download video');
            throw new Error(errorMsg);
        }


        // Store video data
        currentVideoData = data.data;

        // Show video preview
        showVideoPreview(data.data);

        // Show success message
        if (data.cached) {
            showMessage(langData['success_cached'], 'success');
        } else {
            showMessage(langData['success_found'], 'success');
        }

        // Remove interstitial
        if (interstitial && interstitial.parentNode) {
            interstitial.remove();
        }

    } catch (error) {
        console.error('Download error:', error);
        const errorMsg = error.message || (currentLang === 'vi' ? 'Có lỗi xảy ra. Vui lòng thử lại.' : 'An error occurred. Please try again.');
        showMessage(errorMsg, 'error');

        // Remove interstitial on error
        if (interstitial && interstitial.parentNode) {
            interstitial.remove();
        }
    } finally {
        setLoadingState(false);
    }
}

/**
 * Validate TikTok URL
 */
function isValidTikTokUrl(url) {
    const tiktokRegex = /^https?:\/\/(www\.)?(vm\.|vt\.)?tiktok\.com\/.+/i;
    return tiktokRegex.test(url);
}

/**
 * Show video preview
 */
function showVideoPreview(data) {
    // Remove existing preview
    clearPreview();

    const isFacebook = data.platform === 'facebook';
    const isYouTube = data.source === 'YouTube' || data.isShort !== undefined;
    const platformLabel = isYouTube ? 'YouTube' : (isFacebook ? 'Facebook' : 'TikTok');
    const platformIcon = isYouTube ? '📺' : (isFacebook ? '📘' : '🎵');

    const langData = window.translations[currentLang];

    // Build download buttons based on platform
    let downloadButtons = '';

    if (isYouTube) {
        // YouTube: Show available download options
        if (data.downloadOptions && data.downloadOptions.length > 0) {
            downloadButtons = data.downloadOptions.map(opt => {
                const isAudio = opt.type === 'audio';
                const btnStyle = isAudio ? 'background: var(--gradient-secondary);' : 'background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);';
                const label = isAudio ? `🎵 ${opt.quality} MP3` : `📥 ${opt.quality} ${opt.format.toUpperCase()}`;
                return `
                    <button onclick="downloadVideoDirect('${encodeURIComponent(opt.url)}', '${opt.type}', 'youtube')" class="download-video-btn" style="${btnStyle}">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 13L5 8H8V2H12V8H15L10 13Z" fill="currentColor"/>
                            <path d="M2 16H18V18H2V16Z" fill="currentColor"/>
                        </svg>
                        ${label}
                    </button>
                `;
            }).join('');
        } else if (data.downloadUrl) {
            // Fallback to single download button
            downloadButtons = `
                <button onclick="downloadVideoDirect('${encodeURIComponent(data.downloadUrl)}', 'video', 'youtube')" class="download-video-btn" style="background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 13L5 8H8V2H12V8H15L10 13Z" fill="currentColor"/>
                        <path d="M2 16H18V18H2V16Z" fill="currentColor"/>
                    </svg>
                    ${langData['download_hd'] || 'Tải Video HD'}
                </button>
            `;
        } else {
            // No download options - show error message
            downloadButtons = `
                <p style="color: var(--text-secondary); text-align: center; padding: 10px;">⚠️ Video này hiện không thể tải. Vui lòng thử video khác.</p>
            `;
        }
    } else if (isFacebook) {
        // Facebook: Show HD and SD options
        const hdUrl = data.videoHD || data.videoNoWatermark || data.videoUrl;
        const sdUrl = data.videoSD || data.videoUrl;

        downloadButtons = `
            ${hdUrl ? `
            <button onclick="downloadVideoDirect('${encodeURIComponent(hdUrl)}', 'video', 'facebook')" class="download-video-btn" style="background: linear-gradient(135deg, #1877F2 0%, #42A5F5 100%);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 13L5 8H8V2H12V8H15L10 13Z" fill="currentColor"/>
                    <path d="M2 16H18V18H2V16Z" fill="currentColor"/>
                </svg>
                ${langData['download_hd']}
            </button>
            ` : ''}
            ${sdUrl ? `
            <button onclick="downloadVideoDirect('${encodeURIComponent(sdUrl)}', 'video', 'facebook')" class="download-video-btn" style="background: linear-gradient(135deg, #4267B2 0%, #898F9C 100%);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 13L5 8H8V2H12V8H15L10 13Z" fill="currentColor"/>
                    <path d="M2 16H18V18H2V16Z" fill="currentColor"/>
                </svg>
                ${langData['download_sd']}
            </button>
            ` : ''}
        `;
    } else {
        // TikTok: Original buttons
        downloadButtons = `
            <button onclick="downloadVideoDirect('${encodeURIComponent(data.videoNoWatermark || data.videoUrl)}', 'video', 'tiktok')" class="download-video-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 13L5 8H8V2H12V8H15L10 13Z" fill="currentColor"/>
                    <path d="M2 16H18V18H2V16Z" fill="currentColor"/>
                </svg>
                ${langData['download_no_logo']}
            </button>
            <button onclick="downloadVideoDirect('${encodeURIComponent(data.videoNoWatermark || data.videoUrl)}', 'audio', 'tiktok')" class="download-video-btn" style="background: var(--gradient-secondary);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M8 5L13 10L8 15V5Z" fill="currentColor"/>
                </svg>
                ${langData['download_audio']}
            </button>
            <button onclick="flipVideo('${data.videoNoWatermark || data.videoUrl}')" class="download-video-btn" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 2H16V18H4V2Z" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M10 2V18" stroke="currentColor" stroke-width="2"/>
                    <path d="M6 6L8 10L6 14" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M14 6L12 10L14 14" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
                ${langData['flip_reup']}
            </button>
        `;
    }

    // Handle author display for different platforms
    let authorDisplay = '';
    if (isYouTube) {
        // YouTube returns author as string
        const authorName = typeof data.author === 'string' ? data.author : (data.author?.name || 'Unknown');
        authorDisplay = `<p class="video-author">👤 ${escapeHtml(authorName)} ${data.duration ? `• ⏱️ ${data.duration}` : ''} ${data.views ? `• 👁️ ${data.views} views` : ''}</p>`;
    } else if (data.author && data.author.username) {
        // TikTok/Facebook format
        authorDisplay = `<p class="video-author">@${escapeHtml(data.author.username)} • ${escapeHtml(data.author.nickname || '')}</p>`;
    }

    // Stats display (TikTok/Facebook only)
    let statsDisplay = '';
    if (!isYouTube && data.stats && (data.stats.likes || data.stats.plays)) {
        statsDisplay = `
            <div class="video-stats">
                <span>❤️ ${formatNumber(data.stats.likes)}</span>
                <span>💬 ${formatNumber(data.stats.comments)}</span>
                <span>🔄 ${formatNumber(data.stats.shares)}</span>
                <span>▶️ ${formatNumber(data.stats.plays)}</span>
            </div>
        `;
    }

    const preview = document.createElement('div');
    preview.className = 'video-preview fade-in';
    preview.innerHTML = `
        <div class="video-info">
            ${data.thumbnail ? `<img src="${data.thumbnail}" alt="Video thumbnail" class="video-thumbnail">` : ''}
            <div class="video-details">
                <span class="platform-badge">${platformIcon} ${platformLabel}</span>
                <h3 class="video-title">${escapeHtml(data.title || 'Untitled Video')}</h3>
                ${authorDisplay}
                ${statsDisplay}
            </div>
        </div>
        <div class="download-actions">
            ${downloadButtons}
        </div>
    `;

    const downloadCard = document.querySelector('.download-card');
    downloadCard.appendChild(preview);
}


/**
 * Download video
 */
function downloadVideo(url, type = 'video') {
    if (!url) {
        const errMsg = currentLang === 'vi' ? 'Không tìm thấy link tải. Vui lòng thử lại.' : 'Download link not found. Please try again.';
        showMessage(errMsg, 'error');
        return;
    }

    // Create temporary link
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok-${type}-${Date.now()}.mp4`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const successMsg = currentLang === 'vi' ? '🎉 Đang tải xuống...' : '🎉 Downloading...';
    showMessage(successMsg, 'success');

    // Show success modal after a short delay
    setTimeout(() => {
        showSuccessModal();
    }, 1500);
}

/**
 * Download video through backend proxy
 */
function downloadVideoProxy(type = 'video') {
    if (!currentVideoData) {
        const errMsg = currentLang === 'vi' ? 'Không tìm thấy thông tin video. Vui lòng thử lại.' : 'Video info not found. Please try again.';
        showMessage(errMsg, 'error');
        return;
    }

    const url = type === 'audio' ? currentVideoData.audioUrl : currentVideoData.videoNoWatermark || currentVideoData.videoUrl;

    if (!url) {
        const errMsg = currentLang === 'vi' ? 'Không tìm thấy link tải. Vui lòng thử lại.' : 'Download link not found. Please try again.';
        showMessage(errMsg, 'error');
        return;
    }

    // Use backend proxy
    const proxyUrl = `/api/download/proxy-download?url=${encodeURIComponent(url)}${type === 'audio' ? '&type=audio' : ''}`;

    // Create temporary link
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = `tiktok-${type}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const successMsg = currentLang === 'vi' ? '🎉 Đang tải xuống...' : '🎉 Downloading...';
    showMessage(successMsg, 'success');

    // Show success modal after a short delay
    setTimeout(() => {
        showSuccessModal();
    }, 1500);
}

/**
 * Download video through backend proxy - direct URL version
 * Updated to use server-side conversion for audio
 * @param {string} encodedUrl - URL encoded download link
 * @param {string} type - 'video' or 'audio'
 * @param {string} platform - 'youtube', 'tiktok', or 'facebook'
 */
async function downloadVideoDirect(encodedUrl, type = 'video', platform = 'tiktok') {
    if (!encodedUrl) {
        const errMsg = currentLang === 'vi' ? 'Không tìm thấy link tải. Vui lòng thử lại.' : 'Download link not found. Please try again.';
        showMessage(errMsg, 'error');
        return;
    }

    // Decode the URL
    const url = decodeURIComponent(encodedUrl);

    if (type === 'audio') {
        processAudio(url);
        return;
    }

    console.log('📥 Downloading:', platform, type, url);

    // Use backend proxy (relative URL) with source parameter
    const proxyUrl = `/api/download/proxy-download?url=${encodeURIComponent(url)}&source=${platform}`;

    // Show success modal after a short delay
    setTimeout(() => {
        showSuccessModal();
    }, 1500);

    // Determine filename based on platform
    const filePrefix = platform || 'video';
    const extension = type === 'audio' ? 'mp3' : 'mp4';
    const filename = `${filePrefix}-${type}-${Date.now()}.${extension}`;

    // Create temporary link and handle error
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const successMsg = currentLang === 'vi' ? '🎉 Đang tải xuống...' : '🎉 Downloading...';
    showMessage(successMsg, 'success');
}

async function processAudio(url) {
    const langData = window.translations[currentLang];
    const extractMsg = currentLang === 'vi' ? '🎵 Đang trích xuất nhạc từ video... Vui lòng chờ.' : '🎵 Extracting audio from video... Please wait.';
    showMessage(extractMsg, 'info');

    try {
        const response = await fetch('/api/convert-mp3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoUrl: url })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Lỗi trích xuất audio');
        }

        // Get the blob and download it
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `tiktok-audio-${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        const successMsg = currentLang === 'vi' ? '✅ Tải nhạc thành công!' : '✅ Audio downloaded successfully!';
        showMessage(successMsg, 'success');
        showSuccessModal();
    } catch (error) {
        console.error('Audio conversion error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
    clearMessages();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type} fade-in`;
    messageDiv.textContent = message;

    const downloadCard = document.querySelector('.download-card');
    downloadCard.appendChild(messageDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

/**
 * Clear messages
 */
function clearMessages() {
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
}

/**
 * Clear video preview
 */
function clearPreview() {
    const previews = document.querySelectorAll('.video-preview');
    previews.forEach(preview => preview.remove());
    currentVideoData = null;
}

/**
 * Set loading state
 */
function setLoadingState(loading) {
    const btnText = downloadBtn.querySelector('span');
    const btnIcon = downloadBtn.querySelector('svg');
    const langData = window.translations[currentLang];

    if (loading) {
        downloadBtn.disabled = true;
        btnIcon.style.display = 'none';
        btnText.textContent = langData['processing'];

        const loader = document.createElement('span');
        loader.className = 'loading';
        loader.id = 'loader';
        downloadBtn.insertBefore(loader, btnText);
    } else {
        downloadBtn.disabled = false;
        btnIcon.style.display = 'block';
        btnText.textContent = langData['download_btn'];

        const loader = document.getElementById('loader');
        if (loader) {
            loader.remove();
        }
    }
}

/**
 * Format large numbers
 */
function formatNumber(num) {
    if (!num) return '0';

    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Track affiliate clicks
 */
function trackAffiliateClick(source) {
    console.log(`Affiliate click from: ${source}`);
    // You can add analytics here (Google Analytics, Facebook Pixel, etc.)
    if (typeof gtag !== 'undefined') {
        gtag('event', 'affiliate_click', {
            'source': source
        });
    }
}

/**
 * Close sticky banner
 */
function closeStickyBanner() {
    const banner = document.getElementById('stickyBanner');
    if (banner) {
        banner.style.display = 'none';
        localStorage.setItem('stickyBannerClosed', 'true');
    }
}

/**
 * Show affiliate interstitial during loading
 */
function showAffiliateInterstitial() {
    const langData = window.translations[currentLang];
    const interstitial = document.createElement('div');
    interstitial.className = 'affiliate-interstitial';

    const waitMsg = currentLang === 'vi' ? '⏰ Trong lúc chờ đợi...' : '⏰ While you wait...';
    const exploreMsg = currentLang === 'vi' ? 'Khám phá ngay deals hot từ Shopee - Giảm đến 50%!' : 'Explore hot deals from Shopee - Up to 50% OFF!';
    const viewNowMsg = currentLang === 'vi' ? 'Xem Ngay 🎁' : 'View Now 🎁';

    interstitial.innerHTML = `
        <div class="affiliate-interstitial-content">
            <div class="affiliate-interstitial-loader">
                <div class="loading-spinner"></div>
                <p>${langData['processing']}</p>
            </div>
            <div class="affiliate-interstitial-ad">
                <h3>${waitMsg}</h3>
                <p>${exploreMsg}</p>
                <a href="${window.AFFILIATE_LINK || 'https://tinyurl.com/SSISY'}" target="_blank" rel="noopener" class="affiliate-interstitial-btn" onclick="trackAffiliateClick('interstitial')">
                    ${viewNowMsg}
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(interstitial);

    // Auto remove after 8 seconds
    setTimeout(() => {
        if (interstitial.parentNode) {
            interstitial.remove();
        }
    }, 8000);

    return interstitial;
}

/**
 * Show success modal after download
 */
function showSuccessModal() {
    const langData = window.translations[currentLang];
    const modal = document.createElement('div');

    const title = currentLang === 'vi' ? 'Tải xuống thành công!' : 'Download successful!';
    const desc = currentLang === 'vi' ? 'Video đã được lưu vào thiết bị của bạn' : 'Video has been saved to your device';
    const offerTitle = currentLang === 'vi' ? '🎉 <strong>Ưu đãi đặc biệt dành cho bạn!</strong>' : '🎉 <strong>Special offer for you!</strong>';
    const offerBtn = currentLang === 'vi' ? 'Nhận voucher Shopee miễn phí' : 'Get free Shopee voucher';

    modal.className = 'success-modal';
    modal.innerHTML = `
        <div class="success-modal-content">
            <button class="success-modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
            <div class="success-modal-icon">✅</div>
            <h3>${title}</h3>
            <p>${desc}</p>
            <div class="success-modal-offer">
                <p class="offer-text">${offerTitle}</p>
                <a href="${window.AFFILIATE_LINK || 'https://tinyurl.com/SSISY'}" target="_blank" rel="noopener" class="success-modal-btn" onclick="trackAffiliateClick('success_modal')">
                    ${offerBtn}
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto remove after 10 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
        }
    }, 10000);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Centralized Affiliate Link Configuration
    const AFFILIATE_LINK = 'https://tinyurl.com/SSISY';
    window.AFFILIATE_LINK = AFFILIATE_LINK; // Make global

    // Update all affiliate links automatically
    const affiliateSelectors = [
        'a[href*="tinyurl.com"]',
        '.affiliate-btn',
        '.sticky-banner-btn',
        '.floating-circle',
        '.success-modal-btn',
        '.affiliate-interstitial-btn'
    ];

    document.querySelectorAll(affiliateSelectors.join(',')).forEach(link => {
        link.href = AFFILIATE_LINK;
    });

    console.log('🔗 Affiliate links updated to:', AFFILIATE_LINK);

    // 2. Auto-paste from clipboard
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (detectPlatform(text)) {
                videoUrlInput.value = text;
                videoUrlInput.focus();
            }
        }
    } catch (err) {
        console.log('Clipboard access denied');
    }

    // Show sticky banner if not closed before
    const stickyBannerClosed = localStorage.getItem('stickyBannerClosed');
    if (!stickyBannerClosed) {
        setTimeout(() => {
            const stickyBanner = document.getElementById('stickyBanner');
            if (stickyBanner) {
                stickyBanner.classList.add('show');
            }
        }, 3000); // Show after 3 seconds
    }
});
