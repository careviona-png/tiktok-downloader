const fs = require('fs');
const path = require('path');

class TemplateManager {
    constructor() {
        this.templatesPath = path.join(__dirname, '../data/templates.json');
        this.templates = {};
        this.loadTemplates();
    }

    loadTemplates() {
        try {
            if (fs.existsSync(this.templatesPath)) {
                this.templates = JSON.parse(fs.readFileSync(this.templatesPath, 'utf8'));
            } else {
                console.warn('[TemplateManager] Templates file not found, using empty default.');
            }
        } catch (error) {
            console.error('[TemplateManager] Error loading templates:', error);
        }
    }

    /**
     * Detect category based on text content
     * @param {string} text - Product title or description
     * @returns {string} - Category key (beauty, fashion, etc.)
     */
    detectCategory(text) {
        if (!text) return 'general';
        const lowerText = text.toLowerCase();

        for (const [category, data] of Object.entries(this.templates)) {
            if (category === 'general') continue;
            if (data.keywords && data.keywords.some(k => lowerText.includes(k))) {
                return category;
            }
        }
        return 'general';
    }

    /**
     * Get a random template component
     * @param {string} category 
     * @param {string} type - 'hooks', 'benefits', 'proofs'
     */
    getRandom(category, type) {
        const catData = this.templates[category] || this.templates['general'];
        const items = catData[type] || this.templates['general'][type] || [];
        if (items.length === 0) return "";
        return items[Math.floor(Math.random() * items.length)];
    }

    /**
     * Get full script structure for a product
     * @param {string} title 
     * @returns {Object} - Script components
     */
    generateScriptStructure(title, categoryOverride = null) {
        const category = categoryOverride || this.detectCategory(title);
        const catData = this.templates[category] || this.templates['general'];

        return {
            category: category,
            hook: this.getRandom(category, 'hooks'),
            benefit1: this.getRandom(category, 'benefits'),
            benefit2: this.getRandom(category, 'benefits'), // Can refine to pick unique
            proof: this.getRandom(category, 'proofs'),
            cta: catData.ctas ? catData.ctas.medium : "Link trong bio nha.",
            hashtags: catData.hashtags || []
        };
    }
}

module.exports = new TemplateManager();
