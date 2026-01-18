const fs = require('fs');
const path = require('path');

class ComplianceService {
    constructor() {
        this.bannedPhrases = [
            // Medical / Health Claims (High Risk)
            "chữa khỏi", "trị dứt điểm", "cam kết hết", "thần thánh", "100% hiệu quả",
            "dứt hẳn", "sạch bong kin kít", "hết sạch mụn", "giảm cân cấp tốc",
            "guaranteed", "cure", "miracle", "100%",

            // False Urgency / Scams
            "tặng miễn phí", "chỉ hôm nay", "free money", "tiền mặt",

            // Platform Policy Violations
            "click ảo", "tăng view", "sub chéo", "hack like"
        ];

        this.restrictedCategories = [
            "thuốc kích dục", "vũ khí", "hàng cấm", "đánh bạc", "sex", "18+"
        ];
    }

    /**
     * Check text for policy violations
     * @param {string} text - The input text (script, caption, overlay)
     * @returns {Object} result - { valid: boolean, violations: string[], warnings: string[] }
     */
    checkContent(text) {
        if (!text) return { valid: true, violations: [], warnings: [] };

        const lowerText = text.toLowerCase();
        const violations = [];
        const warnings = [];

        // Check Hard Blocks
        for (const phrase of this.restrictedCategories) {
            if (lowerText.includes(phrase)) {
                violations.push(`Restricted category detected: "${phrase}"`);
            }
        }

        // Check Policy Violations
        for (const phrase of this.bannedPhrases) {
            if (lowerText.includes(phrase)) {
                // Context matters, but for safety we warn or block based on severity.
                // For "100%", it's often a violation in health niche.
                if (phrase === "100%") {
                    warnings.push(`Avoid absolute claims like "${phrase}". Use "hỗ trợ" or "giúp cải thiện" instead.`);
                } else {
                    violations.push(`Prohibited phrase detected: "${phrase}"`);
                }
            }
        }

        return {
            valid: violations.length === 0,
            violations,
            warnings
        };
    }

    /**
     * Sanitize text (replace bad words with safer alternatives)
     * @param {string} text 
     */
    suggestRepairs(text) {
        let repaired = text;
        const replacements = {
            "chữa khỏi": "hỗ trợ điều trị",
            "trị dứt điểm": "cải thiện rõ rệt",
            "cam kết": "đảm bảo chất lượng",
            "100%": "hiệu quả cao"
        };

        for (const [bad, good] of Object.entries(replacements)) {
            const regex = new RegExp(bad, 'gi');
            repaired = repaired.replace(regex, good);
        }
        return repaired;
    }
}

module.exports = new ComplianceService();
