const axios = require('axios');

/**
 * Get Facebook video info using multiple methods
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
        console.log('[Facebook] Could not resolve URL, using original');
    }

    // Try multiple methods
    let videoData = null;

    // Method 1: Try fbdown.net API (most reliable)
    try {
        videoData = await getFbdownVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via fbdown.net');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] fbdown.net failed:', e.message);
    }

    // Method 2: Try savevideo.me API
    try {
        videoData = await getSaveVideoMe(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via savevideo.me');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] savevideo.me failed:', e.message);
    }

    // Method 3: Direct mobile page scraping (fallback)
    try {
        videoData = await scrapeFacebookMobile(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via mobile scraping');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] Mobile scraping failed:', e.message);
    }

    // Method 4: Try getfvid API
    try {
        videoData = await getGetfvidVideo(resolvedUrl);
        if (videoData && (videoData.hd || videoData.sd)) {
            console.log('✅ Got Facebook video via getfvid');
            return formatFacebookResponse(videoData);
        }
    } catch (e) {
        console.log('[Facebook] getfvid failed:', e.message);
    }

    throw new Error('Không thể tải video Facebook. Video có thể là private hoặc link không hợp lệ.');
}

/**
 * Resolve short URLs and share links
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
 * Get video via fbdown.net (very reliable)
 */
async function getFbdownVideo(url) {
    try {
        // First request to get token
        const pageResponse = await axios.get('https://fbdown.net/', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Submit URL
        const formData = new URLSearchParams();
        formData.append('URLz', url);

        const response = await axios.post('https://fbdown.net/download.php', formData, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://fbdown.net/',
                'Origin': 'https://fbdown.net'
            }
        });

        const html = response.data;

        // Extract HD link
        const hdMatch = html.match(/id="hdlink"[^>]*href="([^"]+)"/i) ||
            html.match(/class="[^"]*hd[^"]*"[^>]*href="([^"]+)"/i) ||
            html.match(/HD.*?href="([^"]+\.mp4[^"]*)"/i);

        // Extract SD link
        const sdMatch = html.match(/id="sdlink"[^>]*href="([^"]+)"/i) ||
            html.match(/class="[^"]*sd[^"]*"[^>]*href="([^"]+)"/i) ||
            html.match(/SD.*?href="([^"]+\.mp4[^"]*)"/i);

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

        if (hdMatch || sdMatch) {
            return {
                title: titleMatch ? titleMatch[1].replace(/\s*-\s*fbdown\.net.*/i, '').trim() : 'Facebook Video',
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
 * Get video via savevideo.me
 */
async function getSaveVideoMe(url) {
    try {
        const response = await axios.post('https://savevideo.me/api/ajaxSearch/',
            `q=${encodeURIComponent(url)}&vt=home`,
            {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://savevideo.me',
                    'Referer': 'https://savevideo.me/'
                }
            }
        );

        if (response.data && response.data.links) {
            const links = response.data.links;
            const hdLink = links.find(l => l.quality && l.quality.includes('HD'));
            const sdLink = links.find(l => l.quality && l.quality.includes('SD')) || links[0];

            if (hdLink || sdLink) {
                return {
                    title: response.data.title || 'Facebook Video',
                    thumbnail: response.data.thumbnail || '',
                    hd: hdLink ? hdLink.url : null,
                    sd: sdLink ? sdLink.url : null
                };
            }
        }
    } catch (e) {
        throw new Error(e.message);
    }
    return null;
}

/**
 * Get video via getfvid.com
 */
async function getGetfvidVideo(url) {
    try {
        const response = await axios.post('https://getfvid.com/downloader',
            `url=${encodeURIComponent(url)}`,
            {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://getfvid.com',
                    'Referer': 'https://getfvid.com/'
                }
            }
        );

        const html = response.data;

        // Extract download links
        const hdMatch = html.match(/download[^"]*HD[^"]*"[^>]*href="([^"]+)"/i) ||
            html.match(/onclick="[^"]*HD[^>]*href="([^"]+)"/i);
        const sdMatch = html.match(/download[^"]*Normal[^"]*href="([^"]+)"/i) ||
            html.match(/onclick="[^"]*SD[^>]*href="([^"]+)"/i);

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
 * Scrape Facebook mobile page
 */
async function scrapeFacebookMobile(url) {
    try {
        let mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
        if (!mobileUrl.includes('m.facebook.com')) {
            mobileUrl = url.replace('facebook.com', 'm.facebook.com');
        }

        const response = await axios.get(mobileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
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
 * Extract video URLs from HTML
 */
function extractVideoFromHtml(html) {
    let hdUrl = null;
    let sdUrl = null;
    let title = 'Facebook Video';

    // HD patterns
    const hdPatterns = [
        /browser_native_hd_url":"([^"]+)"/,
        /playable_url_quality_hd":"([^"]+)"/,
        /"hd_src":"([^"]+)"/,
        /hd_src_no_ratelimit":"([^"]+)"/
    ];

    // SD patterns  
    const sdPatterns = [
        /browser_native_sd_url":"([^"]+)"/,
        /playable_url":"([^"]+)"/,
        /"sd_src":"([^"]+)"/,
        /sd_src_no_ratelimit":"([^"]+)"/,
        /"video_url":"([^"]+)"/,
        /meta\s+property="og:video"[^>]*content="([^"]+)"/i
    ];

    for (const pattern of hdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            try {
                let decoded = match[1].replace(/\\u0025/g, '%')
                    .replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) => String.fromCharCode(parseInt(cc, 16)))
                    .replace(/\\\//g, '/');
                try { decoded = decodeURIComponent(decoded); } catch (e) { }
                if (decoded.includes('.mp4') || decoded.includes('video')) {
                    hdUrl = decoded;
                    break;
                }
            } catch (e) { }
        }
    }

    for (const pattern of sdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            try {
                let decoded = match[1].replace(/\\u0025/g, '%')
                    .replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) => String.fromCharCode(parseInt(cc, 16)))
                    .replace(/\\\//g, '/');
                try { decoded = decodeURIComponent(decoded); } catch (e) { }
                if (decoded.includes('.mp4') || decoded.includes('video')) {
                    sdUrl = decoded;
                    break;
                }
            } catch (e) { }
        }
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        title = titleMatch[1].replace(/\s*[\|•-]\s*Facebook.*$/i, '').trim();
    }

    if (hdUrl || sdUrl) {
        return { title, thumbnail: '', hd: hdUrl, sd: sdUrl || hdUrl };
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
