const youtubedl = require('youtube-dl-exec');
const path = require('path');

/**
 * Extract YouTube video/shorts information
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} - Video metadata
 */
async function getYoutubeInfo(url) {
    try {
        // We use youtube-dl-exec to get metadata without downloading
        // We only fetch information for now
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        if (!output) {
            throw new Error('Could not extract video data');
        }

        // Parse relevant formats
        // We look for progressive formats (video + audio) first, then best adaptive
        const videoTitle = output.title || 'YouTube Short';
        const thumbnail = output.thumbnail || (output.thumbnails && output.thumbnails.length > 0 ? output.thumbnails[output.thumbnails.length - 1].url : '');

        // Find best MP4 format if possible
        const formats = output.formats || [];
        const mp4Format = formats.find(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none') || formats[formats.length - 1];

        return {
            title: videoTitle,
            thumbnail: thumbnail,
            duration: output.duration_string || `${Math.floor(output.duration / 60)}:${output.duration % 60}`,
            author: output.uploader || output.channel,
            views: output.view_count,
            downloadUrl: mp4Format ? mp4Format.url : null,
            quality: mp4Format ? (mp4Format.resolution || mp4Format.format_note) : 'HD',
            source: 'YouTube'
        };
    } catch (error) {
        console.error('Error in getYoutubeInfo:', error.message);
        throw new Error('Không thể lấy thông tin video YouTube. Vui lòng kiểm tra lại URL.');
    }
}

module.exports = {
    getYoutubeInfo
};
