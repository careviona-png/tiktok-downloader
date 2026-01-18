const axios = require('axios');

async function testVytDlp() {
    const url = 'https://www.facebook.com/reel/1083427499691163/';
    console.log('🔍 Testing vyt-dlp API with FB URL:', url);

    try {
        const response = await axios.get(`https://api.vyt-dlp.com/facebook?url=${encodeURIComponent(url)}`, {
            timeout: 30000
        });

        console.log('Result:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testVytDlp();
