const { getFacebookVideo } = require('./utils/facebook');

async function test() {
    const urls = [
        'https://www.facebook.com/watch/?v=123456789', // Dummy
        'https://fb.watch/qR_xZ9z3_P/', // Example short link
        'https://www.facebook.com/reel/1083427499691163/' // Example Reel
    ];

    for (const url of urls) {
        console.log(`\n--- Testing: ${url} ---`);
        try {
            const result = await getFacebookVideo(url);
            console.log('Result:', JSON.stringify(result, null, 2));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

test();
