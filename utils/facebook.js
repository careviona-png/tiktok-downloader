const youtubedl = require('youtube-dl-exec');

/**
 * Get Facebook video info using yt-dlp (youtube-dl-exec)
 * This is the most reliable method for extracting video URLs
 */
async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video:', url);

    try {
        // Use yt-dlp to extract video info
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:https://www.facebook.com/',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        console.log('✅ yt-dlp extraction successful!');

        // Find best quality formats
        let videoHD = '', videoSD = '';

        if (output.formats && output.formats.length > 0) {
            // Sort by quality (height)
            const videoFormats = output.formats
                .filter(f => f.vcodec !== 'none' && f.ext === 'mp4')
                .sort((a, b) => (b.height || 0) - (a.height || 0));

            if (videoFormats.length > 0) {
                videoHD = videoFormats[0].url;
                videoSD = videoFormats[videoFormats.length - 1].url || videoHD;
            }
        }

        // Fallback to direct URL if available
        if (!videoHD && output.url) {
            videoHD = output.url;
            videoSD = output.url;
        }

        if (!videoHD && !videoSD) {
            throw new Error('No video URL found in extraction result');
        }

        return {
            id: output.id || Date.now().toString(),
            title: output.title || 'Facebook Video',
            platform: 'facebook',
            author: {
                username: output.uploader || 'facebook_user',
                nickname: output.uploader || 'Facebook User',
                avatar: ''
            },
            thumbnail: output.thumbnail || '',
            duration: output.duration || 0,
            videoUrl: videoSD || videoHD,
            videoNoWatermark: videoHD || videoSD,
            videoHD: videoHD,
            videoSD: videoSD,
            audioUrl: '',
            stats: {
                plays: output.view_count || 0,
                likes: output.like_count || 0,
                comments: output.comment_count || 0,
                shares: 0
            }
        };

    } catch (error) {
        console.error('❌ yt-dlp Error:', error.message);

        // Provide helpful error message
        if (error.message.includes('Private video') || error.message.includes('login')) {
            throw new Error('This video is private. Please make sure the video is public.');
        }
        if (error.message.includes('not supported') || error.message.includes('Unsupported URL')) {
            throw new Error('This URL is not supported. Please use a valid Facebook video link.');
        }

        throw new Error(`Could not download this video: ${error.message}`);
    }
}

module.exports = {
    getFacebookVideo
};
