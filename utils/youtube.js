const axios = require('axios');

/**
 * Extract YouTube video/shorts information
 * Uses YTSave.to proxy API (most reliable)
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

    // Try YTSave API (most reliable)
    let downloadData = null;
    try {
        downloadData = await getYTSaveDownload(url, videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] YTSave download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] YTSave download URL: NO');
    } catch (e) {
        console.log('[YouTube] YTSave API error:', e.message);
    }

    // Fallback: Try SSYouTube API
    try {
        downloadData = await getSSYoutubeDownload(videoId);
        if (downloadData && downloadData.downloadUrl) {
            console.log('[YouTube] SSYouTube download URL: YES');
            return formatResponse({ ...metadata, ...downloadData }, videoId, url);
        }
        console.log('[YouTube] SSYouTube download URL: NO');
    } catch (e) {
        console.log('[YouTube] SSYouTube API error:', e.message);
    }

    console.log('[YouTube] No downloadUrl found');
    return formatResponse(metadata, videoId, url);
}

/**
 * YTSave.to proxy API - Most reliable for YouTube
 * Uses 2-step process: get mediaItems, then poll for fileUrl
 */
async function getYTSaveDownload(url, videoId) {
    try {
        console.log('[YouTube] Step 1: Calling YTSave.to API...');

        // Step 1: Get media items
        const response = await axios.post('https://ytsave.to/proxy.php',
            `url=${encodeURIComponent(url)}`,
            {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://ytsave.to/vi2/',
                    'Origin': 'https://ytsave.to',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            }
        );

        if (response.data && response.data.api) {
            const api = response.data.api;

            if (api.status === 'OK' && api.mediaItems && api.mediaItems.length > 0) {
                console.log('[YouTube] Found', api.mediaItems.length, 'media items');

                // Filter for video items (not audio only)
                const videoItems = api.mediaItems.filter(item =>
                    item.type === 'Video' ||
                    (item.mediaExtension === 'mp4' && !item.mediaRes?.includes('audio'))
                );

                // Sort by quality - prefer 720p or 1080p
                const sortedItems = videoItems.sort((a, b) => {
                    const qualityOrder = { '1080p': 5, '720p': 4, '480p': 3, '360p': 2, '240p': 1 };
                    const aOrder = qualityOrder[a.mediaRes] || 0;
                    const bOrder = qualityOrder[b.mediaRes] || 0;
                    return bOrder - aOrder;
                });

                // Get best quality item (prefer 720p)
                const bestItem = sortedItems.find(item => item.mediaRes === '720p') ||
                    sortedItems.find(item => item.mediaRes === '480p') ||
                    sortedItems[0];

                if (bestItem && bestItem.mediaUrl) {
                    console.log('[YouTube] Step 2: Getting download URL for', bestItem.mediaRes);

                    // Step 2: Poll for actual download URL
                    const fileUrl = await pollForDownloadUrl(bestItem.mediaUrl);

                    if (fileUrl) {
                        // Build download options from all items
                        const downloadOptions = [];
                        for (const item of sortedItems.slice(0, 5)) {
                            const itemUrl = await pollForDownloadUrl(item.mediaUrl);
                            if (itemUrl) {
                                downloadOptions.push({
                                    quality: item.mediaRes || item.mediaQuality || 'Unknown',
                                    url: itemUrl,
                                    type: 'video',
                                    format: item.mediaExtension || 'mp4',
                                    size: item.mediaFileSize ? formatFileSize(item.mediaFileSize) : 'Unknown'
                                });
                            }
                        }

                        return {
                            downloadUrl: fileUrl,
                            downloadOptions: downloadOptions.length > 0 ? downloadOptions : [{
                                quality: bestItem.mediaRes || '720p',
                                url: fileUrl,
                                type: 'video',
                                format: 'mp4',
                                size: 'Unknown'
                            }],
                            quality: bestItem.mediaRes || '720p'
                        };
                    }
                }
            } else if (api.status === 'ERROR') {
                console.log('[YouTube] YTSave error:', api.message);
            }
        }
    } catch (e) {
        console.log('[YouTube] YTSave API error:', e.message);
        throw new Error(e.message);
    }
    return null;
}

/**
 * Poll YTSave for actual download URL
 */
async function pollForDownloadUrl(mediaUrl) {
    if (!mediaUrl) return null;

    // If it's already a direct download URL
    if (mediaUrl.includes('.mp4') && mediaUrl.includes('token=')) {
        return mediaUrl;
    }

    try {
        let attempts = 0;
        const maxAttempts = 20; // 40 seconds max

        while (attempts < maxAttempts) {
            const response = await axios.post('https://ytsave.to/proxy.php',
                `url=${encodeURIComponent(mediaUrl)}`,
                {
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://ytsave.to/vi2/',
                        'Origin': 'https://ytsave.to'
                    }
                }
            );

            if (response.data && response.data.api) {
                const api = response.data.api;

                // Check if processing is complete
                if (api.percent === 'Completed' && api.fileUrl && api.fileUrl !== 'In Processing...') {
                    console.log('[YouTube] Got fileUrl:', api.fileUrl.substring(0, 80) + '...');
                    return api.fileUrl;
                }

                // If still processing, wait and retry
                if (api.percent && api.percent !== 'Completed') {
                    console.log('[YouTube] Processing:', api.percent);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempts++;
                    continue;
                }

                // If got a direct URL
                if (api.fileUrl && api.fileUrl.startsWith('http') && api.fileUrl !== 'In Processing...') {
                    return api.fileUrl;
                }
            }

            break;
        }
    } catch (e) {
        console.log('[YouTube] pollForDownloadUrl failed:', e.message);
    }

    return null;
}

/**
 * SSYouTube API fallback
 */
async function getSSYoutubeDownload(videoId) {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        const response = await axios.post('https://www.y2mate.com/mates/analyzeV2/ajax',
            `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://www.y2mate.com',
                    'Referer': 'https://www.y2mate.com/'
                }
            }
        );

        if (response.data && response.data.links) {
            const mp4Links = response.data.links.mp4 || {};
            const qualities = Object.keys(mp4Links);

            if (qualities.length > 0) {
                // Find 720p or best available
                const quality = qualities.find(q => q.includes('720')) || qualities[0];
                const link = mp4Links[quality];

                if (link && link.k) {
                    // Convert to get download URL
                    const convertResponse = await axios.post(
                        'https://www.y2mate.com/mates/convertV2/index',
                        `vid=${videoId}&k=${encodeURIComponent(link.k)}`,
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
                                quality: link.q || '720p',
                                url: convertResponse.data.dlink,
                                type: 'video',
                                format: 'mp4',
                                size: link.size || 'Unknown'
                            }],
                            quality: link.q || '720p'
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
 * Format file size
 */
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
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
