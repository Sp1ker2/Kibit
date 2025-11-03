#!/bin/bash

# Скрипт для запуска LiveKit сервера и React приложения

echo "🚀 Запускаем LiveKit Stream App..."
echo ""

# Проверяем что livekit-server установлен
if ! command -v livekit-server &> /dev/null
then
    echo "❌ livekit-server не найден!"
    echo "Установите его: brew install livekit"
    exit 1
fi

# Проверяем что node_modules установлены
if [ ! -d "streamApp/node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    cd streamApp && npm install && cd ..
fi

echo "✅ Все зависимости установлены"
echo ""

# Получаем локальный IP адрес
if command -v ipconfig &> /dev/null; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
else
    # Linux
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip addr show | grep "inet " | grep -v 127.0.0.1 | head -n1 | awk '{print $2}' | cut -d/ -f1)
fi

echo "🔧 Запускаем LiveKit сервер на порту 7880..."
echo "🔌 Запускаем API сервер на порту 3001..."
echo "🌐 Запускаем React приложение на порту 5173..."
echo ""
echo "📱 Доступ из локальной сети:"
echo "   👉 http://${LOCAL_IP}:5173"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запускаем все процессы параллельно
trap 'kill $(jobs -p)' EXIT

# Получаем абсолютный путь к директории проекта
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Запускаем LiveKit сервер в фоне (доступен из локальной сети)
# Используем --dev и --bind для доступа со всех интерфейсов
(cd "$PROJECT_DIR/livekit" && livekit-server --dev --bind 0.0.0.0) &

# Ждем 2 секунды чтобы сервер запустился
sleep 2

# Запускаем API сервер в фоне
(cd "$PROJECT_DIR/streamApp" && npm run api) &

# Ждем 1 секунду
sleep 1

# Запускаем React приложение (основной процесс)
cd "$PROJECT_DIR/streamApp" && npm run dev

