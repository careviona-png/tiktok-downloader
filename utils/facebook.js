const axios = require('axios');
const cheerio = require('cheerio');

async function getFacebookVideo(url) {
    console.log('🔍 Fetching Facebook video info for:', url);

    // Method 1: Scrape getfvid.com
    try {
        const result = await scrapeGetFvid(url);
        if (result && (result.hd || result.sd)) {
            console.log('✅ Got Facebook video via GetFvid');
            return formatFacebookResponse(result);
        }
    } catch (e) {
        console.log('[Facebook] GetFvid failed:', e.message);
    }

    // Method 2: Scrape fdown.net (formerly fbdown.net)
    try {
        const result = await scrapeFDown(url);
        if (result && (result.hd || result.sd)) {
            console.log('✅ Got Facebook video via FDown');
            return formatFacebookResponse(result);
        }
    } catch (e) {
        console.log('[Facebook] FDown failed:', e.message);
    }

    throw new Error('Không thể tải video Facebook. Video có thể là private hoặc link không hợp lệ.');
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
                }
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
                }
            }
        );

        const $ = cheerio.load(response.data);
        const sd = $('#sdlink').attr('href');
        const hd = $('#hdlink').attr('href');
        const title = $('.lib-row.lib-header').text().trim() || 'Facebook Video';

        return { hd, sd, title, thumbnail: '' };
    } catch (e) {
        throw new Error('FDown error: ' + e.message);
    }
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
