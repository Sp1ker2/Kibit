#!/bin/bash
# Скрипт для выполнения НА СЕРВЕРЕ
# Скопируй этот файл на сервер и запусти там

cd /root/simple-stream-server || exit 1

echo "🔄 Обновление simple-stream-server..."

# Останавливаем старый процесс
echo "🛑 Остановка старого сервера..."
pkill -f "node server.js" || true
sleep 2

# Проверяем зависимости
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Запускаем новый сервер
echo "▶️  Запуск нового сервера..."
nohup node server.js > /tmp/simple-stream.log 2>&1 &
sleep 2

# Проверяем что сервер запустился
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Сервер успешно запущен!"
    echo "📋 PID: $(pgrep -f 'node server.js')"
    echo "🌐 URL: https://kibitkostreamappv.pp.ua:8443"
    echo "📋 Логи: tail -f /tmp/simple-stream.log"
else
    echo "❌ Сервер не запустился!"
    echo "📋 Проверь логи: tail -f /tmp/simple-stream.log"
fi

