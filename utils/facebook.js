const axios = require('axios');
const cheerio = require('cheerio');
const { YtDlp } = require('ytdlp-nodejs');

async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video info for:', url);

    // Method 1: Try yt-dlp (Most reliable for server environments)
    try {
        console.log('[Facebook] Attempting with yt-dlp...');
        const ytdlp = new YtDlp();
        const info = await ytdlp.getInfoAsync(url);

        if (info && (info.url || info.formats)) {
            console.log('✅ Got Facebook video via yt-dlp');
            return formatYtDlpResponse(info, url);
        }
    } catch (e) {
        console.log('[Facebook] yt-dlp failed:', e.message);
    }

    // Method 2: Scrape getfvid.com
    try {
        console.log('[Facebook] Attempting with GetFvid...');
        const result = await scrapeGetFvid(url);
        if (result && (result.hd || result.sd)) {
            console.log('✅ Got Facebook video via GetFvid');
            return formatFacebookResponse(result);
        }
    } catch (e) {
        console.log('[Facebook] GetFvid failed:', e.message);
    }

    // Method 3: Scrape fdown.net (formerly fbdown.net)
    try {
        console.log('[Facebook] Attempting with FDown...');
        const result = await scrapeFDown(url);
        if (result && (result.hd || result.sd)) {
            console.log('✅ Got Facebook video via FDown');
            return formatFacebookResponse(result);
        }
    } catch (e) {
        console.log('[Facebook] FDown failed:', e.message);
    }

    throw new Error('Không thể tải video Facebook. Video có thể là private, link không hợp lệ, hoặc server bị chặn.');
}

async function scrapeGetFvid(url) {
    try {
        const response = await axios.post('https://www.getfvid.com/downloader',
            `url=${encodeURIComponent(url)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.getfvid.com/'
                },
                timeout: 10000
            }
        );

        const $ = cheerio.load(response.data);
        const hd = $('a.btn-download-hd').attr('href');
        const sd = $('a.btn-download-sd').attr('href');
        const title = $('.card-title a').text() || 'Facebook Video';
        const thumbnail = $('.card-img-top').attr('src') || '';

        return { hd, sd, title, thumbnail };
    } catch (e) {
        throw new Error('GetFvid error: ' + e.message);
    }
}

async function scrapeFDown(url) {
    try {
        const response = await axios.post('https://fdown.net/download.php',
            `URLz=${encodeURIComponent(url)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://fdown.net/'
                },
                timeout: 10000
            }
        );

        const $ = cheerio.load(response.data);
        const sd = $('#sdlink').attr('href');
        const hd = $('#hdlink').attr('href');
        const title = $('.lib-row.lib-header').text().trim() || 'Facebook Video';
        const thumbnail = ''; // FDown doesn't usually afford easy access to thumbnail

        return { hd, sd, title, thumbnail };
    } catch (e) {
        throw new Error('FDown error: ' + e.message);
    }
}

function formatYtDlpResponse(info, url) {
    // Extract best video URLs
    let videoHD = '';
    let videoSD = '';

    // If ytdlp returns formats, try to find HD and SD
    if (info.formats && Array.isArray(info.formats)) {
        // Sort by quality (height)
        const sorted = info.formats.sort((a, b) => (b.height || 0) - (a.height || 0));

        // Best quality is HD
        videoHD = sorted[0].url;

        // Try to find something closer to SD (e.g. 360p - 480p)
        const sdFormat = sorted.find(f => f.height && f.height <= 480 && f.height >= 360);
        videoSD = sdFormat ? sdFormat.url : sorted[sorted.length - 1].url;
    } else if (info.url) {
        videoHD = info.url;
        videoSD = info.url;
    }

    return {
        id: info.id || Date.now().toString(),
        title: info.title || 'Facebook Video',
        platform: 'facebook',
        author: {
            username: info.uploader_id || 'facebook_user',
            nickname: info.uploader || 'Facebook User',
            avatar: ''
        },
        thumbnail: info.thumbnail || '',
        duration: info.duration || 0,
        videoUrl: videoHD || videoSD,
        videoNoWatermark: videoHD || videoSD,
        videoHD: videoHD,
        videoSD: videoSD,
        audioUrl: '',
        stats: {
            plays: info.view_count || 0,
            likes: info.like_count || 0,
            comments: info.comment_count || 0,
            shares: info.repost_count || 0
        }
    };
}

function formatFacebookResponse(data) {
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
        videoUrl: data.hd || data.sd,
        videoNoWatermark: data.hd || data.sd,
        videoHD: data.hd || '',
        videoSD: data.sd || '',
        audioUrl: '',
        stats: { plays: 0, likes: 0, comments: 0, shares: 0 }
    };
}

module.exports = {
    getFacebookVideo
};
