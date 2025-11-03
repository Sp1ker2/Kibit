#!/bin/bash
# Скрипт для исправления daemon - остановка Cloudflare и запуск LiveKit

echo "🔧 Исправление daemon..."
echo ""

# Останавливаем Cloudflare Tunnel
echo "🛑 Останавливаем Cloudflare Tunnel..."
pkill -9 cloudflared 2>/dev/null
pkill -9 cloudflare 2>/dev/null
sleep 2
echo "✅ Cloudflare остановлен"

# Проверяем что LiveKit не запущен (если был)
echo "🧹 Очистка старых процессов..."
pkill -9 livekit-server 2>/dev/null
pkill -9 vite 2>/dev/null
pkill -9 "npm run api" 2>/dev/null
sleep 2

# Проверяем что start-with-https.sh существует
if [ ! -f "/www/wwwroot/LiveKit/start-with-https.sh" ]; then
    echo "❌ Файл start-with-https.sh не найден!"
    echo "   Путь: /www/wwwroot/LiveKit/start-with-https.sh"
    exit 1
fi

# Проверяем права
chmod +x /www/wwwroot/LiveKit/start-with-https.sh

echo ""
echo "✅ Готово!"
echo ""
echo "📋 СЛЕДУЮЩИЕ ШАГИ:"
echo ""
echo "1. Откройте daemon 'test' в панели aaPanel"
echo "2. Проверьте 'Start command':"
echo "   Должно быть: bash /www/wwwroot/LiveKit/start-with-https.sh"
echo "3. Проверьте 'Process directory':"
echo "   Должно быть: /www/wwwroot/LiveKit"
echo "4. Сохраните и перезапустите daemon"
echo ""
echo "5. Проверьте порты:"
echo "   netstat -tulpn | grep -E '5173|3001|7880'"
echo ""

