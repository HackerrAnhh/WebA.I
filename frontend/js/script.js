const API_BASE = window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;
const nativeAlert = window.alert.bind(window);

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
        glow: `hsl(${hue} 88% 58% / 0.34)`,
        ink: `hsl(${thirdHue} 42% 13%)`
    };
});
const PRODUCT_IMAGE_ANIMATIONS = new Set([
    'float',
    'pulse',
    'tilt',
    'orbit',
    'zoom',
    'shimmer',
    'bounce',
    'glow',
    'drift',
    'none'
]);
const MIN_PASSWORD_LENGTH = 8;

function getProductTheme(themeId = '') {
    return PRODUCT_THEMES.find(theme => theme.id === themeId) || PRODUCT_THEMES[0];
}

function productThemeStyle(theme) {
    return [
        `--card-theme-a:${theme.accentA}`,
        `--card-theme-b:${theme.accentB}`,
        `--card-theme-c:${theme.accentC}`,
        `--card-theme-glow:${theme.glow}`,
        `--card-theme-ink:${theme.ink}`
    ].join(';');
}

function getProductImageAnimation(value = '') {
    const animation = String(value || '').trim();
    return PRODUCT_IMAGE_ANIMATIONS.has(animation) ? animation : 'float';
}

function getPasswordError(password = '') {
    return String(password || '').length >= MIN_PASSWORD_LENGTH
        ? ''
        : `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
}

let successNoticeLastFocus = null;
let successNoticeResolver = null;

function closeSuccessNotice(result = true) {
    const notice = document.getElementById('successNotice');
    if (!notice) return;
    notice.classList.remove('active', 'is-confirm', 'is-success', 'is-error', 'is-warning');
    notice.setAttribute('aria-hidden', 'true');
    if (successNoticeResolver) {
        successNoticeResolver(result);
        successNoticeResolver = null;
    }
    if (successNoticeLastFocus?.focus) successNoticeLastFocus.focus();
    successNoticeLastFocus = null;
}

function getNoticeType(message) {
    const text = String(message || '');
    if (/^(Lỗi|Không tải được|Không thể|Không đọc được|Đăng nhập thất bại|Đăng ký thất bại|Error|Network|Failed)|\blỗi\b|thất bại|failed|error/i.test(text)) {
        return 'error';
    }
    if (/Hãy chọn|Vui lòng|thiếu|chưa chọn|File quá lớn|Tồn kho không hợp lệ|Giỏ hàng trống|Secret Key/i.test(text)) {
        return 'warning';
    }
    return 'success';
}

function openNotice(message, title = 'Thông báo', options = {}) {
    const notice = document.getElementById('successNotice');
    const titleEl = document.getElementById('successNoticeTitle');
    const messageEl = document.getElementById('successNoticeMessage');
    const okBtn = document.getElementById('successNoticeOk');
    const cancelBtn = document.getElementById('successNoticeCancel');
    const kickerEl = document.querySelector('.success-notice-kicker');
    const isConfirm = !!options.confirm;
    const type = options.type || (isConfirm ? 'warning' : getNoticeType(message));
    if (!notice || !titleEl || !messageEl || !okBtn || !cancelBtn || !kickerEl) {
        return Promise.resolve(isConfirm ? false : (nativeAlert(message), true));
    }

    successNoticeLastFocus = document.activeElement;
    titleEl.textContent = title;
    messageEl.textContent = message;
    kickerEl.textContent = options.kicker || (type === 'error' ? 'ERROR' : type === 'warning' ? 'WARNING' : 'DONE');
    okBtn.textContent = options.okText || 'OK';
    cancelBtn.textContent = options.cancelText || 'Hủy';
    notice.classList.remove('active', 'is-success', 'is-error', 'is-warning');
    notice.classList.toggle('is-confirm', isConfirm);
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

function showInfoNotice(message, title = '') {
    const text = String(message || '');
    const type = getNoticeType(text);
    const resolvedTitle = title || (type === 'error' ? 'Có lỗi xảy ra' : type === 'warning' ? 'Cần kiểm tra' : 'Thông báo');
    return openNotice(text, resolvedTitle, { type, okText: 'OK' });
}

window.alert = (message) => {
    showInfoNotice(String(message || ''));
};

const escapeHTML = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const encodeDataAttr = (value) => escapeHTML(JSON.stringify(value || []));

// ─── Auth State ───────────────────────────────────────────────────────────────
const Auth = {
    getToken: () => localStorage.getItem('gs_token'),
    getUser:  () => { try { return JSON.parse(localStorage.getItem('gs_user')); } catch { return null; } },
    isLoggedIn: () => !!localStorage.getItem('gs_token'),
    save(token, user) {
        localStorage.setItem('gs_token', token);
        localStorage.setItem('gs_user', JSON.stringify(user));
        if (user.role === 'admin') {
            localStorage.setItem('admin_token', token);
        }
    },
    clear() {
        localStorage.removeItem('gs_token');
        localStorage.removeItem('gs_user');
        localStorage.removeItem('admin_token');
    },
    getHeaders() {
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` };
    }
};

function updateNavAuthUI() {
    const user = Auth.getUser();
    const authArea = document.getElementById('authArea');
    const userArea = document.getElementById('userArea');
    const navUsername = document.getElementById('navUsername');
    const adminDashBtn = document.getElementById('adminDashBtn');
    if (!authArea || !userArea) return;

    if (user) {
        authArea.style.display = 'none';
        userArea.style.display = 'flex';
        navUsername.textContent = '👤 ' + user.name;
        adminDashBtn.style.display = user.role === 'admin' ? 'flex' : 'none';
    } else {
        authArea.style.display = 'block';
        userArea.style.display = 'none';
    }
}

// Require login before protected actions
function requireLogin(callback) {
    if (Auth.isLoggedIn()) { callback(); return; }
    // Show login modal, store callback to fire after login
    window._afterLoginCallback = callback;
    document.getElementById('authModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab('login');
}

window.switchAuthTab = (tab) => {
    document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
};

// ─── Product Grid Renderer ────────────────────────────────────────────────────
let _allProducts = [];

function getProductSearchText(product) {
    return [
        product.name,
        product.title,
        product.subtitle,
        product.description,
        product.engineBadge,
        ...(Array.isArray(product.features) ? product.features : []),
        ...(Array.isArray(product.plans) ? product.plans.map(p => p.name) : [])
    ].join(' ').toLowerCase();
}

function filterProductsLocally(query) {
    const q = query.trim().toLowerCase();
    if (!q) return _allProducts;
    return _allProducts.filter(product => getProductSearchText(product).includes(q));
}

function renderProductGrid(products, query = '') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (!products.length) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:3rem;">Không tìm thấy sản phẩm phù hợp.</p>';
        return;
    }
    const resultLabel = query
        ? `<div class="search-results-count">Tìm thấy ${products.length} sản phẩm cho "${escapeHTML(query)}"</div>`
        : '';
    grid.innerHTML = resultLabel + products.map(p => {
        const plans = Array.isArray(p.plans) && p.plans.length ? p.plans : [{ name: '1 Tháng', price: 0, original: 0 }];
        const features = Array.isArray(p.features) ? p.features : [];
        const lowestPlan = plans.reduce((min, pl) => pl.price < min.price ? pl : min, plans[0]);
        const isOutOfStock = (p.stock || 0) === 0;
        const discountPct = lowestPlan.original && lowestPlan.original > lowestPlan.price
            ? Math.round((1 - lowestPlan.price / lowestPlan.original) * 100)
            : 50;
        const stockBadge = isOutOfStock
            ? `<span class="stock-pill stock-pill-out">HẾT HÀNG</span>`
            : p.stock <= 3
            ? `<span class="stock-pill stock-pill-low">CÒN ${p.stock} GÓI</span>`
            : `<span class="stock-pill stock-pill-ok">${p.stock} GÓI</span>`;
        const theme = getProductTheme(p.productTheme || p.theme);
        const imageAnimation = getProductImageAnimation(p.imageAnimation);

        return `
            <div class="product-card${isOutOfStock ? ' is-out-of-stock' : ''}"
                style="${productThemeStyle(theme)}"
                data-id="${escapeHTML(p.id)}"
                data-theme="${theme.id}"
                data-animation="${imageAnimation}"
                data-plans='${encodeDataAttr(plans)}'
                data-features='${encodeDataAttr(features)}'
                ${!isOutOfStock ? 'onclick="openProductModal(this)"' : ''}>
                ${isOutOfStock ? `
                <div class="out-of-stock-overlay">
                    <div class="out-of-stock-stamp">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                        <span>HẾT HÀNG</span>
                    </div>
                </div>` : ''}
                <div class="card-inner">
                    <div class="card-header ${escapeHTML(p.iconClass || 'bg-chatgpt')}">
                        ${stockBadge}
                        <div class="header-content${p.image ? ' product-visual-content' : ''}">
                            <div class="engine-badge">${escapeHTML(p.engineBadge || 'PREMIUM')}</div>
                            ${p.image ? `
                                <div class="product-img-container img-anim-${imageAnimation}">
                                    <span class="product-image-aura" aria-hidden="true"></span>
                                    <img src="${escapeHTML(p.image)}" class="product-main-img" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async">
                                    <div class="product-visual-copy">
                                        <strong>${escapeHTML(p.title || p.name)}</strong>
                                        <span>${escapeHTML(p.subtitle || p.engineBadge || '')}</span>
                                    </div>
                                </div>
                            ` : `
                                <div class="app-icon">${p.appIconHtml || ''}</div>
                                <h3>${escapeHTML(p.title || p.name)}</h3>
                                <p class="app-subtitle">${escapeHTML(p.subtitle || '')}</p>
                            `}
                        </div>
                    </div>
                    <div class="card-body">
                        <h4>${escapeHTML(p.name)}</h4>
                        <p class="description">${escapeHTML(p.description || '')}</p>
                        <div class="pricing">
                            <div class="price-block">
                                <span class="prefix">${escapeHTML(p.pricePrefix || 'Chỉ từ')}</span>
                                <div class="price-row">
                                    <span class="price-now">${lowestPlan.price.toLocaleString('vi-VN')}đ</span>
                                    ${lowestPlan.original ? `<del>${lowestPlan.original.toLocaleString('vi-VN')}đ</del>` : ''}
                                </div>
                                <span class="plan-hint">/ ${escapeHTML(lowestPlan.name)}</span>
                            </div>
                            <div class="discount-block">
                                <div class="discount-pct">-${discountPct}%</div>
                                <div class="discount-label">SALE</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

async function loadProductsFromAPI(query = '') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    const normalizedQuery = query.trim();
    grid.setAttribute('aria-busy', 'true');
    try {
        const url = normalizedQuery ? `${API_BASE}/products?q=${encodeURIComponent(normalizedQuery)}` : `${API_BASE}/products`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const products = await res.json();
        if (!normalizedQuery) _allProducts = products;
        renderProductGrid(products, normalizedQuery);
    } catch (e) {
        console.warn('Backend offline:', e);
        if (_allProducts.length) {
            renderProductGrid(filterProductsLocally(normalizedQuery), normalizedQuery);
        } else {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:3rem;">Không thể tải sản phẩm. Hãy kiểm tra server Node đang chạy ở cổng 3000.</p>';
        }
    } finally {
        grid.removeAttribute('aria-busy');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('successNoticeOk')?.addEventListener('click', () => closeSuccessNotice(true));
    document.getElementById('successNoticeCancel')?.addEventListener('click', () => closeSuccessNotice(false));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.getElementById('successNotice')?.classList.contains('active')) {
            closeSuccessNotice(false);
        }
    });

    const modal = document.getElementById('contactModal');
    const openBtn = document.getElementById('openContactModal');
    const openBtnMobile = document.getElementById('openContactModalMobile');
    const closeBtn = document.getElementById('closeContactModal');

    const openModal = () => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (openBtnMobile) openBtnMobile.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    // ─── Auth UI Setup ────────────────────────────────────────────────────────
    updateNavAuthUI();

    // Open login modal
    const openLoginModalBtn = document.getElementById('openLoginModal');
    if (openLoginModalBtn) openLoginModalBtn.addEventListener('click', () => {
        document.getElementById('authModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    // Close auth modal
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authModalEl = document.getElementById('authModal');
    if (closeAuthModal) closeAuthModal.addEventListener('click', () => {
        authModalEl.classList.remove('active');
        document.body.style.overflow = '';
        window._afterLoginCallback = null;
    });
    if (authModalEl) authModalEl.addEventListener('click', e => {
        if (e.target === authModalEl) {
            authModalEl.classList.remove('active');
            document.body.style.overflow = '';
            window._afterLoginCallback = null;
        }
    });

    // Login form submit
    document.getElementById('btnDoLogin')?.addEventListener('click', async () => {
        const username = document.getElementById('fLoginUser').value.trim();
        const password = document.getElementById('fLoginPass').value.trim();
        const errEl = document.getElementById('loginErrMsg');
        errEl.style.display = 'none';
        if (!username || !password) {
            errEl.textContent = 'Vui lòng nhập tài khoản và mật khẩu!';
            errEl.style.display = 'block';
            return;
        }
        const passwordError = getPasswordError(password);
        if (passwordError) {
            errEl.textContent = passwordError;
            errEl.style.display = 'block';
            return;
        }
        try {
            const res = await fetch(API_BASE + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.token) {
                Auth.save(data.token, data.user);
                updateNavAuthUI();
                authModalEl.classList.remove('active');
                document.body.style.overflow = '';
                if (window._afterLoginCallback) {
                    window._afterLoginCallback();
                    window._afterLoginCallback = null;
                }
            } else {
                errEl.textContent = data.error || 'Đăng nhập thất bại';
                errEl.style.display = 'block';
            }
        } catch {
            errEl.textContent = 'Không thể kết nối server!';
            errEl.style.display = 'block';
        }
    });
    document.getElementById('fLoginPass')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnDoLogin')?.click();
    });

    // Register form submit
    document.getElementById('btnDoRegister')?.addEventListener('click', async () => {
        const name     = document.getElementById('fRegName').value.trim();
        const username = document.getElementById('fRegUser').value.trim();
        const password = document.getElementById('fRegPass').value.trim();
        const email    = document.getElementById('fRegEmail').value.trim();
        const errEl = document.getElementById('registerErrMsg');
        errEl.style.display = 'none';
        if (!name || !username || !password) {
            errEl.textContent = 'Vui lòng điền đầy đủ thông tin!';
            errEl.style.display = 'block';
            return;
        }
        const passwordError = getPasswordError(password);
        if (passwordError) {
            errEl.textContent = passwordError;
            errEl.style.display = 'block';
            return;
        }
        try {
            const res = await fetch(API_BASE + '/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password, email })
            });
            const data = await res.json();
            if (data.token) {
                Auth.save(data.token, data.user);
                updateNavAuthUI();
                authModalEl.classList.remove('active');
                document.body.style.overflow = '';
                if (window._afterLoginCallback) {
                    window._afterLoginCallback();
                    window._afterLoginCallback = null;
                }
            } else {
                errEl.textContent = data.error || 'Đăng ký thất bại';
                errEl.style.display = 'block';
            }
        } catch {
            errEl.textContent = 'Không thể kết nối server!';
            errEl.style.display = 'block';
        }
    });

    // Logout (frontend)
    document.getElementById('btnLogoutFront')?.addEventListener('click', () => {
        Auth.clear();
        updateNavAuthUI();
    });

    // ─── Search ───────────────────────────────────────────────────────────────
    let _searchTimer;
    const searchInput = document.getElementById('globalSearchInput');
    const searchBtn = document.getElementById('btnGlobalSearch');
    
    const triggerSearch = () => {
        clearTimeout(_searchTimer);
        loadProductsFromAPI(searchInput.value.trim());
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(triggerSearch, 400);
        });
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') triggerSearch();
        });
    }
    if (searchBtn) {
        searchBtn.addEventListener('click', triggerSearch);
    }


    function base32Decode(base32) {
        const clean = base32.replace(/[\s=-]/g, '').toUpperCase();
        if (!clean || /[^A-Z2-7]/.test(clean)) {
            throw new Error('Secret Key không đúng định dạng Base32');
        }
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        for (let i = 0; i < clean.length; i++) {
            const val = alphabet.indexOf(clean.charAt(i));
            bits += val.toString(2).padStart(5, '0');
        }
        const length = Math.floor(bits.length / 8);
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
        }
        return bytes;
    }

    function concatBytes(...arrays) {
        const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        arrays.forEach(arr => {
            out.set(arr, offset);
            offset += arr.length;
        });
        return out;
    }

    function sha1(bytes) {
        const ml = bytes.length * 8;
        const withOne = bytes.length + 1;
        const paddedLength = Math.ceil((withOne + 8) / 64) * 64;
        const data = new Uint8Array(paddedLength);
        data.set(bytes);
        data[bytes.length] = 0x80;
        const view = new DataView(data.buffer);
        view.setUint32(paddedLength - 8, Math.floor(ml / 0x100000000));
        view.setUint32(paddedLength - 4, ml >>> 0);

        let h0 = 0x67452301;
        let h1 = 0xefcdab89;
        let h2 = 0x98badcfe;
        let h3 = 0x10325476;
        let h4 = 0xc3d2e1f0;
        const w = new Uint32Array(80);

        for (let i = 0; i < paddedLength; i += 64) {
            for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4);
            for (let j = 16; j < 80; j++) {
                const val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (val << 1) | (val >>> 31);
            }

            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let j = 0; j < 80; j++) {
                let f, k;
                if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
                else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
                else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
                else { f = b ^ c ^ d; k = 0xca62c1d6; }
                const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0;
                e = d;
                d = c;
                c = ((b << 30) | (b >>> 2)) >>> 0;
                b = a;
                a = temp;
            }
            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
        }

        const out = new Uint8Array(20);
        const outView = new DataView(out.buffer);
        [h0, h1, h2, h3, h4].forEach((h, i) => outView.setUint32(i * 4, h));
        return out;
    }

    function hmacSha1(key, message) {
        let normalizedKey = key;
        if (normalizedKey.length > 64) normalizedKey = sha1(normalizedKey);
        const block = new Uint8Array(64);
        block.set(normalizedKey);
        const outer = new Uint8Array(64);
        const inner = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
            outer[i] = block[i] ^ 0x5c;
            inner[i] = block[i] ^ 0x36;
        }
        return sha1(concatBytes(outer, sha1(concatBytes(inner, message))));
    }

    function getCounterBuffer() {
        let counter = Math.floor(Date.now() / 1000 / 30);
        const counterBuffer = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            counterBuffer[i] = counter & 0xff;
            counter = Math.floor(counter / 256);
        }
        return counterBuffer;
    }

    async function generateTOTP(secret) {
        try {
            const secretBytes = base32Decode(secret);
            const counterBuffer = getCounterBuffer();
            let hmacBytes;
            if (window.crypto?.subtle) {
                const key = await crypto.subtle.importKey(
                    'raw',
                    secretBytes,
                    { name: 'HMAC', hash: { name: 'SHA-1' } },
                    false,
                    ['sign']
                );
                const hmac = await crypto.subtle.sign('HMAC', key, counterBuffer);
                hmacBytes = new Uint8Array(hmac);
            } else {
                hmacBytes = hmacSha1(secretBytes, counterBuffer);
            }

            const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
            const code = ((hmacBytes[offset] & 0x7f) << 24 |
                        (hmacBytes[offset + 1] & 0xff) << 16 |
                        (hmacBytes[offset + 2] & 0xff) << 8 |
                        (hmacBytes[offset + 3] & 0xff)) % 1000000;

            return code.toString().padStart(6, '0');
        } catch (e) {
            console.error("Lỗi tạo mã 2FA:", e);
            return "ERROR";
        }
    }

    const btnOtp = document.querySelector('.tool-2fa .btn-otp');
    const input2fa = document.querySelector('.tool-2fa input');
    const display2fa = document.querySelector('.code-display');

    if (btnOtp && input2fa && display2fa) {
        const updateOtp = async (showLoading = true) => {
            const secret = input2fa.value.trim().replace(/\s+/g, '');
            if (!secret) {
                alert('Vui lòng nhập Secret Key!');
                return;
            }
            if (showLoading) display2fa.textContent = '...';
            const code = await generateTOTP(secret);
            display2fa.textContent = code;
            display2fa.dataset.active = code === 'ERROR' ? '0' : '1';
            const remain = 30 - (Math.floor(Date.now() / 1000) % 30);
            display2fa.title = `Còn ${remain}s trước khi đổi mã`;
        };

        btnOtp.addEventListener('click', () => updateOtp(true));
        input2fa.addEventListener('keydown', e => {
            if (e.key === 'Enter') updateOtp(true);
        });
        input2fa.addEventListener('input', () => {
            display2fa.dataset.active = '0';
            display2fa.textContent = '000000';
            display2fa.removeAttribute('title');
        });
        setInterval(() => {
            if (display2fa.dataset.active === '1' && input2fa.value.trim()) updateOtp(false);
        }, 1000);
    }

    // --- Theme Toggle Functionality ---
    const themeBtn = document.querySelector('.settings-btn');
    
    const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const updateThemeIcon = (theme) => {
        if (!themeBtn) return;
        themeBtn.innerHTML = theme === 'light' ? moonIcon : sunIcon;
    };

    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    updateThemeIcon(savedTheme);

        if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            if (newTheme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    // --- Global State ---
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let currentProduct = null;

    // --- DOM Elements ---
    const cartBadge = document.querySelector('.cart-btn .badge');
    const cartBtn = document.querySelector('.cart-btn');

    // Update Cart Badge
    function updateCartBadge() {
        if(cartBadge) {
            cartBadge.textContent = cart.length;
        }
    }
    updateCartBadge();

    // --- Product Modal Logic ---
    const productModal = document.getElementById('productModal');
    const pmIcon = document.getElementById('pmIcon');
    const pmTitle = document.getElementById('pmTitle');
    const pmSubtitle = document.getElementById('pmSubtitle');
    const pmFeatures = document.getElementById('pmFeatures');
    const pmPlans = document.getElementById('pmPlans');
    const btnAddToCart = document.getElementById('btnAddToCart');

    window.openProductModal = (card) => {
        const appIcon = card.querySelector('.app-icon');
        const headerH3 = card.querySelector('.header-content h3');
        const bodyH4 = card.querySelector('.card-body h4');
        const subtitle = card.querySelector('.app-subtitle');
        const productImg = card.querySelector('.product-main-img');

        const title = headerH3?.textContent || bodyH4?.textContent || 'Sản phẩm';
        const iconHTML = appIcon ? appIcon.innerHTML : (productImg ? `<img src="${productImg.src}" style="width:40px;height:40px;object-fit:contain;">` : '<span>📦</span>');
        const iconClasses = appIcon ? appIcon.className : 'app-icon';
        const bgClass = card.querySelector('.card-header')?.className.split(' ').find(c => c.startsWith('bg-')) || 'bg-chatgpt';

        currentProduct = {
            id: card.dataset.id,
            title,
            iconHTML,
            iconClasses,
            bgClass,
            plans: JSON.parse(card.dataset.plans),
            features: JSON.parse(card.dataset.features)
        };

        // Populate Modal
        pmIcon.innerHTML = currentProduct.iconHTML;
        pmIcon.className = `pm-icon ${currentProduct.iconClasses.replace('app-icon', '').trim()} ${currentProduct.bgClass}`;
        pmTitle.textContent = currentProduct.title;
        pmSubtitle.textContent = subtitle?.textContent || '';
        
        pmFeatures.innerHTML = `<ul>${currentProduct.features.map(f => `<li>${f}</li>`).join('')}</ul>`;
        
        pmPlans.innerHTML = currentProduct.plans.map((plan, index) => `
            <div class="plan-option ${index === 0 ? 'selected' : ''}" data-index="${index}" onclick="selectPlan(this)">
                <span class="plan-name">${plan.name}</span>
                <span class="plan-price">${plan.price.toLocaleString('vi-VN')}đ</span>
            </div>
        `).join('');

        // Use requestAnimationFrame for smooth entry
        requestAnimationFrame(() => {
            productModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    };

    const productGrid = document.getElementById('productGrid');
    const isAnyOverlayActive = () => !!document.querySelector('.modal-overlay.active, .cart-sidebar-overlay.active');

    const findProductCardFromClick = (event) => {
        if (!productGrid || isAnyOverlayActive()) return null;
        if (event.target?.closest?.('.modal-overlay, .cart-sidebar-overlay, .chatbot-container')) return null;

        const card = event.target?.closest?.('.product-card');
        if (card && productGrid.contains(card) && !card.classList.contains('is-out-of-stock')) {
            return card;
        }
        return null;
    };

    if (productGrid) {
        document.addEventListener('click', (event) => {
            const card = findProductCardFromClick(event);
            if (!card) return;
            event.preventDefault();
            event.stopPropagation();
            window.openProductModal(card);
        }, true);
    }

    window.selectPlan = (element) => {
        document.querySelectorAll('.plan-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
    };

    if (btnAddToCart) {
        btnAddToCart.addEventListener('click', () => {
            requireLogin(() => {
                if(!currentProduct) return;
                const selectedPlanElement = document.querySelector('.plan-option.selected');
                if(!selectedPlanElement) return;
                
                const planIndex = selectedPlanElement.dataset.index;
                const selectedPlan = currentProduct.plans[planIndex];

                const existingItem = cart.find(i => i.productId === currentProduct.id && i.planName === selectedPlan.name);
                if(existingItem) {
                    existingItem.quantity = (existingItem.quantity || 1) + 1;
                } else {
                    const cartItem = {
                        cartId: Date.now().toString(),
                        productId: currentProduct.id,
                        title: currentProduct.title,
                        planName: selectedPlan.name,
                        price: selectedPlan.price,
                        quantity: 1
                    };
                    cart.push(cartItem);
                }

                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartBadge();
                
                productModal.classList.remove('active');
                
                renderCart();
                cartSidebarDOM.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });
    }

    // --- Cart Sidebar Logic ---
    const cartSidebarDOM = document.getElementById('cartSidebar');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartDiscount = document.getElementById('cartDiscount');
    const cartTotalPrice = document.getElementById('cartTotalPrice');

    function renderCart() {
        if(cart.length === 0) {
            cartItemsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 1rem;">Giỏ hàng của bạn đang trống.</p>';
            if(cartSubtotal) cartSubtotal.textContent = '0đ';
            if(cartDiscount) cartDiscount.textContent = '-0đ';
            if(cartTotalPrice) cartTotalPrice.textContent = '0đ';
            return;
        }

        cartItemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-header">
                    <div class="cart-item-info">
                        <h4>${item.title}</h4>
                        <p>Gói: ${item.planName}</p>
                    </div>
                    <button class="btn-remove" onclick="removeFromCart('${item.cartId}')" aria-label="Xóa">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
                <div class="cart-item-footer">
                    <span class="cart-item-price">${(item.price * (item.quantity || 1)).toLocaleString('vi-VN')}đ</span>
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="updateCartQty('${item.cartId}', -1)">-</button>
                        <span class="qty-val">${item.quantity || 1}</span>
                        <button class="qty-btn" onclick="updateCartQty('${item.cartId}', 1)">+</button>
                    </div>
                </div>
            </div>
        `).join('');

        const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        const discount = subtotal * 0.1; // 10% discount
        const total = subtotal - discount;

        if(cartSubtotal) cartSubtotal.textContent = `${subtotal.toLocaleString('vi-VN')}đ`;
        if(cartDiscount) cartDiscount.textContent = `-${discount.toLocaleString('vi-VN')}đ`;
        if(cartTotalPrice) cartTotalPrice.textContent = `${total.toLocaleString('vi-VN')}đ`;
    }

    window.updateCartQty = (cartId, delta) => {
        const item = cart.find(i => i.cartId === cartId);
        if(item) {
            item.quantity = (item.quantity || 1) + delta;
            if(item.quantity <= 0) {
                removeFromCart(cartId);
                return;
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartBadge();
            renderCart();
        }
    };

    window.removeFromCart = (cartId) => {
        cart = cart.filter(item => item.cartId !== cartId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        renderCart();
    };

    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            renderCart();
            cartSidebarDOM.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // --- Checkout Modal Logic ---
    const checkoutModalDOM = document.getElementById('checkoutModal');
    const btnGoToCheckout = document.getElementById('btnGoToCheckout');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutQR = document.getElementById('checkoutQR');
    const checkoutFinalPrice = document.getElementById('checkoutFinalPrice');
    const checkoutMemo = document.getElementById('checkoutMemo');

    if (btnGoToCheckout) {
        btnGoToCheckout.addEventListener('click', () => {
            requireLogin(() => {
                if(cart.length === 0) {
                    alert('Giỏ hàng trống!');
                    return;
                }
                cartSidebarDOM.classList.remove('active');
                checkoutModalDOM.classList.add('active');
                
                // Reset state
                checkoutForm.style.display = 'flex';
                checkoutQR.style.display = 'none';
                
                // Pre-fill email from auth if available
                const user = Auth.getUser();
                if (user && user.email) {
                    const emailInput = document.getElementById('checkoutEmail');
                    if (emailInput) emailInput.value = user.email;
                }
                const nameInput = document.getElementById('checkoutName');
                if (nameInput && user && user.name) nameInput.value = user.name;
            });
        });
    }

    let _checkoutPayload = null;
    const btnShowQR = document.getElementById('btnShowQR');
    if (btnShowQR) {
        btnShowQR.addEventListener('click', () => {
            const name = document.getElementById('checkoutName').value.trim();
            const phone = document.getElementById('checkoutPhone').value.trim();
            const email = document.getElementById('checkoutEmail') ? document.getElementById('checkoutEmail').value.trim() : '';
            if(!name || !phone) {
                alert('Vui lòng nhập Họ Tên và Số Điện Thoại!');
                return;
            }

            const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            const discount = subtotal * 0.1;
            const total = subtotal - discount;
            checkoutFinalPrice.textContent = `${total.toLocaleString('vi-VN')}đ`;
            checkoutMemo.textContent = `Thanh toan ${phone}`;

            _checkoutPayload = {
                name,
                phone,
                email,
                memo: `Thanh toan ${phone}`,
                items: cart.map(i => ({ productId: i.productId, planName: i.planName, quantity: i.quantity || 1 })),
                total
            };

            checkoutForm.style.display = 'none';
            checkoutQR.style.display = 'block';
        });
    }

    const btnDoneOrder = document.getElementById('btnDoneOrder');
    if (btnDoneOrder) {
        btnDoneOrder.addEventListener('click', async () => {
            // Post order to backend
            try {
                if (_checkoutPayload) {
                    const res = await fetch(API_BASE + '/orders', {
                        method: 'POST',
                        headers: Auth.getHeaders(),
                        body: JSON.stringify(_checkoutPayload)
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'Không thể tạo đơn hàng');
                    // Refresh product grid (stock may have changed)
                    loadProductsFromAPI();
                }
            } catch (e) {
                console.warn('Could not save order to backend:', e);
                alert(e.message || 'Không thể lưu đơn hàng. Vui lòng thử lại.');
                return;
            }
            alert('Cảm ơn bạn! Chúng tôi sẽ kiểm tra giao dịch và liên hệ qua Zalo/Email trong vài phút.');
            cart = [];
            localStorage.removeItem('cart');
            updateCartBadge();
            checkoutModalDOM.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Close general modals
    const modals = [
        { modal: productModal, close: document.getElementById('closeProductModal') },
        { modal: cartSidebarDOM, close: document.getElementById('closeCartSidebar') },
        { modal: checkoutModalDOM, close: document.getElementById('closeCheckoutModal') }
    ];

    modals.forEach(({modal, close}) => {
        if(close && modal) {
            close.addEventListener('click', () => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
    });

    // --- Chatbot Logic ---
    const chatbotContainer = document.getElementById('chatbotContainer');
    const chatTriggerBtn = document.getElementById('chatTriggerBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatBody = document.getElementById('chatBody');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

    if (chatTriggerBtn) {
        chatTriggerBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            chatbotContainer.classList.add('active');
        });
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            chatbotContainer.classList.remove('active');
        });
    }

    function addMessage(text, isUser) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${isUser ? 'user-msg' : 'bot-msg'}`;
        const p = document.createElement('p');
        p.textContent = text;
        msgDiv.appendChild(p);
        chatBody.appendChild(msgDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot-msg';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatBody.appendChild(typingDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function removeTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        if(typingIndicator) typingIndicator.remove();
    }

    async function getBotReply(userText) {
        try {
            const response = await fetch(API_BASE + '/chat-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    cart: cart.map(item => ({
                        productId: item.productId,
                        title: item.title,
                        planName: item.planName,
                        quantity: item.quantity || 1,
                        price: item.price
                    }))
                })
            });
            const data = await response.json().catch(() => ({}));
            if(!response.ok) throw new Error(data.error || 'Offline bot error');
            return data.reply || "Dạ em chưa tìm thấy câu trả lời trong dữ liệu shop.";
        } catch (error) {
            console.error("Offline Chat Error:", error);
            return "Dạ bot offline chưa đọc được dữ liệu lúc này. Anh/chị thử lại sau vài giây hoặc liên hệ shop trực tiếp qua Zalo/Messenger nhé.";
        }
    }

    async function handleSendMessage() {
        const text = chatInput.value.trim();
        if(!text) return;
        
        addMessage(text, true);
        chatInput.value = '';
        
        showTyping();
        
        // Fetch AI response
        const replyText = await getBotReply(text);
        
        removeTyping();
        addMessage(replyText, false);
    }

    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', handleSendMessage);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') handleSendMessage();
        });
    }

    // Load products from backend API on startup
    loadProductsFromAPI();
});
