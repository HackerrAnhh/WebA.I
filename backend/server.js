const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const zlib = require('zlib');
const xlsx = require('xlsx');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = process.env.FRONTEND_DIR
    ? path.resolve(process.env.FRONTEND_DIR)
    : path.join(ROOT_DIR, 'frontend');
const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(ROOT_DIR, 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'gemisocial_secret_key_12345';
const MIN_PASSWORD_LENGTH = 8;

fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.static(FRONTEND_DIR, {
    index: ['index.html'],
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.html$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
            return;
        }
        if (/\.(?:css|js|png|jpe?g|webp|gif|svg|ico)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const readJson = (filename) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
    } catch (e) {
        return filename === 'data_ai_config.json' ? {} : [];
    }
};

let syncTimeout = null;
const syncToGithub = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO;
        if (!token || !repo) {
            console.log('ℹ️ Git sync skipped: GITHUB_TOKEN or GITHUB_REPO not set');
            return;
        }

        const remote = `https://${token}@github.com/${repo}.git`;
        
        // Kiểm tra xem đã có thư mục .git chưa, nếu chưa thì init
        const checkGitCmd = fs.existsSync(path.join(ROOT_DIR, '.git')) 
            ? '' 
            : `git init && git remote add origin "${remote}" && git fetch && git checkout -b main origin/main && `;

        const cmd = `
            ${checkGitCmd}
            git config user.email "bot@render.com" && \
            git config user.name "Render Bot" && \
            git add -f "${DATA_DIR}/*.json" && \
            git commit -m "chore: update data [skip ci]" && \
            git push "${remote}" main
        `;

        exec(cmd, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
            if (error) {
                const safeStderr = (stderr || '').replace(token, '***');
                console.error(`❌ Git sync failed. Error: ${error.message.replace(token, '***')}`);
                if (safeStderr) console.error(`Details: ${safeStderr}`);
                return;
            }
            console.log('✅ Git sync success');
        });
    }, 5000); // Chờ 5 giây sau lần ghi cuối cùng mới push
};

const writeJson = (filename, data) => {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
    syncToGithub();
};

const asArray = (value) => Array.isArray(value) ? value : [];
const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizeProductImage = (value = '') => {
    const image = String(value || '').trim();
    if (!image) return '';
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(image)) return image;
    if (/^(?:https?:\/\/|\/|assets\/|\.\/assets\/|data\/|\.\/data\/)/i.test(image)) return image;
    return image.replace(/^javascript:/i, '');
};

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

const normalizeProductTheme = (value = '') => {
    const theme = String(value || '').trim();
    return /^theme-(00[1-9]|0[1-9]\d|100)$/.test(theme) ? theme : 'theme-001';
};

const normalizeProductAnimation = (value = '') => {
    const animation = String(value || '').trim();
    return PRODUCT_IMAGE_ANIMATIONS.has(animation) ? animation : 'float';
};

const publicUser = (user) => {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
};

const normalizePassword = (value = '') => String(value || '');
const isValidPassword = (value = '') => normalizePassword(value).length >= MIN_PASSWORD_LENGTH;
const passwordLengthError = () => `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;

const bootstrapAdminFromEnv = () => {
    const password = normalizePassword(process.env.ADMIN_PASSWORD);
    if (!password) return;
    if (!isValidPassword(password)) {
        console.warn(`ADMIN_PASSWORD ignored: must be at least ${MIN_PASSWORD_LENGTH} characters`);
        return;
    }

    const username = String(process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
    const name = String(process.env.ADMIN_NAME || 'Admin').trim() || 'Admin';
    const email = String(process.env.ADMIN_EMAIL || '').trim();
    const users = asArray(readJson('data_user.json'));
    const existingAdmin = users.find(user => user.username === username)
        || users.find(user => user.role === 'admin');
    const adminUser = {
        id: existingAdmin?.id || 'admin_01',
        username,
        password,
        role: 'admin',
        name,
        email
    };

    if (existingAdmin) {
        Object.assign(existingAdmin, adminUser);
    } else {
        users.unshift(adminUser);
    }

    writeJson('data_user.json', users);
    console.log(`Bootstrap admin ready: ${username}`);
};

bootstrapAdminFromEnv();

const normalizeProduct = (product = {}) => {
    const plans = asArray(product.plans).map((plan, index) => ({
        name: String(plan.name || `Gói ${index + 1}`).trim(),
        price: Math.max(0, toNumber(plan.price)),
        original: Math.max(0, toNumber(plan.original))
    })).filter(plan => plan.name && plan.price >= 0);

    return {
        ...product,
        id: String(product.id || `prod_${Date.now()}`),
        name: String(product.name || '').trim(),
        title: String(product.title || product.name || '').trim(),
        subtitle: String(product.subtitle || '').trim(),
        description: String(product.description || '').trim(),
        pricePrefix: String(product.pricePrefix || 'Chỉ từ').trim(),
        stock: Math.max(0, toNumber(product.stock)),
        plans: plans.length ? plans : [{ name: '1 Tháng', price: 0, original: 0 }],
        features: asArray(product.features).map(f => String(f).trim()).filter(Boolean),
        iconClass: String(product.iconClass || 'bg-chatgpt').trim(),
        engineBadge: String(product.engineBadge || 'PREMIUM').trim(),
        image: normalizeProductImage(product.image),
        productTheme: normalizeProductTheme(product.productTheme || product.theme),
        imageAnimation: normalizeProductAnimation(product.imageAnimation || product.animation),
        appIconHtml: String(product.appIconHtml || '').trim()
    };
};

const normalizePromotion = (promo = {}) => {
    const discount = Math.max(0, Math.min(100, toNumber(promo.discount ?? promo.discountPercent)));
    return {
        ...promo,
        id: String(promo.id || `promo_${Date.now()}`),
        code: String(promo.code || '').trim().toUpperCase(),
        discount,
        discountPercent: discount,
        isActive: promo.isActive !== false,
        type: String(promo.type || 'global').trim(),
        startDate: promo.startDate || null,
        endDate: promo.endDate || null,
        targetProducts: Array.isArray(promo.targetProducts) ? promo.targetProducts : []
    };
};

const buildPaymentRecords = (orders) => asArray(orders).map(order => ({
    id: `PAY_${order.id}`,
    orderId: order.id,
    customerName: order.name || order.userName || '',
    phone: order.phone || '',
    email: order.email || '',
    amount: order.total || 0,
    memo: order.memo || (order.phone ? `Thanh toan ${order.phone}` : `Thanh toan ${order.id}`),
    method: order.paymentMethod || 'bank_transfer',
    status: order.status === 'complete' ? 'confirmed' : order.status === 'cancelled' ? 'cancelled' : 'waiting',
    date: order.date
}));

const stripDiacritics = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const tokenize = (value = '') => {
    const stopwords = new Set([
        'toi', 'minh', 'ban', 'anh', 'chi', 'em', 'shop', 'co', 'la', 'gi', 'va', 'cho',
        'hoi', 'muon', 'can', 'duoc', 'khong', 'khong?', 'nay', 'do', 've', 'tu', 'mua',
        'goi', 'san', 'pham', 'tai', 'khoan', 'premium'
    ]);
    return stripDiacritics(value)
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !stopwords.has(word));
};

const flattenJsonText = (value, depth = 0) => {
    if (depth > 5 || value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(item => flattenJsonText(item, depth + 1)).join(' ');
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([key, item]) => `${key} ${flattenJsonText(item, depth + 1)}`)
            .join(' ');
    }
    return '';
};

const normalizeKnowledgeText = (value = '') => String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const decodeXmlEntities = (value = '') => String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));

const xmlToText = (xml = '') => normalizeKnowledgeText(
    decodeXmlEntities(String(xml)
        .replace(/<w:br\s*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' '))
);

const bufferToBase64 = (value = '') => String(value).replace(/^data:[^;]+;base64,/, '');

const stripBinaryNoise = (text = '') => normalizeKnowledgeText(
    text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, ' ')
);

const extractPrintableStrings = (buffer) => {
    const ascii = [];
    let current = '';
    for (const byte of buffer) {
        if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
            current += String.fromCharCode(byte);
        } else {
            if (current.trim().length >= 4) ascii.push(current.trim());
            current = '';
        }
    }
    if (current.trim().length >= 4) ascii.push(current.trim());

    const utf16 = [];
    current = '';
    for (let i = 0; i < buffer.length - 1; i += 2) {
        const code = buffer.readUInt16LE(i);
        if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff)) {
            current += String.fromCharCode(code);
        } else {
            if (current.trim().length >= 4) utf16.push(current.trim());
            current = '';
        }
    }
    if (current.trim().length >= 4) utf16.push(current.trim());

    return normalizeKnowledgeText([...ascii, ...utf16].join('\n'));
};

const readZipEntries = (buffer) => {
    const entries = {};
    const eocdSignature = 0x06054b50;
    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i--) {
        if (buffer.readUInt32LE(i) === eocdSignature) {
            eocd = i;
            break;
        }
    }
    if (eocd === -1) throw new Error('Không đọc được cấu trúc ZIP của file');

    const entryCount = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);
    for (let i = 0; i < entryCount; i++) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');

        if (buffer.readUInt32LE(localOffset) === 0x04034b50) {
            const localNameLength = buffer.readUInt16LE(localOffset + 26);
            const localExtraLength = buffer.readUInt16LE(localOffset + 28);
            const dataStart = localOffset + 30 + localNameLength + localExtraLength;
            const compressed = buffer.slice(dataStart, dataStart + compressedSize);
            if (method === 0) entries[name] = compressed;
            if (method === 8) entries[name] = zlib.inflateRawSync(compressed);
        }

        offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
};

const extractDocxText = (buffer) => {
    const entries = readZipEntries(buffer);
    const parts = Object.entries(entries)
        .filter(([name]) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
        .map(([, content]) => xmlToText(content.toString('utf8')))
        .filter(Boolean);
    return normalizeKnowledgeText(parts.join('\n'));
};

const extractXlsxText = (buffer) => {
    const entries = readZipEntries(buffer);
    const sharedXml = entries['xl/sharedStrings.xml']?.toString('utf8') || '';
    const sharedStrings = [...sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)]
        .map(match => xmlToText(match[0]));
    const rows = [];

    Object.entries(entries)
        .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([name, content]) => {
            const sheetRows = [];
            const xml = content.toString('utf8');
            for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
                const cells = [];
                for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
                    const attrs = cellMatch[1];
                    const body = cellMatch[2];
                    const isShared = /\bt="s"/.test(attrs);
                    const isInline = /\bt="inlineStr"/.test(attrs);
                    const value = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || '';
                    const text = isShared
                        ? sharedStrings[Number(value)] || ''
                        : isInline
                            ? xmlToText(body)
                            : decodeXmlEntities(value);
                    if (String(text).trim()) cells.push(String(text).trim());
                }
                if (cells.length) sheetRows.push(cells.join(' | '));
            }
            if (sheetRows.length) rows.push(`${path.basename(name)}\n${sheetRows.join('\n')}`);
        });

    return normalizeKnowledgeText(rows.join('\n\n'));
};

const extractTextFromUpload = ({ fileName = '', mimeType = '', contentBase64, text, data }) => {
    const ext = path.extname(fileName).toLowerCase();
    if (data !== undefined) {
        return {
            text: extractKnowledgeTextFromData(data),
            data,
            sourceType: 'json'
        };
    }

    let buffer;
    if (contentBase64) {
        buffer = Buffer.from(bufferToBase64(contentBase64), 'base64');
    } else if (text !== undefined) {
        buffer = Buffer.from(String(text), 'utf8');
    } else {
        throw new Error('Thiếu nội dung file để train');
    }

    if (buffer.length > 12 * 1024 * 1024) {
        throw new Error('File quá lớn. Hãy upload file dưới 12MB.');
    }

    if (ext === '.docx') return { text: extractDocxText(buffer), sourceType: 'docx' };
    if (ext === '.xlsx' || ext === '.xlsm') return { text: extractXlsxText(buffer), sourceType: 'xlsx' };

    if (ext === '.json' || mimeType.includes('json')) {
        const raw = stripBinaryNoise(buffer.toString('utf8'));
        try {
            const parsed = JSON.parse(raw);
            return { text: extractKnowledgeTextFromData(parsed), data: parsed, sourceType: 'json' };
        } catch {
            return { text: raw, sourceType: 'json-text' };
        }
    }

    const textLikeExtensions = new Set([
        '.txt', '.md', '.markdown', '.csv', '.tsv', '.sql', '.log', '.ini', '.env',
        '.yaml', '.yml', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.jsx',
        '.tsx', '.php', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs'
    ]);
    if (textLikeExtensions.has(ext) || mimeType.startsWith('text/')) {
        return { text: stripBinaryNoise(buffer.toString('utf8')), sourceType: ext.slice(1) || 'text' };
    }

    return { text: extractPrintableStrings(buffer), sourceType: ext.slice(1) || 'binary-text' };
};

const collectQaPairs = (value, pairs = []) => {
    if (!value || typeof value !== 'object') return pairs;
    if (Array.isArray(value)) {
        value.forEach(item => collectQaPairs(item, pairs));
        return pairs;
    }

    const entries = Object.entries(value);
    const getByKey = (keys) => {
        const found = entries.find(([key]) => keys.includes(stripDiacritics(key).replace(/\s+/g, '_')));
        return found ? found[1] : undefined;
    };
    const question = getByKey(['question', 'query', 'customer_query', 'customer_question', 'user_query', 'user_question', 'cau_hoi', 'hoi']);
    const answer = getByKey(['answer', 'response', 'reply', 'shop_response', 'shop_reply', 'bot_response', 'bot_reply', 'tra_loi', 'dap_an']);

    if (typeof question === 'string' && typeof answer === 'string') {
        pairs.push({ question: question.trim(), answer: answer.trim() });
    }

    entries.forEach(([, item]) => collectQaPairs(item, pairs));
    return pairs;
};

const extractKnowledgeTextFromData = (data) => {
    const pairs = collectQaPairs(data);
    if (pairs.length) {
        return normalizeKnowledgeText(pairs.map(pair => `${pair.question}\n${pair.answer}`).join('\n\n'));
    }
    return normalizeKnowledgeText(flattenJsonText(data).replace(/\s+/g, ' '));
};

const summarizeKnowledgeData = (data) => {
    if (Array.isArray(data)) return `${data.length} mục dữ liệu`;
    if (data && typeof data === 'object') return `${Object.keys(data).length} khóa dữ liệu`;
    return '1 mục dữ liệu';
};

const scoreText = (messageTokens, text) => {
    const normalized = stripDiacritics(text);
    return messageTokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
};

const findBestProduct = (message, products) => {
    const messageNorm = stripDiacritics(message);
    const tokens = tokenize(message);
    let best = null;
    products.forEach(product => {
        const haystack = [
            product.id,
            product.name,
            product.title,
            product.subtitle,
            product.description,
            product.engineBadge,
            ...product.features,
            ...product.plans.map(plan => plan.name)
        ].join(' ');
        let score = scoreText(tokens, haystack);
        const productName = stripDiacritics(product.name);
        const productTitle = stripDiacritics(product.title);
        if (productName && messageNorm.includes(productName)) score += 8;
        if (productTitle && messageNorm.includes(productTitle)) score += 4;
        if (score > 0 && (!best || score > best.score)) best = { product, score };
    });
    return best?.score >= 2 ? best.product : null;
};

const cleanKnowledgeAnswer = (value = '') => normalizeKnowledgeText(String(value)
    .replace(/\b(conversation|customer_query|shop_response|question|answer|query|response)\b/gi, ' ')
    .replace(/\s+([,.!?])/g, '$1')
);

const getRelevantSnippet = (text, tokens) => {
    const compact = normalizeKnowledgeText(text);
    if (!compact) return '';
    const chunks = compact
        .split(/\n+|(?<=[.!?])\s+/)
        .map(chunk => chunk.trim())
        .filter(Boolean);
    const bestChunks = chunks
        .map(chunk => ({ chunk, score: scoreText(tokens, chunk) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(item => item.chunk);
    const snippet = bestChunks.length ? bestChunks.join(' ') : compact;
    return snippet.length > 220 ? snippet.slice(0, 220).trim() + '...' : snippet;
};

const findKnowledgeMatches = (message, entries) => {
    const tokens = tokenize(message);
    if (!tokens.length) return [];

    const matches = [];
    asArray(entries).forEach(entry => {
        const qaPairs = asArray(entry.qaPairs).length ? entry.qaPairs : collectQaPairs(entry.data);
        qaPairs.forEach(pair => {
            const haystack = `${entry.fileName || ''} ${pair.question || ''} ${pair.answer || ''}`;
            const score = scoreText(tokens, haystack) + scoreText(tokens, pair.question || '');
            if (score > 0) {
                matches.push({
                    entry,
                    score,
                    answer: cleanKnowledgeAnswer(pair.answer),
                    snippet: cleanKnowledgeAnswer(pair.answer)
                });
            }
        });

        if (!qaPairs.length) {
            const text = entry.text || extractKnowledgeTextFromData(entry.data);
            const score = scoreText(tokens, `${entry.fileName || ''} ${entry.title || ''} ${text}`);
            if (score > 0) {
                const snippet = cleanKnowledgeAnswer(getRelevantSnippet(text, tokens));
                if (snippet) matches.push({ entry, text, score, answer: snippet, snippet });
            }
        }
    });

    return matches
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(match => ({
            fileName: match.entry.fileName || 'knowledge',
            answer: match.answer || match.snippet,
            snippet: match.snippet || match.answer
        }));
};

const inferRecommendedProducts = (message, products) => {
    const msg = stripDiacritics(message);
    const rules = [
        { keys: ['video', 'tiktok', 'capcut', 'edit', 'dung phim'], names: ['capcut', 'youtube'] },
        { keys: ['thiet ke', 'design', 'anh', 'poster', 'canva'], names: ['canva'] },
        { keys: ['viet', 'grammar', 'tieng anh', 'email', 'cv'], names: ['grammarly'] },
        { keys: ['code', 'lap trinh', 'hoc tap', 'chat', 'hoi dap', 'gpt'], names: ['chatgpt'] },
        { keys: ['google', 'drive', 'gmail', 'docs', 'gemini', 'luu tru'], names: ['gemini'] }
    ];
    const matchedRule = rules.find(rule => rule.keys.some(key => msg.includes(key)));
    if (!matchedRule) return [];
    return products.filter(product => {
        const name = stripDiacritics(`${product.name} ${product.title} ${product.subtitle}`);
        return matchedRule.names.some(key => name.includes(key));
    }).slice(0, 3);
};

const listPlans = (product) => product.plans
    .map(plan => `${plan.name}: ${plan.price.toLocaleString('vi-VN')}đ${plan.original ? ` (giá gốc ${plan.original.toLocaleString('vi-VN')}đ)` : ''}`)
    .join('\n');

const buildOfflineChatReply = ({ message, cart = [] }) => {
    const products = readJson('data_product.json').map(normalizeProduct);
    const promotions = readJson('data_promotion.json').map(normalizePromotion);
    const config = readJson('data_ai_config.json');
    const knowledge = readJson('data_ai_knowledge.json');
    const msg = stripDiacritics(message);
    const product = findBestProduct(message, products);
    const recommended = inferRecommendedProducts(message, products);
    const knowledgeMatches = findKnowledgeMatches(message, knowledge);
    const activePromos = promotions.filter(p => p.isActive);
    const cartCount = asArray(cart).reduce((sum, item) => sum + (item.quantity || 1), 0);

    const isGreeting = /\b(hi|hello|xin chao|chao|alo|tu van)\b/.test(msg);
    const asksPrice = /\b(gia|bao nhieu|tien|phi|goi|plan|thang|nam)\b/.test(msg);
    const asksStock = /\b(con hang|ton kho|het hang|con khong|stock)\b/.test(msg);
    const asksPromo = /\b(khuyen mai|giam gia|ma|voucher|coupon|sale|discount)\b/.test(msg);
    const asksPayment = /\b(thanh toan|chuyen khoan|qr|dat hang|mua|gio hang|checkout)\b/.test(msg);
    const asksWarranty = /\b(bao hanh|doi tra|loi|ho tro|lien he|zalo)\b/.test(msg);
    const asksCompare = /\b(tu van|phu hop|nen mua|chon|so sanh|goi nao)\b/.test(msg);

    let reply = '';
    const sources = [];

    if (product && (asksPrice || asksStock || asksCompare || msg.includes(stripDiacritics(product.name)))) {
        reply = `Dạ ${product.name} hiện ${product.stock > 0 ? `còn ${product.stock} gói` : 'đang hết hàng'}.\n\nCác gói đang bán:\n${listPlans(product)}\n\nĐiểm chính: ${product.features.slice(0, 3).join('; ') || product.description}\n\nAnh/chị bấm vào thẻ ${product.name} trên trang để chọn gói và thêm vào giỏ hàng.`;
        sources.push('data_product.json');
    } else if (knowledgeMatches.length) {
        reply = knowledgeMatches
            .map(match => match.answer || match.snippet)
            .filter(Boolean)
            .filter((answer, index, answers) => answers.indexOf(answer) === index)
            .join('\n');
        sources.push(...knowledgeMatches.map(match => match.fileName));
    } else if (asksPromo) {
        reply = activePromos.length
            ? `Hiện shop có mã khuyến mãi:\n${activePromos.map(p => `- ${p.code}: giảm ${p.discount}%`).join('\n')}\n\nAnh/chị nhập mã ở bước thanh toán nếu giao diện có ô mã giảm giá, hoặc nhắn shop để được áp dụng thủ công.`
            : 'Hiện chưa có mã khuyến mãi đang bật. Anh/chị có thể theo dõi banner trên trang hoặc nhắn shop để hỏi deal mới nhất.';
        sources.push('data_promotion.json');
    } else if (asksPayment) {
        reply = `Quy trình mua hàng: chọn sản phẩm -> chọn gói -> thêm vào giỏ -> bấm Thanh toán -> nhập họ tên, email nhận tài khoản và số Zalo -> chuyển khoản theo QR.\n\n${cartCount ? `Giỏ hàng hiện có ${cartCount} mục.` : 'Nếu giỏ hàng đang trống, anh/chị hãy bấm vào thẻ sản phẩm trước.'} Sau khi chuyển khoản, bấm "Tôi Đã Chuyển Khoản" để shop xử lý đơn.`;
        sources.push('checkout-flow');
    } else if (asksWarranty) {
        reply = 'Dạ shop hỗ trợ bảo hành theo từng gói sản phẩm. Nếu tài khoản lỗi trong thời gian sử dụng, anh/chị gửi mã đơn + email/Zalo đã đặt để shop kiểm tra và đổi/hỗ trợ nhanh.';
        sources.push('support-policy');
    } else if (asksCompare && recommended.length) {
        reply = `Dựa trên nhu cầu của anh/chị, em gợi ý:\n${recommended.map(p => `- ${p.name}: từ ${Math.min(...p.plans.map(plan => plan.price)).toLocaleString('vi-VN')}đ, ${p.description}`).join('\n')}\n\nAnh/chị có thể bấm từng thẻ sản phẩm để xem gói chi tiết.`;
        sources.push('data_product.json');
    } else if (isGreeting) {
        const sampleProducts = products.slice(0, 4).map(p => p.name).join(', ');
        reply = `Chào anh/chị, em là Gemi Bot offline của Gemisocial. Em có thể tư vấn giá, gói, tồn kho, khuyến mãi và cách thanh toán.\n\nMột số sản phẩm hiện có: ${sampleProducts}. Anh/chị đang cần dùng cho học tập, code, thiết kế hay làm video?`;
        sources.push('data_product.json');
    } else {
        reply = 'Dạ, câu hỏi này bot chưa được học, shop sẽ ghi nhận và phản hồi anh/chị sớm nhất nhé!';
        sources.push('unanswered');
        return {
            reply,
            sources: [...new Set(sources)].slice(0, 5),
            offline: true,
            matchedProductId: null,
            knowledgeMatches,
            isUnanswered: true
        };
    }

    return {
        reply,
        sources: [...new Set(sources)].slice(0, 5),
        offline: true,
        matchedProductId: product?.id || null,
        knowledgeMatches
    };
};

const buildOrderFromCart = (body, user, products) => {
    const items = asArray(body.items);
    if (!items.length) {
        const err = new Error('Giỏ hàng trống');
        err.status = 400;
        throw err;
    }

    let subtotal = 0;
    const hydratedItems = items.map(item => {
        const quantity = Math.max(1, Math.floor(toNumber(item.quantity, 1)));
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            const err = new Error(`Sản phẩm ${item.productId || ''} không tồn tại`);
            err.status = 400;
            throw err;
        }
        const plan = product.plans.find(pl => pl.name === item.planName) || product.plans[0];
        if (!plan) {
            const err = new Error(`Sản phẩm ${product.name} chưa có gói bán`);
            err.status = 400;
            throw err;
        }
        if ((product.stock || 0) < quantity) {
            const err = new Error(`${product.name} chỉ còn ${product.stock || 0} gói`);
            err.status = 409;
            throw err;
        }
        const lineTotal = plan.price * quantity;
        subtotal += lineTotal;
        return {
            productId: product.id,
            productName: product.name,
            planName: plan.name,
            price: plan.price,
            quantity,
            lineTotal
        };
    });

    const discount = Math.round(subtotal * 0.1);
    const total = Math.max(0, subtotal - discount);
    return {
        id: 'ORD' + Date.now(),
        date: new Date().toISOString(),
        status: 'pending',
        paymentStatus: 'waiting',
        paymentMethod: body.paymentMethod || 'bank_transfer',
        userId: user.id,
        userName: user.name,
        name: String(body.name || '').trim(),
        phone: String(body.phone || '').trim(),
        email: String(body.email || '').trim(),
        memo: body.memo || `Thanh toan ${String(body.phone || '').trim()}`,
        items: hydratedItems,
        subtotal,
        discount,
        total
    };
};

// ─── Middleware ───────────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ error: 'Invalid Token' });
    }
};
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') next();
        else res.status(403).json({ error: 'Forbidden: Admins only' });
    });
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const handleLogin = (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu tài khoản hoặc mật khẩu' });
    if (!isValidPassword(password)) return res.status(400).json({ error: passwordLengthError() });
    const users = readJson('data_user.json');
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email || '' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ token, user: publicUser(user) });
    } else {
        res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    }
};

const handleRegister = (req, res) => {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (!isValidPassword(password)) return res.status(400).json({ error: passwordLengthError() });
    const users = readJson('data_user.json');
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    const newUser = { id: 'usr_' + Date.now(), username, password, name, email: email || '', role: 'user' };
    users.push(newUser);
    writeJson('data_user.json', users);
    const token = jwt.sign(
        { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name, email: newUser.email || '' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.status(201).json({ token, user: publicUser(newUser) });
};

const handleCurrentUser = (req, res) => {
    res.json({ user: req.user });
};

app.post('/api/auth/login', handleLogin);
app.post('/api/auth/register', handleRegister);
app.get('/api/auth/me', verifyToken, handleCurrentUser);

// Legacy aliases kept so old frontend/Postman requests do not break.
app.post('/api/login', handleLogin);
app.post('/api/register', handleRegister);
app.get('/api/me', verifyToken, handleCurrentUser);

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
const listProducts = (req, res) => {
    const products = readJson('data_product.json').map(normalizeProduct);
    const { q } = req.query;
    if (q) {
        const query = q.toLowerCase();
        return res.json(products.filter(p =>
            (p.name || '').toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query) ||
            (p.title || '').toLowerCase().includes(query) ||
            (p.subtitle || '').toLowerCase().includes(query) ||
            (p.engineBadge || '').toLowerCase().includes(query) ||
            p.features.some(f => f.toLowerCase().includes(query)) ||
            p.plans.some(pl => pl.name.toLowerCase().includes(query))
        ));
    }
    res.json(products);
};

const createProduct = (req, res) => {
    const products = readJson('data_product.json');
    const newProduct = normalizeProduct({ ...req.body, id: req.body.id || 'prod_' + Date.now() });
    products.push(newProduct);
    writeJson('data_product.json', products);
    res.status(201).json(newProduct);
};

const updateProduct = (req, res) => {
    const products = readJson('data_product.json');
    const i = products.findIndex(p => p.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    products[i] = normalizeProduct({ ...products[i], ...req.body, id: products[i].id });
    writeJson('data_product.json', products);
    res.json(products[i]);
};

const deleteProduct = (req, res) => {
    let products = readJson('data_product.json');
    if (!products.some(p => p.id === req.params.id)) return res.status(404).json({ error: 'Not found' });
    products = products.filter(p => p.id !== req.params.id);
    writeJson('data_product.json', products);
    res.status(204).send();
};

app.get('/api/products', listProducts);
app.post('/api/products', verifyAdmin, createProduct);
app.patch('/api/products/:id', verifyAdmin, updateProduct);
app.put('/api/products/:id', verifyAdmin, updateProduct); // Legacy partial update alias.
app.delete('/api/products/:id', verifyAdmin, deleteProduct);

// ─── ORDERS ──────────────────────────────────────────────────────────────────
const listOrders = (req, res) => res.json(readJson('data_order.json'));

const createOrder = (req, res) => {
    const orders = readJson('data_order.json');
    const products = readJson('data_product.json').map(normalizeProduct);
    let newOrder;
    try {
        newOrder = buildOrderFromCart(req.body, req.user, products);
    } catch (e) {
        return res.status(e.status || 400).json({ error: e.message || 'Không thể tạo đơn hàng' });
    }
    orders.unshift(newOrder); // newest first
    writeJson('data_order.json', orders);

    newOrder.items.forEach(item => {
        const p = products.find(p => p.id === item.productId);
        if (p) p.stock -= item.quantity;
    });
    writeJson('data_product.json', products);
    res.status(201).json(newOrder);
};

const updateOrder = (req, res) => {
    const orders = readJson('data_order.json');
    const i = orders.findIndex(o => o.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    const patch = { ...req.body };
    if (patch.status === 'complete') {
        patch.paymentStatus = patch.paymentStatus || 'confirmed';
        patch.completedAt = orders[i].completedAt || new Date().toISOString();
    }
    if (patch.status === 'cancelled') {
        patch.paymentStatus = patch.paymentStatus || 'cancelled';
        patch.cancelledAt = orders[i].cancelledAt || new Date().toISOString();
    }
    orders[i] = { ...orders[i], ...patch };
    writeJson('data_order.json', orders);
    res.json(orders[i]);
};

const deleteOrder = (req, res) => {
    let orders = readJson('data_order.json');
    if (!orders.some(o => o.id === req.params.id)) return res.status(404).json({ error: 'Not found' });
    orders = orders.filter(o => o.id !== req.params.id);
    writeJson('data_order.json', orders);
    res.status(204).send();
};

const listPayments = (req, res) => {
    res.json(buildPaymentRecords(readJson('data_order.json')));
};

app.get('/api/orders', verifyAdmin, listOrders);
app.post('/api/orders', verifyToken, createOrder);
app.patch('/api/orders/:id', verifyAdmin, updateOrder);
app.put('/api/orders/:id', verifyAdmin, updateOrder); // Legacy partial update alias.
app.delete('/api/orders/:id', verifyAdmin, deleteOrder);
app.get('/api/payments', verifyAdmin, listPayments);

// ─── PROMOTIONS ──────────────────────────────────────────────────────────────
const listPromotions = (req, res) => res.json(readJson('data_promotion.json').map(normalizePromotion));

const createPromotion = (req, res) => {
    const promos = readJson('data_promotion.json');
    const newPromo = normalizePromotion({ ...req.body, id: req.body.id || 'promo_' + Date.now() });
    if (!newPromo.code) return res.status(400).json({ error: 'Thiếu mã khuyến mãi' });
    if (promos.some(p => String(p.code || '').toUpperCase() === newPromo.code)) {
        return res.status(409).json({ error: 'Mã khuyến mãi đã tồn tại' });
    }
    promos.push(newPromo);
    writeJson('data_promotion.json', promos);
    res.status(201).json(newPromo);
};

const updatePromotion = (req, res) => {
    const promos = readJson('data_promotion.json');
    const i = promos.findIndex(p => p.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    const updatedPromo = normalizePromotion({ ...promos[i], ...req.body, id: promos[i].id });
    if (!updatedPromo.code) return res.status(400).json({ error: 'Thiếu mã khuyến mãi' });
    if (promos.some((p, idx) => idx !== i && String(p.code || '').toUpperCase() === updatedPromo.code)) {
        return res.status(409).json({ error: 'Mã khuyến mãi đã tồn tại' });
    }
    promos[i] = updatedPromo;
    writeJson('data_promotion.json', promos);
    res.json(promos[i]);
};

const deletePromotion = (req, res) => {
    let promos = readJson('data_promotion.json');
    promos = promos.filter(p => p.id !== req.params.id);
    writeJson('data_promotion.json', promos);
    res.status(204).send();
};

const validatePromotion = (req, res) => {
    const { code } = req.body;
    const promos = readJson('data_promotion.json').map(normalizePromotion);
    const promo = promos.find(p => p.code?.toUpperCase() === code?.toUpperCase() && p.isActive);
    if (promo) res.json({ valid: true, promo });
    else res.status(404).json({ valid: false, error: 'Mã không hợp lệ hoặc đã hết hạn' });
};

app.get('/api/promotions', listPromotions);
app.post('/api/promotions', verifyAdmin, createPromotion);
app.patch('/api/promotions/:id', verifyAdmin, updatePromotion);
app.put('/api/promotions/:id', verifyAdmin, updatePromotion); // Legacy partial update alias.
app.delete('/api/promotions/:id', verifyAdmin, deletePromotion);
app.post('/api/promotion-validations', validatePromotion);
app.post('/api/promotions/validate', validatePromotion); // Legacy action-route alias.

// ─── USERS (admin only) ───────────────────────────────────────────────────────
const listUsers = (req, res) => {
    res.json(readJson('data_user.json'));
};

const createUser = (req, res) => {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'Thiếu thông tin người dùng' });
    if (!isValidPassword(password)) return res.status(400).json({ error: passwordLengthError() });
    const users = readJson('data_user.json');
    if (users.find(u => u.username === req.body.username)) return res.status(409).json({ error: 'Username existed' });
    const newUser = { id: 'usr_' + Date.now(), email: '', role: 'user', ...req.body };
    users.push(newUser);
    writeJson('data_user.json', users);
    res.status(201).json(publicUser(newUser));
};

const updateUser = (req, res) => {
    const users = readJson('data_user.json');
    const i = users.findIndex(u => u.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    if (req.body.username && users.some((u, idx) => idx !== i && u.username === req.body.username)) {
        return res.status(409).json({ error: 'Username existed' });
    }
    const patch = { ...req.body };
    if (patch.password === '') delete patch.password;
    if (patch.password !== undefined && !isValidPassword(patch.password)) {
        return res.status(400).json({ error: passwordLengthError() });
    }
    users[i] = { ...users[i], ...patch };
    writeJson('data_user.json', users);
    res.json(publicUser(users[i]));
};

const deleteUser = (req, res) => {
    let users = readJson('data_user.json');
    users = users.filter(u => u.id !== req.params.id);
    writeJson('data_user.json', users);
    res.status(204).send();
};

app.get('/api/users', verifyAdmin, listUsers);
app.post('/api/users', verifyAdmin, createUser);
app.patch('/api/users/:id', verifyAdmin, updateUser);
app.put('/api/users/:id', verifyAdmin, updateUser); // Legacy partial update alias.
app.delete('/api/users/:id', verifyAdmin, deleteUser);

// ─── STATS ───────────────────────────────────────────────────────────────────
const getDashboardStats = (req, res) => {
    const orders = readJson('data_order.json');
    const products = readJson('data_product.json').map(normalizeProduct);
    const users = readJson('data_user.json');
    const activeOrders = orders.filter(o => o.status !== 'cancelled');
    const completedOrders = orders.filter(o => o.status === 'complete');
    const revenue = completedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const pendingRevenue = orders.filter(o => o.status === 'pending').reduce((s, o) => s + (o.total || 0), 0);
    const pending = orders.filter(o => o.status === 'pending').length;
    const complete = orders.filter(o => o.status === 'complete').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
    const lowStock = products.filter(p => (p.stock || 0) <= 3).sort((a, b) => (a.stock || 0) - (b.stock || 0));
    const productSales = {};
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
        asArray(o.items).forEach(item => {
            const key = item.productId || item.productName || 'unknown';
            if (!productSales[key]) productSales[key] = { productId: key, name: item.productName || key, quantity: 0, revenue: 0 };
            productSales[key].quantity += item.quantity || 0;
            productSales[key].revenue += item.lineTotal || ((item.price || 0) * (item.quantity || 1));
        });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    // Revenue by day (last 7 days)
    const days = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days[d.toISOString().split('T')[0]] = 0;
    }
    completedOrders.forEach(o => {
        const day = o.date?.split('T')[0];
        if (day && days[day] !== undefined) days[day] += o.total || 0;
    });
    res.json({
        revenue,
        grossRevenue: activeOrders.reduce((s, o) => s + (o.total || 0), 0),
        pendingRevenue,
        totalOrders: orders.length,
        pending,
        complete,
        cancelled,
        totalStock,
        totalUsers: users.length,
        revenueByDay: days,
        lowStock,
        topProducts,
        recentOrders: orders.slice(0, 5),
        payments: buildPaymentRecords(orders).slice(0, 5)
    });
};

app.get('/api/dashboard-stats', verifyAdmin, getDashboardStats);
app.get('/api/stats', verifyAdmin, getDashboardStats); // Legacy alias.

// ─── AI CONFIG ────────────────────────────────────────────────────────────────
const getAiConfig = (req, res) => res.json(readJson('data_ai_config.json'));

const updateAiConfig = (req, res) => {
    const config = { ...readJson('data_ai_config.json'), ...req.body };
    writeJson('data_ai_config.json', config);
    res.json(config);
};

const listAiKnowledge = (req, res) => {
    const entries = readJson('data_ai_knowledge.json');
    res.json({
        total: entries.length,
        entries: entries.map(entry => ({
            id: entry.id,
            fileName: entry.fileName,
            sourceType: entry.sourceType || 'json',
            uploadedAt: entry.uploadedAt,
            summary: entry.summary,
            textLength: (entry.text || '').length
        }))
    });
};

const cleanAndFormatMessyData = (text) => {
    const pairs = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentQ = '';
    let currentA = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qMatch = line.match(/^(?:Q|Question|Hỏi|Khách hàng|Khách)(?:\s*:\s*|\s+)(.+)/i);
        const aMatch = line.match(/^(?:A|Answer|Đáp|Shop|Trả lời)(?:\s*:\s*|\s+)(.+)/i);
        
        if (qMatch) {
            if (currentQ && currentA) pairs.push({ question: currentQ, answer: currentA });
            currentQ = qMatch[1];
            currentA = '';
        } else if (aMatch) {
            currentA += (currentA ? ' ' : '') + aMatch[1];
        } else if (line.includes('?')) {
            if (currentQ && currentA) pairs.push({ question: currentQ, answer: currentA });
            currentQ = line;
            currentA = '';
        } else if (line.includes('->')) {
            const parts = line.split('->');
            if (parts.length >= 2) {
                if (currentQ && currentA) pairs.push({ question: currentQ, answer: currentA });
                currentQ = parts[0].trim();
                currentA = parts.slice(1).join('->').trim();
            }
        } else if (currentQ && !currentA) {
            currentA = line;
        } else if (currentQ && currentA) {
            currentA += ' ' + line;
        }
    }
    if (currentQ && currentA) pairs.push({ question: currentQ, answer: currentA });
    return pairs;
};

const createAiKnowledge = (req, res) => {
    const { fileName, mode } = req.body;
    let extracted;
    try {
        extracted = extractTextFromUpload(req.body);
    } catch (e) {
        return res.status(400).json({ error: e.message || 'Không đọc được file train' });
    }
    
    let qaPairs = [];
    if (extracted.data) {
        qaPairs = collectQaPairs(extracted.data);
    } else if (extracted.text) {
        const messyPairs = cleanAndFormatMessyData(extracted.text);
        if (messyPairs.length > 0) qaPairs = messyPairs;
    }

    const entry = {
        id: 'know_' + Date.now(),
        fileName: String(fileName || 'uploaded-data').trim(),
        sourceType: extracted.sourceType || 'text',
        uploadedAt: new Date().toISOString(),
        summary: extracted.data ? summarizeKnowledgeData(extracted.data) : (qaPairs.length ? `${qaPairs.length} cặp Hỏi/Đáp` : `${extracted.text.length} ký tự văn bản`),
        text: normalizeKnowledgeText(extracted.text),
        qaPairs,
        data: qaPairs.length && !extracted.data ? qaPairs : extracted.data
    };
    if (!entry.text) return res.status(400).json({ error: 'File không có nội dung chữ để bot học' });
    const entries = mode === 'replace' ? [] : readJson('data_ai_knowledge.json');
    entries.unshift(entry);
    writeJson('data_ai_knowledge.json', entries.slice(0, 50));
    res.status(201).json({
        success: true,
        total: entries.length,
        entry: {
            id: entry.id,
            fileName: entry.fileName,
            sourceType: entry.sourceType,
            summary: entry.summary
        }
    });
};

const deleteAllAiKnowledge = (req, res) => {
    writeJson('data_ai_knowledge.json', []);
    res.status(204).send();
};

const deleteAiKnowledge = (req, res) => {
    let entries = readJson('data_ai_knowledge.json');
    if (!entries.some(entry => entry.id === req.params.id)) return res.status(404).json({ error: 'Not found' });
    entries = entries.filter(entry => entry.id !== req.params.id);
    writeJson('data_ai_knowledge.json', entries);
    res.status(204).send();
};

const logUnansweredQuestionToExcel = (question) => {
    const filePath = path.join(DATA_DIR, 'Question_Data.xlsx');
    let workbook;
    let sheet;
    const dateStr = new Date().toISOString().split('T')[0];
    const newRow = { 'Câu hỏi chưa trả lời': question, 'Ngày ghi nhận': dateStr };

    try {
        if (fs.existsSync(filePath)) {
            workbook = xlsx.readFile(filePath);
            sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet);
            data.push(newRow);
            sheet = xlsx.utils.json_to_sheet(data);
            workbook.Sheets[workbook.SheetNames[0]] = sheet;
        } else {
            workbook = xlsx.utils.book_new();
            sheet = xlsx.utils.json_to_sheet([newRow]);
            xlsx.utils.book_append_sheet(workbook, sheet, 'Unanswered');
        }
        xlsx.writeFile(workbook, filePath);
    } catch (e) {
        console.error('Lỗi khi ghi file Excel Question_Data.xlsx:', e);
    }
};

const createChatMessage = (req, res) => {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Tin nhắn không được trống' });
    try {
        const replyObj = buildOfflineChatReply({ message, cart: req.body.cart || [] });
        if (replyObj.isUnanswered) {
            logUnansweredQuestionToExcel(message);
        }
        res.json(replyObj);
    } catch (e) {
        console.error('Offline chatbot error:', e);
        res.status(500).json({
            reply: 'Dạ bot offline đang gặp lỗi đọc dữ liệu shop. Anh/chị vui lòng thử lại hoặc liên hệ shop trực tiếp.',
            offline: true,
            error: 'offline_chat_failed'
        });
    }
};

app.get('/api/ai-config', getAiConfig);
app.patch('/api/ai-config', verifyAdmin, updateAiConfig);
app.get('/api/ai-knowledge', verifyAdmin, listAiKnowledge);
app.post('/api/ai-knowledge', verifyAdmin, createAiKnowledge);
app.delete('/api/ai-knowledge', verifyAdmin, deleteAllAiKnowledge);
app.delete('/api/ai-knowledge/:id', verifyAdmin, deleteAiKnowledge);
app.post('/api/chat-messages', createChatMessage);

// Legacy aliases kept for old callers.
app.get('/api/ai_config', getAiConfig);
app.post('/api/ai_config', verifyAdmin, updateAiConfig);
app.get('/api/ai_knowledge', verifyAdmin, listAiKnowledge);
app.post('/api/ai_knowledge', verifyAdmin, createAiKnowledge);
app.delete('/api/ai_knowledge', verifyAdmin, deleteAllAiKnowledge);
app.delete('/api/ai_knowledge/:id', verifyAdmin, deleteAiKnowledge);
app.post('/api/chat', createChatMessage);

app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', service: 'webbanai' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`✅ Gemisocial Server running on http://${HOST}:${PORT}`));
