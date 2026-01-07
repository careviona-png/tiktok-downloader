const axios = require('axios');

/**
 * Extract YouTube video/shorts information
 * Uses Cobalt.tools API which is reliable and actively maintained
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
    }

    // Try Cobalt API for download URL
    let downloadData = null;
    try {
        downloadData = await getCobaltDownload(url);
        console.log('[YouTube] Got Cobalt download URL:', downloadData ? 'YES' : 'NO');
    } catch (e) {
        console.log('[YouTube] Cobalt failed:', e.message);
    }

    // Try alternative API if Cobalt fails
    if (!downloadData || !downloadData.downloadUrl) {
        try {
            downloadData = await getAlternativeDownload(url, videoId);
            console.log('[YouTube] Got alternative download URL:', downloadData ? 'YES' : 'NO');
        } catch (e) {
            console.log('[YouTube] Alternative API failed:', e.message);
        }
    }

    return formatResponse(
        { ...metadata, ...downloadData },
        videoId,
        url
    );
}

/**
 * Get download URL via Cobalt.tools API
 * Cobalt is an open-source project that provides reliable media downloads
 */
async function getCobaltDownload(url) {
    try {
        // Try the main Cobalt API
        const response = await axios.post('https://co.wuk.sh/api/json', {
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
                'Accept': 'application/json'
            }
        });

        if (response.data) {
            const data = response.data;

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
                // Multiple options available
                const options = data.picker.map((item, index) => ({
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
            }
        }
    } catch (e) {
        console.log('[YouTube] Cobalt API error:', e.response?.data || e.message);
    }

    return null;
}

/**
 * Alternative download method using SaveFrom-style API
 */
async function getAlternativeDownload(url, videoId) {
    try {
        // Try ssyoutube API
        const response = await axios.get(`https://api.vevioz.com/api/button/mp4/${videoId}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.data) {
            // Parse the HTML response for download links
            const html = response.data;
            const linkMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);

            if (linkMatch && linkMatch[1]) {
                return {
                    downloadUrl: linkMatch[1],
                    downloadOptions: [{
                        quality: '720p',
                        url: linkMatch[1],
                        type: 'video',
                        format: 'mp4',
                        size: 'Unknown'
                    }],
                    quality: '720p'
                };
            }
        }
    } catch (e) {
        console.log('[YouTube] Alternative API error:', e.message);
    }

    // Try another alternative - y2meta
    try {
        const response = await axios.post('https://api.y2meta.app/api/getDownloadUrls', {
            url: url,
            type: 'video'
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.data) {
            const formats = response.data.data;
            if (formats.video && formats.video.length > 0) {
                const best = formats.video[0];
                return {
                    downloadUrl: best.url,
                    downloadOptions: formats.video.slice(0, 3).map(f => ({
                        quality: f.quality || '720p',
                        url: f.url,
                        type: 'video',
                        format: 'mp4',
                        size: f.size || 'Unknown'
                    })),
                    quality: best.quality || '720p'
                };
            }
        }
    } catch (e) {
        console.log('[YouTube] Y2Meta API error:', e.message);
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
