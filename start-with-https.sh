#!/bin/bash
# Скрипт для запуска LiveKit сервера и React приложения на продакшене
# Запускается через daemon в панели управления

cd /www/wwwroot/LiveKit || exit 1

echo "🚀 Запускаем LiveKit Stream App..."
echo "📁 Директория: $(pwd)"
echo ""

# Проверяем что livekit-server установлен
if ! command -v livekit-server &> /dev/null
then
    echo "❌ livekit-server не найден!"
    exit 1
fi

# Проверяем что node_modules установлены
if [ ! -d "streamApp/node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    cd streamApp && npm install && cd ..
fi

echo "✅ Все зависимости установлены"
echo ""

# Убиваем старые процессы если есть
echo "🧹 Очистка старых процессов..."
pkill -f "livekit-server" 2>/dev/null
pkill -f "npm run api" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Очищаем логи перед запуском
echo "📝 Очистка логов..."
> /tmp/livekit.log
> /tmp/api.log
> /tmp/frontend.log

# Запускаем LiveKit сервер в фоне
echo "🔧 Запускаем LiveKit сервер на порту 7880..."
(cd livekit && livekit-server --dev --bind 0.0.0.0 >> /tmp/livekit.log 2>&1) &

# Ждем немного
sleep 3

# Запускаем API сервер в фоне
echo "🔌 Запускаем API сервер на порту 3001..."
(cd streamApp && npm run api >> /tmp/api.log 2>&1) &

# Ждем немного
sleep 2

# Запускаем React приложение в фоне
echo "🌐 Запускаем React приложение на порту 5173..."
(cd streamApp && npm run dev >> /tmp/frontend.log 2>&1) &

# Ждем чтобы процессы запустились
sleep 5

echo ""
echo "✅ Все сервисы запущены!"
echo "   - LiveKit: порт 7880"
echo "   - API: порт 3001"
echo "   - Frontend: порт 5173"
echo ""
echo "📊 Проверка портов:"
netstat -tulpn 2>/dev/null | grep -E '5173|3001|7880' || ss -tulpn 2>/dev/null | grep -E '5173|3001|7880' || echo "⚠️  Порты не найдены"
echo ""
echo "📋 Логи доступны в:"
echo "   - LiveKit: /tmp/livekit.log"
echo "   - API: /tmp/api.log"
echo "   - Frontend: /tmp/frontend.log"
echo ""

# Держим скрипт запущенным
wait
