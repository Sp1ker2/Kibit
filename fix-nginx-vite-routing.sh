#!/bin/bash
# Скрипт для настройки Nginx для проксирования на Vite с поддержкой SPA роутинга

echo "🔧 Настройка Nginx для Vite с поддержкой SPA роутинга"
echo ""

# Проверка, что Vite работает
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "❌ Vite не работает на порту 5173!"
    echo "   Запустите: cd /www/wwwroot/LiveKit/streamApp && npm run dev"
    exit 1
fi

echo "✅ Vite работает на порту 5173"
echo ""

# Ищем конфигурацию Nginx для домена
DOMAIN="kibitkostreamappv.pp.ua"

echo "📋 Найдем конфигурацию для домена ${DOMAIN}..."
echo ""

# Проверяем панель управления
if [ -d "/www/server/panel" ]; then
    echo "⚠️  Обнаружена панель управления (aaPanel/btPanel)"
    echo ""
    echo "📝 ВАМ НУЖНО ВРУЧНУЮ НАСТРОИТЬ NGINX В ПАНЕЛИ:"
    echo ""
    echo "1. Зайдите в панель управления:"
    echo "   https://$(hostname -I | awk '{print $1}'):8888"
    echo ""
    echo "2. Сайты → ${DOMAIN} → Настройки → Конфигурация"
    echo ""
    echo "3. Найдите блок 'location /' и замените на:"
    cat << 'NGINX_CONFIG'
    # Прокси для API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 500M;
    }

    # Прокси для LiveKit WebSocket
    location /rtc {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # Прокси для Frontend (Vite dev server с поддержкой SPA роутинга)
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
NGINX_CONFIG
    echo ""
    echo "4. Сохраните и перезагрузите Nginx"
    echo ""
    echo "5. После этого /videos будет работать!"
else
    echo "✅ Панель управления не найдена, настраиваем напрямую..."
    
    # Создаем конфигурацию напрямую
    NGINX_CONFIG_FILE="/etc/nginx/sites-available/${DOMAIN}"
    
    if [ ! -f "$NGINX_CONFIG_FILE" ]; then
        echo "📝 Создаю конфигурацию Nginx..."
        mkdir -p /etc/nginx/sites-available
        mkdir -p /etc/nginx/sites-enabled
    fi
    
    cat > "$NGINX_CONFIG_FILE" << EOF
server {
    listen 80;
    listen 8443;
    server_name ${DOMAIN};

    # Прокси для API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 500M;
    }

    # Прокси для LiveKit WebSocket
    location /rtc {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # Прокси для Frontend (Vite dev server с поддержкой SPA роутинга)
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF
    
    # Создаем симлинк
    ln -sf "$NGINX_CONFIG_FILE" "/etc/nginx/sites-enabled/${DOMAIN}"
    
    # Проверяем конфигурацию
    if nginx -t 2>/dev/null; then
        echo "✅ Конфигурация корректна, перезагружаю Nginx..."
        systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null
        echo "✅ Готово!"
    else
        echo "❌ Ошибка в конфигурации Nginx"
        exit 1
    fi
fi

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "🔗 Теперь доступны ссылки:"
echo "   - https://${DOMAIN}:8443/          (главная страница)"
echo "   - https://${DOMAIN}:8443/videos    (публичная страница видео)"
echo "   - https://${DOMAIN}:8443/database  (база данных)"
echo ""

