#!/bin/bash
# Скрипт для розгортання на сервері

SERVER="root@195.133.17.131"
APP_DIR="/root/simple-stream-server"

echo "🚀 Розгортання Simple Stream Server..."

# Копіюємо файли на сервер
echo "📦 Копіюємо файли..."
ssh $SERVER "mkdir -p $APP_DIR"
scp -r . $SERVER:$APP_DIR/

# Встановлюємо залежності та запускаємо
echo "⚙️  Налаштування на сервері..."
ssh $SERVER << 'EOF'
cd /root/simple-stream-server

# Встановлюємо Node.js якщо немає
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Встановлюємо залежності
npm install

# Зупиняємо старий процес якщо є
pkill -f "node server.js" || true

# Запускаємо сервер
nohup node server.js > /tmp/simple-stream.log 2>&1 &

echo "✅ Сервер запущено! Логи: /tmp/simple-stream.log"
EOF

echo "✅ Розгортання завершено!"
echo "🌐 Перейдіть на: https://kibitkostreamappv.pp.ua:8443"

