#!/bin/bash
# Исправление WebSocket для HTTPS
# Выполните на сервере: sudo bash fix-websocket-https.sh

DOMAIN="kibitkostreamappv.pp.ua"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "🔧 Исправление WebSocket для HTTPS..."
echo ""

# Проверяем SSL
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo "❌ SSL сертификат не найден!"
    echo "   Установите SSL: sudo bash /www/wwwroot/LiveKit/setup-ssl.sh"
    exit 1
fi

echo "✅ SSL сертификат найден"
echo ""

# Проверяем что LiveKit запущен
if ! netstat -tulpn 2>/dev/null | grep -q 7880 && ! ss -tulpn 2>/dev/null | grep -q 7880; then
    echo "❌ LiveKit не запущен на порту 7880!"
    exit 1
fi

echo "✅ LiveKit запущен"
echo ""

# Создаем правильную конфигурацию с /rtc в HTTPS блоке
echo "🔧 Создание правильной конфигурации Nginx..."
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

    # LiveKit WebSocket - КРИТИЧЕСКИ ВАЖНО!
    # Должен быть ВНУТРИ HTTPS блока!
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
    echo "✅ Готово! WebSocket должен работать через HTTPS"
    echo ""
    echo "📊 Проверка:"
    echo "   - HTTP редиректит на HTTPS"
    echo "   - HTTPS блок содержит location /rtc"
    echo ""
else
    echo "❌ Ошибка в конфигурации!"
    exit 1
fi

