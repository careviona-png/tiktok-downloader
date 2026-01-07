const { spawn } = require('child_process');
const axios = require('axios');

/**
 * Extract YouTube video/shorts information using yt-dlp binary
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

    try {
        // Use yt-dlp to get video info
        const info = await getYtdlpInfo(url);

        if (info && info.title) {
            console.log('[YouTube] Got info via yt-dlp:', info.title);
            return formatResponse(info, videoId, url);
        }
    } catch (e) {
        console.log('[YouTube] yt-dlp failed:', e.message);
    }

    // Fallback to oEmbed for basic metadata
    try {
        const oembedData = await getVideoInfoOEmbed(url, videoId);
        console.log('[YouTube] Got metadata via oEmbed (no download URL)');
        return formatResponse(oembedData || {}, videoId, url);
    } catch (e) {
        console.log('[YouTube] oEmbed failed:', e.message);
    }

    // Return basic info with thumbnail
    return formatResponse({
        title: 'YouTube Video',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        author: 'Unknown'
    }, videoId, url);
}

/**
 * Get video info using yt-dlp binary
 */
function getYtdlpInfo(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            '-f', 'best[ext=mp4]/best',
            url
        ];

        console.log('[YouTube] Running yt-dlp with args:', args.join(' '));

        const ytdlp = spawn('yt-dlp', args, {
            timeout: 60000 // 60 second timeout
        });

        let stdout = '';
        let stderr = '';

        ytdlp.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytdlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code === 0 && stdout) {
                try {
                    const info = JSON.parse(stdout);

                    // Build download options from formats
                    const downloadOptions = [];
                    const formats = info.formats || [];

                    // Find combined formats (video + audio)
                    const combinedFormats = formats.filter(f =>
                        f.vcodec && f.vcodec !== 'none' &&
                        f.acodec && f.acodec !== 'none' &&
                        f.url
                    ).sort((a, b) => (b.height || 0) - (a.height || 0));

                    // Add unique qualities
                    const addedQualities = new Set();
                    combinedFormats.forEach(f => {
                        const quality = f.height ? `${f.height}p` : 'Auto';
                        if (!addedQualities.has(quality) && downloadOptions.length < 3) {
                            addedQualities.add(quality);
                            downloadOptions.push({
                                quality: quality,
                                url: f.url,
                                type: 'video',
                                format: f.ext || 'mp4',
                                size: f.filesize ? formatBytes(f.filesize) : 'Unknown'
                            });
                        }
                    });

                    // Find audio formats
                    const audioFormats = formats.filter(f =>
                        f.acodec && f.acodec !== 'none' &&
                        (!f.vcodec || f.vcodec === 'none') &&
                        f.url
                    ).sort((a, b) => (b.abr || 0) - (a.abr || 0));

                    if (audioFormats.length > 0) {
                        const bestAudio = audioFormats[0];
                        downloadOptions.push({
                            quality: bestAudio.abr ? `${Math.round(bestAudio.abr)}kbps` : 'Best',
                            url: bestAudio.url,
                            type: 'audio',
                            format: bestAudio.ext || 'm4a',
                            size: bestAudio.filesize ? formatBytes(bestAudio.filesize) : 'Unknown'
                        });
                    }

                    // Get best download URL
                    const bestFormat = combinedFormats[0];

                    resolve({
                        title: info.title,
                        author: info.uploader || info.channel,
                        thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/maxresdefault.jpg`,
                        duration: formatDuration(info.duration),
                        views: formatViews(info.view_count),
                        downloadUrl: bestFormat ? bestFormat.url : info.url,
                        downloadOptions: downloadOptions,
                        quality: bestFormat ? (bestFormat.height ? `${bestFormat.height}p` : 'HD') : 'HD'
                    });
                } catch (parseError) {
                    reject(new Error('Failed to parse yt-dlp output'));
                }
            } else {
                console.log('[YouTube] yt-dlp stderr:', stderr);
                reject(new Error(stderr || 'yt-dlp failed with code ' + code));
            }
        });

        ytdlp.on('error', (err) => {
            console.log('[YouTube] yt-dlp spawn error:', err.message);
            reject(err);
        });
    });
}

/**
 * Get video info via oEmbed API (fallback for metadata only)
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

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = {
    getYoutubeInfo,
    extractVideoId
};
