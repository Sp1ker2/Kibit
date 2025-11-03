#!/bin/bash
# Исправленная конфигурация Nginx для LiveKit
# Выполните на сервере: sudo bash fix-livekit-nginx.sh

DOMAIN="kibitkostreamappv.pp.ua"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "🔧 Обновление конфигурации Nginx для LiveKit..."

# Создаем исправленную конфигурацию
cat > ${NGINX_CONF} <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kibitkostreamappv.pp.ua;

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

    # LiveKit WebSocket - проксируем все запросы к порту 7880
    location /rtc {
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
    }
}
EOF

# Активируем конфигурацию
rm -f /etc/nginx/sites-enabled/${DOMAIN}
ln -s ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN}

echo "✅ Конфигурация обновлена"

# Проверяем конфигурацию
echo "🔍 Проверка конфигурации..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация корректна"
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx || service nginx reload
    echo ""
    echo "✅ Готово! Nginx обновлен для LiveKit"
else
    echo "❌ Ошибка в конфигурации!"
    exit 1
fi

