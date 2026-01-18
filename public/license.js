/**
 * TikDown License Key System
 * Handles trial period, key validation, and feature unlocking
 */

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        TRIAL_DAYS: 7,
        STORAGE_KEYS: {
            USER_ID: 'tikdown_user_id',
            TRIAL_START: 'tikdown_trial_start',
            LICENSE_KEY: 'tikdown_license_key',
            TIKTOK_USERNAME: 'tikdown_tiktok_username',
            UNLOCKED: 'tikdown_unlocked',
            KEY_EXPIRES: 'tikdown_key_expires'
        },
        API_ENDPOINT: '/api/scheduler/validate-key'
    };

    // License Manager Class
    class LicenseManager {
        constructor() {
            this.modal = null;
            this.init();
        }

        // Initialize user fingerprint and trial
        init() {
            this.ensureUserId();
            this.ensureTrialStart();
        }

        // Generate anonymous user ID
        ensureUserId() {
            let userId = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
            if (!userId) {
                userId = this.generateUUID();
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, userId);
            }
            return userId;
        }

        // Start trial on first visit
        ensureTrialStart() {
            let trialStart = localStorage.getItem(CONFIG.STORAGE_KEYS.TRIAL_START);
            if (!trialStart) {
                trialStart = new Date().toISOString();
                localStorage.setItem(CONFIG.STORAGE_KEYS.TRIAL_START, trialStart);
            }
            return trialStart;
        }

        // Generate UUID v4
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        // Get trial days remaining
        getTrialDaysRemaining() {
            const trialStart = localStorage.getItem(CONFIG.STORAGE_KEYS.TRIAL_START);
            if (!trialStart) return CONFIG.TRIAL_DAYS;

            const startDate = new Date(trialStart);
            const now = new Date();
            const diffTime = now - startDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            return Math.max(0, CONFIG.TRIAL_DAYS - diffDays);
        }

        // Check if trial is expired
        isTrialExpired() {
            return this.getTrialDaysRemaining() <= 0;
        }

        // Check if user is unlocked (valid key or active trial)
        isUnlocked() {
            // Check for valid license key
            const unlocked = localStorage.getItem(CONFIG.STORAGE_KEYS.UNLOCKED);
            if (unlocked === 'true') {
                // Check if key has expired
                const keyExpires = localStorage.getItem(CONFIG.STORAGE_KEYS.KEY_EXPIRES);
                if (keyExpires) {
                    const expiryDate = new Date(keyExpires);
                    if (new Date() > expiryDate) {
                        // Key expired, clear unlock status
                        localStorage.removeItem(CONFIG.STORAGE_KEYS.UNLOCKED);
                        localStorage.removeItem(CONFIG.STORAGE_KEYS.LICENSE_KEY);
                        return false;
                    }
                }
                return true;
            }

            // Check if trial is still active
            return !this.isTrialExpired();
        }

        // Get stored TikTok username
        getTikTokUsername() {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.TIKTOK_USERNAME) || '';
        }

        // Get stored license key
        getLicenseKey() {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.LICENSE_KEY) || '';
        }

        // Get user ID
        getUserId() {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
        }

        // Validate license key with server
        async validateKey(licenseKey, tiktokUsername) {
            try {
                const response = await fetch(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        key: licenseKey.trim().toUpperCase(),
                        userId: this.getUserId(),
                        tiktokUsername: tiktokUsername.trim()
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Store the valid key info
                    localStorage.setItem(CONFIG.STORAGE_KEYS.LICENSE_KEY, licenseKey.trim().toUpperCase());
                    localStorage.setItem(CONFIG.STORAGE_KEYS.TIKTOK_USERNAME, tiktokUsername.trim());
                    localStorage.setItem(CONFIG.STORAGE_KEYS.UNLOCKED, 'true');

                    if (data.expiresAt) {
                        localStorage.setItem(CONFIG.STORAGE_KEYS.KEY_EXPIRES, data.expiresAt);
                    }

                    return { success: true, message: data.message || 'Key activated successfully!' };
                } else {
                    return { success: false, message: data.error || 'Invalid license key' };
                }
            } catch (error) {
                console.error('License validation error:', error);
                return { success: false, message: 'Network error. Please try again.' };
            }
        }

        // Create and inject modal HTML
        createModal() {
            if (this.modal) return;

            const daysRemaining = this.getTrialDaysRemaining();
            const isExpired = this.isTrialExpired();
            const storedUsername = this.getTikTokUsername();

            const modalHTML = `
                <div class="license-modal-overlay" id="licenseModalOverlay">
                    <div class="license-modal">
                        <div class="license-modal-header">
                            <div class="license-modal-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                            <h2 class="license-modal-title">Nhập Mã Kích Hoạt</h2>
                            <p class="license-modal-subtitle">
                                ${isExpired
                    ? 'Thời gian dùng thử đã hết. Vui lòng nhập mã bản quyền để tiếp tục sử dụng các tính năng cao cấp.'
                    : 'Mở khóa tính năng cao cấp bằng mã bản quyền hoặc tiếp tục dùng thử miễn phí.'
                }
                            </p>
                        </div>

                        ${!isExpired ? `
                            <div class="license-trial-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                </svg>
                                Còn ${daysRemaining} ngày dùng thử
                            </div>
                        ` : `
                            <div class="license-trial-badge expired">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                Hết hạn dùng thử
                            </div>
                        `}

                        <form class="license-form" id="licenseForm">
                            <div class="license-form-group">
                                <label class="license-form-label">Mã Bản Quyền (License Key)</label>
                                <div class="license-key-input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                                    </svg>
                                    <input 
                                        type="text" 
                                        class="license-form-input" 
                                        id="licenseKeyInput"
                                        placeholder="XXXX-XXXX-XXXX-XXXX"
                                        autocomplete="off"
                                        spellcheck="false"
                                    >
                                </div>
                            </div>
                            
                            <div class="license-form-group">
                                <label class="license-form-label">Tên người dùng TikTok</label>
                                <div class="license-username-input-wrapper">
                                    <input 
                                        type="text" 
                                        class="license-form-input" 
                                        id="tiktokUsernameInput"
                                        placeholder="username"
                                        value="${storedUsername.replace('@', '')}"
                                        autocomplete="off"
                                        spellcheck="false"
                                    >
                                </div>
                            </div>

                            <div id="licenseMessage"></div>

                            <button type="submit" class="license-submit-btn" id="licenseSubmitBtn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                                <span>Mở Khóa Tính Năng</span>
                            </button>

                            ${!isExpired ? `
                                <button type="button" class="license-skip-btn" id="licenseSkipBtn">
                                    Tiếp tục dùng thử (${daysRemaining} ngày còn lại)
                                </button>
                            ` : ''}
                        </form>

                        <div class="license-modal-footer">
                            <p>Chưa có mã kích hoạt? <a href="mailto:contact@tikdown.top">Liên hệ ngay</a></p>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.modal = document.getElementById('licenseModalOverlay');
            this.bindEvents();
        }

        // Bind modal events
        bindEvents() {
            const form = document.getElementById('licenseForm');
            const skipBtn = document.getElementById('licenseSkipBtn');

            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.handleSubmit();
                });
            }

            if (skipBtn) {
                skipBtn.addEventListener('click', () => {
                    this.hideModal();
                });
            }

            // Format license key input
            const keyInput = document.getElementById('licenseKeyInput');
            if (keyInput) {
                keyInput.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    let formatted = value.match(/.{1,4}/g)?.join('-') || '';
                    e.target.value = formatted.substring(0, 19); // XXXX-XXXX-XXXX-XXXX
                });
            }
        }

        // Handle form submission
        async handleSubmit() {
            const keyInput = document.getElementById('licenseKeyInput');
            const usernameInput = document.getElementById('tiktokUsernameInput');
            const submitBtn = document.getElementById('licenseSubmitBtn');
            const messageDiv = document.getElementById('licenseMessage');

            const licenseKey = keyInput.value.trim();
            const tiktokUsername = usernameInput.value.trim();

            // Validation
            if (!licenseKey) {
                this.showMessage(messageDiv, 'error', 'Vui lòng nhập mã bản quyền (License Key)');
                return;
            }

            if (!tiktokUsername) {
                this.showMessage(messageDiv, 'error', 'Vui lòng nhập tên người dùng TikTok');
                return;
            }

            // Show loading
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="license-spinner"></span><span>Đang kiểm tra...</span>';

            // Validate with server
            const result = await this.validateKey(licenseKey, tiktokUsername);

            if (result.success) {
                this.showMessage(messageDiv, 'success', result.message || 'Kích hoạt thành công!');
                submitBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>Đã Mở Khóa!</span>
                `;

                // Hide modal after delay
                setTimeout(() => {
                    this.hideModal();
                    // Refresh page to apply unlocked features
                    window.location.reload();
                }, 1500);
            } else {
                this.showMessage(messageDiv, 'error', 'Mã không hợp lệ hoặc đã hết hạn');
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>Mở Khóa Tính Năng</span>
                `;
            }
        }

        // Show message in modal
        showMessage(container, type, text) {
            const icons = {
                error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
                success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
            };

            container.innerHTML = `
                <div class="license-message license-message-${type}">
                    ${icons[type]}
                    <span>${text}</span>
                </div>
            `;
        }

        // Show modal
        showModal() {
            if (!this.modal) {
                this.createModal();
            }
            requestAnimationFrame(() => {
                this.modal.classList.add('active');
            });
            document.body.style.overflow = 'hidden';
        }

        // Hide modal
        hideModal() {
            if (this.modal) {
                this.modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        // Check and show modal if needed (for scheduler pages)
        checkAccess(forceShow = false) {
            if (forceShow || (this.isTrialExpired() && !this.isUnlocked())) {
                this.showModal();
                return false;
            }
            return true;
        }
    }

    // Create global instance
    window.TikDownLicense = new LicenseManager();

    // Expose utility functions
    window.showLicenseModal = function () {
        window.TikDownLicense.showModal();
    };

    window.hideLicenseModal = function () {
        window.TikDownLicense.hideModal();
    };

    window.isFeatureUnlocked = function () {
        return window.TikDownLicense.isUnlocked();
    };

    window.getTrialDaysRemaining = function () {
        return window.TikDownLicense.getTrialDaysRemaining();
    };

})();
