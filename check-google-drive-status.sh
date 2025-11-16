#!/bin/bash

# Скрипт для перевірки статусу Google Drive налаштувань на сервері

echo "🔍 Перевірка статусу Google Drive..."

PROJECT_DIR="${PROJECT_DIR:-/www/wwwroot/LiveKit}"
STREAMAPP_DIR="${PROJECT_DIR}/streamApp"
ENV_FILE="${STREAMAPP_DIR}/.env"

echo ""
echo "📁 Шляхи:"
echo "   PROJECT_DIR: ${PROJECT_DIR}"
echo "   STREAMAPP_DIR: ${STREAMAPP_DIR}"
echo "   ENV_FILE: ${ENV_FILE}"
echo ""

# Перевіряємо .env файл
if [ -f "$ENV_FILE" ]; then
    echo "✅ .env файл існує"
    echo ""
    echo "📋 Вміст .env файлу (приховано секрети):"
    sed 's/GOOGLE_DRIVE_CLIENT_SECRET=.*/GOOGLE_DRIVE_CLIENT_SECRET=***/' "$ENV_FILE" | \
    sed 's/GOOGLE_DRIVE_REFRESH_TOKEN=.*/GOOGLE_DRIVE_REFRESH_TOKEN=***/' | \
    grep "GOOGLE_DRIVE"
else
    echo "❌ .env файл НЕ знайдено: ${ENV_FILE}"
    echo "   Створіть його використовуючи setup-google-drive-oauth2.sh"
fi

echo ""
echo "🔧 Змінні оточення в поточній сесії:"
echo "   GOOGLE_DRIVE_ENABLED: ${GOOGLE_DRIVE_ENABLED:-НЕ ВСТАНОВЛЕНО}"
echo "   GOOGLE_DRIVE_CLIENT_ID: ${GOOGLE_DRIVE_CLIENT_ID:-НЕ ВСТАНОВЛЕНО}"
echo "   GOOGLE_DRIVE_CLIENT_SECRET: ${GOOGLE_DRIVE_CLIENT_SECRET:+ВСТАНОВЛЕНО (***)}"
if [ -z "$GOOGLE_DRIVE_CLIENT_SECRET" ]; then
    echo "   GOOGLE_DRIVE_CLIENT_SECRET: НЕ ВСТАНОВЛЕНО"
fi
echo "   GOOGLE_DRIVE_REFRESH_TOKEN: ${GOOGLE_DRIVE_REFRESH_TOKEN:+ВСТАНОВЛЕНО (***)}"
if [ -z "$GOOGLE_DRIVE_REFRESH_TOKEN" ]; then
    echo "   GOOGLE_DRIVE_REFRESH_TOKEN: НЕ ВСТАНОВЛЕНО"
fi
echo "   GOOGLE_DRIVE_ROOT_FOLDER_ID: ${GOOGLE_DRIVE_ROOT_FOLDER_ID:-НЕ ВСТАНОВЛЕНО}"
echo ""

# Перевіряємо dotenv
if [ -d "$STREAMAPP_DIR" ]; then
    cd "$STREAMAPP_DIR"
    if npm list dotenv &> /dev/null; then
        echo "✅ dotenv встановлено"
    else
        echo "⚠️  dotenv НЕ встановлено"
        echo "   Встановіть: npm install dotenv"
    fi
fi

echo ""
echo "📊 Процеси PM2 (якщо використовується):"
if command -v pm2 &> /dev/null; then
    pm2 list | grep -i "api\|livekit\|stream" || echo "   Процеси не знайдено"
else
    echo "   PM2 не встановлено"
fi

echo ""
echo "📝 Логи сервера (останні 20 рядків з Google Drive):"
if command -v pm2 &> /dev/null; then
    PM2_PROCESS=$(pm2 list | grep -i "api\|livekit\|stream" | head -1 | awk '{print $2}')
    if [ -n "$PM2_PROCESS" ]; then
        pm2 logs "$PM2_PROCESS" --lines 20 --nostream | grep -i "google\|drive\|oauth" || echo "   Логів з Google Drive не знайдено"
    else
        echo "   Процес PM2 не знайдено"
    fi
else
    echo "   PM2 не встановлено - перевірте логи вручну"
fi

echo ""
echo "✅ Перевірка завершена"

