#!/bin/bash
# Скрипт для исправления подключения LiveKit через Nginx
# Выполните на сервере: sudo bash fix-livekit-connection.sh

DOMAIN="kibitkostreamappv.pp.ua"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "🔧 Исправление подключения LiveKit..."
echo ""

# Проверяем что LiveKit запущен
echo "📊 Проверка LiveKit сервера..."
if netstat -tulpn 2>/dev/null | grep -q 7880 || ss -tulpn 2>/dev/null | grep -q 7880; then
    echo "✅ LiveKit сервер запущен на порту 7880"
else
    echo "❌ LiveKit сервер НЕ запущен на порту 7880!"
    echo "   Запустите: cd /www/wwwroot/LiveKit && ./start-with-https.sh"
    echo "   Или через daemon в панели"
    exit 1
fi

# Проверяем HTTPS конфигурацию
echo ""
echo "📋 Проверка Nginx конфигурации..."

if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Конфигурация Nginx не найдена: $NGINX_CONF"
    exit 1
fi

# Создаем правильную конфигурацию с HTTPS поддержкой
echo "🔧 Создание правильной конфигурации Nginx..."
cat > ${NGINX_CONF} <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kibitkostreamappv.pp.ua;

    # Редирект на HTTPS (если SSL установлен)
    # Раскомментируйте если SSL установлен:
    # return 301 https://$server_name$request_uri;

    # Фронтенд приложение
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # API сервер
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # LiveKit WebSocket - ВАЖНО: проксируем /rtc на порт 7880
    location /rtc {
        proxy_pass http://127.0.0.1:7880/rtc;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }
    
    # LiveKit альтернативные пути
    location ~ ^/(live|twirp|room) {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }
}

# HTTPS конфигурация (если SSL установлен)
# Раскомментируйте и настройте после установки SSL:
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name kibitkostreamappv.pp.ua;
#
#     ssl_certificate /etc/letsencrypt/live/kibitkostreamappv.pp.ua/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/kibitkostreamappv.pp.ua/privkey.pem;
#
#     # Фронтенд
#     location / {
#         proxy_pass http://127.0.0.1:5173;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#         proxy_read_timeout 86400;
#     }
#
#     # API
#     location /api {
#         proxy_pass http://127.0.0.1:3001;
#         proxy_http_version 1.1;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#     }
#
#     # LiveKit WebSocket
#     location /rtc {
#         proxy_pass http://127.0.0.1:7880/rtc;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection "upgrade";
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_read_timeout 86400;
#         proxy_send_timeout 86400;
#         proxy_buffering off;
#     }
#
#     location ~ ^/(live|twirp|room) {
#         proxy_pass http://127.0.0.1:7880;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection "upgrade";
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_read_timeout 86400;
#         proxy_send_timeout 86400;
#         proxy_buffering off;
#     }
# }
EOF

# Активируем конфигурацию
rm -f /etc/nginx/sites-enabled/${DOMAIN}
ln -s ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN}

echo "✅ Конфигурация обновлена"

# Проверяем конфигурацию
echo ""
echo "🔍 Проверка конфигурации Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация корректна"
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx || service nginx reload
    echo ""
    echo "✅ Готово! Nginx обновлен для LiveKit"
    echo ""
    echo "📊 Проверка портов:"
    netstat -tulpn 2>/dev/null | grep -E '5173|3001|7880' || ss -tulpn 2>/dev/null | grep -E '5173|3001|7880' || echo "⚠️  Порты не найдены"
else
    echo "❌ Ошибка в конфигурации!"
    exit 1
fi

