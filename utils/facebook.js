const axios = require('axios');

// Try to load facebook-downloader, fallback to axios if not available
let fb;
try {
    fb = require('@mrnima/facebook-downloader');
} catch (e) {
    console.log('[Facebook] @mrnima/facebook-downloader not available, using fallback');
    fb = null;
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
    if (fb) {
        try {
            const result = await fb.fbdl(normalizedUrl);

            if (result && result.status && result.result) {
                const data = result.result;
                console.log('✅ Got Facebook video via mrnima');
                return formatFacebookResponse(data);
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
        // Try to extract the reel ID and convert to a proper URL
        const match = url.match(/\/share\/r\/([a-zA-Z0-9]+)/);
        if (match) {
            // Convert to proper reel URL format
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

    // Handle fb.watch short links
    if (url.includes('fb.watch')) {
        return url; // Keep as is, let the API handle it
    }

    // Handle fbwat.ch links
    if (url.includes('fbwat.ch')) {
        return url;
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
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000
        });

        const html = response.data;

        // Try to find HD video URL
        let hdUrl = null;
        let sdUrl = null;
        let title = 'Facebook Video';
        let thumbnail = '';

        // Look for HD video
        const hdMatch = html.match(/browser_native_hd_url":"([^"]+)"/);
        if (hdMatch) {
            hdUrl = JSON.parse(`"${hdMatch[1]}"`);
        }

        // Look for SD video
        const sdMatch = html.match(/browser_native_sd_url":"([^"]+)"/);
        if (sdMatch) {
            sdUrl = JSON.parse(`"${sdMatch[1]}"`);
        }

        // Alternative patterns
        if (!hdUrl && !sdUrl) {
            const playableMatch = html.match(/playable_url_quality_hd":"([^"]+)"/);
            if (playableMatch) {
                hdUrl = JSON.parse(`"${playableMatch[1]}"`);
            }

            const sdPlayable = html.match(/playable_url":"([^"]+)"/);
            if (sdPlayable) {
                sdUrl = JSON.parse(`"${sdPlayable[1]}"`);
            }
        }

        // Get title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
            title = titleMatch[1].replace(' | Facebook', '').trim();
        }

        // Get thumbnail
        const thumbMatch = html.match(/og:image" content="([^"]+)"/);
        if (thumbMatch) {
            thumbnail = thumbMatch[1];
        }

        if (hdUrl || sdUrl) {
            return {
                title,
                thumbnail,
                hd: hdUrl,
                sd: sdUrl || hdUrl
            };
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
    try {
        // Try fdownloader-style API
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
    } catch (e) {
        // Ignore
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
