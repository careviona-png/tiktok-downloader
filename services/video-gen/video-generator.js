const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const shopeeExtractor = require('./shopee-extractor');
const templateManager = require('../template-manager');
const complianceService = require('../compliance');
const watermarkService = require('../watermark');

class VideoGenerator {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.outputDir = path.join(__dirname, '../../public/outputs');

        // Ensure dirs exist
        [this.tempDir, this.outputDir].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });
    }

    /**
     * Generate TTS Audio using Google Translate API (Unofficial)
     * @param {string} text 
     * @param {string} outputPath 
     */
    async generateAudio(text, outputPath) {
        if (!text) return null;
        // Chunk text if needed (Google limit is around 200 chars, but client=tw-ob allows more often).
        // For safety, we truncate or just try.
        const safeText = text.substring(0, 200);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=vi&client=tw-ob`;

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }

    /**
     * Download images locally
     * @param {string[]} urls 
     * @param {string} sessionDir 
     */
    async downloadImages(urls, sessionDir) {
        const paths = [];
        for (let i = 0; i < urls.length; i++) {
            // Valid image extensions only
            if (!urls[i].match(/\.(jpg|jpeg|png|webp)/i)) continue;

            const ext = path.extname(urls[i]) || '.jpg';
            const dest = path.join(sessionDir, `img_${i}${ext}`);

            try {
                const response = await axios({
                    url: urls[i],
                    responseType: 'stream',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://shopee.vn/'
                    }
                });
                const writer = fs.createWriteStream(dest);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                paths.push(dest);
            } catch (e) {
                console.error(`Failed to download image ${urls[i]}:`, e.message);
            }
        }
        return paths;
    }

    /**
     * Create slideshow video using FFMPEG
     * @param {string[]} imagePaths 
     * @param {string} audioPath 
     * @param {string} outputPath 
     */
    async renderVideo(imagePaths, audioPath, outputPath, sessionDir = null, options = {}) {
        if (imagePaths.length === 0) throw new Error('No images to render');

        let template = options.template || 'auto';
        let musicType = options.music || 'auto';

        // Auto Selection Logic
        if (template === 'auto') {
            const templates = ['minimal_zoom', 'dynamic_slide', 'fade_smooth', 'flash_sale'];
            template = templates[Math.floor(Math.random() * templates.length)];
            console.log(`[VideoGen] Auto-selected template: ${template}`);
        }

        if (musicType === 'auto') {
            const musics = ['upbeat_pop', 'chill_lofi', 'energetic_rock'];
            musicType = musics[Math.floor(Math.random() * musics.length)];
            console.log(`[VideoGen] Auto-selected music: ${musicType}`);
        }

        // Template Settings
        let durationPerImg = 4;
        if (template === 'flash_sale') durationPerImg = 2;
        if (template === 'dynamic_slide') durationPerImg = 3;

        const fps = 30;
        const frames = durationPerImg * fps;
        const tempDir = sessionDir || path.dirname(outputPath);

        // Music Handling
        let musicPath = null;
        if (musicType !== 'none') {
            const musicUrls = {
                'upbeat_pop': 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Key_MacLeod/Oddities/Kevin_MacLeod_-_Winner_Winner.mp3',
                'chill_lofi': 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Kevin_MacLeod/Link/Kevin_MacLeod_-_Lobby_Time.mp3',
                'energetic_rock': 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Kevin_MacLeod/Oddities/Kevin_MacLeod_-_Dispersion_Relation.mp3'
            };
            const targetUrl = musicUrls[musicType];
            if (targetUrl) {
                try {
                    console.log(`[VideoGen] Downloading music: ${musicType}`);
                    const musicDest = path.join(tempDir, 'bg_music.mp3');
                    const response = await axios({ url: targetUrl, responseType: 'stream', timeout: 30000 });
                    const writer = fs.createWriteStream(musicDest);
                    response.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                    musicPath = musicDest;
                } catch (e) {
                    console.error('[VideoGen] Failed to download music, skipping:', e.message);
                }
            }
        }

        return new Promise((resolve, reject) => {
            let inputs = "";
            let filter = "";
            let maps = "";

            // Effect Logic
            const kenBurnsEffects = [
                `zoompan=z='min(zoom+0.001,1.3)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920`,
                `zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920`,
                `zoompan=z='1.15':d=${frames}:x='if(lte(on,1),0,x+1)':y='ih/2-(ih/zoom/2)':s=1080x1920`,
                `zoompan=z='1.15':d=${frames}:x='if(lte(on,1),iw,x-1)':y='ih/2-(ih/zoom/2)':s=1080x1920`
            ];

            imagePaths.forEach((imgPath, idx) => {
                inputs += `-loop 1 -t ${durationPerImg} -i "${imgPath}" `;

                let effect = "";
                if (template === 'minimal_zoom') {
                    effect = kenBurnsEffects[idx % 2]; // Zoom in/out only
                } else if (template === 'dynamic_slide') {
                    effect = kenBurnsEffects[2 + (idx % 2)]; // Slide only
                } else if (template === 'flash_sale') {
                    effect = `zoompan=z='min(zoom+0.005,1.5)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920`; // Fast zoom
                } else {
                    // fade_smooth or others -> cycle all
                    effect = kenBurnsEffects[idx % kenBurnsEffects.length];
                }

                filter += `[${idx}:v]${effect},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p[v${idx}];`;
                maps += `[v${idx}]`;
            });

            filter += `${maps}concat=n=${imagePaths.length}:v=1:a=0[vout];`;

            // Audio Mixing
            const audioIdx = imagePaths.length;
            inputs += `-i "${audioPath}" `; // TTS Audio

            let audioMap = `${audioIdx}:a`;
            let audioFilter = "";

            if (musicPath) {
                const musicIdx = audioIdx + 1;
                inputs += `-i "${musicPath}" `;
                // Normalize TTS (1.0) and Music (0.15 background)
                audioFilter = `[${audioIdx}:a]volume=1.0[a1];[${musicIdx}:a]volume=0.15[a2];[a1][a2]amix=inputs=2:duration=first[aout]`;
                filter += audioFilter;
                audioMap = "[aout]";
            } else {
                // Just TTS
                audioMap = `${audioIdx}:a`;
                // Remove trailing semicolon from filter if no audio filter added? 
                // Actually filter variable ends with ; from concat. 
                // We need to be careful with semicolon.
            }

            // Clean up filter string trailing semicolon if no audio filter
            if (!musicPath && filter.endsWith(';')) {
                filter = filter.slice(0, -1);
            }

            const cmd = `ffmpeg ${inputs} -filter_complex "${filter}" -map "[vout]" -map ${audioMap} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}" -y`;

            console.log(`[VideoGen] Rendering with template: ${template}, music: ${musicType}...`);
            // console.log('[VideoGen] Command:', cmd); 

            exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                    console.error('[VideoGen] FFMPEG Error:', err.message);
                    console.error('[VideoGen] STDERR:', stderr);
                    reject(err);
                } else {
                    console.log('[VideoGen] Render complete!');
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Step 1: Extract Data & Prepare Draft (No Rendering)
     * @param {string} productUrl 
     * @param {string} variant 
     */
    async prepareDraft(productUrl, variant = 'A') {
        const jobId = Date.now().toString(); // Use string ID
        const sessionDir = path.join(this.tempDir, `draft_${jobId}`);
        fs.mkdirSync(sessionDir, { recursive: true });

        try {
            // 1. Extract Data
            console.log(`[Draft ${jobId}] Extracting data...`);
            const data = await shopeeExtractor.extract(productUrl);

            // 2. Compliance Check
            const check = complianceService.checkContent(data.title);
            // In draft mode, we allow violations but mark them as warnings
            // or we still throw? Master prompt says "Soft Warning". 
            // So we return the warnings in the draft.

            // 3. Generate Script
            const scriptStructure = templateManager.generateScriptStructure(data.title);
            const fullScript = `${scriptStructure.hook} ${scriptStructure.benefit1} ${scriptStructure.benefit2} ${scriptStructure.cta}`;

            // 4. Download Images (Pre-download for preview? Or just return URLs?)
            // Better to download now so we know they work.
            const localImages = await this.downloadImages(data.images, sessionDir);

            const draft = {
                id: jobId,
                url: productUrl,
                title: data.title,
                price: data.price,
                variant: variant,
                script: fullScript,
                images: localImages, // Absolute paths
                compliance: check,
                status: 'DRAFT',
                timestamp: new Date().toISOString()
            };

            // Save draft to disk
            fs.writeFileSync(path.join(sessionDir, 'draft.json'), JSON.stringify(draft, null, 2));
            return draft;

        } catch (error) {
            console.error(`[Draft ${jobId}] Failed:`, error);
            // Cleanup
            // fs.rmSync(sessionDir, { recursive: true, force: true });
            throw error;
        }
    }

    /**
     * Step 2: Render Video from Draft
     * @param {string} draftId 
     * @param {Object} options - { script: string, selectedImages: string[] }
     */
    async renderFromDraft(draftId, options = {}) {
        const sessionDir = path.join(this.tempDir, `draft_${draftId}`);
        const draftPath = path.join(sessionDir, 'draft.json');

        if (!fs.existsSync(draftPath)) {
            throw new Error('Draft expired or not found.');
        }

        const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

        // Override with user edits
        const finalScript = options.script || draft.script;
        const validImages = options.selectedImages || draft.images;

        if (!finalScript) throw new Error('Script is empty');
        if (!validImages || validImages.length === 0) throw new Error('No images selected');

        try {
            console.log(`[Render ${draftId}] Generating Audio/Video...`);

            // 1. Ensure selected images are local files (download if remote URL)
            console.log(`[Render ${draftId}] Processing ${validImages.length} media files...`);
            const localMediaPaths = [];
            for (let i = 0; i < validImages.length; i++) {
                const media = validImages[i];

                // Check if it's a remote URL
                if (media.startsWith('http://') || media.startsWith('https://')) {
                    console.log(`[Render ${draftId}] Downloading: ${media.substring(0, 50)}...`);
                    const ext = media.includes('.mp4') ? '.mp4' : '.jpg';
                    const localPath = path.join(sessionDir, `media_${i}${ext}`);

                    try {
                        const response = await axios({
                            url: media,
                            responseType: 'stream',
                            timeout: 30000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });
                        const writer = fs.createWriteStream(localPath);
                        response.data.pipe(writer);
                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });
                        localMediaPaths.push(localPath);
                    } catch (dlErr) {
                        console.error(`[Render] Failed to download ${media}:`, dlErr.message);
                        // Skip this file
                    }
                } else {
                    // Already a local path
                    if (fs.existsSync(media)) {
                        localMediaPaths.push(media);
                    } else {
                        console.warn(`[Render] Local file not found: ${media}`);
                    }
                }
            }

            if (localMediaPaths.length === 0) {
                throw new Error('No valid media files after download');
            }

            console.log(`[Render ${draftId}] ${localMediaPaths.length} files ready for rendering`);

            // 2. Generate Audio
            const audioPath = path.join(sessionDir, 'audio.mp3');
            await this.generateAudio(finalScript, audioPath);

            // 3. Render Video (using local paths only)
            const rawVideoPath = path.join(sessionDir, 'raw.mp4');
            await this.renderVideo(localMediaPaths, audioPath, rawVideoPath, sessionDir, {
                template: options.template,
                music: options.music
            });

            // 3. Watermark
            // Get disclosure settings
            const settings = require('../settings-manager').getSettings();

            // Only add disclosure if enabled
            const disclosureText = settings.showDisclosure ? settings.disclosureText : "";
            const watermarkText = settings.watermarkText || "TikDown Auto";

            const finalPath = await watermarkService.addWatermark(rawVideoPath, watermarkText, disclosureText);

            // 4. Move to Public
            const publicPath = path.join(this.outputDir, `video_${draftId}.mp4`);
            fs.renameSync(finalPath, publicPath);

            // 5. Update Metadata
            const meta = {
                id: draftId,
                product: draft.title,
                script: finalScript,
                file: `/outputs/video_${draftId}.mp4`,
                timestamp: new Date().toISOString(),
                variant: draft.variant
            };
            fs.writeFileSync(path.join(this.outputDir, `video_${draftId}.json`), JSON.stringify(meta, null, 2));

            // Cleanup draft folder? Maybe keep for debug, or clean up images. 
            // For now keep.

            return meta;

        } catch (error) {
            console.error(`[Render ${draftId}] Failed:`, error);
            throw error;
        }
    }
}

module.exports = new VideoGenerator();
