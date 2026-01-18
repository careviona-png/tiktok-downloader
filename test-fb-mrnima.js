const { facebook } = require('@mrnima/facebook-downloader');

async function test() {
    const urls = [
        'https://www.facebook.com/reel/1083427499691163/'
    ];

    for (const url of urls) {
        console.log(`\n--- Testing @mrnima/facebook-downloader: ${url} ---`);
        try {
            const result = await facebook(url);
            console.log('Result:', JSON.stringify(result, null, 2));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

test();
