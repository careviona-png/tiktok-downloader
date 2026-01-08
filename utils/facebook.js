const axios = require('axios');

/**
 * Get Facebook video info using FSave.net proxy API
 * This is the most reliable method for Facebook video downloads
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

    // Method 3: Alternative - fdown.net
    try {
        videoData = await getFDownVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via fdown.net');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] fdown.net failed:', e.message);
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
 * FSave.net proxy API - Most reliable for Facebook
 */
async function getFSaveVideo(url) {
    try {
        console.log('[Facebook] Calling FSave.net API...');

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
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8'
                }
            }
        );

        console.log('[Facebook] FSave response status:', response.status);

        if (response.data && response.data.api) {
            const api = response.data.api;

            if (api.status === 'OK' && api.mediaItems && api.mediaItems.length > 0) {
                console.log('[Facebook] FSave found', api.mediaItems.length, 'media items');

                // Sort by quality - prefer HD
                const sortedItems = api.mediaItems.sort((a, b) => {
                    const qualityOrder = { 'FHD': 4, '1080p': 4, 'HD': 3, '720p': 3, 'SD': 2, '480p': 2, '360p': 1 };
                    const aOrder = qualityOrder[a.mediaRes] || qualityOrder[a.mediaQuality] || 0;
                    const bOrder = qualityOrder[b.mediaRes] || qualityOrder[b.mediaQuality] || 0;
                    return bOrder - aOrder;
                });

                // Get best HD and SD
                const hdItem = sortedItems.find(item =>
                    item.mediaQuality === 'HD' ||
                    ['1080p', '720p', 'FHD'].includes(item.mediaRes)
                );
                const sdItem = sortedItems.find(item =>
                    item.mediaQuality === 'SD' ||
                    ['480p', '360p'].includes(item.mediaRes)
                ) || sortedItems[sortedItems.length - 1];

                // Get download URLs - might need second API call
                let hdUrl = hdItem ? await getDownloadUrl(hdItem.mediaUrl) : null;
                let sdUrl = sdItem ? await getDownloadUrl(sdItem.mediaUrl) : null;

                // If getDownloadUrl didn't return proper URL, use mediaUrl directly
                if (!hdUrl && hdItem) hdUrl = hdItem.mediaUrl;
                if (!sdUrl && sdItem) sdUrl = sdItem.mediaUrl;

                return {
                    title: api.title || 'Facebook Video',
                    thumbnail: api.avatar || '',
                    hd: hdUrl,
                    sd: sdUrl || hdUrl,
                    mediaItems: sortedItems // Keep all items for UI
                };
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
 * Get actual download URL from FSave (if needed for rendering)
 */
async function getDownloadUrl(mediaUrl) {
    // If it's already a direct URL, return it
    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
        return mediaUrl;
    }

    // If it's an internal reference, try to get the actual download link
    try {
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

        if (response.data && response.data.api && response.data.api.fileUrl) {
            return response.data.api.fileUrl;
        }
    } catch (e) {
        console.log('[Facebook] getDownloadUrl failed:', e.message);
    }

    return null;
}

/**
 * Alternative: fdown.net API
 */
async function getFDownVideo(url) {
    try {
        const response = await axios.post('https://fdown.net/download.php',
            `URLz=${encodeURIComponent(url)}`,
            {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://fdown.net/',
                    'Origin': 'https://fdown.net'
                }
            }
        );

        const html = response.data;

        // Extract download links
        const hdMatch = html.match(/id="hdlink"[^>]*href="([^"]+)"/i) ||
            html.match(/quality:\s*HD[^>]*href="([^"]+)"/i);
        const sdMatch = html.match(/id="sdlink"[^>]*href="([^"]+)"/i) ||
            html.match(/quality:\s*SD[^>]*href="([^"]+)"/i);

        if (hdMatch || sdMatch) {
            return {
                title: 'Facebook Video',
                thumbnail: '',
                hd: hdMatch ? hdMatch[1] : null,
                sd: sdMatch ? sdMatch[1] : null
            };
        }
    } catch (e) {
        throw new Error(e.message);
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
        mediaItems: data.mediaItems || [],
        stats: { plays: 0, likes: 0, comments: 0, shares: 0 }
    };
}

module.exports = {
    getFacebookVideo
};
