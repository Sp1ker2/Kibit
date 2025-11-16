#!/bin/bash
# Скрипт для деплоя на сервер 195.133.39.41:34321

SERVER="195.133.39.41"
PORT="34321"
USER="root"
APP_DIR="/root/simple-stream-server"

echo "🚀 Деплой simple-stream-server на сервер $SERVER:$PORT..."
echo ""

# Проверяем наличие файлов
if [ ! -f "python-streaming/simple-stream-server/server.js" ]; then
    echo "❌ Файл server.js не найден!"
    exit 1
fi

if [ ! -f "python-streaming/simple-stream-server/public/viewer.html" ]; then
    echo "❌ Файл viewer.html не найден!"
    exit 1
fi

echo "📤 Копирование server.js..."
scp -P $PORT -o StrictHostKeyChecking=accept-new \
    python-streaming/simple-stream-server/server.js \
    $USER@$SERVER:$APP_DIR/server.js

if [ $? -eq 0 ]; then
    echo "✅ server.js скопирован!"
else
    echo "❌ Ошибка копирования server.js"
    exit 1
fi

echo ""
echo "📤 Копирование viewer.html..."
scp -P $PORT -o StrictHostKeyChecking=accept-new \
    python-streaming/simple-stream-server/public/viewer.html \
    $USER@$SERVER:$APP_DIR/public/viewer.html

if [ $? -eq 0 ]; then
    echo "✅ viewer.html скопирован!"
else
    echo "❌ Ошибка копирования viewer.html"
    exit 1
fi

echo ""
echo "🔄 Перезапуск сервера..."

ssh -p $PORT -o StrictHostKeyChecking=accept-new $USER@$SERVER << EOF
cd $APP_DIR

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Останавливаем старый процесс
echo "🛑 Остановка старого сервера..."
pkill -f "node server.js" || true
sleep 2

# Запускаем новый сервер
echo "▶️  Запуск нового сервера..."
nohup node server.js > /tmp/simple-stream.log 2>&1 &
sleep 2

# Проверяем что сервер запустился
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Сервер успешно запущен!"
    echo "📋 PID: \$(pgrep -f 'node server.js')"
    echo "🌐 URL: https://kibitkostreamappv.pp.ua:8443"
    echo "📋 Логи: tail -f /tmp/simple-stream.log"
else
    echo "⚠️  Сервер не запустился. Проверь логи:"
    echo "   tail -f /tmp/simple-stream.log"
fi
EOF

echo ""
echo "✅ Деплой завершен!"

