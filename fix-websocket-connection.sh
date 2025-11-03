#!/bin/bash
# Исправление WebSocket подключения LiveKit через Nginx
# Выполните на сервере: sudo bash fix-websocket-connection.sh

DOMAIN="kibitkostreamappv.pp.ua"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "🔧 Исправление WebSocket подключения LiveKit..."
echo ""

# Проверяем что LiveKit запущен
echo "📊 Проверка LiveKit сервера..."
if netstat -tulpn 2>/dev/null | grep -q 7880 || ss -tulpn 2>/dev/null | grep -q 7880; then
    echo "✅ LiveKit сервер запущен на порту 7880"
else
    echo "❌ LiveKit сервер НЕ запущен на порту 7880!"
    exit 1
fi

# Проверяем есть ли SSL сертификат
SSL_EXISTS=false
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    SSL_EXISTS=true
    echo "✅ SSL сертификат найден"
else
    echo "⚠️  SSL сертификат не найден (будет только HTTP)"
fi
echo ""

# Создаем правильную конфигурацию с WebSocket
echo "🔧 Создание правильной конфигурации Nginx для WebSocket..."

if [ "$SSL_EXISTS" = true ]; then
    # Конфигурация с HTTPS
    cat > ${NGINX_CONF} <<EOF
# HTTP - редирект на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# HTTPS конфигурация
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Фронтенд приложение
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # API сервер
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # LiveKit WebSocket - КРИТИЧЕСКИ ВАЖНО для WebSocket!
    # Важно: НЕ добавляем /rtc в proxy_pass, чтобы путь передавался как есть
    location /rtc {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
        proxy_set_header Origin "";
    }
    
    # LiveKit альтернативные пути
    location ~ ^/(live|twirp|room) {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }
}
EOF
else
    # Конфигурация без HTTPS (только HTTP)
    cat > ${NGINX_CONF} <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Фронтенд приложение
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # API сервер
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # LiveKit WebSocket - КРИТИЧЕСКИ ВАЖНО для WebSocket!
    # Важно: НЕ добавляем /rtc в proxy_pass, чтобы путь передавался как есть
    location /rtc {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
        proxy_set_header Origin "";
    }
    
    # LiveKit альтернативные пути
    location ~ ^/(live|twirp|room) {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }
}
EOF
fi

# Активируем конфигурацию
rm -f /etc/nginx/sites-enabled/${DOMAIN}
ln -s ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN}

echo "✅ Конфигурация обновлена"
echo ""

# Проверяем конфигурацию
echo "🔍 Проверка конфигурации Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация корректна"
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx
    echo ""
    echo "✅ Готово! WebSocket должен работать"
    echo ""
    echo "📊 Проверка портов:"
    netstat -tulpn 2>/dev/null | grep -E '5173|3001|7880' || ss -tulpn 2>/dev/null | grep -E '5173|3001|7880'
else
    echo "❌ Ошибка в конфигурации!"
    exit 1
fi

