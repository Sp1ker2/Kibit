#!/bin/bash
# Диагностика конфигурации Nginx для WebSocket

DOMAIN="kibitkostreamappv.pp.ua"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "🔍 Диагностика конфигурации Nginx..."
echo ""

# Проверка всех активных конфигов
echo "1. Все активные конфигурации Nginx:"
ls -la /etc/nginx/sites-enabled/
echo ""

# Проверка полной конфигурации
echo "2. Полная конфигурация для домена:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat ${NGINX_CONF}
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверка блоков server
echo "3. Блоки server в конфигурации:"
grep -n "server {" ${NGINX_CONF} | head -5
echo ""

# Проверка listen директив
echo "4. Директивы listen:"
grep -n "listen" ${NGINX_CONF}
echo ""

# Проверка location /rtc в каком блоке
echo "5. Проверка в каком блоке находится location /rtc:"
echo ""
LINES=$(grep -n "location /rtc" ${NGINX_CONF} | cut -d: -f1)
if [ -n "$LINES" ]; then
    for LINE in $LINES; do
        echo "   Найден location /rtc на строке: $LINE"
        echo ""
        echo "   Проверка контекста (50 строк до и после):"
        START=$((LINE - 50))
        if [ $START -lt 1 ]; then
            START=1
        fi
        END=$((LINE + 50))
        sed -n "${START},${END}p" ${NGINX_CONF} | head -100
        echo ""
        echo "   Ищем listen выше этого location:"
        sed -n "1,${LINE}p" ${NGINX_CONF} | grep -n "listen" | tail -3
        echo ""
    done
else
    echo "❌ location /rtc НЕ найден!"
fi

# Проверка тестового запроса
echo "6. Тестовый запрос к /rtc:"
curl -I -k https://localhost/rtc -H "Host: ${DOMAIN}" 2>&1 | head -10
echo ""

# Проверка логов Nginx
echo "7. Последние ошибки Nginx связанные с /rtc:"
grep -i "/rtc" /var/log/nginx/error.log 2>/dev/null | tail -5 || echo "Логи не найдены"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 ВАЖНО:"
echo ""
echo "location /rtc ДОЛЖЕН находиться ВНУТРИ server блока с:"
echo "  listen 443 ssl;"
echo ""
echo "Если location /rtc находится в server блоке с listen 80;"
echo "то он не будет работать для HTTPS запросов!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

