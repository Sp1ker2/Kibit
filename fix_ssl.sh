#!/bin/bash

echo "🔐 НАСТРОЙКА SSL СЕРТИФИКАТОВ"
echo "================================"

# Подключение к серверу
ssh root@195.133.17.131 << 'ENDSSH'

echo "1️⃣ Проверка Let's Encrypt сертификатов..."
if [ -f "/etc/letsencrypt/live/kibitkostreamappv.pp.ua/fullchain.pem" ]; then
    echo "✅ Сертификаты найдены"
    certbot certificates 2>/dev/null | grep -A 3 "kibitkostreamappv" | head -5
else
    echo "❌ Сертификаты не найдены! Устанавливаю..."
    certbot certonly --standalone -d kibitkostreamappv.pp.ua --non-interactive --agree-tos --email admin@kibitkostreamappv.pp.ua
fi

echo ""
echo "2️⃣ Проверка Nginx конфигурации..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx конфигурация валидна"
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
else
    echo "❌ Ошибка в конфигурации Nginx!"
    nginx -t
    exit 1
fi

echo ""
echo "3️⃣ Перезапуск Node.js серверов..."
cd /root/simple-stream-server

# Останавливаем старые процессы
pkill -f "node server.js" 2>/dev/null
pkill -f "node websocket-server.js" 2>/dev/null
sleep 2

# Запускаем заново
nohup node server.js > server.log 2>&1 &
sleep 2
nohup node websocket-server.js > websocket.log 2>&1 &
sleep 2

# Проверяем что запустились
if ps aux | grep -q "[n]ode server.js"; then
    echo "✅ Node.js server запущен"
else
    echo "❌ Node.js server не запустился!"
    tail -20 server.log
fi

if ps aux | grep -q "[n]ode websocket-server.js"; then
    echo "✅ WebSocket server запущен"
else
    echo "❌ WebSocket server не запустился!"
    tail -20 websocket.log
fi

echo ""
echo "4️⃣ Проверка SSL соединений..."
echo "Проверяю порт 8443..."
timeout 3 openssl s_client -connect localhost:8443 -servername kibitkostreamappv.pp.ua < /dev/null 2>/dev/null | grep -q "Verify return code: 0" && echo "✅ SSL на порту 8443 работает" || echo "⚠️ Проблема с SSL на 8443"

echo "Проверяю порт 8444..."
timeout 3 openssl s_client -connect localhost:8444 -servername kibitkostreamappv.pp.ua < /dev/null 2>/dev/null | grep -q "Verify return code: 0" && echo "✅ SSL на порту 8444 работает" || echo "⚠️ Проблема с SSL на 8444"

echo ""
echo "✅ ГОТОВО! Все сервисы перезапущены с SSL сертификатами"
echo ""
echo "📋 Следующие шаги:"
echo "1. Обновите страницу в браузере (Ctrl+Shift+R)"
echo "2. Проверьте что появился зеленый замочек 🔒"
echo "3. Если все еще 'Не защищено', очистите кэш браузера"

ENDSSH

echo ""
echo "🎉 Настройка завершена!"

