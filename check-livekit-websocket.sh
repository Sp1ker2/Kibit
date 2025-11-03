#!/bin/bash
# Проверка LiveKit и WebSocket подключения

echo "🔍 Проверка LiveKit и WebSocket..."
echo ""

# Проверка процесса LiveKit
echo "1. Проверка процесса LiveKit:"
LIVEKIT_PID=$(pgrep -f "livekit-server")
if [ -n "$LIVEKIT_PID" ]; then
    echo "✅ LiveKit запущен (PID: $LIVEKIT_PID)"
    ps aux | grep livekit-server | grep -v grep
else
    echo "❌ LiveKit НЕ запущен!"
fi
echo ""

# Проверка порта 7880
echo "2. Проверка порта 7880:"
if netstat -tulpn 2>/dev/null | grep -q 7880 || ss -tulpn 2>/dev/null | grep -q 7880; then
    echo "✅ Порт 7880 слушается"
    netstat -tulpn 2>/dev/null | grep 7880 || ss -tulpn 2>/dev/null | grep 7880
else
    echo "❌ Порт 7880 НЕ слушается"
fi
echo ""

# Проверка подключения к LiveKit напрямую
echo "3. Проверка подключения к LiveKit напрямую:"
if curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:7880 2>/dev/null | grep -q "200\|404\|405"; then
    echo "✅ LiveKit отвечает на HTTP запросы"
else
    echo "❌ LiveKit НЕ отвечает на HTTP запросы"
    echo "   Попробуем подключиться:"
    curl -I http://localhost:7880 2>&1 | head -3
fi
echo ""

# Проверка WebSocket через Nginx
echo "4. Проверка WebSocket через Nginx:"
DOMAIN="kibitkostreamappv.pp.ua"
PROTOCOL="https"

# Проверяем SSL
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    PROTOCOL="https"
    echo "   Используем HTTPS"
else
    PROTOCOL="http"
    echo "   Используем HTTP"
fi

echo "   Тестируем: ${PROTOCOL}://${DOMAIN}/rtc"
WS_RESPONSE=$(curl -i -N -s -m 5 \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Host: ${DOMAIN}" \
    "${PROTOCOL}://${DOMAIN}/rtc" 2>&1 | head -10)

if echo "$WS_RESPONSE" | grep -q "101\|Upgrade"; then
    echo "✅ WebSocket отвечает правильно (101 Switching Protocols)"
elif echo "$WS_RESPONSE" | grep -q "404"; then
    echo "❌ WebSocket возвращает 404 - Nginx не находит /rtc"
    echo "   Проверьте конфигурацию Nginx"
elif echo "$WS_RESPONSE" | grep -q "502\|503"; then
    echo "❌ WebSocket возвращает 502/503 - LiveKit не отвечает"
    echo "   Проверьте что LiveKit запущен"
else
    echo "⚠️  Неожиданный ответ:"
    echo "$WS_RESPONSE" | head -5
fi
echo ""

# Проверка конфигурации Nginx
echo "5. Проверка конфигурации Nginx для /rtc:"
if grep -A 10 "location /rtc" /etc/nginx/sites-available/kibitkostreamappv.pp.ua 2>/dev/null | grep -q "proxy_pass.*7880"; then
    echo "✅ Location /rtc найден в конфигурации"
    echo ""
    echo "   Текущая конфигурация:"
    grep -A 15 "location /rtc" /etc/nginx/sites-available/kibitkostreamappv.pp.ua 2>/dev/null | head -15
else
    echo "❌ Location /rtc НЕ найден в конфигурации!"
fi
echo ""

# Логи LiveKit - ищем где они могут быть
echo "6. Поиск логов LiveKit:"
if [ -f "/tmp/livekit.log" ]; then
    echo "✅ Логи найдены: /tmp/livekit.log"
    echo "   Последние строки:"
    tail -5 /tmp/livekit.log
elif [ -f "/var/log/livekit.log" ]; then
    echo "✅ Логи найдены: /var/log/livekit.log"
    tail -5 /var/log/livekit.log
else
    echo "⚠️  Логи LiveKit не найдены"
    echo "   Проверьте где LiveKit логирует (может быть в stdout/stderr)"
    echo "   Попробуйте: journalctl -u livekit 2>/dev/null || journalctl | grep livekit | tail -5"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 РЕКОМЕНДАЦИИ:"
echo ""
echo "Если WebSocket не работает:"
echo "1. Выполните: sudo bash /www/wwwroot/LiveKit/fix-websocket-connection.sh"
echo "2. Перезагрузите Nginx: sudo systemctl reload nginx"
echo "3. Проверьте что LiveKit запущен: netstat -tulpn | grep 7880"
echo ""
echo "Если LiveKit не запущен:"
echo "  Перезапустите daemon в панели"
echo "  Или: cd /www/wwwroot/LiveKit && bash start-with-https.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

