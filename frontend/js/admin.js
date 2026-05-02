const API = window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;
const nativeAlert = window.alert.bind(window);

let token = localStorage.getItem('admin_token') || null;
const state = {
    products: [],
    orders: [],
    promotions: [],
    users: [],
    payments: []
};

const PRODUCT_THEME_GROUPS = [
    'Aurora', 'Nexus', 'Prism', 'Nebula', 'Vertex',
    'Solar', 'Ocean', 'Ember', 'Lumen', 'Fusion'
];
const PRODUCT_THEME_TONES = [
    'Mint', 'Cyan', 'Sapphire', 'Violet', 'Rose',
    'Coral', 'Amber', 'Lime', 'Teal', 'Graphite'
];
const PRODUCT_THEMES = Array.from({ length: 100 }, (_, index) => {
    const hue = Math.round((18 + index * 137.508) % 360);
    const secondHue = Math.round((hue + 38 + (index % 5) * 9) % 360);
    const thirdHue = Math.round((hue + 198 + (index % 7) * 6) % 360);
    return {
        id: `theme-${String(index + 1).padStart(3, '0')}`,
        name: `${PRODUCT_THEME_GROUPS[Math.floor(index / 10)]} ${PRODUCT_THEME_TONES[index % 10]}`,
        accentA: `hsl(${hue} 88% 58%)`,
        accentB: `hsl(${secondHue} 92% 56%)`,
        accentC: `hsl(${thirdHue} 82% 54%)`,
        glow: `hsl(${hue} 88% 58% / 0.34)`
    };
});
const PRODUCT_IMAGE_ANIMATIONS = [
    { id: 'float', label: 'Float mềm' },
    { id: 'pulse', label: 'Pulse nổi bật' },
    { id: 'tilt', label: 'Tilt xoay nhẹ' },
    { id: 'orbit', label: 'Orbit cao cấp' },
    { id: 'zoom', label: 'Zoom spotlight' },
    { id: 'shimmer', label: 'Shimmer scan' },
    { id: 'bounce', label: 'Bounce năng động' },
    { id: 'glow', label: 'Glow ánh sáng' },
    { id: 'drift', label: 'Drift chậm' },
    { id: 'none', label: 'Tắt animation' }
];

// ─── Utilities ───────────────────────────────────────────────────────────────
const escapeHTML = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (value = 0) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '';
const formatFileSize = (bytes = 0) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};
const discountOf = (promo) => Number(promo.discount ?? promo.discountPercent ?? 0);
const stockClass = (stock) => stock <= 0 ? 'stock-out' : stock <= 3 ? 'stock-low' : 'stock-high';
const statusClass = (status) => status === 'complete' ? 'status-complete' : status === 'cancelled' ? 'stock-out' : 'status-pending';
const statusLabel = (status) => ({ pending: 'Chờ xử lý', complete: 'Hoàn thành', cancelled: 'Hủy bỏ' }[status] || status || 'pending');
const paymentLabel = (status) => ({ waiting: 'Chờ xác nhận', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' }[status] || status || 'Chờ xác nhận');
const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MIN_PASSWORD_LENGTH = 8;

function getPasswordError(password = '') {
    return String(password || '').length >= MIN_PASSWORD_LENGTH
        ? ''
        : `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
}

function getProductTheme(themeId = '') {
    return PRODUCT_THEMES.find(theme => theme.id === themeId) || PRODUCT_THEMES[0];
}

function productThemeGradient(theme) {
    return `linear-gradient(135deg, ${theme.accentA}, ${theme.accentB}, ${theme.accentC})`;
}

function productThemeOptionsHtml(selected = '') {
    const active = getProductTheme(selected).id;
    return PRODUCT_THEMES
        .map(theme => `<option value="${theme.id}" ${theme.id === active ? 'selected' : ''}>${theme.id} - ${escapeHTML(theme.name)}</option>`)
        .join('');
}

function imageAnimationOptionsHtml(selected = '') {
    const active = PRODUCT_IMAGE_ANIMATIONS.some(animation => animation.id === selected) ? selected : 'float';
    return PRODUCT_IMAGE_ANIMATIONS
        .map(animation => `<option value="${animation.id}" ${animation.id === active ? 'selected' : ''}>${escapeHTML(animation.label)}</option>`)
        .join('');
}

function productThemePreviewHtml(themeId = '') {
    const theme = getProductTheme(themeId);
    return `
        <div class="product-theme-preview" style="--theme-preview-gradient:${productThemeGradient(theme)};--theme-preview-glow:${theme.glow};">
            <span class="product-theme-swatch"></span>
            <span>
                <strong>${escapeHTML(theme.name)}</strong>
                <small>${theme.id}</small>
            </span>
        </div>
    `;
}

function productVisualSummary(product = {}) {
    const theme = getProductTheme(product.productTheme);
    const animation = PRODUCT_IMAGE_ANIMATIONS.find(item => item.id === product.imageAnimation) || PRODUCT_IMAGE_ANIMATIONS[0];
    return `
        <div class="product-visual-meta">
            <span class="product-theme-chip" style="--theme-preview-gradient:${productThemeGradient(theme)};">
                <i></i>${escapeHTML(theme.name)}
            </span>
            <span class="product-animation-chip">${escapeHTML(animation.label)}</span>
        </div>
    `;
}

window.syncProductThemePreview = (themeId) => {
    const preview = document.getElementById('f_theme_preview');
    if (preview) preview.innerHTML = productThemePreviewHtml(themeId);
};

function getAuthHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function parseResponse(res) {
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error(data.error || 'Phiên đăng nhập hết hạn');
    }
    if (!res.ok) throw new Error(data.error || text || `HTTP ${res.status}`);
    return data;
}

async function apiGet(endpoint) {
    const res = await fetch(API + endpoint, { headers: getAuthHeaders(), cache: 'no-store' });
    return parseResponse(res);
}

async function apiPost(endpoint, body) {
    const res = await fetch(API + endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
    });
    return parseResponse(res);
}

async function apiPatch(endpoint, body) {
    const res = await fetch(API + endpoint, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
    });
    return parseResponse(res);
}

async function apiDelete(endpoint) {
    const res = await fetch(API + endpoint, { method: 'DELETE', headers: getAuthHeaders() });
    return parseResponse(res);
}

function showTableMessage(tbody, colspan, message) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;color:rgba(255,255,255,0.45);padding:2rem;">${escapeHTML(message)}</td></tr>`;
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
}

let successNoticeLastFocus = null;
let successNoticeResolver = null;

function closeSuccessNotice(result = true) {
    const notice = document.getElementById('successNotice');
    if (!notice) return;
    notice.classList.remove('active');
    notice.classList.remove('is-confirm');
    notice.classList.remove('is-success', 'is-error', 'is-warning');
    notice.setAttribute('aria-hidden', 'true');
    if (successNoticeResolver) {
        successNoticeResolver(result);
        successNoticeResolver = null;
    }
    if (successNoticeLastFocus?.focus) successNoticeLastFocus.focus();
    successNoticeLastFocus = null;
}

function openNotice(message, title = 'Thông báo', options = {}) {
    const notice = document.getElementById('successNotice');
    const titleEl = document.getElementById('successNoticeTitle');
    const messageEl = document.getElementById('successNoticeMessage');
    const okBtn = document.getElementById('successNoticeOk');
    const cancelBtn = document.getElementById('successNoticeCancel');
    const kickerEl = document.querySelector('.success-notice-kicker');
    const isConfirm = !!options.confirm;
    const type = options.type || (isConfirm ? 'warning' : 'success');
    if (!notice || !titleEl || !messageEl || !okBtn || !cancelBtn || !kickerEl) {
        return Promise.resolve(isConfirm ? false : (nativeAlert(message), true));
    }

    successNoticeLastFocus = document.activeElement;
    titleEl.textContent = title;
    messageEl.textContent = message;
    kickerEl.textContent = options.kicker || (isConfirm ? 'CONFIRM' : type.toUpperCase());
    okBtn.textContent = options.okText || 'OK';
    cancelBtn.textContent = options.cancelText || 'Hủy';
    notice.classList.remove('active');
    notice.classList.toggle('is-confirm', isConfirm);
    notice.classList.remove('is-success', 'is-error', 'is-warning');
    notice.classList.add(`is-${type}`);
    notice.setAttribute('aria-hidden', 'false');

    return new Promise(resolve => {
        successNoticeResolver = resolve;
        requestAnimationFrame(() => {
            notice.classList.add('active');
            okBtn.focus();
        });
    });
}

function showSuccessNotice(message, title = 'Thao tác thành công') {
    return openNotice(message, title, { type: 'success', kicker: 'DONE', okText: 'OK' });
}

function getNoticeType(message) {
    const text = String(message || '');
    if (/^(Lỗi|Không tải được|Không thể|Không đọc được|Đăng nhập thất bại|Đăng ký thất bại|Error|Network|Failed)|\blỗi\b|thất bại|failed|error/i.test(text)) {
        return 'error';
    }
    if (/Hãy chọn|Vui lòng|thiếu|chưa chọn|File quá lớn|Tồn kho không hợp lệ|Giỏ hàng trống/i.test(text)) {
        return 'warning';
    }
    return 'success';
}

function showInfoNotice(message, title = 'Thông báo') {
    const text = String(message || '');
    const type = getNoticeType(text);
    const resolvedTitle = title || (type === 'error' ? 'Có lỗi xảy ra' : type === 'warning' ? 'Cần kiểm tra' : 'Thông báo');
    return openNotice(text, resolvedTitle, { type, kicker: type === 'error' ? 'ERROR' : type === 'warning' ? 'WARNING' : 'DONE', okText: 'OK' });
}

function showConfirmNotice(message, title = 'Xác nhận thao tác') {
    return openNotice(message, title, { confirm: true, type: 'warning', kicker: 'WARNING', okText: 'OK', cancelText: 'Hủy' });
}

window.alert = (message) => {
    showInfoNotice(String(message || ''), '');
};

function openAdminModal(titleText, bodyHtml, onSave, saveText = 'Lưu Thay Đổi') {
    document.getElementById('modalTitle').textContent = titleText;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    const saveBtn = document.getElementById('btnSaveForm');
    saveBtn.textContent = saveText;
    saveBtn.onclick = async () => {
        try {
            await onSave();
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    };
    document.getElementById('adminModal').classList.add('active');
}

function logout() {
    localStorage.removeItem('admin_token');
    token = null;
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('loginScreen');

    if (token) {
        const user = JSON.parse(localStorage.getItem('gs_user') || '{}');
        if (user.name) document.getElementById('adminName').textContent = user.name;
        showDashboard();
    } else {
        loginScreen.style.display = 'flex';
    }

    document.getElementById('btnLogin').addEventListener('click', doLogin);
    document.getElementById('loginPass').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('btnLogout').addEventListener('click', logout);

    const aiFileInput = document.getElementById('aiDataUpload');
    const aiUploadShell = document.querySelector('.ai-upload-shell');
    const aiUploadFileName = document.getElementById('aiUploadFileName');
    const aiUploadFileInfo = document.getElementById('aiUploadFileInfo');
    const resetAiUploadMeta = () => {
        if (aiUploadShell) aiUploadShell.classList.remove('has-file');
        if (aiUploadFileName) aiUploadFileName.textContent = 'Chưa chọn tệp';
        if (aiUploadFileInfo) aiUploadFileInfo.textContent = 'Bấm chọn hoặc kéo-thả file vào đây';
    };
    const setAiUploadFile = (file) => {
        if (!file) {
            resetAiUploadMeta();
            return;
        }
        aiUploadShell?.classList.add('has-file');
        if (aiUploadFileName) aiUploadFileName.textContent = file.name;
        if (aiUploadFileInfo) aiUploadFileInfo.textContent = `${file.type || 'Không rõ loại'} - ${formatFileSize(file.size)}`;
    };
    aiFileInput?.addEventListener('change', () => {
        const file = aiFileInput.files?.[0];
        setAiUploadFile(file);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        aiUploadShell?.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            aiUploadShell.classList.add('is-dragover');
        });
    });
    ['dragleave', 'drop'].forEach(eventName => {
        aiUploadShell?.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            aiUploadShell.classList.remove('is-dragover');
        });
    });
    aiUploadShell?.addEventListener('drop', e => {
        const file = e.dataTransfer?.files?.[0];
        if (!file || !aiFileInput) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        aiFileInput.files = transfer.files;
        setAiUploadFile(file);
    });
    ['dragover', 'drop'].forEach(eventName => {
        window.addEventListener(eventName, e => {
            if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
        });
    });

    document.querySelectorAll('.nav-item[data-tab]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const tab = link.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
            document.getElementById('tab-' + tab).style.display = 'block';
            document.querySelector('.admin-header h2').textContent = link.textContent.trim();
            loadTab(tab);
        });
    });

    document.getElementById('btnSaveAiConfig')?.addEventListener('click', async () => {
        const prompt = document.getElementById('aiSystemPrompt').value.trim();
        try {
            await apiPatch('/ai-config', { systemPrompt: prompt });
            showSuccessNotice('Cấu hình AI đã được lưu và sẵn sàng áp dụng cho bot.', 'Đã lưu cấu hình');
        } catch (e) { alert('Lỗi: ' + e.message); }
    });

    document.getElementById('btnUploadAiData')?.addEventListener('click', async () => {
        const fileInput = document.getElementById('aiDataUpload');
        const file = fileInput.files[0];
        if (!file) { alert('Hãy chọn file để train bot!'); return; }
        if (file.size > 12 * 1024 * 1024) {
            alert('File quá lớn. Hãy chọn file dưới 12MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const mode = document.getElementById('aiTrainMode')?.value || 'append';
                const contentBase64 = arrayBufferToBase64(e.target.result);
                const result = await apiPost('/ai-knowledge', {
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    mode,
                    contentBase64
                });
                fileInput.value = '';
                resetAiUploadMeta();
                await loadAiKnowledge();
                showSuccessNotice(`Đã train bot offline từ ${file.name}. Tổng knowledge: ${result.total}`, 'Train knowledge thành công');
            } catch (err) {
                alert('Lỗi xử lý file: ' + (err.message || 'Không đọc được nội dung file.'));
            }
        };
        reader.onerror = () => alert('Không đọc được file trên trình duyệt.');
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('btnClearAiData')?.addEventListener('click', async () => {
        if (!(await showConfirmNotice('Xóa toàn bộ dữ liệu JSON đã train cho bot offline?', 'Xác nhận xóa knowledge'))) return;
        try {
            await apiDelete('/ai-knowledge');
            await loadAiKnowledge();
            showSuccessNotice('Đã xóa toàn bộ dữ liệu train offline khỏi knowledge.', 'Đã xóa knowledge');
        } catch (e) { alert('Lỗi: ' + e.message); }
    });

    document.getElementById('closeAdminModal')?.addEventListener('click', closeAdminModal);
    document.getElementById('successNoticeOk')?.addEventListener('click', () => closeSuccessNotice(true));
    document.getElementById('successNoticeCancel')?.addEventListener('click', () => closeSuccessNotice(false));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.getElementById('successNotice')?.classList.contains('active')) {
            closeSuccessNotice(false);
        }
    });
});

async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';
    if (!username || !password) {
        errorEl.textContent = 'Vui lòng nhập tài khoản và mật khẩu';
        errorEl.style.display = 'block';
        return;
    }
    const passwordError = getPasswordError(password);
    if (passwordError) {
        errorEl.textContent = passwordError;
        errorEl.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await parseResponse(res);
        if (data.token && data.user.role === 'admin') {
            token = data.token;
            localStorage.setItem('admin_token', token);
            localStorage.setItem('gs_user', JSON.stringify(data.user));
            document.getElementById('adminName').textContent = data.user.name;
            showDashboard();
        } else {
            errorEl.textContent = 'Đăng nhập thất bại hoặc bạn không có quyền Admin';
            errorEl.style.display = 'block';
        }
    } catch (e) {
        errorEl.textContent = e.message || 'Không thể kết nối Server.';
        errorEl.style.display = 'block';
    }
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'flex';
    loadTab('dashboard');
}

// ─── Tab Loaders ─────────────────────────────────────────────────────────────
async function loadTab(tab) {
    switch(tab) {
        case 'dashboard':  await loadDashboard();  break;
        case 'products':   await loadProducts();   break;
        case 'orders':     await loadOrders();     break;
        case 'payments':   await loadPayments();   break;
        case 'promotions': await loadPromotions(); break;
        case 'users':      await loadUsers();      break;
        case 'ai_config':  await loadAiConfig();   break;
    }
}

async function loadDashboard() {
    try {
        const stats = await apiGet('/dashboard-stats');
        document.getElementById('statRevenue').textContent = money(stats.revenue);
        document.getElementById('statOrders').textContent = stats.totalOrders;
        document.getElementById('statStock').textContent = `${stats.totalStock} gói`;
        document.getElementById('statUsers').textContent = stats.totalUsers;
        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statComplete').textContent = stats.complete;
        document.getElementById('statPendingRevenue').textContent = money(stats.pendingRevenue);

        const maxRev = Math.max(...Object.values(stats.revenueByDay), 1);
        
        // 1. Revenue Chart
        const ctxRev = document.getElementById('revenueChartCanvas');
        if (window.revChartInstance) window.revChartInstance.destroy();
        window.revChartInstance = new Chart(ctxRev, {
            type: 'line',
            data: {
                labels: Object.keys(stats.revenueByDay).map(d => d.split('-').slice(1).join('/')),
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: Object.values(stats.revenueByDay),
                    borderColor: '#FF5C00',
                    backgroundColor: 'rgba(255, 92, 0, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#FBBF24',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } },
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } }
                }
            }
        });

        // 2. Product Pie Chart
        const ctxProd = document.getElementById('productChartCanvas');
        if (window.prodChartInstance) window.prodChartInstance.destroy();
        window.prodChartInstance = new Chart(ctxProd, {
            type: 'doughnut',
            data: {
                labels: stats.topProducts.slice(0, 5).map(p => p.name),
                datasets: [{
                    data: stats.topProducts.slice(0, 5).map(p => p.quantity),
                    backgroundColor: ['#FF5C00', '#FBBF24', '#10B981', '#3B82F6', '#8B5CF6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', padding: 10, font: { size: 10 } } }
                }
            }
        });

        renderDashboardList('dashboardLowStock', stats.lowStock, p => `
            <div class="mini-row">
                <span>${escapeHTML(p.name)}</span>
                <strong class="${stockClass(p.stock)}">${p.stock} gói</strong>
            </div>
        `, 'Không có sản phẩm sắp hết hàng.');

        renderDashboardList('dashboardTopProducts', stats.topProducts, p => `
            <div class="mini-row">
                <span>${escapeHTML(p.name)}</span>
                <strong>${p.quantity} bán</strong>
            </div>
        `, 'Chưa có dữ liệu bán hàng.');

        renderDashboardList('dashboardRecentOrders', stats.recentOrders, o => `
            <div class="mini-row">
                <span>${escapeHTML(o.id)} - ${escapeHTML(o.name || o.userName || '')}</span>
                <strong>${money(o.total)}</strong>
            </div>
        `, 'Chưa có đơn hàng.');
    } catch (e) {
        alert('Không tải được dashboard: ' + e.message);
    }
}

function renderDashboardList(id, rows, renderer, emptyText) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = rows?.length ? rows.map(renderer).join('') : `<p class="empty-state">${escapeHTML(emptyText)}</p>`;
}

async function loadProducts() {
    const tbody = document.getElementById('productTableBody');
    showTableMessage(tbody, 8, 'Đang tải sản phẩm...');
    try {
        state.products = await apiGet('/products');
        if (!state.products.length) return showTableMessage(tbody, 8, 'Chưa có sản phẩm.');
        tbody.innerHTML = state.products.map(p => {
            const plans = Array.isArray(p.plans) ? p.plans : [];
            const lowestPlan = plans.reduce((min, pl) => pl.price < min.price ? pl : min, plans[0] || { price: 0 });
            return `
                <tr>
                    <td class="mono">${escapeHTML(p.id)}</td>
                    <td>${productTableImageHtml(p)}</td>
                    <td>
                        <strong>${escapeHTML(p.name)}</strong>
                        <div class="muted">${escapeHTML(p.subtitle || '')}</div>
                    </td>
                    <td>${plans.length} gói<br><span class="muted">${money(lowestPlan.price)}</span></td>
                    <td>
                        <div class="inline-stock">
                            <span class="stock-badge ${stockClass(p.stock)}">${p.stock}</span>
                            <input type="number" value="${p.stock}" class="stock-input" id="st_${escapeHTML(p.id)}">
                            <button class="btn-sm btn-primary" onclick="updateStock('${p.id}')">Lưu</button>
                        </div>
                    </td>
                    <td>${escapeHTML(p.engineBadge || '')}</td>
                    <td>${productVisualSummary(p)}</td>
                    <td>
                        <button class="btn-sm btn-primary" onclick="editProduct('${p.id}')">Sửa</button>
                        <button class="btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Xóa</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        showTableMessage(tbody, 8, 'Không tải được sản phẩm: ' + e.message);
    }
}

async function loadOrders() {
    const tbody = document.getElementById('orderTableBody');
    showTableMessage(tbody, 7, 'Đang tải đơn hàng...');
    try {
        state.orders = await apiGet('/orders');
        if (!state.orders.length) return showTableMessage(tbody, 7, 'Chưa có đơn hàng.');
        tbody.innerHTML = state.orders.map(o => `
            <tr>
                <td class="mono">${escapeHTML(o.id)}</td>
                <td>
                    <strong>${escapeHTML(o.name || o.userName || '')}</strong>
                    <div class="muted">${formatDate(o.date)}</div>
                </td>
                <td>${escapeHTML(o.phone || '')}<br><span class="muted">${escapeHTML(o.email || '')}</span></td>
                <td>${(o.items || []).length} dòng<br><button class="btn-link" onclick="viewOrder('${o.id}')">Xem chi tiết</button></td>
                <td class="text-yellow">${money(o.total)}</td>
                <td>
                    <select onchange="updateOrderStatus('${o.id}', this.value)" class="admin-select">
                        <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                        <option value="complete" ${o.status === 'complete' ? 'selected' : ''}>Hoàn thành</option>
                        <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Hủy bỏ</option>
                    </select>
                    <div style="margin-top:.4rem;"><span class="stock-badge ${statusClass(o.status)}">${statusLabel(o.status)}</span></div>
                </td>
                <td>
                    <button class="btn-sm btn-danger" onclick="deleteOrder('${o.id}')">Xóa</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        showTableMessage(tbody, 7, 'Không tải được đơn hàng: ' + e.message);
    }
}

async function loadPayments() {
    const tbody = document.getElementById('paymentTableBody');
    showTableMessage(tbody, 6, 'Đang tải thanh toán...');
    try {
        state.payments = await apiGet('/payments');
        if (!state.payments.length) return showTableMessage(tbody, 6, 'Chưa có lịch sử thanh toán.');
        tbody.innerHTML = state.payments.map(p => `
            <tr>
                <td class="mono">${escapeHTML(p.orderId)}</td>
                <td>${escapeHTML(p.customerName || '')}<br><span class="muted">${escapeHTML(p.phone || p.email || '')}</span></td>
                <td>${formatDate(p.date)}</td>
                <td class="text-yellow">${money(p.amount)}</td>
                <td>${escapeHTML(p.memo || '')}</td>
                <td><span class="stock-badge ${statusClass(p.status === 'confirmed' ? 'complete' : p.status === 'cancelled' ? 'cancelled' : 'pending')}">${paymentLabel(p.status)}</span></td>
            </tr>
        `).join('');
    } catch (e) {
        showTableMessage(tbody, 6, 'Không tải được thanh toán: ' + e.message);
    }
}

async function loadPromotions() {
    const tbody = document.getElementById('promoTableBody');
    showTableMessage(tbody, 4, 'Đang tải khuyến mãi...');
    try {
        state.promotions = await apiGet('/promotions');
        if (!state.promotions.length) return showTableMessage(tbody, 4, 'Chưa có mã khuyến mãi.');
        tbody.innerHTML = state.promotions.map(p => `
            <tr>
                <td style="font-weight:bold;color:var(--accent-yellow);">${escapeHTML(p.code)}</td>
                <td>${discountOf(p)}%</td>
                <td>
                    <span style="font-size: 0.8rem; color: #aaa;">${escapeHTML(p.type || 'global')}</span><br>
                    <span style="font-size: 0.75rem; color: #888;">${p.startDate ? p.startDate : 'Bất kỳ'} - ${p.endDate ? p.endDate : 'Bất kỳ'}</span>
                </td>
                <td><span class="stock-badge ${p.isActive ? 'status-complete' : 'stock-out'}">${p.isActive ? 'Active' : 'Off'}</span></td>
                <td>
                    <button class="btn-sm btn-primary" onclick="editPromo('${p.id}')">Sửa</button>
                    <button class="btn-sm btn-primary" onclick="togglePromo('${p.id}')">${p.isActive ? 'Tắt' : 'Bật'}</button>
                    <button class="btn-sm btn-danger" onclick="deletePromo('${p.id}')">Xóa</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        showTableMessage(tbody, 4, 'Không tải được khuyến mãi: ' + e.message);
    }
}

async function loadUsers() {
    const tbody = document.getElementById('userTableBody');
    showTableMessage(tbody, 5, 'Đang tải người dùng...');
    try {
        state.users = await apiGet('/users');
        if (!state.users.length) return showTableMessage(tbody, 5, 'Chưa có người dùng.');
        tbody.innerHTML = state.users.map(u => `
            <tr>
                <td>${escapeHTML(u.name)}</td>
                <td>${escapeHTML(u.username)}</td>
                <td style="font-family: monospace; color: var(--accent-orange);">${escapeHTML(u.password || '***')}</td>
                <td>${escapeHTML(u.email || '')}</td>
                <td><span class="stock-badge ${u.role === 'admin' ? 'status-complete' : ''}">${escapeHTML(u.role)}</span></td>
                <td>
                    <button class="btn-sm btn-primary" onclick="editUser('${u.id}')">Sửa</button>
                    <button class="btn-sm btn-danger" ${u.username === 'admin' ? 'disabled' : ''} onclick="deleteUser('${u.id}')">Xóa</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        showTableMessage(tbody, 5, 'Không tải được người dùng: ' + e.message);
    }
}

async function loadAiConfig() {
    try {
        const config = await apiGet('/ai-config');
        document.getElementById('aiSystemPrompt').value = config.systemPrompt || '';
        await loadAiKnowledge();
    } catch (e) {
        alert('Không tải được cấu hình AI: ' + e.message);
    }
}

async function loadAiKnowledge() {
    const statusEl = document.getElementById('aiKnowledgeStatus');
    const listEl = document.getElementById('aiKnowledgeList');
    if (!statusEl || !listEl) return;
    try {
        const knowledge = await apiGet('/ai-knowledge');
        statusEl.textContent = `Bot offline đang có ${knowledge.total} file knowledge đã train.`;
        listEl.innerHTML = knowledge.entries.length
            ? knowledge.entries.map(entry => `
                <div class="mini-row">
                    <span>
                        <strong>${escapeHTML(entry.fileName)}</strong>
                        <br><span class="muted">${escapeHTML(entry.sourceType || 'text')} - ${escapeHTML(entry.summary || '')} - ${formatDate(entry.uploadedAt)}</span>
                    </span>
                    <button class="btn-sm btn-danger" onclick="deleteAiKnowledge('${entry.id}')">Xóa</button>
                </div>
            `).join('')
            : '<p class="empty-state">Chưa upload JSON knowledge nào. Bot vẫn dùng catalog và khuyến mãi hiện có.</p>';
    } catch (e) {
        statusEl.textContent = 'Không tải được danh sách knowledge: ' + e.message;
    }
}

// ─── Action Handlers ─────────────────────────────────────────────────────────
window.deleteAiKnowledge = async (id) => {
    if (!(await showConfirmNotice('Xóa file knowledge này khỏi bot offline?', 'Xác nhận xóa knowledge'))) return;
    try {
        await apiDelete('/ai-knowledge/' + id);
        await loadAiKnowledge();
        showSuccessNotice('File knowledge đã được xóa khỏi bot offline.', 'Đã xóa knowledge');
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.updateStock = async (id) => {
    const stock = parseInt(document.getElementById('st_' + id).value, 10);
    if (!Number.isFinite(stock) || stock < 0) return alert('Tồn kho không hợp lệ');
    try {
        await apiPatch('/products/' + id, { stock });
        await loadProducts();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.deleteProduct = async (id) => {
    if (!(await showConfirmNotice('Xóa sản phẩm này?', 'Xác nhận xóa sản phẩm'))) return;
    try {
        await apiDelete('/products/' + id);
        await loadProducts();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.updateOrderStatus = async (id, status) => {
    try {
        await apiPatch('/orders/' + id, { status });
        await loadOrders();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.deleteOrder = async (id) => {
    if (!(await showConfirmNotice('Xóa đơn hàng này?', 'Xác nhận xóa đơn hàng'))) return;
    try {
        await apiDelete('/orders/' + id);
        await loadOrders();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.deletePromo = async (id) => {
    if (!(await showConfirmNotice('Xóa mã này?', 'Xác nhận xóa mã'))) return;
    try {
        await apiDelete('/promotions/' + id);
        await loadPromotions();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.togglePromo = async (id) => {
    const promo = state.promotions.find(p => p.id === id);
    if (!promo) return;
    try {
        await apiPatch('/promotions/' + id, { isActive: !promo.isActive });
        await loadPromotions();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.deleteUser = async (id) => {
    if (!(await showConfirmNotice('Xóa người dùng này?', 'Xác nhận xóa người dùng'))) return;
    try {
        await apiDelete('/users/' + id);
        await loadUsers();
    } catch (e) { alert('Lỗi: ' + e.message); }
};

window.viewOrder = (id) => {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;
    const items = (order.items || []).map(item => `
        <tr>
            <td>${escapeHTML(item.productName || item.productId || '')}</td>
            <td>${escapeHTML(item.planName || '')}</td>
            <td>${item.quantity || 1}</td>
            <td>${money(item.price || 0)}</td>
            <td>${money(item.lineTotal || ((item.price || 0) * (item.quantity || 1)))}</td>
        </tr>
    `).join('');
    openAdminModal(`Chi tiết đơn ${order.id}`, `
        <div class="detail-grid">
            <div><label>Khách hàng</label><strong>${escapeHTML(order.name || order.userName || '')}</strong></div>
            <div><label>SĐT</label><strong>${escapeHTML(order.phone || '')}</strong></div>
            <div><label>Email</label><strong>${escapeHTML(order.email || '')}</strong></div>
            <div><label>Ngày tạo</label><strong>${formatDate(order.date)}</strong></div>
            <div><label>Trạng thái</label><strong>${statusLabel(order.status)}</strong></div>
            <div><label>Tổng tiền</label><strong class="text-yellow">${money(order.total)}</strong></div>
        </div>
        <div class="table-container" style="margin-top:1rem;">
            <table class="admin-table">
                <thead><tr><th>Sản phẩm</th><th>Gói</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
                <tbody>${items || '<tr><td colspan="5">Không có dòng hàng.</td></tr>'}</tbody>
            </table>
        </div>
    `, async () => closeAdminModal(), 'Đóng');
};

// ─── Forms ───────────────────────────────────────────────────────────────────
function plansToText(plans = []) {
    return plans.map(p => `${p.name}|${p.price}|${p.original || ''}`).join('\n');
}

function parsePlans(text) {
    const plans = text.split('\n').map(line => {
        const [name, price, original] = line.split('|').map(v => (v || '').trim());
        return { name, price: Number(price), original: Number(original || 0) };
    }).filter(p => p.name && Number.isFinite(p.price) && p.price >= 0);
    if (!plans.length) throw new Error('Hãy nhập ít nhất 1 gói theo định dạng Tên|Giá|Giá gốc');
    return plans;
}

function productImagePreviewHtml(image = '') {
    return image
        ? `<img src="${escapeHTML(image)}" alt="Ảnh sản phẩm">`
        : '<div class="product-image-empty">Chưa có ảnh</div>';
}

function productTableImageHtml(product = {}) {
    if (!product.image) {
        return `<div class="product-thumb product-thumb-empty">${escapeHTML((product.name || 'AI').slice(0, 2).toUpperCase())}</div>`;
    }
    return `<img class="product-thumb" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name || 'Ảnh sản phẩm')}">`;
}

function updateProductImagePreview(image, metaText = '') {
    const imageValue = String(image || '').trim();
    const imageInput = document.getElementById('f_image');
    const urlInput = document.getElementById('f_image_url');
    const preview = document.getElementById('f_image_preview');
    const meta = document.getElementById('f_image_meta');
    const uploadShell = document.getElementById('f_image_upload_shell');

    if (imageInput) imageInput.value = imageValue;
    if (urlInput) urlInput.value = imageValue.startsWith('data:image/') ? '' : imageValue;
    if (preview) preview.innerHTML = productImagePreviewHtml(imageValue);
    if (meta) {
        meta.textContent = metaText || (imageValue
            ? (imageValue.startsWith('data:image/') ? 'Ảnh đã nhúng vào sản phẩm' : 'Đang dùng đường dẫn/URL ảnh')
            : 'PNG, JPG, WEBP hoặc GIF. Tối đa 2 MB.');
    }
    if (uploadShell) uploadShell.classList.toggle('has-file', !!imageValue);
}

window.setProductImageFromUrl = (value) => {
    updateProductImagePreview(value);
};

window.clearProductImage = () => {
    const fileInput = document.getElementById('f_image_file');
    const urlInput = document.getElementById('f_image_url');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    updateProductImagePreview('', 'Đã xóa ảnh khỏi sản phẩm.');
};

window.handleProductImageUpload = (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
        input.value = '';
        showInfoNotice('Vui lòng chọn ảnh PNG, JPG, WEBP hoặc GIF.', 'Ảnh không hợp lệ');
        return;
    }

    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
        input.value = '';
        showInfoNotice(`File quá lớn. Ảnh sản phẩm tối đa ${formatFileSize(PRODUCT_IMAGE_MAX_BYTES)}.`, 'Ảnh quá lớn');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || '');
        updateProductImagePreview(dataUrl, `${file.name} - ${formatFileSize(file.size)} - đã nhúng vào sản phẩm`);
        showSuccessNotice(`Đã tải ảnh ${file.name} cho sản phẩm.`, 'Đã chọn ảnh sản phẩm');
    };
    reader.onerror = () => showInfoNotice('Không đọc được file ảnh sản phẩm.', 'Lỗi tải ảnh');
    reader.readAsDataURL(file);
};

function productFormHtml(product = {}) {
    const imageValue = String(product.image || '').trim();
    const imageUrlValue = imageValue.startsWith('data:image/') ? '' : imageValue;
    const selectedTheme = getProductTheme(product.productTheme).id;
    const selectedAnimation = PRODUCT_IMAGE_ANIMATIONS.some(item => item.id === product.imageAnimation)
        ? product.imageAnimation
        : 'float';
    return `
        <div class="form-grid">
            <div class="form-group"><label>Tên sản phẩm</label><input type="text" id="f_name" value="${escapeHTML(product.name || '')}" placeholder="ChatGPT Plus"></div>
            <div class="form-group"><label>Tiêu đề thẻ</label><input type="text" id="f_title" value="${escapeHTML(product.title || '')}" placeholder="ChatGPT"></div>
            <div class="form-group"><label>Subtitle</label><input type="text" id="f_subtitle" value="${escapeHTML(product.subtitle || '')}" placeholder="AI WORKSTATION"></div>
            <div class="form-group"><label>Engine badge</label><input type="text" id="f_engine" value="${escapeHTML(product.engineBadge || '')}" placeholder="PLUS VIP"></div>
            <div class="form-group"><label>Tồn kho</label><input type="number" id="f_stock" value="${product.stock ?? 10}"></div>
            <div class="form-group"><label>Prefix giá</label><input type="text" id="f_prefix" value="${escapeHTML(product.pricePrefix || 'Chỉ từ')}"></div>
            <div class="form-group"><label>Theme màu thẻ</label><select id="f_product_theme" class="admin-select" onchange="syncProductThemePreview(this.value)">
                ${productThemeOptionsHtml(selectedTheme)}
            </select><div id="f_theme_preview">${productThemePreviewHtml(selectedTheme)}</div></div>
            <div class="form-group"><label>Animation ảnh</label><select id="f_image_animation" class="admin-select">
                ${imageAnimationOptionsHtml(selectedAnimation)}
            </select></div>
            <div class="form-group"><label>Background fallback</label><select id="f_icon_class" class="admin-select">
                ${['bg-chatgpt','bg-chatgpt-business','bg-chatgpt-pro','bg-gemini','bg-grammarly','bg-gemini-ultra','bg-capcut','bg-canva','bg-youtube'].map(c => `<option value="${c}" ${product.iconClass === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-group product-image-manager">
            <label>Ảnh sản phẩm</label>
            <input type="hidden" id="f_image" value="${escapeHTML(imageValue)}">
            <div class="product-image-layout">
                <div class="product-image-preview" id="f_image_preview">${productImagePreviewHtml(imageValue)}</div>
                <div class="product-image-control">
                    <div class="product-image-upload-shell ${imageValue ? 'has-file' : ''}" id="f_image_upload_shell">
                        <input class="product-image-input" type="file" id="f_image_file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="handleProductImageUpload(event)">
                        <label class="product-image-upload-picker" for="f_image_file">
                            <span class="product-image-upload-icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M4 16.5V18A2 2 0 0 0 6 20H18A2 2 0 0 0 20 18V16.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                                </svg>
                            </span>
                            Tải ảnh sản phẩm
                        </label>
                        <div class="product-image-upload-meta">
                            <strong id="f_image_meta">${imageValue ? (imageValue.startsWith('data:image/') ? 'Ảnh đã nhúng vào sản phẩm' : 'Đang dùng đường dẫn/URL ảnh') : 'PNG, JPG, WEBP hoặc GIF'}</strong>
                            <span>Tối đa ${formatFileSize(PRODUCT_IMAGE_MAX_BYTES)}. Ảnh sẽ hiển thị trên thẻ sản phẩm.</span>
                        </div>
                    </div>
                    <div class="product-image-url-row">
                        <input type="text" id="f_image_url" value="${escapeHTML(imageUrlValue)}" placeholder="Hoặc nhập assets/chatgpt-plus.png / https://..." oninput="setProductImageFromUrl(this.value)">
                        <button type="button" class="btn-sm product-image-clear" onclick="clearProductImage()">Xóa ảnh</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="form-group" style="margin-top:1rem;"><label>Mô tả</label><textarea id="f_desc">${escapeHTML(product.description || '')}</textarea></div>
        <div class="form-group" style="margin-top:1rem;"><label>Gói bán - mỗi dòng: Tên|Giá|Giá gốc</label><textarea id="f_plans" rows="5">${escapeHTML(plansToText(product.plans || [{ name: '1 Tháng', price: 200000, original: 0 }]))}</textarea></div>
        <div class="form-group" style="margin-top:1rem;"><label>Tính năng - mỗi dòng 1 ý</label><textarea id="f_features" rows="5">${escapeHTML((product.features || []).join('\n'))}</textarea></div>
        <div class="form-group" style="margin-top:1rem;"><label>Icon HTML</label><textarea id="f_icon_html" rows="4">${escapeHTML(product.appIconHtml || '<h2>AI</h2>')}</textarea></div>
    `;
}

function readProductForm() {
    const name = document.getElementById('f_name').value.trim();
    if (!name) throw new Error('Tên sản phẩm không được trống');
    return {
        name,
        title: document.getElementById('f_title').value.trim() || name,
        subtitle: document.getElementById('f_subtitle').value.trim(),
        engineBadge: document.getElementById('f_engine').value.trim() || 'PREMIUM',
        stock: Math.max(0, parseInt(document.getElementById('f_stock').value, 10) || 0),
        pricePrefix: document.getElementById('f_prefix').value.trim() || 'Chỉ từ',
        productTheme: document.getElementById('f_product_theme').value,
        imageAnimation: document.getElementById('f_image_animation').value,
        iconClass: document.getElementById('f_icon_class').value,
        image: document.getElementById('f_image').value.trim(),
        description: document.getElementById('f_desc').value.trim(),
        plans: parsePlans(document.getElementById('f_plans').value),
        features: document.getElementById('f_features').value.split('\n').map(v => v.trim()).filter(Boolean),
        appIconHtml: document.getElementById('f_icon_html').value.trim()
    };
}

window.openProductForm = () => {
    openAdminModal('Thêm Sản Phẩm Mới', productFormHtml(), async () => {
        const product = await apiPost('/products', readProductForm());
        closeAdminModal();
        await loadProducts();
        showSuccessNotice(`Sản phẩm ${product.name} đã được tạo.`, 'Đã thêm sản phẩm');
    });
};

window.editProduct = (id) => {
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    openAdminModal('Sửa Sản Phẩm', productFormHtml(product), async () => {
        const updatedProduct = await apiPatch('/products/' + id, readProductForm());
        closeAdminModal();
        await loadProducts();
        showSuccessNotice(`Sản phẩm ${updatedProduct.name} đã được cập nhật.`, 'Đã lưu sản phẩm');
    });
};

window.generateRandomPromoCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    const input = document.getElementById('f_pcode');
    if (input) input.value = code;
};

window.togglePromoCodeMode = () => {
    const input = document.getElementById('f_pcode');
    const toggleBtn = document.getElementById('f_pcode_toggle');
    if (!input || !toggleBtn) return;
    const isRandom = toggleBtn.dataset.mode === 'random';
    if (isRandom) {
        toggleBtn.dataset.mode = 'manual';
        toggleBtn.textContent = '🎲 Ngẫu nhiên';
        input.readOnly = false;
        input.value = '';
        input.placeholder = 'Nhập mã tùy ý...';
        input.focus();
    } else {
        toggleBtn.dataset.mode = 'random';
        toggleBtn.textContent = '✏️ Nhập tay';
        generateRandomPromoCode();
        input.readOnly = true;
    }
};

window.filterPromoProducts = () => {
    const query = (document.getElementById('f_ptarget_search')?.value || '').toLowerCase();
    const items = document.querySelectorAll('.promo-product-item');
    items.forEach(item => {
        const label = item.textContent.toLowerCase();
        item.style.display = label.includes(query) ? '' : 'none';
    });
};

function promoFormHtml(promo = {}) {
    const selectedIds = promo.targetProducts || [];
    const productCheckboxes = (state.products || []).map(p => {
        const checked = selectedIds.includes(p.id) ? 'checked' : '';
        return `<label class="promo-product-item" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;transition:background 0.15s;color:rgba(255,255,255,0.85);">
            <input type="checkbox" class="f_ptarget_cb" value="${escapeHTML(p.id)}" ${checked} style="accent-color:var(--admin-accent);width:16px;height:16px;cursor:pointer;">
            <span style="flex:1;font-size:0.88rem;">${escapeHTML(p.name)}</span>
            <span style="font-size:0.72rem;color:rgba(255,255,255,0.35);font-family:monospace;">${escapeHTML(p.id)}</span>
        </label>`;
    }).join('');

    const isEdit = !!promo.code;
    const startMode = isEdit ? 'manual' : 'random';
    const startBtnText = isEdit ? '🎲 Ngẫu nhiên' : '✏️ Nhập tay';

    return `
        <div style="display:grid;gap:1.25rem;">
            <!-- Row 1: Mã code (full width) -->
            <div class="form-group">
                <label>Mã code</label>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <input type="text" id="f_pcode" value="${escapeHTML(promo.code || '')}" placeholder="${isEdit ? '' : 'Tự động tạo...'}" ${isEdit ? '' : 'readonly'} style="flex:1;">
                    <button id="f_pcode_toggle" data-mode="${startMode}" class="btn-sm" type="button" onclick="togglePromoCodeMode()" style="white-space:nowrap;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:6px;padding:0.45rem 0.85rem;cursor:pointer;font-size:0.82rem;transition:all 0.2s;">${startBtnText}</button>
                    <button class="btn-sm" type="button" onclick="generateRandomPromoCode()" style="white-space:nowrap;background:linear-gradient(135deg,#FF5C00,#FBBF24);border:none;color:#fff;border-radius:6px;padding:0.45rem 0.85rem;cursor:pointer;font-size:0.82rem;">🎲 Tạo mã</button>
                </div>
            </div>

            <!-- Row 2: Giảm giá + Loại -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div class="form-group"><label>Giảm giá (%)</label><input type="number" id="f_pdisc" min="0" max="100" value="${discountOf(promo) || 10}"></div>
                <div class="form-group">
                    <label>Loại khuyến mãi</label>
                    <select id="f_ptype" class="admin-select" style="width:100%;">
                        <option value="global" ${promo.type === 'global' || !promo.type ? 'selected' : ''}>Toàn hệ thống</option>
                        <option value="time" ${promo.type === 'time' ? 'selected' : ''}>Theo thời gian</option>
                        <option value="event" ${promo.type === 'event' ? 'selected' : ''}>Sự kiện</option>
                        <option value="product" ${promo.type === 'product' ? 'selected' : ''}>Sản phẩm cụ thể</option>
                    </select>
                </div>
            </div>

            <!-- Row 3: Sản phẩm đích (searchable checkbox list) -->
            <div class="form-group">
                <label>Sản phẩm đích</label>
                <input type="text" id="f_ptarget_search" placeholder="🔍 Tìm sản phẩm..." oninput="filterPromoProducts()" style="margin-bottom:0.5rem;font-size:0.85rem;">
                <div style="max-height:150px;overflow-y:auto;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;">
                    ${productCheckboxes || '<span style="color:rgba(255,255,255,0.3);padding:10px;display:block;text-align:center;font-size:0.85rem;">Chưa có sản phẩm nào</span>'}
                </div>
            </div>

            <!-- Row 4: Ngày bắt đầu / kết thúc -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div class="form-group"><label>Ngày bắt đầu</label><input type="date" id="f_pstart" value="${escapeHTML(promo.startDate || '')}"></div>
                <div class="form-group"><label>Ngày kết thúc</label><input type="date" id="f_pend" value="${escapeHTML(promo.endDate || '')}"></div>
            </div>

            <!-- Row 5: Active checkbox -->
            <label class="check-row"><input type="checkbox" id="f_pactive" ${promo.isActive !== false ? 'checked' : ''} style="accent-color:var(--admin-accent);"> Đang hoạt động</label>
        </div>
    `;
}

function readPromoForm() {
    const code = document.getElementById('f_pcode').value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('f_pdisc').value, 10);
    const type = document.getElementById('f_ptype').value;
    const startDate = document.getElementById('f_pstart').value || null;
    const endDate = document.getElementById('f_pend').value || null;
    const checkboxes = document.querySelectorAll('.f_ptarget_cb:checked');
    const targetProducts = Array.from(checkboxes).map(cb => cb.value);

    if (!code) throw new Error('Mã khuyến mãi không được trống');
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Giảm giá phải từ 0 đến 100');
    
    return { 
        code, 
        discount, 
        discountPercent: discount, 
        type,
        startDate,
        endDate,
        targetProducts,
        isActive: document.getElementById('f_pactive').checked 
    };
}

window.openPromoForm = async () => {
    if (!state.products || !state.products.length) {
        try { state.products = await apiGet('/products'); } catch(e) { console.warn('Could not load products for promo form'); }
    }
    openAdminModal('Tạo Mã Khuyến Mãi', promoFormHtml(), async () => {
        await apiPost('/promotions', readPromoForm());
        closeAdminModal();
        await loadPromotions();
    });
    setTimeout(() => generateRandomPromoCode(), 50);
};


window.editPromo = async (id) => {
    const promo = state.promotions.find(p => p.id === id);
    if (!promo) return;
    if (!state.products || !state.products.length) {
        try { state.products = await apiGet('/products'); } catch(e) {}
    }
    openAdminModal('Sửa Mã Khuyến Mãi', promoFormHtml(promo), async () => {
        await apiPatch('/promotions/' + id, readPromoForm());
        closeAdminModal();
        await loadPromotions();
    });
};

function userFormHtml(user = {}) {
    return `
        <div class="form-grid">
            <div class="form-group"><label>Họ tên</label><input type="text" id="f_uname" value="${escapeHTML(user.name || '')}" placeholder="Nguyễn Văn A"></div>
            <div class="form-group"><label>Username</label><input type="text" id="f_uuser" value="${escapeHTML(user.username || '')}"></div>
            <div class="form-group"><label>Email</label><input type="email" id="f_uemail" value="${escapeHTML(user.email || '')}"></div>
            <div class="form-group"><label>Mật khẩu ${user.id ? '(để trống nếu không đổi)' : ''}</label><input type="password" id="f_upass" minlength="8" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự"></div>
            <div class="form-group"><label>Quyền</label><select id="f_urole" class="admin-select"><option value="user" ${user.role !== 'admin' ? 'selected' : ''}>User</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
        </div>
    `;
}

function readUserForm(isEdit = false) {
    const payload = {
        name: document.getElementById('f_uname').value.trim(),
        username: document.getElementById('f_uuser').value.trim(),
        email: document.getElementById('f_uemail').value.trim(),
        role: document.getElementById('f_urole').value
    };
    const password = document.getElementById('f_upass').value.trim();
    if (!payload.name || !payload.username) throw new Error('Tên và username không được trống');
    if (!isEdit && !password) throw new Error('Mật khẩu không được trống');
    if (password) {
        const passwordError = getPasswordError(password);
        if (passwordError) throw new Error(passwordError);
    }
    if (password) payload.password = password;
    return payload;
}

window.openUserForm = () => {
    openAdminModal('Thêm Thành Viên', userFormHtml(), async () => {
        await apiPost('/users', readUserForm(false));
        closeAdminModal();
        await loadUsers();
    });
};

window.editUser = (id) => {
    const user = state.users.find(u => u.id === id);
    if (!user) return;
    openAdminModal('Sửa Thành Viên', userFormHtml(user), async () => {
        await apiPatch('/users/' + id, readUserForm(true));
        closeAdminModal();
        await loadUsers();
    });
};
