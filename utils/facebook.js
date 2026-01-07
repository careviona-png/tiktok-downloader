const axios = require('axios');

// Try to load facebook-downloader with correct import
let facebookDownloader;
try {
    const fbModule = require('@mrnima/facebook-downloader');
    // The module exports { facebook } function
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
    console.log('🔍 Fetching Facebook video:', url);

    // Normalize URL - handle /share/r/ format
    const normalizedUrl = normalizeUrl(url);
    console.log('📎 Normalized URL:', normalizedUrl);

    // Try primary method first
    if (facebookDownloader) {
        try {
            const result = await facebookDownloader(normalizedUrl);
            console.log('[Facebook] mrnima result:', JSON.stringify(result).substring(0, 200));

            if (result) {
                // Handle different response formats
                let data;
                if (result.result) {
                    data = result.result;
                } else if (result.hd || result.sd) {
                    data = result;
                } else if (result.data) {
                    data = result.data;
                } else {
                    data = result;
                }

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
        const data = await scrapeFacebookVideo(normalizedUrl);
        if (data && (data.hd || data.sd)) {
            console.log('✅ Got Facebook video via scraping');
            return formatFacebookResponse(data);
        }
    } catch (e) {
        console.log('[Facebook] Scraping failed:', e.message);
    }

    // Try alternative API
    try {
        const data = await getViaAlternativeAPI(normalizedUrl);
        if (data && (data.hd || data.sd)) {
            console.log('✅ Got Facebook video via alternative API');
            return formatFacebookResponse(data);
        }
    } catch (e) {
        console.log('[Facebook] Alternative API failed:', e.message);
    }

    throw new Error('Không thể tải video Facebook. Vui lòng kiểm tra link và thử lại.');
}

/**
 * Normalize Facebook URL - convert share links to direct links
 */
function normalizeUrl(url) {
    // Handle /share/r/ format (Reels share links)
    if (url.includes('/share/r/')) {
        const match = url.match(/\/share\/r\/([a-zA-Z0-9]+)/);
        if (match) {
            return `https://www.facebook.com/reel/${match[1]}`;
        }
    }

    // Handle /share/v/ format (Video share links)
    if (url.includes('/share/v/')) {
        const match = url.match(/\/share\/v\/([a-zA-Z0-9]+)/);
        if (match) {
            return `https://www.facebook.com/watch/?v=${match[1]}`;
        }
    }

    return url;
}

/**
 * Scrape Facebook video directly
 */
async function scrapeFacebookVideo(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cookie': 'locale=en_US;'
            },
            timeout: 15000,
            maxRedirects: 5
        });

        const html = response.data;
        let hdUrl = null;
        let sdUrl = null;
        let title = 'Facebook Video';
        let thumbnail = '';

        // Try multiple patterns for HD video
        const hdPatterns = [
            /browser_native_hd_url":"([^"]+)"/,
            /playable_url_quality_hd":"([^"]+)"/,
            /"hd_src":"([^"]+)"/,
            /hd_src_no_ratelimit":"([^"]+)"/
        ];

        for (const pattern of hdPatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    hdUrl = JSON.parse(`"${match[1]}"`);
                    break;
                } catch (e) { }
            }
        }

        // Try multiple patterns for SD video
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
            title = titleMatch[1].replace(' | Facebook', '').replace(' - Facebook', '').trim();
        }

        // Get thumbnail
        const thumbMatch = html.match(/og:image" content="([^"]+)"/);
        if (thumbMatch) {
            thumbnail = thumbMatch[1];
        }

        if (hdUrl || sdUrl) {
            return { title, thumbnail, hd: hdUrl, sd: sdUrl || hdUrl };
        }

    } catch (e) {
        console.log('[Facebook] Scrape error:', e.message);
    }

    return null;
}

/**
 * Try alternative Facebook video API
 */
async function getViaAlternativeAPI(url) {
    // Try multiple alternative APIs
    const apis = [
        {
            name: 'fdownloader',
            method: async () => {
                const response = await axios.post('https://fdownloader.net/api/ajaxSearch',
                    `q=${encodeURIComponent(url)}`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    }
                );
                if (response.data && response.data.links) {
                    const links = response.data.links;
                    return {
                        title: response.data.title || 'Facebook Video',
                        thumbnail: response.data.thumb || '',
                        hd: links.find(l => l.quality === 'HD')?.url || '',
                        sd: links.find(l => l.quality === 'SD')?.url || links[0]?.url || ''
                    };
                }
                return null;
            }
        },
        {
            name: 'getfvid',
            method: async () => {
                const response = await axios.post('https://getfvid.com/api/bypass',
                    { url: url },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0'
                        },
                        timeout: 15000
                    }
                );
                if (response.data && (response.data.hd || response.data.sd)) {
                    return {
                        title: 'Facebook Video',
                        thumbnail: '',
                        hd: response.data.hd || '',
                        sd: response.data.sd || ''
                    };
                }
                return null;
            }
        }
    ];

    for (const api of apis) {
        try {
            const result = await api.method();
            if (result) {
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
