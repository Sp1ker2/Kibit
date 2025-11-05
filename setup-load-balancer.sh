#!/bin/bash
# Скрипт для настройки Nginx Load Balancer на главном сервере (195.133.17.131)

echo "⚖️  Настройка Nginx Load Balancer"
echo ""

# Массив серверов (upstream)
SERVERS=(
    "195.133.17.131"
    "195.133.17.179"
    "195.133.39.17"
    "195.133.39.33"
    "195.133.39.41"
)

# Создаем конфигурацию Nginx
NGINX_CONFIG="/etc/nginx/sites-available/streamapp-lb"

cat > /tmp/nginx-lb.conf << 'NGINX_EOF'
# Load Balancer для LiveKit Stream App

# Upstream для API серверов
upstream api_backend {
    least_conn;  # Балансировка по наименьшему количеству соединений
    server 195.133.17.131:3001;
    server 195.133.17.179:3001;
    server 195.133.39.17:3001;
    server 195.133.39.33:3001;
    server 195.133.39.41:3001;
    keepalive 32;
}

# Upstream для Frontend серверов
upstream frontend_backend {
    ip_hash;  # Привязка по IP для стабильности сессий
    server 195.133.17.131:5173;
    server 195.133.17.179:5173;
    server 195.133.39.17:5173;
    server 195.133.39.33:5173;
    server 195.133.39.41:5173;
    keepalive 32;
}

# Upstream для LiveKit WebSocket
upstream livekit_backend {
    ip_hash;  # Привязка по IP для WebSocket соединений
    server 195.133.17.131:7880;
    server 195.133.17.179:7880;
    server 195.133.39.17:7880;
    server 195.133.39.33:7880;
    server 195.133.39.41:7880;
    keepalive 32;
}

server {
    listen 80;
    server_name kibitkostreamappv.pp.ua;

    # Логи
    access_log /var/log/nginx/streamapp-access.log;
    error_log /var/log/nginx/streamapp-error.log;

    # Прокси для API
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Прокси для LiveKit WebSocket
    location /rtc {
        proxy_pass http://livekit_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffering off;
    }

    # Прокси для LiveKit HTTP
    location /livekit/ {
        proxy_pass http://livekit_backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Прокси для Frontend (Vite dev server)
    location / {
        proxy_pass http://frontend_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# SSL конфигурация (если есть SSL сертификат)
server {
    listen 443 ssl http2;
    server_name kibitkostreamappv.pp.ua;

    # SSL сертификаты (замените на ваши пути)
    # ssl_certificate /path/to/certificate.crt;
    # ssl_certificate_key /path/to/private.key;

    # Логи
    access_log /var/log/nginx/streamapp-ssl-access.log;
    error_log /var/log/nginx/streamapp-ssl-error.log;

    # Те же location блоки что и выше
    include /etc/nginx/sites-available/streamapp-lb-locations.conf;
}
NGINX_EOF

echo "📝 Конфигурация Nginx создана"
echo ""
echo "⚠️  ВАЖНО: Выполните следующие команды на главном сервере (195.133.17.131):"
echo ""
echo "1. Скопируйте конфигурацию:"
echo "   sudo cp /tmp/nginx-lb.conf /etc/nginx/sites-available/streamapp-lb"
echo ""
echo "2. Создайте симлинк:"
echo "   sudo ln -sf /etc/nginx/sites-available/streamapp-lb /etc/nginx/sites-enabled/"
echo ""
echo "3. Проверьте конфигурацию:"
echo "   sudo nginx -t"
echo ""
echo "4. Перезапустите Nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo "5. Откройте порты на всех серверах (если firewall включен):"
echo "   sudo ufw allow 3001/tcp"
echo "   sudo ufw allow 5173/tcp"
echo "   sudo ufw allow 7880/tcp"
echo "   sudo ufw allow 7880/udp"
echo ""

