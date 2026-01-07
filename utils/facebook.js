const axios = require('axios');

// Try to load facebook-downloader with correct import
let facebookDownloader;
try {
    const fbModule = require('@mrnima/facebook-downloader');
    facebookDownloader = fbModule.facebook || fbModule.fbdl || fbModule.default;
    console.log('[Facebook] Loaded @mrnima/facebook-downloader');
} catch (e) {
    console.log('[Facebook] @mrnima/facebook-downloader not available:', e.message);
    facebookDownloader = null;
}

/**
 * Get Facebook video info
 * Supports regular videos, Reels, and share links
 */
async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video info for:', url);

    // First, resolve any share/short links to get the real URL
    let resolvedUrl = url;
    try {
        resolvedUrl = await resolveShortUrl(url);
        console.log('📎 Resolved URL:', resolvedUrl);
    } catch (e) {
        console.log('[Facebook] Could not resolve URL, using original:', e.message);
    }

    // Try primary method first
    if (facebookDownloader) {
        try {
            const result = await facebookDownloader(resolvedUrl);
            console.log('[Facebook] mrnima result type:', typeof result);

            if (result) {
                let data;
                if (result.result) data = result.result;
                else if (result.hd || result.sd) data = result;
                else if (result.data) data = result.data;
                else data = result;

                if (data.hd || data.sd || data.url) {
                    console.log('✅ Got Facebook video via mrnima');
                    return formatFacebookResponse({
                        title: data.title || 'Facebook Video',
                        thumbnail: data.thumbnail || '',
                        hd: data.hd || data.url_hd || '',
                        sd: data.sd || data.url || data.url_sd || ''
                    });
                }
            }
        } catch (e) {
            console.log('[Facebook] mrnima failed:', e.message);
        }
    }

    // Fallback: Try with direct scraping
    try {
        const data = await scrapeFacebookVideo(resolvedUrl);
        if (data && (data.hd || data.sd)) {
            console.log('✅ Got Facebook video via scraping');
            return formatFacebookResponse(data);
        }
    } catch (e) {
        console.log('[Facebook] Scraping failed:', e.message);
    }

    // Try alternative APIs
    try {
        const data = await getViaAlternativeAPI(resolvedUrl);
        if (data && (data.hd || data.sd)) {
            console.log('✅ Got Facebook video via alternative API');
            return formatFacebookResponse(data);
        }
    } catch (e) {
        console.log('[Facebook] Alternative API failed:', e.message);
    }

    throw new Error('Không thể tải video Facebook. Video có thể là private hoặc link không hợp lệ.');
}

/**
 * Resolve short URLs and share links to get the actual Facebook URL
 */
async function resolveShortUrl(url) {
    // If it's a share link, follow redirects to get the real URL
    if (url.includes('/share/') || url.includes('fb.watch') || url.includes('fbwat.ch')) {
        try {
            const response = await axios.head(url, {
                maxRedirects: 5,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                validateStatus: (status) => status < 400
            });

            // Get the final URL after redirects
            if (response.request && response.request.res && response.request.res.responseUrl) {
                return response.request.res.responseUrl;
            }
        } catch (e) {
            // Try GET request instead
            try {
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                // Extract real URL from response if available
                if (response.request && response.request.res && response.request.res.responseUrl) {
                    return response.request.res.responseUrl;
                }
            } catch (e2) {
                console.log('[Facebook] Redirect resolution failed:', e2.message);
            }
        }
    }

    return url;
}

/**
 * Scrape Facebook video directly
 */
async function scrapeFacebookVideo(url) {
    try {
        // Use mobile user agent for better compatibility
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000,
            maxRedirects: 5
        });

        const html = response.data;
        let hdUrl = null;
        let sdUrl = null;
        let title = 'Facebook Video';
        let thumbnail = '';

        // Try multiple patterns for video URLs
        const videoPatterns = [
            /browser_native_hd_url":"([^"]+)"/,
            /playable_url_quality_hd":"([^"]+)"/,
            /"hd_src":"([^"]+)"/,
            /hd_src_no_ratelimit":"([^"]+)"/,
            /"video_url":"([^"]+)"/,
            /contentUrl":"([^"]+\.mp4[^"]*)"/
        ];

        for (const pattern of videoPatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    const decoded = JSON.parse(`"${match[1]}"`);
                    if (!hdUrl) hdUrl = decoded;
                    break;
                } catch (e) { }
            }
        }

        const sdPatterns = [
            /browser_native_sd_url":"([^"]+)"/,
            /playable_url":"([^"]+)"/,
            /"sd_src":"([^"]+)"/,
            /sd_src_no_ratelimit":"([^"]+)"/
        ];

        for (const pattern of sdPatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    sdUrl = JSON.parse(`"${match[1]}"`);
                    break;
                } catch (e) { }
            }
        }

        // Get title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
            title = titleMatch[1].replace(/\s*[\|•-]\s*Facebook.*$/i, '').trim();
        }

        // Get thumbnail
        const thumbPatterns = [
            /og:image" content="([^"]+)"/,
            /twitter:image" content="([^"]+)"/,
            /"thumbnailUrl":"([^"]+)"/
        ];
        for (const pattern of thumbPatterns) {
            const match = html.match(pattern);
            if (match) {
                thumbnail = match[1];
                break;
            }
        }

        if (hdUrl || sdUrl) {
            return { title, thumbnail, hd: hdUrl, sd: sdUrl || hdUrl };
        }

    } catch (e) {
        throw new Error(e.message);
    }

    return null;
}

/**
 * Try alternative Facebook video APIs
 */
async function getViaAlternativeAPI(url) {
    const apis = [
        {
            name: 'rapidapi-fb',
            method: async () => {
                // Try a basic fetch approach
                const response = await axios.get(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000
                });

                const html = response.data;
                const videoMatch = html.match(/data-video-url="([^"]+)"/);
                if (videoMatch) {
                    return {
                        title: 'Facebook Video',
                        thumbnail: '',
                        hd: videoMatch[1],
                        sd: videoMatch[1]
                    };
                }
                return null;
            }
        }
    ];

    for (const api of apis) {
        try {
            const result = await api.method();
            if (result && (result.hd || result.sd)) {
                console.log(`[Facebook] ${api.name} succeeded`);
                return result;
            }
        } catch (e) {
            console.log(`[Facebook] ${api.name} failed:`, e.message);
        }
    }

    return null;
}

/**
 * Format Facebook response
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
        stats: {
            plays: 0,
            likes: 0,
            comments: 0,
            shares: 0
        }
    };
}

module.exports = {
    getFacebookVideo
};
