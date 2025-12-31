const axios = require('axios');

/**
 * Get TikTok video without watermark using free public API
 * @param {string} url - TikTok video URL
 * @returns {Promise<Object>} Video data
 */
async function getTikTokVideo(url) {
    try {
        console.log('🔍 Fetching TikTok video:', url);

        // Use free public TikTok downloader API
        const response = await axios.post('https://www.tikwm.com/api/', {
            url: url,
            count: 12,
            cursor: 0,
            web: 1,
            hd: 1
        });

        console.log('✅ Response received');

        if (!response.data || response.data.code !== 0) {
            console.error('❌ API Error:', response.data);
            throw new Error('Video not found or unavailable');
        }

        const data = response.data.data;
        console.log('📹 Video found:', data.title || 'TikTok Video');

        // Helper function to convert relative URLs to absolute
        const makeAbsoluteUrl = (path) => {
            if (!path) return '';
            if (path.startsWith('http')) return path;
            return `https://tikwm.com${path}`;
        };

        // Extract video data
        const videoData = {
            id: data.id || data.aweme_id || '',
            title: data.title || 'TikTok Video',
            author: {
                username: data.author?.unique_id || 'Unknown',
                nickname: data.author?.nickname || 'Unknown',
                avatar: makeAbsoluteUrl(data.author?.avatar || '')
            },
            thumbnail: makeAbsoluteUrl(data.cover || data.origin_cover || ''),
            duration: data.duration || 0,

            // Download URLs - convert relative paths to absolute
            videoUrl: makeAbsoluteUrl(data.play || data.wmplay || ''),
            videoNoWatermark: makeAbsoluteUrl(data.hdplay || data.play || ''),

            // Audio
            audioUrl: makeAbsoluteUrl(data.music || data.music_info?.play || ''),

            // Stats
            stats: {
                plays: data.play_count || 0,
                likes: data.digg_count || 0,
                comments: data.comment_count || 0,
                shares: data.share_count || 0
            }
        };

        console.log('✅ Video ready!');
        console.log('Title:', videoData.title);
        console.log('Author:', videoData.author.username);
        console.log('Video URL:', videoData.videoNoWatermark);
        console.log('Audio URL:', videoData.audioUrl);
        console.log('Has video URL:', !!videoData.videoNoWatermark);
        console.log('Has audio URL:', !!videoData.audioUrl);

        // Log raw audio data for debugging
        console.log('Raw audio field from API:', data.music);
        console.log('Raw music_info from API:', data.music_info);

        return videoData;

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }

        throw new Error(`Failed to fetch video: ${error.message}`);
    }
}

module.exports = {
    getTikTokVideo
};
