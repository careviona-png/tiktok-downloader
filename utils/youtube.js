const axios = require('axios');

/**
 * Extract YouTube video/shorts information using multiple methods
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} - Video metadata
 */
async function getYoutubeInfo(url) {
    try {
        console.log('[YouTube] Fetching info for:', url);

        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        console.log('[YouTube] Video ID:', videoId);

        // Try multiple methods to get video info
        let videoData = null;

        // Method 1: Try oEmbed API (for basic info)
        try {
            videoData = await getVideoInfoOEmbed(url, videoId);
            console.log('[YouTube] Got info via oEmbed');
        } catch (e) {
            console.log('[YouTube] oEmbed failed:', e.message);
        }

        // Method 2: Try scraping YouTube page
        if (!videoData || !videoData.downloadUrl) {
            try {
                const pageData = await getVideoInfoFromPage(videoId);
                if (pageData) {
                    videoData = { ...videoData, ...pageData };
                    console.log('[YouTube] Got formats from page scraping');
                }
            } catch (e) {
                console.log('[YouTube] Page scraping failed:', e.message);
            }
        }

        // Method 3: Try third-party API (cobalt.tools)
        if (!videoData || !videoData.downloadUrl) {
            try {
                const cobaltData = await getVideoInfoCobalt(url);
                if (cobaltData) {
                    videoData = { ...videoData, ...cobaltData };
                    console.log('[YouTube] Got info via Cobalt API');
                }
            } catch (e) {
                console.log('[YouTube] Cobalt API failed:', e.message);
            }
        }

        if (!videoData) {
            throw new Error('Could not extract video data');
        }

        return {
            title: videoData.title || 'YouTube Video',
            thumbnail: videoData.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            duration: videoData.duration || '00:00',
            author: videoData.author || 'Unknown',
            views: videoData.views || '0',
            downloadUrl: videoData.downloadUrl || null,
            downloadOptions: videoData.downloadOptions || [],
            quality: videoData.quality || 'HD',
            source: 'YouTube',
            isShort: url.includes('/shorts/'),
            videoId: videoId
        };
    } catch (error) {
        console.error('[YouTube] Error in getYoutubeInfo:', error.message);
        throw new Error('Không thể lấy thông tin video YouTube. Vui lòng kiểm tra lại URL hoặc thử lại sau.');
    }
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
 * Get video formats by scraping YouTube page
 */
async function getVideoInfoFromPage(videoId) {
    try {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const response = await axios.get(watchUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        const html = response.data;

        // Extract player response
        const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
        if (!playerResponseMatch) {
            return null;
        }

        const playerResponse = JSON.parse(playerResponseMatch[1]);

        // Check if video is available
        if (playerResponse.playabilityStatus?.status !== 'OK') {
            const reason = playerResponse.playabilityStatus?.reason || 'Video unavailable';
            throw new Error(reason);
        }

        const videoDetails = playerResponse.videoDetails || {};
        const streamingData = playerResponse.streamingData || {};

        // Get formats
        const formats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];

        // Find combined formats (video + audio)
        const combinedFormats = formats.filter(f =>
            f.mimeType?.includes('video') &&
            f.audioQuality &&
            f.url
        ).sort((a, b) => (b.height || 0) - (a.height || 0));

        // Find audio formats
        const audioFormats = formats.filter(f =>
            f.mimeType?.includes('audio') &&
            f.url
        ).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        // Build download options
        const downloadOptions = [];
        const addedQualities = new Set();

        combinedFormats.forEach(f => {
            const quality = f.height ? `${f.height}p` : 'Auto';
            if (!addedQualities.has(quality) && downloadOptions.length < 3 && f.url) {
                addedQualities.add(quality);
                downloadOptions.push({
                    quality: quality,
                    url: f.url,
                    type: 'video',
                    format: 'mp4',
                    size: f.contentLength ? formatBytes(parseInt(f.contentLength)) : 'Unknown'
                });
            }
        });

        // Add audio option
        if (audioFormats.length > 0 && audioFormats[0].url) {
            const bestAudio = audioFormats[0];
            downloadOptions.push({
                quality: bestAudio.bitrate ? `${Math.round(bestAudio.bitrate / 1000)}kbps` : 'Best',
                url: bestAudio.url,
                type: 'audio',
                format: 'm4a',
                size: bestAudio.contentLength ? formatBytes(parseInt(bestAudio.contentLength)) : 'Unknown'
            });
        }

        // Get duration
        let duration = '00:00';
        if (videoDetails.lengthSeconds) {
            const secs = parseInt(videoDetails.lengthSeconds);
            const mins = Math.floor(secs / 60);
            const remainSecs = secs % 60;
            duration = `${String(mins).padStart(2, '0')}:${String(remainSecs).padStart(2, '0')}`;
        }

        return {
            title: videoDetails.title,
            author: videoDetails.author,
            duration: duration,
            views: formatViews(parseInt(videoDetails.viewCount) || 0),
            downloadUrl: combinedFormats[0]?.url || null,
            downloadOptions: downloadOptions,
            quality: combinedFormats[0]?.height ? `${combinedFormats[0].height}p` : 'HD'
        };
    } catch (error) {
        console.error('[YouTube] Page scraping error:', error.message);
        return null;
    }
}

/**
 * Get video info via Cobalt API (third-party service)
 */
async function getVideoInfoCobalt(url) {
    try {
        const response = await axios.post('https://api.cobalt.tools/api/json', {
            url: url,
            vCodec: 'h264',
            vQuality: '720',
            aFormat: 'mp3',
            filenamePattern: 'basic'
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.url) {
            return {
                downloadUrl: response.data.url,
                downloadOptions: [{
                    quality: '720p',
                    url: response.data.url,
                    type: 'video',
                    format: 'mp4',
                    size: 'Unknown'
                }],
                quality: '720p'
            };
        }

        return null;
    } catch (error) {
        console.error('[YouTube] Cobalt API error:', error.message);
        return null;
    }
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
    const urlObj = new URL(url);
    const vParam = urlObj.searchParams.get('v');
    if (vParam && vParam.length === 11) return vParam;

    // Embedded format
    const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
