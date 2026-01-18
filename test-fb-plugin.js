const axios = require('axios');
const cheerio = require('cheerio');

async function testFBPlugin() {
    const url = 'https://www.facebook.com/reel/1083427499691163/';
    const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;

    console.log('🔍 Testing FB Plugin scraper:', pluginUrl);

    try {
        const response = await axios.get(pluginUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        const html = response.data;
        console.log('Got HTML, searching for video links...');

        // Search for hd_src or sd_src in the script tags
        const hdMatch = html.match(/"hd_src":"([^"]+)"/);
        const sdMatch = html.match(/"sd_src":"([^"]+)"/);

        if (hdMatch || sdMatch) {
            console.log('✅ Found links!');
            if (hdMatch) console.log('HD:', hdMatch[1].replace(/\\/g, ''));
            if (sdMatch) console.log('SD:', sdMatch[1].replace(/\\/g, ''));
        } else {
            console.log('❌ No links found in HTML.');
            // console.log(html.substring(0, 500)); // Sample
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testFBPlugin();
