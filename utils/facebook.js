const axios = require('axios');

/**
 * Get Facebook video info using a working approach
 * Uses multiple API fallbacks
 */
async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video:', url);

    // Try multiple APIs
    const apis = [
        () => trygetvideoDownloader(url),
        () => tryRapidAPI(url),
        () => tryDirectScrape(url)
    ];

    for (const apiCall of apis) {
        try {
            const result = await apiCall();
            if (result && (result.videoHD || result.videoSD)) {
                return result;
            }
        } catch (error) {
            console.log('API attempt failed:', error.message);
        }
    }

    throw new Error('Could not download this video. Please try a different link or check if the video is public.');
}

/**
 * Try getvideo.app downloader
 */
async function trygetvideoDownloader(url) {
    console.log('📡 Trying getVideo API...');

    try {
        const response = await axios({
            method: 'POST',
            url: 'https://getvideo.cc/api/ajaxSearch',
            data: `q=${encodeURIComponent(url)}&vt=home`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Origin': 'https://getvideo.cc',
                'Referer': 'https://getvideo.cc/',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 30000
        });

        const data = response.data;
        if (data.status === 'ok' && data.data) {
            // Parse HTML in data.data to find links
            const html = data.data;
            const hdMatch = html.match(/href="([^"]+)"[^>]*>HD/i) || html.match(/data-url="([^"]+)"/);
            const sdMatch = html.match(/href="([^"]+)"[^>]*>SD/i);
            const videoMatch = html.match(/href="(https?:\/\/[^"]+(?:\.mp4|video)[^"]*)"/i);

            let hdUrl = hdMatch ? hdMatch[1] : '';
            let sdUrl = sdMatch ? sdMatch[1] : '';

            if (!hdUrl && !sdUrl && videoMatch) {
                sdUrl = videoMatch[1];
            }

            if (hdUrl || sdUrl) {
                console.log('✅ getVideo API success!');
                return createVideoData(hdUrl, sdUrl, data.title || 'Facebook Video');
            }
        }
    } catch (error) {
        console.log('getVideo error:', error.message);
    }
    return null;
}

/**
 * Try RapidAPI Facebook downloader
 */
async function tryRapidAPI(url) {
    console.log('📡 Trying Rapid API...');

    // Note: This is a free tier endpoint, may have rate limits
    try {
        const response = await axios({
            method: 'GET',
            url: `https://facebook-video-downloader2.p.rapidapi.com/facebook?url=${encodeURIComponent(url)}`,
            headers: {
                'X-RapidAPI-Key': 'demo', // Would need real key for production
                'X-RapidAPI-Host': 'facebook-video-downloader2.p.rapidapi.com'
            },
            timeout: 15000
        });

        if (response.data && response.data.video_url) {
            console.log('✅ Rapid API success!');
            return createVideoData(response.data.hd_url || response.data.video_url, response.data.sd_url || response.data.video_url, response.data.title);
        }
    } catch (error) {
        console.log('RapidAPI error:', error.message);
    }
    return null;
}

/**
 * Try direct page scraping (last resort)
 */
async function tryDirectScrape(url) {
    console.log('📡 Trying direct scrape...');

    try {
        // Try to get the mobile version which might have video URLs in source
        let normalizedUrl = url.replace('www.facebook.com', 'm.facebook.com');

        const response = await axios.get(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000,
            maxRedirects: 5
        });

        const html = response.data;

        // Look for video URLs in the page
        const videoPatterns = [
            /"playable_url_quality_hd":"([^"]+)"/,
            /"playable_url":"([^"]+)"/,
            /"hd_src":"([^"]+)"/,
            /"sd_src":"([^"]+)"/,
            /data-store="([^"]*video_url[^"]*)"/,
            /src="(https?:\/\/video[^"]+\.mp4[^"]*)"/
        ];

        let hdUrl = '', sdUrl = '';

        for (const pattern of videoPatterns) {
            const match = html.match(pattern);
            if (match) {
                let videoUrl = match[1].replace(/\\/g, '').replace(/\\u0025/g, '%');
                // Decode unicode if needed
                try {
                    videoUrl = decodeURIComponent(videoUrl);
                } catch (e) { }

                if (!hdUrl) hdUrl = videoUrl;
                else if (!sdUrl) sdUrl = videoUrl;

                if (hdUrl && sdUrl) break;
            }
        }

        if (hdUrl || sdUrl) {
            console.log('✅ Direct scrape success!');
            return createVideoData(hdUrl, sdUrl, 'Facebook Video');
        }
    } catch (error) {
        console.log('Direct scrape error:', error.message);
    }
    return null;
}

/**
 * Create standardized video data object
 */
function createVideoData(hdUrl, sdUrl, title = 'Facebook Video') {
    return {
        id: Date.now().toString(),
        title: title,
        platform: 'facebook',
        author: {
            username: 'facebook_user',
            nickname: 'Facebook User',
            avatar: ''
        },
        thumbnail: '',
        duration: 0,
        videoUrl: sdUrl || hdUrl,
        videoNoWatermark: hdUrl || sdUrl,
        videoHD: hdUrl,
        videoSD: sdUrl,
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
