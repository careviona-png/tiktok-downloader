const axios = require('axios');

/**
 * Get Facebook video info using FSave.net proxy API
 * FSave uses a 2-step process:
 * 1. Get mediaItems with mediaUrl references
 * 2. Process each mediaUrl to get actual fileUrl
 */
async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video info for:', url);

    // First, resolve any share/short links
    let resolvedUrl = url;
    try {
        resolvedUrl = await resolveShortUrl(url);
        console.log('📎 Resolved URL:', resolvedUrl);
    } catch (e) {
        console.log('[Facebook] Could not resolve URL, using original');
    }

    let videoData = null;

    // Method 1: FSave.net proxy API (most reliable)
    try {
        videoData = await getFSaveVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via FSave.net');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] FSave failed:', e.message);
    }

    // Method 2: Try with original URL if resolved failed
    if (resolvedUrl !== url) {
        try {
            videoData = await getFSaveVideo(url);
            if (videoData && (videoData.hd || videoData.sd)) {
                console.log('✅ Got Facebook video via FSave.net (original URL)');
                return formatFacebookResponse(videoData);
            }
        } catch (e) {
            console.log('[Facebook] FSave (original) failed:', e.message);
        }
    }

    throw new Error('Không thể tải video Facebook. Video có thể là private hoặc link không hợp lệ.');
}

/**
 * Resolve short URLs
 */
async function resolveShortUrl(url) {
    if (url.includes('/share/') || url.includes('fb.watch') || url.includes('fbwat.ch')) {
        try {
            const response = await axios.get(url, {
                maxRedirects: 10,
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                validateStatus: (status) => status < 400
            });

            if (response.request && response.request.res && response.request.res.responseUrl) {
                return response.request.res.responseUrl;
            }
        } catch (e) {
            console.log('[Facebook] Redirect resolution failed:', e.message);
        }
    }
    return url;
}

/**
 * FSave.net proxy API - 2-step process
 * Step 1: Get mediaItems
 * Step 2: Process each to get actual fileUrl
 */
async function getFSaveVideo(url) {
    try {
        console.log('[Facebook] Step 1: Calling FSave.net API...');

        // Step 1: Get media items
        const response = await axios.post('https://fsave.net/proxy.php',
            `url=${encodeURIComponent(url)}`,
            {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://fsave.net/vi',
                    'Origin': 'https://fsave.net',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            }
        );

        if (response.data && response.data.api) {
            const api = response.data.api;

            if (api.status === 'OK' && api.mediaItems && api.mediaItems.length > 0) {
                console.log('[Facebook] Found', api.mediaItems.length, 'media items');

                // Sort by quality - prefer HD
                const sortedItems = api.mediaItems.sort((a, b) => {
                    const qualityOrder = { 'FHD': 4, '1080p': 4, 'HD': 3, '720p': 3, 'SD': 2, '480p': 2, '360p': 1 };
                    const aOrder = qualityOrder[a.mediaRes] || qualityOrder[a.mediaQuality] || 0;
                    const bOrder = qualityOrder[b.mediaRes] || qualityOrder[b.mediaQuality] || 0;
                    return bOrder - aOrder;
                });

                // Get best HD and SD items
                const hdItem = sortedItems.find(item =>
                    item.mediaQuality === 'HD' ||
                    ['1080p', '720p', 'FHD'].includes(item.mediaRes)
                );
                const sdItem = sortedItems.find(item =>
                    item.mediaQuality === 'SD' ||
                    ['480p', '360p', '240p'].includes(item.mediaRes)
                ) || sortedItems[sortedItems.length - 1];

                // Step 2: Get actual download URLs for HD and SD
                let hdUrl = null;
                let sdUrl = null;

                if (hdItem) {
                    console.log('[Facebook] Step 2: Getting HD download URL...');
                    hdUrl = await getActualDownloadUrl(hdItem.mediaUrl);
                }

                if (sdItem && sdItem !== hdItem) {
                    console.log('[Facebook] Step 2: Getting SD download URL...');
                    sdUrl = await getActualDownloadUrl(sdItem.mediaUrl);
                }

                // Fallback: use HD as SD if SD not available
                if (!sdUrl) sdUrl = hdUrl;
                if (!hdUrl) hdUrl = sdUrl;

                if (hdUrl || sdUrl) {
                    return {
                        title: api.title || 'Facebook Video',
                        thumbnail: api.avatar || '',
                        hd: hdUrl,
                        sd: sdUrl
                    };
                }
            } else if (api.status === 'ERROR') {
                console.log('[Facebook] FSave error:', api.message);
            }
        }
    } catch (e) {
        console.log('[Facebook] FSave API error:', e.message);
        throw new Error(e.message);
    }
    return null;
}

/**
 * Step 2: Get actual download URL from FSave
 * Poll until processing is complete
 */
async function getActualDownloadUrl(mediaUrl) {
    if (!mediaUrl) return null;

    // If it's already a direct download URL, return it
    if (mediaUrl.includes('.mp4') && !mediaUrl.includes('videoProcess')) {
        return mediaUrl;
    }

    try {
        // Call FSave to process and get actual download URL
        let attempts = 0;
        const maxAttempts = 15; // 30 seconds max

        while (attempts < maxAttempts) {
            const response = await axios.post('https://fsave.net/proxy.php',
                `url=${encodeURIComponent(mediaUrl)}`,
                {
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://fsave.net/vi',
                        'Origin': 'https://fsave.net'
                    }
                }
            );

            if (response.data && response.data.api) {
                const api = response.data.api;

                // Check if processing is complete
                if (api.percent === 'Completed' && api.fileUrl) {
                    console.log('[Facebook] Got fileUrl:', api.fileUrl.substring(0, 80) + '...');
                    return api.fileUrl;
                }

                // If still processing, wait and retry
                if (api.percent && api.percent !== 'Completed') {
                    console.log('[Facebook] Processing:', api.percent);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempts++;
                    continue;
                }

                // If got a direct URL in response
                if (api.fileUrl) {
                    return api.fileUrl;
                }
            }

            break;
        }

        // If polling failed, try to use the mediaUrl directly
        // It might work if it's from mcontent.app
        if (mediaUrl.includes('mcontent.app')) {
            return mediaUrl;
        }

    } catch (e) {
        console.log('[Facebook] getActualDownloadUrl failed:', e.message);
    }

    return null;
}

/**
 * Format response
 */
function formatFacebookResponse(data) {
    return {
        id: Date.now().toString(),
        title: data.title || 'Facebook Video',
        platform: 'facebook',
        author: {
            username: 'facebook_user',
            nickname: 'Facebook User',
            avatar: ''
        },
        thumbnail: data.thumbnail || '',
        duration: 0,
        videoUrl: data.sd || data.hd,
        videoNoWatermark: data.hd || data.sd,
        videoHD: data.hd || '',
        videoSD: data.sd || '',
        audioUrl: '',
        stats: { plays: 0, likes: 0, comments: 0, shares: 0 }
    };
}

module.exports = {
    getFacebookVideo
};
