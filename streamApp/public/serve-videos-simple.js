// Простой сервер для videos.html с проксированием API
import http from 'http';
import { createProxyAgent } from 'proxy-agent';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import httpProxy from 'http-proxy-middleware';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8090;
const API_URL = 'http://127.0.0.1:3001';
const HTML_FILE = path.join(__dirname, '../videos.html');

// Читаем videos.html и меняем API_URL на относительный путь
let htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

// Заменяем API_URL в HTML на текущий порт
htmlContent = htmlContent.replace(
    /const API_URL = window\.location\.origin;/,
    `const API_URL = 'http://' + window.location.host;`
);

const server = http.createServer((req, res) => {
    // API запросы - проксируем на API сервер
    if (req.url.startsWith('/api/')) {
        const targetUrl = `${API_URL}${req.url}`;
        
        const proxyReq = http.request(targetUrl, {
            method: req.method,
            headers: {
                ...req.headers,
                host: 'localhost:3001'
            }
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end('Proxy error');
        });
        
        req.pipe(proxyReq);
        return;
    }
    
    // videos.html или главная страница
    if (req.url === '/videos.html' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
});



