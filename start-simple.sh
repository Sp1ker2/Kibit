#!/bin/bash
# Простой скрипт для запуска без Cloudflare Tunnel (используется nginx)
cd /www/wwwroot/LiveKit || exit 1

# Останавливаем старые процессы
pkill -f "livekit-server" 2>/dev/null
pkill -f "npm run api" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "node server/api.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

sleep 2

# Запускаем LiveKit сервер
cd livekit
nohup livekit-server --dev --bind 0.0.0.0 > /tmp/livekit.log 2>&1 &

# Ждем
sleep 3

# Запускаем API сервер
cd ../streamApp
nohup npm run api > /tmp/api.log 2>&1 &

# Ждем
sleep 2

# Очищаем старый лог перед запуском
> /tmp/frontend.log

# Запускаем Frontend
nohup npm run dev -- --host 0.0.0.0 --port 5173 >> /tmp/frontend.log 2>&1 &

# Ждем запуска
sleep 5

# Проверяем порты
netstat -tuln | grep -E '3001|5173|7880' || ss -tuln | grep -E '3001|5173|7880'

echo ""
echo "✅ Все сервисы запущены!"
echo "📋 Для просмотра логов используйте:"
echo "   tail -f /tmp/frontend.log"

