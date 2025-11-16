#!/bin/bash

# Автоматичний скрипт для налаштування Google Drive на сервері 195.133.39.41
# Виконайте цей скрипт локально - він підключиться до сервера і налаштує все

set -e

SERVER_IP="195.133.39.41"
SERVER_PORT="31966"
SERVER_USER="root"
SERVER_PASS="EReAGUNX"
PROJECT_DIR="/www/wwwroot/LiveKit"
STREAMAPP_DIR="$PROJECT_DIR/streamApp"

echo "🔐 Налаштування Google Drive на сервері $SERVER_IP:$SERVER_PORT..."

# Перевіряємо sshpass
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass не встановлено"
    echo "Встановіть: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

# Функція для виконання команд на сервері
run_remote() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" "$@"
}

# Функція для копіювання файлів на сервер
copy_to_server() {
    sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P "$SERVER_PORT" "$@"
}

echo "📡 Підключення до сервера..."

# Створюємо .env файл на сервері
echo "📝 Створюємо .env файл (з плейсхолдерами - замініть своїми значеннями)..."
run_remote "mkdir -p $STREAMAPP_DIR" || true

run_remote \"cat > $STREAMAPP_DIR/.env << 'ENVEOF'\nGOOGLE_DRIVE_ENABLED=true\nGOOGLE_DRIVE_CLIENT_ID=CHANGEME_CLIENT_ID\nGOOGLE_DRIVE_CLIENT_SECRET=CHANGEME_CLIENT_SECRET\nGOOGLE_DRIVE_REFRESH_TOKEN=CHANGEME_REFRESH_TOKEN\nGOOGLE_DRIVE_ROOT_FOLDER_ID=CHANGEME_ROOT_FOLDER_ID\nENVEOF\n\"

run_remote "chmod 600 $STREAMAPP_DIR/.env"
echo "✅ .env файл створено"

# Встановлюємо dotenv
echo "📦 Встановлюємо dotenv..."
run_remote "cd $STREAMAPP_DIR && npm install dotenv --save"
echo "✅ dotenv встановлено"

# Перезапускаємо PM2 процеси
echo "🔄 Перезапускаємо PM2 процеси..."
run_remote "pm2 restart all --update-env 2>/dev/null || echo 'PM2 не використовується'"
echo "✅ Процеси перезапущено"

# Перевірка статусу
echo ""
echo "🔍 Перевірка статусу..."
run_remote "cat $STREAMAPP_DIR/.env | grep GOOGLE_DRIVE_ENABLED"
run_remote "cd $STREAMAPP_DIR && npm list dotenv 2>/dev/null | head -1 || echo 'dotenv перевірка...'"

echo ""
echo "✅ Налаштування завершено!"
echo ""
echo "📋 Наступні кроки:"
echo "1. Перевірте логи сервера: pm2 logs --lines 50 | grep -i google"
echo "2. Перевірте, що з'являється: ✅ Google Drive API инициализирован через OAuth 2.0"
echo "3. Зробіть тестове завантаження відео"
