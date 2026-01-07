const fb = require('@mrnima/facebook-downloader');

/**
 * Get Facebook video info using @mrnima/facebook-downloader
 * This replaces the dependency on youtube-dl-exec
 */
async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video (mrnima):', url);

    try {
        const result = await fb.fbdl(url);

        if (!result || !result.status) {
            throw new Error('Could not extract Facebook video data');
        }

        // result usually contains { status: true, result: { title, thumbnail, hd, sd } }
        const data = result.result;

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

    } catch (error) {
        console.error('❌ Facebook Download Error:', error.message);

        if (error.message.includes('Private') || error.message.includes('login')) {
            throw new Error('This video is private. Please make sure the video is public.');
        }

        throw new Error(`Could not download this Facebook video. Please use a valid public link.`);
    }
}

module.exports = {
    getFacebookVideo
};
