const { YTDlp } = require('ytdlp-nodejs');

async function test() {
    const ytdlp = new YTDlp();
    const urls = [
        'https://www.facebook.com/reel/1083427499691163/'
    ];

    for (const url of urls) {
        console.log(`\n--- Testing ytdlp-nodejs: ${url} ---`);
        try {
            const info = await ytdlp.getVideoInfo(url);
            console.log('Result:', JSON.stringify(info, null, 2));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

test();
