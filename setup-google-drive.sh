#!/bin/bash

# Автоматичний скрипт налаштування Google Drive
# Завантажте цей файл на сервер через aaPanel файловий менеджер
# і виконайте: bash setup-google-drive.sh

set -e

echo "🔐 Налаштування Google Drive OAuth2..."
echo ""

PROJECT_DIR="/www/wwwroot/LiveKit"
STREAMAPP_DIR="$PROJECT_DIR/streamApp"
ENV_FILE="$STREAMAPP_DIR/.env"

# Перевірка директорії
if [ ! -d "$STREAMAPP_DIR" ]; then
    echo "❌ Директорія $STREAMAPP_DIR не існує!"
    echo "Перевірте шлях до проекту"
    exit 1
fi

echo "✅ Директорія знайдена: $STREAMAPP_DIR"
echo ""

# Створюємо .env файл (з плейсхолдерами — замініть своїми значеннями)
echo "📝 Створюємо .env файл (з плейсхолдерами — замініть своїми значеннями)..."
cat > "$ENV_FILE" << 'EOF'
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=CHANGEME_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET=CHANGEME_CLIENT_SECRET
GOOGLE_DRIVE_REFRESH_TOKEN=CHANGEME_REFRESH_TOKEN
GOOGLE_DRIVE_ROOT_FOLDER_ID=CHANGEME_ROOT_FOLDER_ID
EOF

chmod 600 "$ENV_FILE"
echo "✅ .env файл створено: $ENV_FILE"
echo ""

# Перевірка вмісту
echo "📋 Вміст .env файлу:"
grep "GOOGLE_DRIVE" "$ENV_FILE" | sed 's/=.*/=***/' || cat "$ENV_FILE"
echo ""

# Встановлюємо dotenv
echo "📦 Встановлюємо dotenv..."
cd "$STREAMAPP_DIR"
if npm list dotenv &> /dev/null; then
    echo "✅ dotenv вже встановлено"
else
    npm install dotenv --save
    echo "✅ dotenv встановлено"
fi
echo ""

# Перезапускаємо PM2 процеси
echo "🔄 Перезапускаємо PM2 процеси..."
if command -v pm2 &> /dev/null; then
    PM2_PROCESS=$(pm2 list | grep -i "api\|livekit\|stream" | head -1 | awk '{print $2}' || echo "")
    if [ -n "$PM2_PROCESS" ]; then
        echo "Знайдено процес PM2: $PM2_PROCESS"
        pm2 restart "$PM2_PROCESS" --update-env
        echo "✅ Процес перезапущено"
        echo ""
        echo "📋 Останні логи (через 3 секунди):"
        sleep 3
        pm2 logs "$PM2_PROCESS" --lines 20 --nostream | grep -i "google\|drive" || echo "Логи Google Drive з'являться після перезапуску"
    else
        echo "⚠️ PM2 процес не знайдено"
        echo "Перезапустіть API сервер вручну:"
        echo "  pm2 restart all --update-env"
    fi
else
    echo "⚠️ PM2 не встановлено"
    echo "Перезапустіть API сервер вручну"
fi
echo ""

# Перевірка systemd
if command -v systemctl &> /dev/null; then
    if systemctl list-unit-files | grep -q "livekit-api"; then
        echo "🔄 Перезапускаємо systemd службу..."
        systemctl restart livekit-api
        echo "✅ Служба перезапущена"
        echo ""
        echo "📋 Статус служби:"
        systemctl status livekit-api --no-pager -l | head -10
    fi
fi

echo ""
echo "✅═══════════════════════════════════════════════════"
echo "✅ Налаштування Google Drive завершено!"
echo "✅═══════════════════════════════════════════════════"
echo ""
echo "📋 Наступні кроки:"
echo ""
echo "1. Перевірте логи сервера:"
echo "   pm2 logs --lines 50 | grep -i 'google\|drive'"
echo ""
echo "2. Має з'явитися:"
echo "   ✅ Переменные окружения загружены из .env файла"
echo "   ✅ Google Drive API инициализирован через OAuth 2.0"
echo ""
echo "3. Зробіть тестове завантаження відео з Python рекордера"
echo ""
echo "4. Перевірте Google Drive - файли мають з'явитися в:"
echo "   LiveKitRecordings/комната/username/дата/"
echo ""

