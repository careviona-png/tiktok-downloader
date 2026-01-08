const axios = require('axios');

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

    // Try multiple methods
    let videoData = null;

    // Method 1: Direct scraping with multiple patterns
    try {
        videoData = await scrapeFacebookVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via scraping');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] Scraping failed:', e.message);
    }

    // Method 2: Mobile page scraping
    try {
        videoData = await scrapeFacebookMobile(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via mobile scraping');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] Mobile scraping failed:', e.message);
    }

    // Method 3: Try external API
    try {
        videoData = await getViaExternalAPI(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via external API');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] External API failed:', e.message);
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
            const response = await axios.get(url, {
                maxRedirects: 10,
                timeout: 15000,
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
            console.log('[Facebook] Redirect resolution failed:', e.message);
        }
    }

    return url;
}

/**
 * Scrape Facebook video directly - Desktop version
 */
async function scrapeFacebookVideo(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Cookie': 'locale=en_US'
            },
            timeout: 20000,
            maxRedirects: 10
        });

        const html = response.data;
        return extractVideoFromHtml(html);

    } catch (e) {
        throw new Error(e.message);
    }
}

/**
 * Scrape Facebook video - Mobile version (often has more accessible links)
 */
async function scrapeFacebookMobile(url) {
    try {
        // Convert to mobile URL
        let mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
        if (!mobileUrl.includes('m.facebook.com')) {
            mobileUrl = url.replace('facebook.com', 'm.facebook.com');
        }

        const response = await axios.get(mobileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 20000,
            maxRedirects: 10
        });

        const html = response.data;
        return extractVideoFromHtml(html);

    } catch (e) {
        throw new Error(e.message);
    }
}

/**
 * Extract video URLs from HTML content
 */
function extractVideoFromHtml(html) {
    let hdUrl = null;
    let sdUrl = null;
    let title = 'Facebook Video';
    let thumbnail = '';

    // HD Video patterns
    const hdPatterns = [
        /browser_native_hd_url":"([^"]+)"/,
        /playable_url_quality_hd":"([^"]+)"/,
        /"hd_src":"([^"]+)"/,
        /hd_src_no_ratelimit":"([^"]+)"/,
        /FBQualityLabel="hd"[^>]*src="([^"]+)"/i,
        /"baseURL":"([^"]+\.mp4[^"]*)".*?"qualityLabel":"720p"/,
        /data-sd="([^"]+mp4[^"]*)"/
    ];

    // SD Video patterns
    const sdPatterns = [
        /browser_native_sd_url":"([^"]+)"/,
        /playable_url":"([^"]+)"/,
        /"sd_src":"([^"]+)"/,
        /sd_src_no_ratelimit":"([^"]+)"/,
        /FBQualityLabel="sd"[^>]*src="([^"]+)"/i,
        /video_url":"([^"]+)"/,
        /meta\s+property="og:video"[^>]*content="([^"]+)"/i,
        /data-video-source[^>]*="([^"]+mp4[^"]*)"/
    ];

    // Try to find HD URL
    for (const pattern of hdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            try {
                let decoded = match[1];
                // Decode unicode escapes
                decoded = decoded.replace(/\\u0025/g, '%');
                decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) => String.fromCharCode(parseInt(cc, 16)));
                decoded = decoded.replace(/\\\//g, '/');

                // Decode URL encoding
                try {
                    decoded = decodeURIComponent(decoded);
                } catch (e) { }

                if (decoded.includes('.mp4') || decoded.includes('video')) {
                    hdUrl = decoded;
                    break;
                }
            } catch (e) { }
        }
    }

    // Try to find SD URL
    for (const pattern of sdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            try {
                let decoded = match[1];
                decoded = decoded.replace(/\\u0025/g, '%');
                decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) => String.fromCharCode(parseInt(cc, 16)));
                decoded = decoded.replace(/\\\//g, '/');

                try {
                    decoded = decodeURIComponent(decoded);
                } catch (e) { }

                if (decoded.includes('.mp4') || decoded.includes('video')) {
                    sdUrl = decoded;
                    break;
                }
            } catch (e) { }
        }
    }

    // Get title
    const titlePatterns = [
        /<title[^>]*>([^<]+)<\/title>/i,
        /og:title"[^>]*content="([^"]+)"/i,
        /"title":"([^"]+)"/
    ];
    for (const pattern of titlePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            title = match[1].replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) => String.fromCharCode(parseInt(cc, 16)));
            title = title.replace(/\s*[\|•-]\s*Facebook.*$/i, '').trim();
            if (title.length > 5) break;
        }
    }

    // Get thumbnail
    const thumbPatterns = [
        /og:image"[^>]*content="([^"]+)"/i,
        /twitter:image"[^>]*content="([^"]+)"/i,
        /"thumbnailUrl":"([^"]+)"/,
        /"image":"([^"]+)"/
    ];
    for (const pattern of thumbPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            thumbnail = match[1].replace(/\\\//g, '/');
            break;
        }
    }

    if (hdUrl || sdUrl) {
        return { title, thumbnail, hd: hdUrl, sd: sdUrl || hdUrl };
    }

    return null;
}

/**
 * Try external Facebook video download API
 */
async function getViaExternalAPI(url) {
    try {
        // Try getfvid.com API
        const response = await axios.post('https://getfvid.com/api',
            new URLSearchParams({ url: url }),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://getfvid.com/'
                },
                timeout: 15000
            }
        );

        if (response.data) {
            const data = response.data;
            if (data.hd || data.sd || data.normal) {
                return {
                    title: data.title || 'Facebook Video',
                    thumbnail: data.thumbnail || '',
                    hd: data.hd || data.sd || data.normal,
                    sd: data.sd || data.normal || data.hd
                };
            }
        }
    } catch (e) {
        console.log('[Facebook] getfvid API failed:', e.message);
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
