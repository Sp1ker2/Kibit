#!/bin/bash
# Скрипт для деплоя viewer.html на сервер

SERVER="195.133.17.131"
PORT="16205"
USER="root"
PASS="iFG02M6Z"
APP_DIR="/root/simple-stream-server"

echo "🚀 Деплой viewer.html на сервер..."

# Проверяем наличие файла
if [ ! -f "python-streaming/simple-stream-server/public/viewer.html" ]; then
    echo "❌ Файл viewer.html не найден!"
    exit 1
fi

# Копируем исправленный viewer.html с дополнительными опциями
echo "📤 Копирование viewer.html на сервер..."
sshpass -p "$PASS" scp \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=30 \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -P "$PORT" \
    python-streaming/simple-stream-server/public/viewer.html \
    "$USER@$SERVER:$APP_DIR/public/viewer.html" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ viewer.html успешно задеплоен!"
    echo ""
    echo "🔄 Перезапуск сервера для применения изменений..."
    
    # Перезапускаем сервер
    sshpass -p "$PASS" ssh \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=30 \
        -P "$PORT" \
        "$USER@$SERVER" << EOF
cd $APP_DIR
pkill -f "node server.js" || true
sleep 2
nohup node server.js > /tmp/simple-stream.log 2>&1 &
sleep 1
echo "✅ Сервер перезапущен!"
EOF
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Деплой завершен успешно!"
        echo "🌐 Проверь: https://kibitkostreamappv.pp.ua:8443"
    else
        echo "⚠️  Файл задеплоен, но не удалось перезапустить сервер автоматически."
        echo "   Перезапусти вручную через SSH."
    fi
else
    echo ""
    echo "❌ Ошибка деплоя через автоматический скрипт."
    echo ""
    echo "📋 Выполни вручную через SSH:"
    echo "   ssh -p $PORT $USER@$SERVER"
    echo "   # Затем скопируй viewer.html или замени его содержимое"
    echo ""
    echo "   Или используй команду:"
    echo "   scp -P $PORT python-streaming/simple-stream-server/public/viewer.html $USER@$SERVER:$APP_DIR/public/viewer.html"
fi
