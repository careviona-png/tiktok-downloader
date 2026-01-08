const axios = require('axios');

/**
 * Get Facebook video info using SnapSave API (most reliable for Reels)
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

    // Method 1: SnapSave API (best for Reels)
    try {
        videoData = await getSnapSaveVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via SnapSave');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] SnapSave failed:', e.message);
    }

    // Method 2: FDownloader API
    try {
        videoData = await getFDownloaderVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via FDownloader');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] FDownloader failed:', e.message);
    }

    // Method 3: SSFacebook
    try {
        videoData = await getSSFacebookVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via SSFacebook');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] SSFacebook failed:', e.message);
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
 * SnapSave API - Best for Facebook Reels
 */
async function getSnapSaveVideo(url) {
    try {
        // Step 1: Get the page and token
        const pageRes = await axios.get('https://snapsave.app/', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Extract token if present
        let token = '';
        const tokenMatch = pageRes.data.match(/name="token"\s+value="([^"]+)"/);
        if (tokenMatch) token = tokenMatch[1];

        // Step 2: Submit URL
        const formData = new URLSearchParams();
        formData.append('url', url);
        if (token) formData.append('token', token);

        const response = await axios.post('https://snapsave.app/action.php', formData, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://snapsave.app/',
                'Origin': 'https://snapsave.app'
            }
        });

        const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        // Extract download links - SnapSave uses specific patterns
        const hdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*(?:Download|HD|1080p|720p)/i) ||
            html.match(/"(https:\/\/cdn\.snapsave\.app[^"]+)"/i) ||
            html.match(/"(https:\/\/[^"]*fbcdn[^"]+\.mp4[^"]*)"/i);

        const sdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*(?:SD|480p|360p)/i) ||
            html.match(/"(https:\/\/[^"]+\.mp4[^"]*)"/i);

        // Also try to extract from encoded data
        const dataMatch = html.match(/decodeURIComponent\("([^"]+)"\)/);
        if (dataMatch) {
            try {
                const decoded = decodeURIComponent(dataMatch[1]);
                const decodedHd = decoded.match(/"(https:\/\/[^"]+\.mp4[^"]*)"/);
                if (decodedHd && !hdMatch) {
                    return {
                        title: 'Facebook Video',
                        thumbnail: '',
                        hd: decodedHd[1],
                        sd: decodedHd[1]
                    };
                }
            } catch (e) { }
        }

        if (hdMatch || sdMatch) {
            return {
                title: 'Facebook Video',
                thumbnail: '',
                hd: hdMatch ? hdMatch[1] : null,
                sd: sdMatch ? sdMatch[1] : (hdMatch ? hdMatch[1] : null)
            };
        }
    } catch (e) {
        throw new Error(e.message);
    }
    return null;
}

/**
 * FDownloader API
 */
async function getFDownloaderVideo(url) {
    try {
        const response = await axios.post('https://fdownloader.net/api/ajaxSearch',
            `q=${encodeURIComponent(url)}`,
            {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://fdownloader.net',
                    'Referer': 'https://fdownloader.net/'
                }
            }
        );

        if (response.data && response.data.data) {
            const html = response.data.data;

            // Extract download links
            const hdMatch = html.match(/<a[^>]*href="([^"]+)"[^>]*>.*?HD.*?<\/a>/i) ||
                html.match(/download[^"]*HD[^"]*href="([^"]+)"/i);
            const sdMatch = html.match(/<a[^>]*href="([^"]+)"[^>]*>.*?SD.*?<\/a>/i) ||
                html.match(/download[^"]*SD[^"]*href="([^"]+)"/i);

            if (hdMatch || sdMatch) {
                return {
                    title: response.data.title || 'Facebook Video',
                    thumbnail: response.data.thumbnail || '',
                    hd: hdMatch ? hdMatch[1] : null,
                    sd: sdMatch ? sdMatch[1] : null
                };
            }
        }
    } catch (e) {
        throw new Error(e.message);
    }
    return null;
}

/**
 * SSFacebook API
 */
async function getSSFacebookVideo(url) {
    try {
        // Convert to ssfacebook URL format
        const ssUrl = url.replace('www.facebook.com', 'www.ssfacebook.com')
            .replace('m.facebook.com', 'www.ssfacebook.com')
            .replace('facebook.com', 'ssfacebook.com');

        const response = await axios.get(ssUrl, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
                'Accept': 'text/html,application/xhtml+xml'
            },
            maxRedirects: 5
        });

        const html = response.data;

        // Extract video links
        const hdMatch = html.match(/href="([^"]+)"[^>]*>\s*(?:Download\s*HD|HD\s*Quality)/i) ||
            html.match(/_hd_src[^"]*"(https?:\/\/[^"]+)"/i);
        const sdMatch = html.match(/href="([^"]+)"[^>]*>\s*(?:Download\s*SD|SD\s*Quality)/i) ||
            html.match(/_src[^"]*"(https?:\/\/[^"]+\.mp4[^"]*)"/i);

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
        stats: { plays: 0, likes: 0, comments: 0, shares: 0 }
    };
}

module.exports = {
    getFacebookVideo
};
