#!/bin/bash

echo "🧹 Очистка и исправление проблем..."
echo ""

# Останавливаем все процессы
echo "⏸️  Останавливаем процессы..."
pkill -9 -f "vite" 2>/dev/null
pkill -9 -f "node.*api.js" 2>/dev/null
pkill -9 -f "livekit-server" 2>/dev/null
sleep 2

# Освобождаем порты если заняты
echo "🔓 Освобождаем порты..."
fuser -k 5173/tcp 2>/dev/null
fuser -k 3001/tcp 2>/dev/null
fuser -k 7880/tcp 2>/dev/null
fuser -k 7881/tcp 2>/dev/null
fuser -k 7882/udp 2>/dev/null

# Исправляем права доступа на node_modules
if [ -d "streamApp/node_modules" ]; then
    echo "🔧 Исправляем права доступа..."
    chmod -R 755 streamApp/node_modules 2>/dev/null
    chmod +x streamApp/node_modules/.bin/* 2>/dev/null
fi

# Исправляем права на скрипты
chmod +x setup.sh 2>/dev/null
chmod +x start.sh 2>/dev/null
chmod +x show-ip.sh 2>/dev/null
chmod +x cleanup.sh 2>/dev/null

echo ""
echo "✅ Очистка завершена!"
echo ""
echo "Теперь запустите: ./start.sh"

