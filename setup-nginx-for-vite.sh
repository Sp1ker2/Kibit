#!/bin/bash
# Скрипт для автоматической настройки Nginx для проксирования на Vite dev server

set -e

DOMAIN="kibitkostreamappv.pp.ua"
VITE_PORT=5173
API_PORT=3001
LIVEKIT_PORT=7880

echo "🔧 Настройка Nginx для проксирования на Vite dev server"
echo ""

# Проверка, что Vite работает
if ! curl -s http://localhost:${VITE_PORT} > /dev/null 2>&1; then
    echo "⚠️  Vite не работает на порту ${VITE_PORT}!"
    echo "   Запускаю Vite..."
    cd /www/wwwroot/LiveKit/streamApp
    nohup npm run dev > /tmp/vite.log 2>&1 &
    sleep 5
    
    if ! curl -s http://localhost:${VITE_PORT} > /dev/null 2>&1; then
        echo "❌ Не удалось запустить Vite. Проверьте логи: tail -f /tmp/vite.log"
        exit 1
    fi
    echo "✅ Vite запущен"
fi

echo "✅ Vite работает на порту ${VITE_PORT}"
echo ""

# Поиск конфигурации сайта
NGINX_CONFIG=""
CONFIG_FOUND=false

# Вариант 1: Конфигурация в панели управления
if [ -d "/www/server/panel" ]; then
    echo "📋 Ищу конфигурацию в панели управления..."
    
    # Ищем конфигурацию через шаблоны панели
    PANEL_VHOST_DIR="/www/server/panel/vhost"
    
    # Проверяем, есть ли файлы конфигурации сайтов
    if [ -f "/www/server/panel/vhost/nginx/${DOMAIN}.conf" ]; then
        NGINX_CONFIG="/www/server/panel/vhost/nginx/${DOMAIN}.conf"
        CONFIG_FOUND=true
        echo "✅ Найдена конфигурация: ${NGINX_CONFIG}"
    else
        # Пробуем найти через базу данных панели
        echo "📋 Поиск через базу данных панели..."
        
        # Создаем резервную копию базы
        if [ -f "/www/server/panel/data/default.db" ]; then
            cp /www/server/panel/data/default.db /tmp/panel_db_backup.db
            echo "✅ Резервная копия базы данных создана"
        fi
        
        # Ищем сайт в базе данных
        if command -v sqlite3 &> /dev/null; then
            SITE_ID=$(sqlite3 /www/server/panel/data/default.db "SELECT id FROM sites WHERE name='${DOMAIN}' OR domains LIKE '%${DOMAIN}%' LIMIT 1;" 2>/dev/null || echo "")
            
            if [ -n "$SITE_ID" ]; then
                echo "✅ Найден сайт в базе данных, ID: ${SITE_ID}"
                # Обновляем конфигурацию через API панели или напрямую через базу
            fi
        fi
        
        # Если не нашли, создаем конфигурацию напрямую
        NGINX_CONFIG="/www/server/panel/vhost/nginx/${DOMAIN}.conf"
        echo "📝 Создаю новую конфигурацию: ${NGINX_CONFIG}"
    fi
fi

# Вариант 2: Стандартная конфигурация Nginx
if [ "$CONFIG_FOUND" = false ]; then
    if [ -f "/etc/nginx/sites-available/${DOMAIN}" ]; then
        NGINX_CONFIG="/etc/nginx/sites-available/${DOMAIN}"
        CONFIG_FOUND=true
        echo "✅ Найдена стандартная конфигурация: ${NGINX_CONFIG}"
    fi
fi

# Если конфигурация не найдена, создаем новую
if [ "$CONFIG_FOUND" = false ]; then
    echo "📝 Создаю новую конфигурацию Nginx..."
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    NGINX_CONFIG="/etc/nginx/sites-available/${DOMAIN}"
fi

# Создаем резервную копию существующей конфигурации
if [ -f "$NGINX_CONFIG" ]; then
    cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Резервная копия создана: ${NGINX_CONFIG}.backup.*"
fi

# Создаем/обновляем конфигурацию
echo ""
echo "📝 Создаю/обновляю конфигурацию Nginx..."

cat > "$NGINX_CONFIG" << EOF
server {
    listen 80;
    listen [::]:80;
    listen 8443;
    listen [::]:8443;
    server_name ${DOMAIN};

    # Логи
    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log /var/log/nginx/${DOMAIN}-error.log;

    # Прокси для API
    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
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
        proxy_pass http://127.0.0.1:${LIVEKIT_PORT};
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

    # Прокси для LiveKit HTTP
    location ~ ^/(live|twirp) {
        proxy_pass http://127.0.0.1:${LIVEKIT_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Прокси для Frontend (Vite dev server с поддержкой SPA роутинга)
    # ВАЖНО: Этот блок должен быть последним (после /api/ и /rtc)
    # Vite автоматически поддерживает SPA роутинг, поэтому try_files не нужен
    location / {
        proxy_pass http://127.0.0.1:${VITE_PORT};
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

echo "✅ Конфигурация создана: ${NGINX_CONFIG}"
echo ""

# Создаем симлинк если используем стандартную конфигурацию
if [[ "$NGINX_CONFIG" == /etc/nginx/sites-available/* ]]; then
    ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/${DOMAIN}"
    echo "✅ Симлинк создан: /etc/nginx/sites-enabled/${DOMAIN}"
fi

# Если конфигурация в панели, пробуем перезагрузить через панель
if [[ "$NGINX_CONFIG" == /www/server/panel/vhost/* ]]; then
    echo "📋 Конфигурация находится в панели управления"
    echo "   Может потребоваться перезагрузка через веб-интерфейс панели"
fi

# Проверяем конфигурацию Nginx
echo ""
echo "🔍 Проверка конфигурации Nginx..."
if /www/server/panel/webserver/sbin/webserver -t 2>/dev/null || nginx -t 2>/dev/null; then
    echo "✅ Конфигурация корректна"
    
    # Перезагружаем Nginx
    echo ""
    echo "🔄 Перезагружаю Nginx..."
    
    # Пробуем разные способы перезагрузки
    if systemctl reload nginx 2>/dev/null; then
        echo "✅ Nginx перезагружен через systemctl"
    elif systemctl reload webserver 2>/dev/null; then
        echo "✅ Webserver перезагружен через systemctl"
    elif /www/server/panel/webserver/sbin/webserver -s reload 2>/dev/null; then
        echo "✅ Webserver перезагружен через панель"
    elif service nginx reload 2>/dev/null; then
        echo "✅ Nginx перезагружен через service"
    else
        echo "⚠️  Не удалось перезагрузить автоматически"
        echo "   Выполните вручную: systemctl reload nginx"
        echo "   Или через панель управления: перезагрузите Nginx"
    fi
else
    echo "❌ Ошибка в конфигурации Nginx!"
    echo "   Проверьте файл: ${NGINX_CONFIG}"
    exit 1
fi

echo ""
echo "✅ ГОТОВО! Nginx настроен для проксирования на Vite"
echo ""
echo "🔗 Теперь доступны ссылки:"
echo "   - https://${DOMAIN}:8443/          (главная страница)"
echo "   - https://${DOMAIN}:8443/videos    (публичная страница видео)"
echo "   - https://${DOMAIN}:8443/database  (база данных)"
echo ""
echo "🧪 Проверка работы /videos:"
sleep 2
if curl -s "http://localhost:${VITE_PORT}/videos" | grep -q "html\|root"; then
    echo "✅ /videos работает через Vite!"
else
    echo "⚠️  /videos может потребовать перезагрузки страницы"
fi
echo ""
echo "📋 Если что-то не работает:"
echo "   1. Проверьте, что Vite работает: curl http://localhost:5173"
echo "   2. Проверьте логи Nginx: tail -f /var/log/nginx/${DOMAIN}-error.log"
echo "   3. Проверьте логи Vite: tail -f /tmp/vite.log"

