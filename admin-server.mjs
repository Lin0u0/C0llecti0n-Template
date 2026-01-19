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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4322;

// 数据文件路径
const DATA_DIR = join(__dirname, 'src', 'data');
const DATA_FILES = {
    books: join(DATA_DIR, 'books.json'),
    movies: join(DATA_DIR, 'movies.json'),
    series: join(DATA_DIR, 'series.json'),
    music: join(DATA_DIR, 'music.json'),
};

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
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
║   端口: http://localhost:${PORT}                            ║
║                                                            ║
║   API 端点:                                                 ║
║   - GET    /api/books          获取所有书籍                ║
║   - POST   /api/books          添加新书籍                  ║
║   - PUT    /api/books/:id      更新书籍                    ║
║   - DELETE /api/books/:id      删除书籍                    ║
║                                                            ║
║   同样支持: /api/movies, /api/series, /api/music           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
