/**
 * Caption & Hashtag Generator - Utility Module
 * Provides viral caption templates and hashtags for different niches
 */

const CAPTION_TEMPLATES = {
    trending: [
        "Cái kết thật bất ngờ 😱 {topic} #viral #trend",
        "Bạn đã biết điều này chưa? ✨ {topic} #kienthuc #thuvi",
        "Xem đến cuối để thấy bất ngờ nhé! 🔥 {topic} #xuhuong #fyp",
        "Tag ngay người bạn cần xem cái này 😂 {topic} #haihuoc #funny",
        "Đừng bỏ qua khoảnh khắc này! 💎 {topic} #hot #trending"
    ],
    mmo: [
        "Cách kiếm 500k/ngày cực đơn giản 💸 {topic} #mmo #kiemtienonline",
        "Bí mật mà người giàu không nói cho bạn 🤫 {topic} #taichinh #dautu",
        "App kiếm tiền uy tín nhất 2025 🚀 {topic} #kiemtien #online",
        "Hướng dẫn chi tiết từ A-Z cho người mới 📚 {topic} #tutorial #mmo",
        "Vốn 0 đồng vẫn có thể làm được! 💡 {topic} #affiliate #marketing"
    ],
    review: [
        "Review chân thực nhất về {topic} ⭐ #review #danhgia",
        "Món đồ này có thực sự thần thánh như lời đồn? 🤔 {topic} #unbox #review",
        "Mua hay không mua? Xem hết video nhé! ✨ {topic} #shopping #review",
        "Top 3 món đồ không thể thiếu mùa hè này ☀️ {topic} #recommedation #review",
        "Sốc với chất lượng của sản phẩm này 😲 {topic} #gadget #review"
    ],
    motivation: [
        "Thay đổi tư duy, thay đổi cuộc đời ✨ {topic} #dongluc #thanhcong",
        "Đừng bỏ cuộc, thành công đang đợi bạn 🌟 {topic} #motivation #phattrienbanthan",
        "Bài học quý giá từ người thành công 🎓 {topic} #vươntới #thanhcong",
        "Khởi đầu ngay hôm nay, đừng chần chừ! 🚀 {topic} #action #motivation",
        "Năng lượng tích cực cho ngày mới 🌈 {topic} #positive #life"
    ]
};

const HASHTAG_SETS = {
    general: ["#viral", "#trending", "#xuhuong", "#fyp", "#tiktok", "#reels", "#shorts"],
    mmo: ["#kiemtienonline", "#mmo", "#affiliatemarketing", "#dropshipping", "#kinhdoanh", "#taichinh", "#passiveincome"],
    vlog: ["#dailyvlog", "#cuocsong", "#family", "#travel", "#foodie", "#lifestyle", "#beauty"],
    tech: ["#congnghe", "#gadgets", "#setup", "#pcgaming", "#apple", "#android", "#reviewcongnghe"],
    motivation: ["#dongluc", "#thanhcong", "#phattrienbanthan", "#quotes", "#tuduymoi", "#nangluong"],
    funny: ["#haihuoc", "#funny", "#cuoidieu", "#giaitru", "#trend", "#memes"]
};

/**
 * Generate viral captions and hashtags based on topic and niche
 */
function generateViralContent(topic, niche = 'trending') {
    const templates = CAPTION_TEMPLATES[niche] || CAPTION_TEMPLATES.trending;
    const hashtags = HASHTAG_SETS[niche] || HASHTAG_SETS.general;

    // Generate 5 different results
    const results = templates.map(template => {
        const caption = template.replace('{topic}', topic || '');
        // Mix in some random hashtags from the niche and general set
        const selectedHashtags = [
            ...hashtags.slice(0, 3),
            ...HASHTAG_SETS.general.sort(() => 0.5 - Math.random()).slice(0, 2)
        ];

        // Check for compliance
        const compliance = require('../services/compliance');
        let cleanCaption = caption.split('#')[0].trim();

        const scanResult = compliance.scanText(cleanCaption);
        if (scanResult.status === 'BLOCK') {
            cleanCaption = "[Nội dung đã bị chặn do vi phạm chính sách]";
        }

        // Add Mandatory Disclosure
        const disclosureText = "\n\n*Lưu ý: Link có thể là affiliate. Mình có thể nhận hoa hồng nếu bạn mua qua link, không tăng giá.*";

        return {
            caption: cleanCaption,
            hashtags: [...new Set([...caption.matchAll(/#\w+/g)].map(m => m[0]).concat(selectedHashtags))].join(' '),
            fullText: `${cleanCaption}${disclosureText} ${[...new Set([...caption.matchAll(/#\w+/g)].map(m => m[0]).concat(selectedHashtags))].join(' ')}`,
            compliance: scanResult
        };
    });

    return results;
}

/**
 * Get available niches
 */
function getNiches() {
    return Object.keys(CAPTION_TEMPLATES).map(key => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1)
    }));
}

module.exports = {
    generateViralContent,
    getNiches,
    CAPTION_TEMPLATES,
    HASHTAG_SETS
};
