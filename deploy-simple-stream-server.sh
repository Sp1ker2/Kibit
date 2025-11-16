#!/bin/bash
# Скрипт для деплоя simple-stream-server на сервер

SERVER="195.133.17.131"
PORT="16205"
USER="root"
PASS="iFG02M6Z"
APP_DIR="/root/simple-stream-server"

echo "🚀 Деплой simple-stream-server на сервер..."
echo "📦 Копирование файлов..."

# Создаем директорию если не существует
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -P "$PORT" "$USER@$SERVER" "mkdir -p $APP_DIR/public" 2>&1

# Копируем server.js
echo "📤 Копирование server.js..."
sshpass -p "$PASS" scp \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=30 \
    -P "$PORT" \
    python-streaming/simple-stream-server/server.js \
    "$USER@$SERVER:$APP_DIR/server.js" 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Ошибка копирования server.js"
    exit 1
fi

# Копируем viewer.html
echo "📤 Копирование viewer.html..."
sshpass -p "$PASS" scp \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=30 \
    -P "$PORT" \
    python-streaming/simple-stream-server/public/viewer.html \
    "$USER@$SERVER:$APP_DIR/public/viewer.html" 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Ошибка копирования viewer.html"
    exit 1
fi

echo "✅ Файлы успешно скопированы!"
echo ""
echo "🔄 Перезапуск сервера..."

# Перезапускаем сервер
sshpass -p "$PASS" ssh \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=30 \
    -P "$PORT" \
    "$USER@$SERVER" << EOF
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
sleep 1

# Проверяем что сервер запустился
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Сервер успешно запущен!"
    echo "📋 PID: \$(pgrep -f 'node server.js')"
else
    echo "⚠️  Сервер не запустился. Проверь логи:"
    echo "   tail -f /tmp/simple-stream.log"
fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Деплой завершен успешно!"
    echo "🌐 Проверь: https://kibitkostreamappv.pp.ua:8443"
    echo "📋 Для просмотра логов: ssh -p $PORT $USER@$SERVER 'tail -f /tmp/simple-stream.log'"
else
    echo ""
    echo "⚠️  Деплой завершен, но перезапуск сервера не удался."
    echo "   Перезапусти вручную:"
    echo "   ssh -p $PORT $USER@$SERVER"
    echo "   cd $APP_DIR"
    echo "   pkill -f 'node server.js'"
    echo "   nohup node server.js > /tmp/simple-stream.log 2>&1 &"
fi

