#!/bin/bash
# Скрипт для обновления таймаутов Nginx на сервере балансировщика
# Выполнить на сервере с Nginx (обычно это server1: 195.133.17.131)

DOMAIN="kibitkostreamappv.pp.ua"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "🔧 Обновление таймаутов Nginx для загрузки видео в Google Drive..."
echo ""

# Проверяем, существует ли файл конфигурации
if [ ! -f "$NGINX_CONF" ]; then
    echo "⚠️  Файл $NGINX_CONF не найден"
    echo "📋 Поиск альтернативных конфигураций..."
    find /etc/nginx -name "*${DOMAIN}*" -o -name "*streamapp*" 2>/dev/null | head -5
    exit 1
fi

echo "✅ Найден файл: $NGINX_CONF"
echo ""

# Создаем резервную копию
BACKUP_FILE="${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONF" "$BACKUP_FILE"
echo "📦 Создана резервная копия: $BACKUP_FILE"
echo ""

# Обновляем таймауты для /api/
echo "🔧 Обновление таймаутов для /api/..."

# Проверяем, есть ли уже proxy_send_timeout
if grep -q "location /api" "$NGINX_CONF"; then
    # Обновляем proxy_read_timeout до 600s если он меньше
    sed -i 's/proxy_read_timeout [0-9]*s;/proxy_read_timeout 600s;/g' "$NGINX_CONF"
    
    # Добавляем proxy_send_timeout если его нет
    if ! grep -q "proxy_send_timeout" "$NGINX_CONF" || ! grep -A 10 "location /api" "$NGINX_CONF" | grep -q "proxy_send_timeout"; then
        sed -i '/location \/api/,/}/ { /proxy_read_timeout/a\        proxy_send_timeout 600s;' "$NGINX_CONF" | head -1
        # Альтернативный способ - добавляем после proxy_read_timeout
        sed -i '/proxy_read_timeout 600s;/a\        proxy_send_timeout 600s;' "$NGINX_CONF"
    else
        sed -i 's/proxy_send_timeout [0-9]*s;/proxy_send_timeout 600s;/g' "$NGINX_CONF"
    fi
    
    # Добавляем client_max_body_size если его нет в server блоке
    if ! grep -q "client_max_body_size" "$NGINX_CONF"; then
        sed -i '/server_name/a\    client_max_body_size 500M;' "$NGINX_CONF"
    fi
    
    echo "✅ Таймауты обновлены"
else
    echo "⚠️  Блок location /api не найден в конфигурации"
fi

echo ""
echo "📋 Проверка конфигурации Nginx..."
if nginx -t; then
    echo ""
    echo "✅ Конфигурация валидна"
    echo ""
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
    echo ""
    echo "📋 Проверьте таймауты:"
    grep -A 15 "location /api" "$NGINX_CONF" | grep -E "proxy_read_timeout|proxy_send_timeout|client_max_body_size"
else
    echo ""
    echo "❌ Ошибка в конфигурации Nginx!"
    echo "📋 Восстановление из резервной копии..."
    cp "$BACKUP_FILE" "$NGINX_CONF"
    echo "✅ Конфигурация восстановлена"
    exit 1
fi

