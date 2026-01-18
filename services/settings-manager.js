const fs = require('fs');
const path = require('path');

class SettingsManager {
    constructor() {
        this.settingsPath = path.join(__dirname, '../data/settings.json');
        this.defaultSettings = {
            watermarkText: "TikDown Auto",
            showDisclosure: true,
            disclosureText: "*Lưu ý: Link có thể là affiliate. Mình có thể nhận hoa hồng nếu bạn mua qua link.",
            watermarkPosition: "bottom-right",
            runwayApiKey: "",
            pexelsApiKey: "",
            veedApiKey: ""
        };
        // Ensure data dir
        const dataDir = path.dirname(this.settingsPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    }

    getSettings() {
        if (!fs.existsSync(this.settingsPath)) {
            return this.defaultSettings;
        }
        try {
            const current = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
            return { ...this.defaultSettings, ...current };
        } catch (e) {
            return this.defaultSettings;
        }
    }

    saveSettings(newSettings) {
        const current = this.getSettings();
        const updated = { ...current, ...newSettings };
        fs.writeFileSync(this.settingsPath, JSON.stringify(updated, null, 2));
        return updated;
    }
}

module.exports = new SettingsManager();
