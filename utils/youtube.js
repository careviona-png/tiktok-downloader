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

    // Method 1: Try y2mate API
    try {
        downloadData = await getY2MateDownload(videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] Y2Mate download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] Y2Mate download URL: NO');
    } catch (e) {
        console.log('[YouTube] Y2Mate API error:', e.message);
    }

    // Method 2: Try loader.to API
    try {
        downloadData = await getLoaderToDownload(videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] loader.to download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] loader.to download URL: NO');
    } catch (e) {
        console.log('[YouTube] loader.to API error:', e.message);
    }

    // Method 3: Try yt1s API
    try {
        downloadData = await getYt1sDownload(videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] yt1s download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] yt1s download URL: NO');
    } catch (e) {
        console.log('[YouTube] yt1s API error:', e.message);
    }

    // Method 4: Try direct API from rapidapi
    try {
        downloadData = await getDirectYoutubeDownload(videoId, url);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] Direct download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] Direct download URL: NO');
    } catch (e) {
        console.log('[YouTube] Direct API error:', e.message);
    }

    console.log('[YouTube] No downloadUrl, not caching');
    return formatResponse(metadata, videoId, url);
}

/**
 * Get download URL via Y2Mate-style API
 */
async function getY2MateDownload(videoId) {
    try {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Try yt-download.org API
        const response = await axios.post('https://yt-download.org/api/button/mp4',
            `url=${encodeURIComponent(youtubeUrl)}`,
            {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://yt-download.org/',
                    'Origin': 'https://yt-download.org'
                }
            }
        );

        // Parse HTML response for download links
        const html = response.data;
        const downloadMatch = html.match(/href="(https:\/\/[^"]+)"\s+class="[^"]*download/i);

        if (downloadMatch && downloadMatch[1]) {
            return {
                downloadUrl: downloadMatch[1],
                downloadOptions: [{
                    quality: '720p',
                    url: downloadMatch[1],
                    type: 'video',
                    format: 'mp4',
                    size: 'Unknown'
                }],
                quality: '720p'
            };
        }
    } catch (e) {
        throw new Error(e.message);
    }

    return null;
}

/**
 * Get download via loader.to
 */
async function getLoaderToDownload(videoId) {
    try {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Step 1: Get download ID
        const initResponse = await axios.get(
            `https://loader.to/api/button/?url=${encodeURIComponent(youtubeUrl)}&f=mp4`,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );

        // Extract download link from response
        if (initResponse.data) {
            const html = initResponse.data;
            const linkMatch = html.match(/download_url\s*:\s*["']([^"']+)["']/i) ||
                html.match(/href="(https:\/\/dl\.[^"]+)"/i);

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
        throw new Error(e.message);
    }

    return null;
}

/**
 * Get download via yt1s.com style API
 */
async function getYt1sDownload(videoId) {
    try {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Try ssyoutube which is maintained
        const response = await axios.get(
            `https://www.y2mate.com/mates/analyzeV2/ajax`,
            {
                params: {
                    k_query: youtubeUrl,
                    k_page: 'home',
                    hl: 'en',
                    q_auto: 0
                },
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            }
        );

        if (response.data && response.data.links) {
            const links = response.data.links;
            const mp4Links = links.mp4 || {};

            // Get first available quality
            const qualities = Object.keys(mp4Links);
            if (qualities.length > 0) {
                const firstQuality = mp4Links[qualities[0]];
                if (firstQuality && firstQuality.k) {
                    // Convert the link
                    const convertResponse = await axios.post(
                        'https://www.y2mate.com/mates/convertV2/index',
                        new URLSearchParams({
                            vid: videoId,
                            k: firstQuality.k
                        }),
                        {
                            timeout: 20000,
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        }
                    );

                    if (convertResponse.data && convertResponse.data.dlink) {
                        return {
                            downloadUrl: convertResponse.data.dlink,
                            downloadOptions: [{
                                quality: firstQuality.q || '720p',
                                url: convertResponse.data.dlink,
                                type: 'video',
                                format: 'mp4',
                                size: firstQuality.size || 'Unknown'
                            }],
                            quality: firstQuality.q || '720p'
                        };
                    }
                }
            }
        }
    } catch (e) {
        throw new Error(e.message);
    }

    return null;
}

/**
 * Try direct YouTube download methods
 */
async function getDirectYoutubeDownload(videoId, originalUrl) {
    try {
        // Try getting info from YouTube's own API
        const response = await axios.get(
            `https://www.youtube.com/get_video_info?video_id=${videoId}&el=detailpage`,
            {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );

        if (response.data) {
            // Parse the response
            const params = new URLSearchParams(response.data);
            const playerResponse = params.get('player_response');

            if (playerResponse) {
                const data = JSON.parse(playerResponse);
                const formats = data.streamingData?.formats || [];

                if (formats.length > 0) {
                    // Get the best quality available
                    const bestFormat = formats.find(f => f.qualityLabel === '720p') || formats[0];

                    if (bestFormat && bestFormat.url) {
                        return {
                            downloadUrl: bestFormat.url,
                            downloadOptions: formats.slice(0, 5).map(f => ({
                                quality: f.qualityLabel || 'Unknown',
                                url: f.url,
                                type: 'video',
                                format: f.mimeType?.split(';')[0]?.split('/')[1] || 'mp4',
                                size: f.contentLength ? `${Math.round(f.contentLength / 1024 / 1024)}MB` : 'Unknown'
                            })),
                            quality: bestFormat.qualityLabel || 'HD'
                        };
                    }
                }
            }
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
