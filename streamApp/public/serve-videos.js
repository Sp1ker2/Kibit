// Простой сервер для videos.html с проксированием API
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8090;
const API_URL = 'http://127.0.0.1:3001';
const HTML_FILE = path.join(__dirname, '../videos.html');

// Читаем videos.html и меняем API_URL
let htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

// Заменяем API_URL на текущий порт сервера
htmlContent = htmlContent.replace(
    /const API_URL = window\.location\.origin;/,
    `const API_URL = 'http://' + window.location.host;`
);

const server = http.createServer((req, res) => {
    // API запросы - проксируем на API сервер
    if (req.url.startsWith('/api/')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = `${API_URL}${url.pathname}${url.search}`;
        
        const proxyReq = http.request(targetUrl, {
            method: req.method,
            headers: {
                ...req.headers,
                host: '127.0.0.1:3001'
            }
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
        });
        
        req.pipe(proxyReq);
        return;
    }
    
    // videos.html или главная страница
    if (req.url === '/videos.html' || req.url === '/') {
        res.writeHead(200, { 
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(htmlContent);
        return;
    }
    
    // 404 для всего остального
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
    console.log(`🔗 Ссылка: http://kibitkostreamappv.pp.ua:${PORT}/videos.html`);
    console.log(`📡 API проксируется на: ${API_URL}`);
});
