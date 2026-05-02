const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = 'backup/memories.md';
const TZ = 'Asia/Ho_Chi_Minh';

const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.cache'
]);

const BINARY_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.pdf',
    '.zip',
    '.rar',
    '.7z',
    '.exe',
    '.dll'
]);

const PREFERRED_ORDER = [
    'README.md',
    'package.json',
    'render.yaml',
    '.env.example',
    '.dockerignore',
    '.gitignore',
    'backend/server.js',
    'backend/package.json',
    'backend/package-lock.json',
    'frontend/index.html',
    'frontend/admin.html',
    'frontend/js/script.js',
    'frontend/js/admin.js',
    'frontend/css/style.css',
    'frontend/css/admin.css',
    'docker/Dockerfile',
    'docker/docker-compose.yml',
    'docker/entrypoint.sh',
    'backup/snapshot.js',
    'docs/deploy-render-docker.md',
    'docs/testAPI.txt',
    '.claude/settings.local.json',
    'data/data_product.json',
    'data/data_order.json',
    'data/data_user.json',
    'data/data_promotion.json',
    'data/data_ai_config.json',
    'data/data_ai_knowledge.json',
    'data/data_train.json',
    'data/dataTest.txt'
];

const normalizePath = (filePath) => filePath.split(path.sep).join('/');

const getTimestamp = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(new Date()).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +07:00`;
};

const hashFile = (relativePath) => {
    const buffer = fs.readFileSync(path.join(ROOT, relativePath));
    return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
};

const formatMtime = (date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const walkFiles = (dir = ROOT) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = normalizePath(path.relative(ROOT, fullPath));
        const firstSegment = relativePath.split('/')[0];

        if (entry.isDirectory()) {
            if (!EXCLUDED_DIRS.has(entry.name) && !EXCLUDED_DIRS.has(firstSegment)) {
                files.push(...walkFiles(fullPath));
            }
            continue;
        }

        if (entry.isFile() && relativePath !== OUTPUT_FILE) {
            files.push(relativePath);
        }
    }

    return files;
};

const isBinary = (relativePath) => BINARY_EXTENSIONS.has(path.extname(relativePath).toLowerCase());

const sortFiles = (files) => {
    const preferredIndex = new Map(PREFERRED_ORDER.map((file, index) => [file, index]));
    return [...files].sort((a, b) => {
        const ai = preferredIndex.has(a) ? preferredIndex.get(a) : Number.MAX_SAFE_INTEGER;
        const bi = preferredIndex.has(b) ? preferredIndex.get(b) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
    });
};

const languageFor = (relativePath) => {
    const ext = path.extname(relativePath).toLowerCase();
    const base = path.basename(relativePath).toLowerCase();
    if (base === 'dockerfile') return 'dockerfile';
    const map = {
        '.js': 'js',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.txt': 'text',
        '.md': 'md'
    };
    return map[ext] || 'text';
};

const fenceFor = (content) => {
    const matches = content.match(/`{3,}/g) || [];
    const longest = matches.reduce((max, item) => Math.max(max, item.length), 3);
    return '`'.repeat(longest + 1);
};

const readText = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

const collectInvalidJsonFiles = (files) => files
    .filter((file) => path.extname(file).toLowerCase() === '.json')
    .filter((file) => {
        try {
            JSON.parse(readText(file));
            return false;
        } catch (error) {
            return true;
        }
    });

const describeUserAccounts = () => {
    try {
        const users = JSON.parse(readText('data/data_user.json'));
        if (!Array.isArray(users) || !users.length) return 'xem `data/data_user.json`';

        return users.map((user) => {
            const role = user.role === 'admin' ? 'admin' : 'user';
            const username = String(user.username || '').trim() || '(empty username)';
            const password = String(user.password || '').trim() || '(empty password)';
            return `${role} \`${username}\` / \`${password}\``;
        }).join(', ');
    } catch (error) {
        return 'xem `data/data_user.json`';
    }
};

const allFiles = sortFiles(walkFiles());
const textFiles = allFiles.filter((file) => !isBinary(file));
const binaryFiles = allFiles.filter((file) => isBinary(file));
const invalidJsonFiles = collectInvalidJsonFiles(textFiles);
const defaultAccountText = describeUserAccounts();

let output = '# memories.md - Snapshot hien tai cua WebBanA.I\n\n';
output += `Cap nhat: ${getTimestamp()}\n`;
output += `Thu muc goc: ${ROOT}\n\n`;

output += '## Muc Dich\n\n';
output += 'File nay la ban backup doc de khoi phuc code/dang du lieu khi he thong WebBanA.I bi sua loi hoac hong file. Neu can khoi phuc, tao lai file theo dung duong dan tu cac code block trong muc `NOI DUNG FILE NGUON`.\n\n';

output += '## Pham Vi Snapshot\n\n';
output += '- Bao gom source `frontend/`, `backend/`, Docker/Render config, package manifest, lockfile, cau hinh local va cac file du lieu trong `data/`.\n';
output += '- Khong copy `node_modules/`; phuc hoi backend bang `npm --prefix backend install` dua tren `backend/package-lock.json`.\n';
output += '- Anh trong `frontend/assets/` khong duoc nhung nhi phan vao markdown; muc hash ben duoi dung de kiem tra asset con dung ban.\n';
output += '- `backup/memories.md` khong tu snapshot chinh no de tranh de quy va phinh file.\n\n';

output += '## Cach Chay / Phuc Hoi Nhanh\n\n';
output += '1. Cai dependency: `npm --prefix backend install`.\n';
output += '2. Chay server: `npm start` tu repo root hoac `npm --prefix backend start`.\n';
output += '3. Mo web: `http://localhost:3000/`.\n';
output += '4. Mo admin: `http://localhost:3000/admin.html`.\n';
output += `5. Tai khoan hien co trong \`data/data_user.json\`: ${defaultAccountText}.\n`;
output += '6. Docker local: `docker compose -f docker/docker-compose.yml up --build`.\n';
output += '7. Neu file nao loi, copy noi dung trong section `### <duong-dan-file>` tu file nay ve dung duong dan tuong ung.\n';
output += '8. Neu du lieu JSON loi parse, uu tien khoi phuc cac file `data/*.json` tu snapshot nay truoc khi sua logic server.\n\n';

output += '## Ban Do He Thong\n\n';
output += '- Runtime: Node.js CommonJS, Express 5, CORS, JWT, XLSX, zlib; static file served tu `frontend/`.\n';
output += '- Auth/password: login/register/admin user CRUD bat buoc mat khau toi thieu 8 ky tu o ca server va UI.\n';
output += '- Data storage: file JSON sync trong `data/`, helper `readJson`/`writeJson` nam trong `backend/server.js`.\n';
output += '- Frontend khach hang: `frontend/index.html` + `frontend/css/style.css` + `frontend/js/script.js`; dung `API_BASE`, auth localStorage `gs_token`/`gs_user`, gio hang localStorage `gemi_cart`, checkout bank transfer, chatbot.\n';
output += '- Admin: `frontend/admin.html` + `frontend/css/admin.css` + `frontend/js/admin.js`; dung localStorage `admin_token`, goi API CRUD san pham/don hang/khuyen mai/user/AI.\n';
output += '- Product visual moi: moi san pham co `productTheme` tu `theme-001` den `theme-100` va `imageAnimation` gom float/pulse/tilt/orbit/zoom/shimmer/bounce/glow/drift/none.\n';
output += '- Anh san pham dang dung qua static path `/assets/*`, file nam tai `frontend/assets/`.\n';
output += '- Docker/Render: `docker/Dockerfile`, `docker/docker-compose.yml`, `docker/entrypoint.sh`, `render.yaml`; Render persistent disk mount tai `/app/data`.\n\n';

output += '## API Chinh Trong server.js\n\n';
output += '- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`; legacy alias `/api/login`, `/api/register`, `/api/me`.\n';
output += '- Products: `GET /api/products`, admin `POST/PATCH/PUT/DELETE /api/products/:id`.\n';
output += '- Orders/payments: admin `GET /api/orders`, user `POST /api/orders`, admin `PATCH/PUT/DELETE /api/orders/:id`, admin `GET /api/payments`.\n';
output += '- Promotions: `GET /api/promotions`, admin CRUD `/api/promotions`, validate `POST /api/promotion-validations`; legacy `/api/promotions/validate`.\n';
output += '- Users: admin CRUD `/api/users`.\n';
output += '- Dashboard: admin `GET /api/dashboard-stats`; legacy `/api/stats`.\n';
output += '- AI/chat: `GET/PATCH /api/ai-config`, admin CRUD `/api/ai-knowledge`, `POST /api/chat-messages`; legacy underscore routes `/api/ai_config`, `/api/ai_knowledge`, `/api/chat`.\n\n';

output += '## Luu Y Ky Thuat\n\n';
if (invalidJsonFiles.length) {
    output += `- Cac file JSON dang khong parse hop le: ${invalidJsonFiles.map((file) => `\`${file}\``).join(', ')}; server se fallback tuy theo helper doc file.\n`;
} else {
    output += '- Tat ca file JSON trong snapshot parse hop le tai thoi diem tao backup.\n';
}
output += '- JWT secret co the cau hinh bang bien moi truong `JWT_SECRET`; fallback demo van la `gemisocial_secret_key_12345`.\n';
output += '- Password user hien dang luu plain text trong `data/data_user.json`; phu hop demo/local, khong nen dua production neu chua harden.\n';
output += '- `express.json({ limit: \'25mb\' })` cho phep upload anh product base64 tu admin; admin JS gioi han anh san pham 2MB.\n\n';

output += '## Cay File Duoc Snapshot\n\n';
for (const file of allFiles) {
    const stat = fs.statSync(path.join(ROOT, file));
    output += `- \`${file}\` (${stat.size} bytes, modified ${formatMtime(stat.mtime)})\n`;
}
output += '\n';

output += '## SHA256 Kiem Tra File\n\n';
output += '| File | SHA256 |\n';
output += '| --- | --- |\n';
for (const file of allFiles) {
    output += `| \`${file}\` | \`${hashFile(file)}\` |\n`;
}
output += '\n';

if (binaryFiles.length) {
    output += '## Asset Binary Metadata\n\n';
    output += '| File | Bytes | SHA256 |\n';
    output += '| --- | ---: | --- |\n';
    for (const file of binaryFiles) {
        const stat = fs.statSync(path.join(ROOT, file));
        output += `| \`${file}\` | ${stat.size} | \`${hashFile(file)}\` |\n`;
    }
    output += '\n';
}

output += '## NOI DUNG FILE NGUON\n\n';
for (const file of textFiles) {
    const content = readText(file);
    const fence = fenceFor(content);
    output += `### ${file}\n`;
    output += `${fence}${languageFor(file)}\n`;
    output += content;
    if (!content.endsWith('\n')) output += '\n';
    output += `${fence}\n\n`;
}

fs.writeFileSync(path.join(ROOT, OUTPUT_FILE), output, 'utf8');
console.log(`Done writing ${OUTPUT_FILE} with ${textFiles.length} text files and ${binaryFiles.length} binary files.`);
