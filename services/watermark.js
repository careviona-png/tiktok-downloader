const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class WatermarkService {
    /**
     * Add watermark and disclosure to video using FFMPEG
     * @param {string} inputVideoPath 
     * @param {string} text 
     * @param {string} disclosureText 
     * @returns {Promise<string>} Path to output video
     */
    async addWatermark(inputVideoPath, text = "TikDown Automation", disclosureText = "") {
        const outputDir = path.join(path.dirname(inputVideoPath), 'watermarked');
        const filename = path.basename(inputVideoPath, path.extname(inputVideoPath)) + '_wm' + path.extname(inputVideoPath);
        const outputPath = path.join(outputDir, filename);

        // Ensure output dir exists
        try {
            await fs.mkdir(outputDir, { recursive: true });
        } catch (e) { }

        return new Promise((resolve, reject) => {
            // Note: Escaping special chars in text is crucial but simplified here.
            const safeText = text.replace(/:/g, '\\:').replace(/'/g, '');
            const safeDisclosure = disclosureText ? disclosureText.replace(/:/g, '\\:').replace(/'/g, '') : "";

            // 1. Brand Watermark: Bottom Right (x=w-tw-20, y=h-th-20)
            let vf = `drawtext=text='${safeText}':fontcolor=white:fontsize=24:x=w-tw-20:y=h-th-20:box=1:boxcolor=black@0.5:boxborderw=5`;

            // 2. Disclosure: Bottom Center (x=(w-text_w)/2, y=h-th-10) - Smaller font
            if (safeDisclosure) {
                // Using 18px font for disclosure, centered at bottom
                vf += `,drawtext=text='${safeDisclosure}':fontcolor=white:fontsize=16:x=(w-text_w)/2:y=h-text_h-10:box=1:boxcolor=black@0.5:boxborderw=2`;
            }

            const cmd = `ffmpeg -i "${inputVideoPath}" -vf "${vf}" -c:a copy "${outputPath}" -y`;

            console.log(`[Watermark] Processing: ${inputVideoPath}`);
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[Watermark] Error: ${error.message}`);
                    reject(error);
                    return;
                }
                console.log(`[Watermark] Done: ${outputPath}`);
                resolve(outputPath);
            });
        });
    }
}

module.exports = new WatermarkService();
