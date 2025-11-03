#!/bin/bash
# Скрипт для проверки состояния LiveKit и подключения
# Выполните на сервере: bash check-livekit.sh

echo "🔍 Проверка состояния LiveKit..."
echo ""

# Проверка портов
echo "📊 Проверка портов:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Порт 5173 (Frontend):"
if netstat -tulpn 2>/dev/null | grep -q 5173 || ss -tulpn 2>/dev/null | grep -q 5173; then
    echo "✅ Слушается"
    netstat -tulpn 2>/dev/null | grep 5173 || ss -tulpn 2>/dev/null | grep 5173
else
    echo "❌ НЕ слушается"
fi
echo ""

echo "Порт 3001 (API):"
if netstat -tulpn 2>/dev/null | grep -q 3001 || ss -tulpn 2>/dev/null | grep -q 3001; then
    echo "✅ Слушается"
    netstat -tulpn 2>/dev/null | grep 3001 || ss -tulpn 2>/dev/null | grep 3001
else
    echo "❌ НЕ слушается"
fi
echo ""

echo "Порт 7880 (LiveKit):"
if netstat -tulpn 2>/dev/null | grep -q 7880 || ss -tulpn 2>/dev/null | grep -q 7880; then
    echo "✅ Слушается"
    netstat -tulpn 2>/dev/null | grep 7880 || ss -tulpn 2>/dev/null | grep 7880
else
    echo "❌ НЕ слушается - LiveKit НЕ запущен!"
fi
echo ""

# Проверка процессов
echo "📋 Проверка процессов:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "LiveKit сервер:"
if pgrep -f "livekit-server" > /dev/null; then
    echo "✅ Запущен (PID: $(pgrep -f 'livekit-server'))"
else
    echo "❌ НЕ запущен"
fi
echo ""

echo "Vite (Frontend):"
if pgrep -f "vite" > /dev/null; then
    echo "✅ Запущен (PID: $(pgrep -f 'vite'))"
else
    echo "❌ НЕ запущен"
fi
echo ""

echo "API сервер:"
if pgrep -f "node.*api.js\|npm.*api" > /dev/null; then
    echo "✅ Запущен (PID: $(pgrep -f 'node.*api.js\|npm.*api'))"
else
    echo "❌ НЕ запущен"
fi
echo ""

# Проверка Nginx
echo "🌐 Проверка Nginx:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if systemctl is-active --quiet nginx || service nginx status > /dev/null 2>&1; then
    echo "✅ Nginx запущен"
    
    # Проверка конфигурации
    if nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Конфигурация корректна"
    else
        echo "❌ Ошибка в конфигурации:"
        nginx -t
    fi
    
    # Проверка location /rtc
    if grep -q "location /rtc" /etc/nginx/sites-available/kibitkostreamappv.pp.ua 2>/dev/null; then
        echo "✅ Location /rtc найден в конфигурации"
    else
        echo "❌ Location /rtc НЕ найден в конфигурации!"
    fi
else
    echo "❌ Nginx НЕ запущен"
fi
echo ""

# Проверка логов
echo "📋 Последние логи:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "/tmp/livekit.log" ]; then
    echo "LiveKit (последние 10 строк):"
    tail -n 10 /tmp/livekit.log
    echo ""
fi

if [ -f "/tmp/api.log" ]; then
    echo "API (последние 5 строк):"
    tail -n 5 /tmp/api.log
    echo ""
fi

if [ -f "/tmp/frontend.log" ]; then
    echo "Frontend (последние 5 строк):"
    tail -n 5 /tmp/frontend.log
    echo ""
fi

# Проверка подключения к LiveKit
echo "🔌 Проверка подключения к LiveKit:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v curl > /dev/null; then
    echo "Проверка HTTP подключения к порту 7880:"
    if curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:7880 > /dev/null 2>&1; then
        echo "✅ LiveKit отвечает на HTTP запросы"
    else
        echo "⚠️  LiveKit не отвечает на HTTP запросы (это нормально для WebSocket сервера)"
    fi
else
    echo "⚠️  curl не установлен, пропускаем проверку подключения"
fi
echo ""

echo "✅ Проверка завершена!"
echo ""
echo "💡 Если LiveKit не запущен:"
echo "   cd /www/wwwroot/LiveKit && ./start-with-https.sh"
echo "   Или перезапустите daemon в панели"
echo ""
echo "💡 Если Nginx не настроен:"
echo "   sudo bash /www/wwwroot/LiveKit/fix-livekit-connection.sh"

