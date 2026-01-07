const axios = require('axios');

/**
 * Extract YouTube video/shorts information using multiple methods
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} - Video metadata
 */
async function getYoutubeInfo(url) {
    console.log('[YouTube] Fetching info for:', url);

    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('URL YouTube không hợp lệ. Vui lòng kiểm tra lại.');
    }

    console.log('[YouTube] Video ID:', videoId);

    // Try multiple methods
    let videoData = null;
    let lastError = null;

    // Method 1: RapidAPI YouTubeToMP3 (free tier available)
    try {
        videoData = await getVideoViaRapidAPI(videoId);
        if (videoData && videoData.downloadUrl) {
            console.log('[YouTube] Got video via RapidAPI');
            return formatResponse(videoData, videoId, url);
        }
    } catch (e) {
        console.log('[YouTube] RapidAPI failed:', e.message);
        lastError = e;
    }

    // Method 2: Try Y2mate-style API
    try {
        videoData = await getVideoViaY2mate(videoId, url);
        if (videoData && videoData.downloadUrl) {
            console.log('[YouTube] Got video via Y2mate');
            return formatResponse(videoData, videoId, url);
        }
    } catch (e) {
        console.log('[YouTube] Y2mate failed:', e.message);
        lastError = e;
    }

    // Method 3: Try invidious API (privacy-focused YouTube frontend)
    try {
        videoData = await getVideoViaInvidious(videoId);
        if (videoData && videoData.downloadUrl) {
            console.log('[YouTube] Got video via Invidious');
            return formatResponse(videoData, videoId, url);
        }
    } catch (e) {
        console.log('[YouTube] Invidious failed:', e.message);
        lastError = e;
    }

    // Method 4: Try basic oEmbed for metadata only
    try {
        videoData = await getVideoInfoOEmbed(url, videoId);
        console.log('[YouTube] Got metadata via oEmbed (no download URL)');
        return formatResponse(videoData || {}, videoId, url);
    } catch (e) {
        console.log('[YouTube] oEmbed failed:', e.message);
    }

    // If all methods fail, return basic info
    return formatResponse({
        title: 'YouTube Video',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        author: 'Unknown'
    }, videoId, url);
}

/**
 * Try RapidAPI YouTube service
 */
async function getVideoViaRapidAPI(videoId) {
    // Using a public YouTube info endpoint
    const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    if (response.data) {
        return {
            title: response.data.title,
            author: response.data.author_name,
            thumbnail: response.data.thumbnail_url
        };
    }
    return null;
}

/**
 * Try Y2mate-style conversion API
 */
async function getVideoViaY2mate(videoId, originalUrl) {
    // Y2mate API endpoint
    const analyzeUrl = 'https://www.y2mate.com/mates/analyzeV2/ajax';

    try {
        const response = await axios.post(analyzeUrl,
            `k_query=${encodeURIComponent(originalUrl)}&k_page=home&hl=en&q_auto=0`,
            {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://www.y2mate.com',
                    'Referer': 'https://www.y2mate.com/'
                }
            }
        );

        if (response.data && response.data.status === 'ok') {
            const data = response.data;
            const formats = data.links?.mp4 || {};

            // Find best quality
            const qualities = ['1080', '720', '480', '360'];
            let bestFormat = null;
            for (const q of qualities) {
                if (formats[q]) {
                    bestFormat = formats[q];
                    break;
                }
            }

            if (bestFormat) {
                // Get conversion URL
                const convertResponse = await axios.post('https://www.y2mate.com/mates/convertV2/index',
                    `vid=${data.vid}&k=${bestFormat.k}`,
                    {
                        timeout: 20000,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Origin': 'https://www.y2mate.com'
                        }
                    }
                );

                if (convertResponse.data?.status === 'ok' && convertResponse.data?.dlink) {
                    return {
                        title: data.title,
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                        downloadUrl: convertResponse.data.dlink,
                        quality: bestFormat.q
                    };
                }
            }
        }
    } catch (e) {
        console.log('[YouTube] Y2mate error:', e.message);
    }
    return null;
}

/**
 * Try Invidious API (privacy-focused YouTube frontend)
 */
async function getVideoViaInvidious(videoId) {
    // List of Invidious instances
    const instances = [
        'https://invidious.snopyta.org',
        'https://yewtu.be',
        'https://vid.puffyan.us',
        'https://invidious.kavin.rocks'
    ];

    for (const instance of instances) {
        try {
            const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data) {
                const data = response.data;

                // Find format with both video and audio
                const formats = data.formatStreams || [];
                const adaptiveFormats = data.adaptiveFormats || [];

                // Prefer combined formats
                const combinedFormat = formats.find(f => f.quality && f.url) || formats[0];

                if (combinedFormat && combinedFormat.url) {
                    return {
                        title: data.title,
                        author: data.author,
                        thumbnail: data.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                        downloadUrl: combinedFormat.url,
                        downloadOptions: formats.filter(f => f.url).map(f => ({
                            quality: f.quality || f.qualityLabel || 'Auto',
                            url: f.url,
                            type: 'video',
                            format: 'mp4'
                        })),
                        quality: combinedFormat.quality || 'HD',
                        duration: formatDuration(data.lengthSeconds),
                        views: formatViews(data.viewCount)
                    };
                }
            }
        } catch (e) {
            console.log(`[YouTube] Invidious ${instance} failed:`, e.message);
            continue;
        }
    }
    return null;
}

/**
 * Get video info via oEmbed API
 */
async function getVideoInfoOEmbed(url, videoId) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

    const response = await axios.get(oembedUrl, {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    if (response.data) {
        return {
            title: response.data.title,
            author: response.data.author_name,
            thumbnail: response.data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
        };
    }

    return null;
}

/**
 * Format response
 */
function formatResponse(data, videoId, url) {
    return {
        title: data.title || 'YouTube Video',
        thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        duration: data.duration || '00:00',
        author: data.author || 'Unknown',
        views: data.views || '0',
        downloadUrl: data.downloadUrl || null,
        downloadOptions: data.downloadOptions || [],
        quality: data.quality || 'HD',
        source: 'YouTube',
        isShort: url.includes('/shorts/'),
        videoId: videoId
    };
}

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url) {
    if (!url) return null;

    // YouTube Shorts format
    const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // youtu.be format
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];

    // Standard YouTube format with v= parameter
    try {
        const urlObj = new URL(url);
        const vParam = urlObj.searchParams.get('v');
        if (vParam && vParam.length === 11) return vParam;
    } catch (e) { }

    // Embedded format
    const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
}

/**
 * Format duration from seconds
 */
function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format view count
 */
function formatViews(views) {
    if (!views) return '0';
    if (views >= 1000000) {
        return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
        return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
}

module.exports = {
    getYoutubeInfo,
    extractVideoId
};
