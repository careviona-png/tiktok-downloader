const axios = require('axios');

/**
 * Extract YouTube video/shorts information
 * Uses multiple API fallbacks for reliability
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

    // Get metadata from oEmbed first
    let metadata = null;
    try {
        metadata = await getVideoInfoOEmbed(url, videoId);
        console.log('[YouTube] Got metadata:', metadata.title);
    } catch (e) {
        console.log('[YouTube] oEmbed failed:', e.message);
        metadata = { title: 'YouTube Video', author: 'Unknown' };
    }

    // Try multiple APIs for download URL
    let downloadData = null;

    // Method 1: Try Cobalt API (correct URL)
    try {
        downloadData = await getCobaltDownload(url);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] Got Cobalt download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] Got Cobalt download URL: NO');
    } catch (e) {
        console.log('[YouTube] Cobalt API error:', e.message);
    }

    // Method 2: Try SaveTube API
    try {
        downloadData = await getSaveTubeDownload(videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] Got SaveTube download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] Got SaveTube download URL: NO');
    } catch (e) {
        console.log('[YouTube] SaveTube API error:', e.message);
    }

    // Method 3: Try direct YouTube embed extraction
    try {
        downloadData = await getYouTubeEmbedDownload(videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] Got embed download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] Got embed download URL: NO');
    } catch (e) {
        console.log('[YouTube] Embed extraction error:', e.message);
    }

    console.log('[YouTube] No downloadUrl, not caching');
    return formatResponse(metadata, videoId, url);
}

/**
 * Get download URL via Cobalt API
 * Official Cobalt API: https://api.cobalt.tools
 */
async function getCobaltDownload(url) {
    try {
        const response = await axios.post('https://api.cobalt.tools/api/json', {
            url: url,
            vCodec: 'h264',
            vQuality: '720',
            aFormat: 'mp3',
            filenamePattern: 'basic',
            isAudioOnly: false
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'TikDown/1.0'
            }
        });

        if (response.data) {
            const data = response.data;
            console.log('[YouTube] Cobalt response status:', data.status);

            if (data.status === 'stream' || data.status === 'redirect') {
                return {
                    downloadUrl: data.url,
                    downloadOptions: [{
                        quality: '720p',
                        url: data.url,
                        type: 'video',
                        format: 'mp4',
                        size: 'Unknown'
                    }],
                    quality: '720p'
                };
            } else if (data.status === 'picker' && data.picker && data.picker.length > 0) {
                const options = data.picker.map(item => ({
                    quality: item.type === 'video' ? '720p' : 'Audio',
                    url: item.url,
                    type: item.type || 'video',
                    format: 'mp4',
                    size: 'Unknown'
                }));

                return {
                    downloadUrl: data.picker[0].url,
                    downloadOptions: options,
                    quality: '720p'
                };
            } else if (data.status === 'error') {
                console.log('[YouTube] Cobalt error:', data.text);
            }
        }
    } catch (e) {
        throw new Error(e.response?.data?.text || e.message);
    }

    return null;
}

/**
 * Try SaveTube-style API
 */
async function getSaveTubeDownload(videoId) {
    try {
        // Try ssyoutube/savefrom style API
        const response = await axios.get(`https://www.ssyoutube.com/api/convert?id=${videoId}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.url) {
            return {
                downloadUrl: response.data.url,
                downloadOptions: [{
                    quality: response.data.quality || '720p',
                    url: response.data.url,
                    type: 'video',
                    format: 'mp4',
                    size: 'Unknown'
                }],
                quality: response.data.quality || '720p'
            };
        }
    } catch (e) {
        // Try alternative endpoint
        try {
            const response2 = await axios.post('https://loader.to/ajax/download.php',
                `format=1080&url=https://www.youtube.com/watch?v=${videoId}`,
                {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            );

            if (response2.data && response2.data.download_url) {
                return {
                    downloadUrl: response2.data.download_url,
                    downloadOptions: [{
                        quality: '1080p',
                        url: response2.data.download_url,
                        type: 'video',
                        format: 'mp4',
                        size: 'Unknown'
                    }],
                    quality: '1080p'
                };
            }
        } catch (e2) {
            throw new Error(e.message);
        }
    }

    return null;
}

/**
 * Try to extract from YouTube embed page
 */
async function getYouTubeEmbedDownload(videoId) {
    try {
        // Try noembed for additional metadata
        const response = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
            timeout: 10000
        });

        // This only gets metadata, not download URL
        // But we can construct a proxy URL
        if (response.data && response.data.title) {
            // Return null as we can't get direct download from noembed
            return null;
        }
    } catch (e) {
        throw new Error(e.message);
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
        title: data?.title || 'YouTube Video',
        thumbnail: data?.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        duration: data?.duration || '00:00',
        author: data?.author || 'Unknown',
        views: data?.views || '0',
        downloadUrl: data?.downloadUrl || null,
        downloadOptions: data?.downloadOptions || [],
        quality: data?.quality || 'HD',
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

module.exports = {
    getYoutubeInfo,
    extractVideoId
};
