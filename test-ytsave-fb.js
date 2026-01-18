const axios = require('axios');

async function testYTSaveWithFB() {
    const url = 'https://www.facebook.com/reel/1083427499691163/';
    console.log('🔍 Testing YTSave with FB URL:', url);

    try {
        const response = await axios.post('https://ytsave.to/proxy.php',
            `url=${encodeURIComponent(url)}`,
            {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://ytsave.to/vi2/',
                    'Origin': 'https://ytsave.to'
                }
            }
        );

        console.log('Result:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testYTSaveWithFB();
