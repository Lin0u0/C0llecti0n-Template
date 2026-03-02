/**
 * 本地 API 服务器 - 用于管理页面编辑 JSON 数据
 * 
 * 使用方法：
 * 1. 运行 `npm run admin-server` 启动此服务器
 * 2. 在另一个终端运行 `npm run dev` 启动 Astro
 * 3. 访问 http://localhost:4321/admin 进行数据管理
 */

import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuration from environment variables
const PORT = process.env.ADMIN_API_PORT || 4322;
const HOST = process.env.ADMIN_API_HOST || 'localhost';
const ADMIN_KEY = process.env.ADMIN_KEY;

// Security: Check if admin key is configured
if (!ADMIN_KEY) {
    console.warn('⚠️  Warning: ADMIN_KEY not set. Write operations (POST/PUT/DELETE) will be rejected with 503 until ADMIN_KEY is configured.');
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// 数据文件路径
const DATA_DIR = join(__dirname, 'src', 'data');
const DATA_FILES = {
    books: join(DATA_DIR, 'books.json'),
    movies: join(DATA_DIR, 'movies.json'),
    series: join(DATA_DIR, 'series.json'),
    music: join(DATA_DIR, 'music.json'),
};

// ==================== Data Validation Schemas ====================

const ValidationRules = {
    required: (value, fieldName) => {
        if (value === undefined || value === null || value === '') {
            return `${fieldName} is required`;
        }
        return null;
    },
    string: (value, fieldName) => {
        if (value !== undefined && value !== null && typeof value !== 'string') {
            return `${fieldName} must be a string`;
        }
        return null;
    },
    number: (value, fieldName, min, max) => {
        if (value === undefined || value === null) return null;
        const num = Number(value);
        if (isNaN(num)) return `${fieldName} must be a number`;
        if (min !== undefined && num < min) return `${fieldName} must be at least ${min}`;
        if (max !== undefined && num > max) return `${fieldName} must be at most ${max}`;
        return null;
    },
    url: (value, fieldName) => {
        if (!value) return null;
        // Allow relative paths like "/covers/image.jpg"
        if (value.startsWith('/')) return null;
        try {
            new URL(value);
            return null;
        } catch {
            return `${fieldName} must be a valid URL or path`;
        }
    },
    date: (value, fieldName) => {
        if (!value) return null;
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return `${fieldName} must be a valid date (YYYY-MM-DD)`;
        }
        return null;
    },
    enum: (value, fieldName, allowedValues) => {
        if (!value) return null;
        if (!allowedValues.includes(value)) {
            return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
        }
        return null;
    }
};

// Field schemas for each data type
const FIELD_SCHEMAS = {
    books: {
        title: { required: true, type: 'string' },
        author: { required: true, type: 'string' },
        publisher: { type: 'string' },
        country: { type: 'string' },
        year: { type: 'number', min: 1000, max: 2100 },
        status: { type: 'enum', values: ['reading', 'completed', 'want-to-read'] },
        platform: { type: 'string' },
        cover: { type: 'url' },
        addedDate: { type: 'date' },
        rating: { type: 'number', min: 1, max: 10 },
        notes: { type: 'string' }
    },
    movies: {
        title: { required: true, type: 'string' },
        director: { type: 'string' },
        country: { type: 'string' },
        year: { type: 'number', min: 1000, max: 2100 },
        status: { type: 'enum', values: ['watching', 'completed', 'want-to-watch'] },
        cover: { required: true, type: 'url' },
        addedDate: { type: 'date' },
        rating: { type: 'number', min: 1, max: 10 },
        genre: { type: 'string' },
        notes: { type: 'string' }
    },
    series: {
        title: { required: true, type: 'string' },
        director: { type: 'string' },
        country: { type: 'string' },
        year: { type: 'number', min: 1000, max: 2100 },
        status: { type: 'enum', values: ['watching', 'completed', 'want-to-watch'] },
        cover: { required: true, type: 'url' },
        addedDate: { type: 'date' },
        rating: { type: 'number', min: 1, max: 10 },
        genre: { type: 'string' },
        notes: { type: 'string' }
    },
    music: {
        title: { required: true, type: 'string' },
        artist: { required: true, type: 'string' },
        cover: { required: true, type: 'url' },
        year: { type: 'number', min: 1000, max: 2100 },
        country: { type: 'string' },
        addedDate: { type: 'date' },
        rating: { type: 'number', min: 1, max: 10 },
        genre: { type: 'string' },
        notes: { type: 'string' }
    }
};

/**
 * Validate item data against schema
 * @param {string} type - Data type (books, movies, series, music)
 * @param {Object} data - Item data to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
function validateItem(type, data) {
    const schema = FIELD_SCHEMAS[type];
    if (!schema) {
        return { isValid: false, errors: [`Unknown data type: ${type}`] };
    }

    const errors = [];

    // Check for unknown fields
    const knownFields = Object.keys(schema);
    const unknownFields = Object.keys(data).filter(key => 
        !knownFields.includes(key) && key !== 'id'
    );
    if (unknownFields.length > 0) {
        console.warn(`Unknown fields in ${type}:`, unknownFields);
    }

    // Validate each field
    for (const [fieldName, rules] of Object.entries(schema)) {
        const value = data[fieldName];

        // Check required
        if (rules.required) {
            const error = ValidationRules.required(value, fieldName);
            if (error) {
                errors.push(error);
                continue;
            }
        }

        // Skip further validation if value is empty and not required
        if (!value && !rules.required) continue;

        // Type validation
        switch (rules.type) {
            case 'string':
                const stringError = ValidationRules.string(value, fieldName);
                if (stringError) errors.push(stringError);
                break;
            case 'number':
                const numberError = ValidationRules.number(value, fieldName, rules.min, rules.max);
                if (numberError) errors.push(numberError);
                break;
            case 'url':
                const urlError = ValidationRules.url(value, fieldName);
                if (urlError) errors.push(urlError);
                break;
            case 'date':
                const dateError = ValidationRules.date(value, fieldName);
                if (dateError) errors.push(dateError);
                break;
            case 'enum':
                const enumError = ValidationRules.enum(value, fieldName, rules.values);
                if (enumError) errors.push(enumError);
                break;
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// CORS 头 - Restrict to localhost for security
const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:4321',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Content-Type': 'application/json',
};

// 读取 JSON 文件
async function readJsonFile(type) {
    const filePath = DATA_FILES[type];
    if (!filePath) {
        throw new Error(`Unknown data type: ${type}`);
    }
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

// 写入 JSON 文件
async function writeJsonFile(type, data) {
    const filePath = DATA_FILES[type];
    if (!filePath) {
        throw new Error(`Unknown data type: ${type}`);
    }
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// 生成新 ID
function generateId(type, items) {
    const prefix = type === 'books' ? 'book' :
        type === 'movies' ? 'movie' :
            type === 'series' ? 'series' : 'music';
    const maxId = items.reduce((max, item) => {
        const match = item.id?.match(new RegExp(`${prefix}-(\\d+)`));
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `${prefix}-${maxId + 1}`;
}

// Authentication middleware - Check admin key for write operations
function isAuthenticated(req) {
    // Skip authentication for GET requests (read-only)
    if (req.method === 'GET') return true;
    if (!ADMIN_KEY) return false; // no key configured → block writes
    const providedKey = req.headers['x-admin-key'];
    return providedKey === ADMIN_KEY;
}

// 请求处理
async function handleRequest(req, res) {
    // 设置 CORS
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Security: Check authentication for write operations
    if (!isAuthenticated(req)) {
        const status = !ADMIN_KEY ? 503 : 401;
        const message = !ADMIN_KEY ? 'Service unavailable - ADMIN_KEY not configured' : 'Unauthorized - Invalid admin key';
        res.writeHead(status);
        res.end(JSON.stringify({ error: message }));
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // API 路由: /api/{type}
    if (pathParts[0] !== 'api' || !pathParts[1]) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    const type = pathParts[1]; // books, movies, series, music
    const itemId = pathParts[2]; // 可选的 ID

    try {
        // GET - 获取列表或单个项目
        if (req.method === 'GET') {
            const data = await readJsonFile(type);
            if (itemId) {
                const item = data.find(i => i.id === itemId);
                if (!item) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Item not found' }));
                    return;
                }
                res.writeHead(200);
                res.end(JSON.stringify(item));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify(data));
            }
            return;
        }

        // POST - 创建新项目
        if (req.method === 'POST') {
            const body = await getRequestBody(req);
            
            // Validate input data
            const validation = validateItem(type, body);
            if (!validation.isValid) {
                res.writeHead(400);
                res.end(JSON.stringify({ 
                    error: 'Validation failed', 
                    details: validation.errors 
                }));
                return;
            }

            const data = await readJsonFile(type);

            const newItem = {
                id: generateId(type, data),
                ...body,
                addedDate: body.addedDate || new Date().toISOString().split('T')[0],
            };

            // 添加到列表开头
            data.unshift(newItem);
            await writeJsonFile(type, data);

            console.log(`✅ Created ${type}: ${newItem.title}`);
            res.writeHead(201);
            res.end(JSON.stringify(newItem));
            return;
        }

        // PUT - 更新项目
        if (req.method === 'PUT' && itemId) {
            const body = await getRequestBody(req);
            
            // Validate input data (skip id validation)
            const validation = validateItem(type, body);
            if (!validation.isValid) {
                res.writeHead(400);
                res.end(JSON.stringify({ 
                    error: 'Validation failed', 
                    details: validation.errors 
                }));
                return;
            }

            const data = await readJsonFile(type);

            const index = data.findIndex(i => i.id === itemId);
            if (index === -1) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Item not found' }));
                return;
            }

            data[index] = { ...data[index], ...body, id: itemId };
            await writeJsonFile(type, data);

            console.log(`✅ Updated ${type}: ${data[index].title}`);
            res.writeHead(200);
            res.end(JSON.stringify(data[index]));
            return;
        }

        // DELETE - 删除项目
        if (req.method === 'DELETE' && itemId) {
            const data = await readJsonFile(type);

            const index = data.findIndex(i => i.id === itemId);
            if (index === -1) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Item not found' }));
                return;
            }

            const deleted = data.splice(index, 1)[0];
            await writeJsonFile(type, data);

            console.log(`🗑️ Deleted ${type}: ${deleted.title}`);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, deleted }));
            return;
        }

        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
    }
}

// 解析请求体
const MAX_BODY_SIZE = 1_000_000; // 1 MB

function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

// 启动服务器
const server = createServer(handleRequest);
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔧 管理 API 服务器已启动                                  ║
║                                                            ║
║   端口: http://${HOST}:${PORT}                              ║
║                                                            ║
║   API 端点:                                                 ║
║   - GET    /api/books          获取所有书籍                ║
║   - POST   /api/books          添加新书籍                  ║
║   - PUT    /api/books/:id      更新书籍                    ║
║   - DELETE /api/books/:id      删除书籍                    ║
║                                                            ║
║   同样支持: /api/movies, /api/series, /api/music           ║
║                                                            ║
║   环境变量:                                                 ║
║   - ADMIN_API_PORT             设置端口 (默认: 4322)       ║
║   - ADMIN_API_HOST             设置主机 (默认: localhost)  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
