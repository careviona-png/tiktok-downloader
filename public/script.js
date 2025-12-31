// Configuration
const API_URL = '/api/download';

// DOM Elements
const downloadForm = document.getElementById('downloadForm');
const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = downloadForm.querySelector('.download-btn');

// State
let currentVideoData = null;

// Event Listeners
downloadForm.addEventListener('submit', handleDownload);

/**
 * Handle download form submission
 */
async function handleDownload(e) {
    e.preventDefault();

    const url = videoUrlInput.value.trim();

    if (!url) {
        showMessage('Vui lòng nhập link TikTok', 'error');
        return;
    }

    // Validate TikTok URL
    if (!isValidTikTokUrl(url)) {
        showMessage('Link TikTok không hợp lệ. Vui lòng kiểm tra lại.', 'error');
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
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Không thể tải video');
        }

        // Store video data
        currentVideoData = data.data;

        // Show video preview
        showVideoPreview(data.data);

        // Show success message
        if (data.cached) {
            showMessage('✨ Đã tìm thấy video (từ cache)', 'success');
        } else {
            showMessage('✅ Tìm thấy video! Click nút bên dưới để tải xuống.', 'success');
        }

        // Remove interstitial
        if (interstitial && interstitial.parentNode) {
            interstitial.remove();
        }

    } catch (error) {
        console.error('Download error:', error);
        showMessage(error.message || 'Có lỗi xảy ra. Vui lòng thử lại.', 'error');

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

    const preview = document.createElement('div');
    preview.className = 'video-preview fade-in';
    preview.innerHTML = `
        <div class="video-info">
            ${data.thumbnail ? `<img src="${data.thumbnail}" alt="Video thumbnail" class="video-thumbnail">` : ''}
            <div class="video-details">
                <h3 class="video-title">${escapeHtml(data.title)}</h3>
                <p class="video-author">@${escapeHtml(data.author.username)} • ${escapeHtml(data.author.nickname)}</p>
                ${data.stats ? `
                    <div class="video-stats">
                        <span>❤️ ${formatNumber(data.stats.likes)}</span>
                        <span>💬 ${formatNumber(data.stats.comments)}</span>
                        <span>🔄 ${formatNumber(data.stats.shares)}</span>
                        <span>▶️ ${formatNumber(data.stats.plays)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        <div class="download-actions">
            <button onclick="downloadVideoDirect('${encodeURIComponent(data.videoNoWatermark || data.videoUrl)}', 'video')" class="download-video-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 13L5 8H8V2H12V8H15L10 13Z" fill="currentColor"/>
                    <path d="M2 16H18V18H2V16Z" fill="currentColor"/>
                </svg>
                Tải Video (Không Logo)
            </button>
            <button onclick="downloadVideoDirect('${encodeURIComponent(data.videoNoWatermark || data.videoUrl)}', 'audio')" class="download-video-btn" style="background: var(--gradient-secondary);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M8 5L13 10L8 15V5Z" fill="currentColor"/>
                </svg>
                Tải Audio
            </button>
            <button onclick="flipVideo('${data.videoNoWatermark || data.videoUrl}')" class="download-video-btn" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 2H16V18H4V2Z" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M10 2V18" stroke="currentColor" stroke-width="2"/>
                    <path d="M6 6L8 10L6 14" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M14 6L12 10L14 14" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
                🔄 Đảo Ngang (Reup)
            </button>
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
        showMessage('Không tìm thấy link tải. Vui lòng thử lại.', 'error');
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

    showMessage('🎉 Đang tải xuống...', 'success');

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
        showMessage('Không tìm thấy thông tin video. Vui lòng thử lại.', 'error');
        return;
    }

    const url = type === 'audio' ? currentVideoData.audioUrl : currentVideoData.videoNoWatermark || currentVideoData.videoUrl;

    if (!url) {
        showMessage('Không tìm thấy link tải. Vui lòng thử lại.', 'error');
        return;
    }

    // Use backend proxy
    const proxyUrl = `http://localhost:3000/api/proxy-download?url=${encodeURIComponent(url)}${type === 'audio' ? '&type=audio' : ''}`;

    // Create temporary link
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = `tiktok-${type}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showMessage('🎉 Đang tải xuống...', 'success');

    // Show success modal after a short delay
    setTimeout(() => {
        showSuccessModal();
    }, 1500);
}

/**
 * Download video through backend proxy - direct URL version
 * Updated to use server-side conversion for audio
 */
async function downloadVideoDirect(encodedUrl, type = 'video') {
    if (!encodedUrl) {
        showMessage('Không tìm thấy link tải. Vui lòng thử lại.', 'error');
        return;
    }

    // Decode the URL
    const url = decodeURIComponent(encodedUrl);

    if (type === 'audio') {
        console.log('🎵 Extracting audio on server...');
        showMessage('🎵 Đang trích xuất nhạc từ video... Vui lòng chờ.', 'info');

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

            showMessage('✅ Tải nhạc thành công!', 'success');
            showSuccessModal();
            return;
        } catch (error) {
            console.error('Audio conversion error:', error);
            showMessage('❌ Lỗi trích xuất nhạc: ' + error.message, 'error');
            return;
        }
    }

    console.log('📥 Downloading:', type, url);

    // Use backend proxy (relative URL)
    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;

    // Show success modal after a short delay
    setTimeout(() => {
        showSuccessModal();
    }, 1500);

    // Create temporary link and handle error
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = `tiktok-${type}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showMessage('🎉 Đang tải xuống...', 'success');
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

    if (loading) {
        downloadBtn.disabled = true;
        btnIcon.style.display = 'none';
        btnText.textContent = 'Đang xử lý...';

        const loader = document.createElement('span');
        loader.className = 'loading';
        loader.id = 'loader';
        downloadBtn.insertBefore(loader, btnText);
    } else {
        downloadBtn.disabled = false;
        btnIcon.style.display = 'block';
        btnText.textContent = 'Tải xuống';

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
    const interstitial = document.createElement('div');
    interstitial.className = 'affiliate-interstitial';
    interstitial.innerHTML = `
        <div class="affiliate-interstitial-content">
            <div class="affiliate-interstitial-loader">
                <div class="loading-spinner"></div>
                <p>Đang xử lý video của bạn...</p>
            </div>
            <div class="affiliate-interstitial-ad">
                <h3>⏰ Trong lúc chờ đợi...</h3>
                <p>Khám phá ngay deals hot từ Shopee - Giảm đến 50%!</p>
                <a href="https://tinyurl.com/SSISY" target="_blank" rel="noopener" class="affiliate-interstitial-btn" onclick="trackAffiliateClick('interstitial')">
                    Xem Ngay 🎁
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(interstitial);

    // Auto remove after 3 seconds or when download completes
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
    const modal = document.createElement('div');
    modal.className = 'success-modal';
    modal.innerHTML = `
        <div class="success-modal-content">
            <button class="success-modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
            <div class="success-modal-icon">✅</div>
            <h3>Tải xuống thành công!</h3>
            <p>Video đã được lưu vào thiết bị của bạn</p>
            <div class="success-modal-offer">
                <p class="offer-text">🎉 <strong>Ưu đãi đặc biệt dành cho bạn!</strong></p>
                <a href="https://tinyurl.com/SSISY" target="_blank" rel="noopener" class="success-modal-btn" onclick="trackAffiliateClick('success_modal')">
                    Nhận voucher Shopee miễn phí
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
            if (isValidTikTokUrl(text)) {
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
