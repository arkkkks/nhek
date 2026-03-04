const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "portal-db.json");
const FOOD_CONFIG_FILE = path.join(DATA_DIR, "food-catalog.json");
const QUIZ_CONFIG_FILE = path.join(DATA_DIR, "quiz-sets.json");
const MOOD_EMOTIONS_FILE = path.join(DATA_DIR, "mood-emotions.json");
const QUESTION_EMOTIONS_FILE = path.join(DATA_DIR, "question-emotions.json");
const CLIENT_BRIDGE_PATH = "/backend/client/storage-bridge.js";

const SESSION_COOKIE = "portal_session";
const ANON_COOKIE = "portal_anon";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8"
};

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        const seed = {
            users: [],
            sessions: [],
            activities: [],
            moods: {},
            storage: {
                local: {},
                session: {}
            }
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf8");
    }
}

function readData() {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.users)) parsed.users = [];
    if (!Array.isArray(parsed.sessions)) parsed.sessions = [];
    if (!Array.isArray(parsed.activities)) parsed.activities = [];
    if (!parsed.moods || typeof parsed.moods !== "object") parsed.moods = {};
    if (!parsed.storage || typeof parsed.storage !== "object") {
        parsed.storage = { local: {}, session: {} };
    }
    if (!parsed.storage.local || typeof parsed.storage.local !== "object") parsed.storage.local = {};
    if (!parsed.storage.session || typeof parsed.storage.session !== "object") parsed.storage.session = {};
    return parsed;
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function readFoodConfig() {
    return readJsonFile(FOOD_CONFIG_FILE);
}

function readQuizConfig() {
    return readJsonFile(QUIZ_CONFIG_FILE);
}

function readMoodEmotionsConfig() {
    return readJsonFile(MOOD_EMOTIONS_FILE);
}

function readQuestionEmotionsConfig() {
    return readJsonFile(QUESTION_EMOTIONS_FILE);
}

function parseCookies(req) {
    const raw = req.headers.cookie || "";
    if (!raw) return {};
    const out = {};
    for (const part of raw.split(";")) {
        const idx = part.indexOf("=");
        if (idx < 0) continue;
        const key = decodeURIComponent(part.slice(0, idx).trim());
        const value = decodeURIComponent(part.slice(idx + 1).trim());
        out[key] = value;
    }
    return out;
}

function appendSetCookie(res, cookieLine) {
    const prev = res.getHeader("Set-Cookie");
    if (!prev) {
        res.setHeader("Set-Cookie", [cookieLine]);
        return;
    }
    if (Array.isArray(prev)) {
        res.setHeader("Set-Cookie", [...prev, cookieLine]);
        return;
    }
    res.setHeader("Set-Cookie", [prev, cookieLine]);
}

function setCookie(res, name, value, options = {}) {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
    parts.push(`Path=${options.path || "/"}`);
    if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
    if (options.httpOnly !== false) parts.push("HttpOnly");
    parts.push(`SameSite=${options.sameSite || "Lax"}`);
    if (options.secure) parts.push("Secure");
    appendSetCookie(res, parts.join("; "));
}

function clearCookie(res, name) {
    setCookie(res, name, "", { maxAge: 0 });
}

function sendJson(res, code, payload) {
    res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(JSON.stringify(payload));
}

function sendText(res, code, text) {
    res.writeHead(code, {
        "Content-Type": "text/plain; charset=utf-8"
    });
    res.end(text);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                req.destroy();
                reject(new Error("Payload too large"));
            }
        });
        req.on("end", () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}

function nowIso() {
    return new Date().toISOString();
}

function randomToken() {
    return crypto.randomBytes(32).toString("hex");
}

function sanitizeUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
    };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
    return { hash, salt };
}

function verifyPassword(password, user) {
    const check = crypto.pbkdf2Sync(password, user.salt, 120000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(check, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function isValidUsername(value) {
    return typeof value === "string" && /^[A-Za-z0-9_.-]{3,30}$/.test(value.trim());
}

function isValidEmail(value) {
    return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPassword(value) {
    return typeof value === "string" && value.length >= 6 && value.length <= 72;
}

function cleanupExpiredSessions(data) {
    const now = Date.now();
    data.sessions = data.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
}

function findSession(data, req) {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (!token) return null;
    const session = data.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
}

function getCurrentUser(data, req) {
    const session = findSession(data, req);
    if (!session) return null;
    return data.users.find((u) => u.id === session.userId) || null;
}

function ensureAnonCookie(req, res) {
    const cookies = parseCookies(req);
    if (cookies[ANON_COOKIE]) return cookies[ANON_COOKIE];
    const anon = randomToken();
    setCookie(res, ANON_COOKIE, anon, { maxAge: 60 * 60 * 24 * 365 });
    return anon;
}

function createSession(data, userId, req, res) {
    const cookies = parseCookies(req);
    const existing = cookies[SESSION_COOKIE];
    if (existing) {
        data.sessions = data.sessions.filter((s) => s.token !== existing);
    }
    const token = randomToken();
    data.sessions.push({
        token,
        userId,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    });
    setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_TTL_MS / 1000 });
}

function destroySession(data, req, res) {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (token) {
        data.sessions = data.sessions.filter((s) => s.token !== token);
    }
    clearCookie(res, SESSION_COOKIE);
}

function getStorageOwnerKey(scope, data, req, res) {
    const session = findSession(data, req);
    if (scope === "local") {
        if (session) return `user:${session.userId}`;
        const anon = ensureAnonCookie(req, res);
        return `anon:${anon}`;
    }
    if (scope === "session") {
        if (session) return `session:${session.token}`;
        const anon = ensureAnonCookie(req, res);
        return `session:anon:${anon}`;
    }
    return null;
}

function getStorageBucket(data, scope, ownerKey) {
    if (!data.storage || typeof data.storage !== "object") {
        data.storage = { local: {}, session: {} };
    }
    if (!data.storage.local) data.storage.local = {};
    if (!data.storage.session) data.storage.session = {};
    if (!data.storage[scope][ownerKey]) data.storage[scope][ownerKey] = {};
    return data.storage[scope][ownerKey];
}

function handleSignup(req, res) {
    parseBody(req)
        .then((body) => {
            const username = String(body.username || "").trim();
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");

            if (!isValidUsername(username)) {
                sendJson(res, 400, { error: "Username must be 3-30 chars and use letters, numbers, . _ -" });
                return;
            }
            if (!isValidEmail(email)) {
                sendJson(res, 400, { error: "Invalid email format" });
                return;
            }
            if (!isValidPassword(password)) {
                sendJson(res, 400, { error: "Password must be 6-72 characters" });
                return;
            }

            const data = readData();
            cleanupExpiredSessions(data);

            if (data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
                sendJson(res, 409, { error: "Username already exists" });
                return;
            }
            if (data.users.some((u) => u.email.toLowerCase() === email)) {
                sendJson(res, 409, { error: "Email already exists" });
                return;
            }

            const { hash, salt } = hashPassword(password);
            const user = {
                id: crypto.randomUUID(),
                username,
                email,
                passwordHash: hash,
                salt,
                createdAt: nowIso()
            };
            data.users.push(user);
            data.activities.push({
                id: crypto.randomUUID(),
                userId: user.id,
                username: user.username,
                action: "Account created",
                timestamp: nowIso()
            });

            writeData(data);
            sendJson(res, 201, { message: "Account created. Please log in.", user: sanitizeUser(user) });
        })
        .catch((error) => sendJson(res, 400, { error: error.message }));
}

function handleLogin(req, res) {
    parseBody(req)
        .then((body) => {
            const username = String(body.username || "").trim();
            const password = String(body.password || "");

            if (!username || !password) {
                sendJson(res, 400, { error: "Username and password are required" });
                return;
            }

            const data = readData();
            cleanupExpiredSessions(data);

            const user = data.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
            if (!user || !verifyPassword(password, user)) {
                sendJson(res, 401, { error: "Invalid username or password" });
                return;
            }

            createSession(data, user.id, req, res);
            data.activities.push({
                id: crypto.randomUUID(),
                userId: user.id,
                username: user.username,
                action: "User logged in",
                timestamp: nowIso()
            });

            writeData(data);
            sendJson(res, 200, { message: "Login successful", user: sanitizeUser(user) });
        })
        .catch((error) => sendJson(res, 400, { error: error.message }));
}

function handleLogout(req, res) {
    const data = readData();
    cleanupExpiredSessions(data);
    destroySession(data, req, res);
    writeData(data);
    sendJson(res, 200, { message: "Logged out" });
}

function handleMe(req, res) {
    const data = readData();
    cleanupExpiredSessions(data);
    const user = getCurrentUser(data, req);
    writeData(data);
    if (!user) {
        sendJson(res, 200, { user: null });
        return;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
}

function handlePostActivity(req, res) {
    parseBody(req)
        .then((body) => {
            const action = String(body.action || "").trim();
            if (!action) {
                sendJson(res, 400, { error: "Action is required" });
                return;
            }
            if (action.length > 200) {
                sendJson(res, 400, { error: "Action is too long (max 200 chars)" });
                return;
            }

            const data = readData();
            cleanupExpiredSessions(data);
            const user = getCurrentUser(data, req);
            if (!user) {
                sendJson(res, 401, { error: "Please log in first" });
                return;
            }

            const entry = {
                id: crypto.randomUUID(),
                userId: user.id,
                username: user.username,
                action,
                timestamp: nowIso()
            };
            data.activities.push(entry);
            writeData(data);
            sendJson(res, 201, { message: "Activity saved", activity: entry });
        })
        .catch((error) => sendJson(res, 400, { error: error.message }));
}

function handleGetActivities(req, res, parsedUrl) {
    const data = readData();
    cleanupExpiredSessions(data);
    const currentUser = getCurrentUser(data, req);
    const queryUsername = String(parsedUrl.searchParams.get("username") || "").trim();

    if (!currentUser) {
        sendJson(res, 401, { error: "Please log in first" });
        return;
    }

    const targetUsername = queryUsername || currentUser.username;
    if (targetUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
    }

    const activities = data.activities
        .filter((entry) => entry.userId === currentUser.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100);

    writeData(data);
    sendJson(res, 200, { activities });
}

function handleStorage(req, res, parsedUrl) {
    const scope = String(parsedUrl.searchParams.get("scope") || "local").toLowerCase();
    if (scope !== "local" && scope !== "session") {
        sendJson(res, 400, { error: "scope must be local or session" });
        return;
    }

    const data = readData();
    cleanupExpiredSessions(data);
    const ownerKey = getStorageOwnerKey(scope, data, req, res);
    const bucket = getStorageBucket(data, scope, ownerKey);
    const keyParam = parsedUrl.searchParams.get("key");

    if (req.method === "GET") {
        writeData(data);
        sendJson(res, 200, { items: bucket });
        return;
    }

    if (req.method === "DELETE") {
        if (keyParam) {
            delete bucket[keyParam];
        } else {
            data.storage[scope][ownerKey] = {};
        }
        writeData(data);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === "PUT" || req.method === "POST") {
        parseBody(req)
            .then((body) => {
                const key = String(body.key || "").trim();
                if (!key) {
                    sendJson(res, 400, { error: "key is required" });
                    return;
                }
                const value = body.value === undefined || body.value === null ? "" : String(body.value);
                bucket[key] = value;
                writeData(data);
                sendJson(res, 200, { ok: true });
            })
            .catch((error) => sendJson(res, 400, { error: error.message }));
        return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getRecommendedFoods(config, emotion) {
    const catalog = Array.isArray(config?.foodCatalog) ? config.foodCatalog : [];
    const profiles = config?.emotionFoodProfiles && typeof config.emotionFoodProfiles === "object"
        ? config.emotionFoodProfiles
        : {};

    if (!catalog.length) return [];

    const profileTags = Array.isArray(profiles[emotion]) && profiles[emotion].length
        ? profiles[emotion]
        : ["mood", "calm", "energy", "focus", "comfort"];

    const scoredFoods = catalog.map((food) => ({
        food,
        score: profileTags.reduce(
            (total, tag) => total + (Array.isArray(food.tags) && food.tags.includes(tag) ? 1 : 0),
            0
        )
    }));

    const matchedPool = scoredFoods.filter((item) => item.score > 0);
    const sortedPool = (matchedPool.length ? matchedPool : scoredFoods)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.food);

    return shuffle(sortedPool).slice(0, 4);
}

function handleFoodConfig(req, res) {
    try {
        const config = readFoodConfig();
        if (!config) {
            sendJson(res, 404, { error: "Food config not found" });
            return;
        }
        sendJson(res, 200, {
            foodCatalog: config.foodCatalog || [],
            emotionFoodProfiles: config.emotionFoodProfiles || {}
        });
    } catch (error) {
        sendJson(res, 500, { error: "Unable to load food config" });
    }
}

function handleFoodRecommendations(req, res, parsedUrl) {
    const emotion = String(parsedUrl.searchParams.get("emotion") || "").trim().toLowerCase();
    if (!emotion) {
        sendJson(res, 400, { error: "emotion query parameter is required" });
        return;
    }

    try {
        const config = readFoodConfig();
        if (!config) {
            sendJson(res, 404, { error: "Food config not found" });
            return;
        }
        const foods = getRecommendedFoods(config, emotion);
        sendJson(res, 200, { emotion, foods });
    } catch (error) {
        sendJson(res, 500, { error: "Unable to generate food recommendations" });
    }
}

function handleQuizConfig(req, res) {
    try {
        const config = readQuizConfig();
        if (!config) {
            sendJson(res, 404, { error: "Quiz config not found" });
            return;
        }
        sendJson(res, 200, config);
    } catch (error) {
        sendJson(res, 500, { error: "Unable to load quiz config" });
    }
}

function handleMoodEmotions(req, res) {
    try {
        const config = readMoodEmotionsConfig();
        if (!config) {
            sendJson(res, 404, { error: "Mood emotions config not found" });
            return;
        }
        sendJson(res, 200, config);
    } catch (error) {
        sendJson(res, 500, { error: "Unable to load mood emotions config" });
    }
}

function normalizeQuestionEmotionFeaturePath(featurePath) {
    const raw = String(featurePath || "").trim();
    if (!raw) return null;
    if (/^(https?:)?\/\//i.test(raw) || /^javascript:/i.test(raw)) return null;

    const cleanPath = raw.split("?")[0];
    let decodedPath = cleanPath;
    try {
        decodedPath = decodeURIComponent(cleanPath);
    } catch (error) {
        decodedPath = cleanPath;
    }

    const normalized = decodedPath.replace(/^[/\\]+/, "");
    if (!normalized || normalized.includes("\0")) return null;
    return normalized;
}

function questionEmotionTargetExists(featurePath) {
    const normalized = normalizeQuestionEmotionFeaturePath(featurePath);
    if (!normalized) return false;

    const resolved = path.resolve(ROOT_DIR, normalized);
    const root = ROOT_DIR + path.sep;
    if (resolved !== ROOT_DIR && !resolved.startsWith(root)) {
        return false;
    }

    try {
        return fs.statSync(resolved).isFile();
    } catch (error) {
        return false;
    }
}

function filterQuestionEmotionItems(items) {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => {
        if (!item || typeof item !== "object") return false;
        if (!item.feature) return true;
        return questionEmotionTargetExists(item.feature);
    });
}

function handleQuestionEmotions(req, res) {
    try {
        const config = readQuestionEmotionsConfig();
        if (!config) {
            sendJson(res, 404, { error: "Question emotion config not found" });
            return;
        }

        const safeItems = filterQuestionEmotionItems(config.items);
        sendJson(res, 200, { ...config, items: safeItems });
    } catch (error) {
        sendJson(res, 500, { error: "Unable to load question emotion config" });
    }
}

function normalizeMonthKey(input) {
    if (!input) return null;
    const parts = String(input).trim().split("-");
    if (parts.length !== 2) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }
    return `${year}-${month}`;
}

function isValidDateKey(value) {
    return typeof value === "string" && /^\d{4}-\d{1,2}-\d{1,2}$/.test(value.trim());
}

function handleMoodEntries(req, res, parsedUrl) {
    const data = readData();
    cleanupExpiredSessions(data);

    const ownerKey = getStorageOwnerKey("local", data, req, res);
    if (!data.moods || typeof data.moods !== "object") data.moods = {};
    if (!data.moods[ownerKey] || typeof data.moods[ownerKey] !== "object") {
        data.moods[ownerKey] = {};
    }
    const bucket = data.moods[ownerKey];

    if (req.method === "GET") {
        const monthQuery = normalizeMonthKey(parsedUrl.searchParams.get("month"));
        if (!monthQuery) {
            writeData(data);
            sendJson(res, 200, { entries: bucket });
            return;
        }
        const filtered = {};
        Object.entries(bucket).forEach(([key, emoji]) => {
            if (key.startsWith(`${monthQuery}-`)) {
                filtered[key] = emoji;
            }
        });
        writeData(data);
        sendJson(res, 200, { entries: filtered });
        return;
    }

    if (req.method === "DELETE") {
        const dateKey = String(parsedUrl.searchParams.get("dateKey") || "").trim();
        if (!isValidDateKey(dateKey)) {
            sendJson(res, 400, { error: "Valid dateKey query parameter is required" });
            return;
        }
        delete bucket[dateKey];
        writeData(data);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === "PUT" || req.method === "POST") {
        parseBody(req)
            .then((body) => {
                const dateKey = String(body.dateKey || "").trim();
                const emoji = String(body.emoji || "").trim();
                if (!isValidDateKey(dateKey)) {
                    sendJson(res, 400, { error: "Valid dateKey is required" });
                    return;
                }
                if (!emoji || emoji.length > 16) {
                    sendJson(res, 400, { error: "Valid emoji is required" });
                    return;
                }
                bucket[dateKey] = emoji;
                writeData(data);
                sendJson(res, 200, { ok: true });
            })
            .catch((error) => sendJson(res, 400, { error: error.message }));
        return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
}

function resolveStaticPath(parsedUrl) {
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/") {
        if (fs.existsSync(path.join(ROOT_DIR, "home.html"))) {
            pathname = "/home.html";
        } else {
            pathname = "/Log in/Log in.html";
        }
    }
    const rel = pathname.replace(/^[/\\]+/, "");
    return path.resolve(ROOT_DIR, rel);
}

function injectBridge(content) {
    if (content.includes(CLIENT_BRIDGE_PATH)) {
        return content;
    }
    const tag = `<script src="${CLIENT_BRIDGE_PATH}"></script>`;
    if (content.includes("</head>")) {
        return content.replace("</head>", `${tag}\n</head>`);
    }
    if (content.includes("<body")) {
        return content.replace(/<body[^>]*>/i, (match) => `${match}\n${tag}`);
    }
    return `${tag}\n${content}`;
}

function serveStatic(req, res, parsedUrl) {
    const filePath = resolveStaticPath(parsedUrl);
    const ext = path.extname(filePath).toLowerCase();
    const root = ROOT_DIR + path.sep;
    const blockedRoot = path.resolve(DATA_DIR) + path.sep;

    if (filePath !== ROOT_DIR && !filePath.startsWith(root)) {
        sendText(res, 403, "Forbidden");
        return;
    }
    if (filePath.startsWith(blockedRoot)) {
        sendText(res, 403, "Forbidden");
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            sendText(res, 404, "Not Found");
            return;
        }

        fs.readFile(filePath, ext === ".html" ? "utf8" : undefined, (readErr, content) => {
            if (readErr) {
                sendText(res, 500, "Unable to read file");
                return;
            }

            if (ext === ".html") {
                const html = injectBridge(content);
                res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
                res.end(html);
                return;
            }

            res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
            res.end(content);
        });
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const route = parsedUrl.pathname;

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
    }

    if (req.method === "GET" && route === "/api/health") {
        sendJson(res, 200, { status: "ok" });
        return;
    }
    if (req.method === "GET" && route === "/api/food/config") {
        handleFoodConfig(req, res);
        return;
    }
    if (req.method === "GET" && route === "/api/food/recommendations") {
        handleFoodRecommendations(req, res, parsedUrl);
        return;
    }
    if (req.method === "GET" && route === "/api/quiz/config") {
        handleQuizConfig(req, res);
        return;
    }
    if (req.method === "GET" && route === "/api/mood/emotions") {
        handleMoodEmotions(req, res);
        return;
    }
    if (req.method === "GET" && route === "/api/question/emotions") {
        handleQuestionEmotions(req, res);
        return;
    }
    if ((req.method === "GET" || req.method === "PUT" || req.method === "POST" || req.method === "DELETE") && route === "/api/mood/entries") {
        handleMoodEntries(req, res, parsedUrl);
        return;
    }
    if (req.method === "POST" && route === "/api/signup") {
        handleSignup(req, res);
        return;
    }
    if (req.method === "POST" && route === "/api/login") {
        handleLogin(req, res);
        return;
    }
    if (req.method === "POST" && route === "/api/logout") {
        handleLogout(req, res);
        return;
    }
    if (req.method === "GET" && route === "/api/me") {
        handleMe(req, res);
        return;
    }
    if (req.method === "POST" && route === "/api/activities") {
        handlePostActivity(req, res);
        return;
    }
    if (req.method === "GET" && route === "/api/activities") {
        handleGetActivities(req, res, parsedUrl);
        return;
    }
    if ((req.method === "GET" || req.method === "PUT" || req.method === "POST" || req.method === "DELETE") && route === "/api/storage") {
        handleStorage(req, res, parsedUrl);
        return;
    }

    serveStatic(req, res, parsedUrl);
});

server.listen(PORT, () => {
    ensureDataFile();
    console.log(`Portal backend running on http://localhost:${PORT}`);
});

