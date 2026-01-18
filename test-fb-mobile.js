const axios = require('axios');

async function testMobileScrape() {
    const url = 'https://www.facebook.com/reel/1083427499691163/';
    const mobileUrl = url.replace('www.', 'm.');

    console.log('🔍 Testing Mobile Scraper:', mobileUrl);

    try {
        const response = await axios.get(mobileUrl, {
            headers: {
                // Mobile User-Agent to trick Facebook into serving mobile site
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        const html = response.data;
        console.log('Got HTML, searching for video links...');

        // Search for <video src="..."> or HD/SD sources in JSON/JS
        const videoSrcMatch = html.match(/video src="([^"]+)"/);
        const hdSourceMatch = html.match(/"hd_src":"([^"]+)"/);
        const sdSourceMatch = html.match(/"sd_src":"([^"]+)"/);

        if (videoSrcMatch || hdSourceMatch || sdSourceMatch) {
            console.log('✅ Found links!');
            if (videoSrcMatch) console.log('Direct Src:', videoSrcMatch[1].replace(/&amp;/g, '&'));
            if (hdSourceMatch) console.log('HD:', hdSourceMatch[1].replace(/\\/g, '').replace(/&amp;/g, '&'));
            if (sdSourceMatch) console.log('SD:', sdSourceMatch[1].replace(/\\/g, '').replace(/&amp;/g, '&'));
        } else {
            console.log('❌ No links found in Mobile HTML.');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testMobileScrape();
