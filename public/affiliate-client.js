async function startGeneration() {
    const urlInput = document.getElementById('shopeeUrl');
    const statusText = document.getElementById('statusText');

    const url = urlInput.value.trim();
    if (!url) {
        alert('Vui lòng nhập link Shopee!');
        return;
    }

    // Open Modal & Show Loading
    const modal = document.getElementById('previewModal');
    const draftLoading = document.getElementById('draftLoading');
    const draftContent = document.getElementById('draftContent');

    modal.style.display = 'block';
    draftLoading.style.display = 'block';
    draftContent.style.display = 'none';
    statusText.innerText = 'Đang phân tích...';

    try {
        // Call Draft API
        const res = await fetch('/api/affiliate/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, variant: 'A' })
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        // Populate Modal
        const draft = data.data;
        document.getElementById('draftId').value = draft.id;
        document.getElementById('draftTitle').value = draft.title;
        document.getElementById('draftScript').value = draft.script;

        // Populate Images (or show empty message)
        const imgContainer = document.getElementById('draftImages');
        imgContainer.innerHTML = '';

        if (draft.images && draft.images.length > 0) {
            draft.images.forEach((imgPath, idx) => {
                addMediaToGrid(imgPath, 'image');
            });
        } else {
            imgContainer.innerHTML = '<p style="color: #888; grid-column: span 3; text-align: center;">Không tìm thấy ảnh từ Shopee. Vui lòng thêm thủ công hoặc tìm từ Pexels.</p>';
        }

        // Also fetch stock videos as suggestions
        searchStockMedia(true); // Auto-search based on title

        // Show Content
        draftLoading.style.display = 'none';
        draftContent.style.display = 'block';
        statusText.innerText = 'Vui lòng kiểm tra & xác nhận';

    } catch (error) {
        console.error(error);
        alert('Lỗi phân tích: ' + error.message);
        closeModal();
    }
}

// Helper to add media item to grid
function addMediaToGrid(url, type = 'image') {
    const imgContainer = document.getElementById('draftImages');
    // Remove "no images" message if exists
    const noImgMsg = imgContainer.querySelector('p');
    if (noImgMsg) noImgMsg.remove();

    // Convert local path to /temp URL if needed
    let displayUrl = url;
    if (url.includes('temp') && !url.startsWith('http')) {
        displayUrl = '/temp/' + url.split('temp')[1].replace(/\\/g, '/');
    }

    const div = document.createElement('div');
    div.style.position = 'relative';

    if (type === 'video' || url.endsWith('.mp4')) {
        div.innerHTML = `
            <video src="${displayUrl}" style="width: 100%; aspect-ratio: 9/16; object-fit: cover; border-radius: 4px;" muted loop onmouseenter="this.play()" onmouseleave="this.pause()"></video>
            <input type="checkbox" class="img-select" value="${url}" checked style="position: absolute; top: 5px; right: 5px; width: 20px; height: 20px;">
            <span style="position: absolute; bottom: 5px; left: 5px; background: rgba(0,0,0,0.7); color: white; font-size: 10px; padding: 2px 5px; border-radius: 3px;">VIDEO</span>
        `;
    } else {
        div.innerHTML = `
            <img src="${displayUrl}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px;" onerror="this.src='https://via.placeholder.com/150?text=Error'">
            <input type="checkbox" class="img-select" value="${url}" checked style="position: absolute; top: 5px; right: 5px; width: 20px; height: 20px;">
        `;
    }
    imgContainer.appendChild(div);
}

// Manual Media Addition
function addManualMedia() {
    const urlInput = document.getElementById('manualImageUrl');
    const url = urlInput.value.trim();
    if (!url) {
        alert('Vui lòng nhập URL ảnh hoặc video!');
        return;
    }
    addMediaToGrid(url, url.endsWith('.mp4') ? 'video' : 'image');
    urlInput.value = '';
}

// Pexels Stock Search
async function searchStockMedia(autoSearch = false) {
    const queryInput = document.getElementById('stockSearchQuery');
    let query = queryInput ? queryInput.value.trim() : '';

    // If auto-search, use product title keywords
    if (autoSearch || !query) {
        const title = document.getElementById('draftTitle').value;
        // Simple keyword extraction
        query = title.split(/\s+/).filter(w => w.length > 3).slice(0, 2).join(' ') || 'product';
    }

    if (!query) return;

    try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            data.data.forEach(item => {
                addMediaToGrid(item.url, item.type);
            });
        }
    } catch (error) {
        console.log('Stock search failed:', error);
        // Silently fail for auto-search
    }
}

async function confirmRender() {
    const draftId = document.getElementById('draftId').value;
    const script = document.getElementById('draftScript').value;
    const selectedImages = Array.from(document.querySelectorAll('.img-select:checked')).map(cb => cb.value);

    if (selectedImages.length === 0) {
        alert('Vui lòng chọn ít nhất 1 ảnh!');
        return;
    }

    const renderBtn = document.getElementById('renderBtn');
    renderBtn.innerText = '⏳ Đang xử lý...';
    renderBtn.disabled = true;

    const template = document.getElementById('videoTemplate').value;
    const music = document.getElementById('backgroundMusic').value;

    try {
        const res = await fetch('/api/affiliate/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draftId, script, selectedImages, template, music })
        });
        const data = await res.json();

        if (data.success) {
            closeModal();
            addVideoToGrid(data.data, data.data.variant || 'A', document.getElementById('shopeeUrl').value);
            document.getElementById('statusText').innerText = '✅ Hoàn tất!';
        } else {
            throw new Error(data.error);
        }

    } catch (error) {
        alert('Lỗi tạo video: ' + error.message);
    } finally {
        renderBtn.innerText = '🎬 Tạo Video (FFMPEG)';
        renderBtn.disabled = false;
    }
}

// AI Video Generation with Runway
async function confirmRenderAI() {
    const draftId = document.getElementById('draftId').value;
    const script = document.getElementById('draftScript').value;
    const selectedImages = Array.from(document.querySelectorAll('.img-select:checked')).map(cb => cb.value);

    if (selectedImages.length === 0) {
        alert('Vui lòng chọn ít nhất 1 ảnh!');
        return;
    }

    const renderBtn = document.getElementById('renderAiBtn');
    renderBtn.innerText = '⏳ AI đang tạo video... (30-60s)';
    renderBtn.disabled = true;

    try {
        const res = await fetch('/api/affiliate/render-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                draftId,
                script,
                selectedImages,
                prompt: 'Professional product showcase, smooth cinematic motion, elegant zoom and pan, studio lighting'
            })
        });
        const data = await res.json();

        if (data.success) {
            closeModal();
            addVideoToGrid(data.data, 'AI', document.getElementById('shopeeUrl').value);
            document.getElementById('statusText').innerText = '✅ AI Video hoàn tất!';
        } else {
            throw new Error(data.error);
        }

    } catch (error) {
        alert('Lỗi AI: ' + error.message);
    } finally {
        renderBtn.innerText = '🤖 Runway';
        renderBtn.disabled = false;
    }
}

// Veed AI Video Generation (Talking Video)
async function confirmRenderVeed() {
    const draftId = document.getElementById('draftId').value;
    const script = document.getElementById('draftScript').value;
    const selectedImages = Array.from(document.querySelectorAll('.img-select:checked')).map(cb => cb.value);

    if (selectedImages.length === 0) {
        alert('Vui lòng chọn ít nhất 1 ảnh!');
        return;
    }

    const renderBtn = document.getElementById('renderVeedBtn');
    renderBtn.innerText = '⏳ Đang tạo...';
    renderBtn.disabled = true;

    try {
        const res = await fetch('/api/affiliate/render-veed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draftId, script, selectedImages })
        });
        const data = await res.json();

        if (data.success) {
            closeModal();
            addVideoToGrid(data.data, 'Veed', document.getElementById('shopeeUrl').value);
            document.getElementById('statusText').innerText = '✅ Veed Video hoàn tất!';
        } else {
            throw new Error(data.error);
        }

    } catch (error) {
        alert('Lỗi Veed: ' + error.message);
    } finally {
        renderBtn.innerText = '🎤 Veed';
        renderBtn.disabled = false;
    }
}

function closeModal() {
    document.getElementById('previewModal').style.display = 'none';
}

function addVideoToGrid(videoData, variant, originalUrl) {
    const grid = document.getElementById('videoList');

    // Tracking Link Generation
    // Host is current host
    const host = window.location.origin;
    const trackingLink = `${host}/r?to=${encodeURIComponent(originalUrl)}&vid=${videoData.id}&var=${variant}`;

    const div = document.createElement('div');
    div.className = 'video-item';
    div.innerHTML = `
        <div class="video-preview">
            <video src="${videoData.file}" controls></video>
        </div>
        <div class="video-info">
            <div class="video-title">
                <span class="badge badge-${variant.toLowerCase()}">Mẫu ${variant}</span> 
                ${videoData.product}
            </div>
            <div class="stats">
                <small>ID: ${videoData.id}</small>
                <small>${new Date().toLocaleTimeString()}</small>
            </div>
            <div class="actions">
                <a href="${videoData.file}" download class="btn-outline" style="text-align: center; color: white; text-decoration: none;">⬇ Tải Video</a>
                <button class="btn-outline" style="color: white;" onclick="copyLink('${trackingLink}')">🔗 Sao Chép Link</button>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #666; word-break: break-all;">
                Link: ${trackingLink}
            </div>
        </div>
    `;
    grid.prepend(div);
}

// Tab Switching
function switchTab(tab) {
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.style.display = 'none');
    document.getElementById(`tab-${tab}`).style.display = 'block';

    document.querySelectorAll('.btn-outline').forEach(btn => btn.style.border = '1px solid #555');
    // Simple highlight hack (in real app us classes)

    if (tab === 'analytics') loadAnalytics();
    if (tab === 'settings') loadSettings();
}

// Analytics
async function loadAnalytics() {
    const res = await fetch('/api/dashboard/stats');
    const { data } = await res.json();

    // Chart
    const ctx = document.getElementById('abChart').getContext('2d');
    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mẫu A', 'Mẫu B'],
            datasets: [{
                label: 'Lượt Click Tracker',
                data: [data.byVariant.A || 0, data.byVariant.B || 0],
                backgroundColor: ['#007bff', '#28a745']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Hiệu quả A/B Testing' }
            }
        }
    });

    // Table
    const tbody = document.getElementById('recentClicksBody');
    tbody.innerHTML = '';
    data.recent.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.5rem; color: #aaa;">${new Date(log.timestamp).toLocaleTimeString()}</td>
            <td><span class="badge badge-${log.variant ? log.variant.toLowerCase() : 'a'}">${log.variant || 'N/A'}</span></td>
            <td>${log.videoId || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Settings
async function loadSettings() {
    const res = await fetch('/api/settings');
    const { data } = await res.json();
    document.getElementById('setWatermark').value = data.watermarkText || '';
    document.getElementById('setShowDisclosure').checked = data.showDisclosure;
    document.getElementById('setDisclosure').value = data.disclosureText || '';
    document.getElementById('setRunwayKey').value = data.runwayApiKey || '';
    document.getElementById('setPexelsKey').value = data.pexelsApiKey || '';
    document.getElementById('setVeedKey').value = data.veedApiKey || '';
}

async function saveSettings() {
    const settings = {
        watermarkText: document.getElementById('setWatermark').value,
        showDisclosure: document.getElementById('setShowDisclosure').checked,
        disclosureText: document.getElementById('setDisclosure').value,
        runwayApiKey: document.getElementById('setRunwayKey').value,
        pexelsApiKey: document.getElementById('setPexelsKey').value,
        veedApiKey: document.getElementById('setVeedKey').value
    };
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    alert('Đã lưu cài đặt! API keys sẽ được áp dụng ngay.');
}

