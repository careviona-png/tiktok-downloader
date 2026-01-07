const ytdl = require('ytdl-core');

/**
 * Extract YouTube video/shorts information using ytdl-core
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} - Video metadata
 */
async function getYoutubeInfo(url) {
    try {
        // Get basic info
        const info = await ytdl.getInfo(url);

        if (!info || !info.videoDetails) {
            throw new Error('Could not extract video data');
        }

        const details = info.videoDetails;

        // Find best format with both video and audio
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoandaudio' })
            || info.formats.find(f => f.hasVideo && f.hasAudio)
            || info.formats[0];

        return {
            title: details.title,
            thumbnail: details.thumbnails && details.thumbnails.length > 0 ? details.thumbnails[details.thumbnails.length - 1].url : '',
            duration: new Date(details.lengthSeconds * 1000).toISOString().substr(14, 5),
            author: details.author.name,
            views: details.viewCount,
            downloadUrl: format ? format.url : null,
            quality: format ? (format.qualityLabel || '720p') : 'HD',
            source: 'YouTube'
        };
    } catch (error) {
        console.error('Error in getYoutubeInfo (ytdl-core):', error.message);
        throw new Error('Không thể lấy thông tin video YouTube. Vui lòng kiểm tra lại URL hoặc thử lại sau.');
    }
}

module.exports = {
    getYoutubeInfo
};
