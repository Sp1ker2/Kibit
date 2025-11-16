#!/bin/bash

# Скрипт для налаштування Google Drive OAuth2 на сервері

set -e

echo "🔐 Налаштування Google Drive OAuth2..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Параметри Google Drive OAuth2 (змінні оточення або плейсхолдери)
GOOGLE_DRIVE_ENABLED="${GOOGLE_DRIVE_ENABLED:-true}"
GOOGLE_DRIVE_CLIENT_ID="${GOOGLE_DRIVE_CLIENT_ID:-CHANGEME_CLIENT_ID}"
GOOGLE_DRIVE_CLIENT_SECRET="${GOOGLE_DRIVE_CLIENT_SECRET:-CHANGEME_CLIENT_SECRET}"
GOOGLE_DRIVE_REFRESH_TOKEN="${GOOGLE_DRIVE_REFRESH_TOKEN:-CHANGEME_REFRESH_TOKEN}"
GOOGLE_DRIVE_ROOT_FOLDER_ID="${GOOGLE_DRIVE_ROOT_FOLDER_ID:-CHANGEME_ROOT_FOLDER_ID}"

# Путь к проекту на сервере (по умолчанию)
PROJECT_DIR="${PROJECT_DIR:-/www/wwwroot/LiveKit}"
STREAMAPP_DIR="${PROJECT_DIR}/streamApp"
ENV_FILE="${STREAMAPP_DIR}/.env"

echo "📁 Директорія проекту: ${PROJECT_DIR}"

# Проверяем существование директории
if [ ! -d "$STREAMAPP_DIR" ]; then
    echo -e "${RED}❌ Директорія ${STREAMAPP_DIR} не існує!${NC}"
    echo "   Вкажіть правильний шлях через змінну PROJECT_DIR"
    echo "   Приклад: PROJECT_DIR=/path/to/project ./setup-google-drive-oauth2.sh"
    exit 1
fi

echo "✅ Директорія знайдена"

# Создаем или обновляем .env файл
echo -e "${YELLOW}📝 Створюємо/оновлюємо .env файл...${NC}"

# Читаем существующий .env если он есть
if [ -f "$ENV_FILE" ]; then
    echo "   Файл .env вже існує, додаємо/оновлюємо змінні Google Drive..."
    # Удаляем старые Google Drive переменные если они есть
    sed -i.bak '/^GOOGLE_DRIVE/d' "$ENV_FILE"
    # Удаляем backup файл
    rm -f "${ENV_FILE}.bak"
else
    echo "   Створюємо новий .env файл..."
    touch "$ENV_FILE"
fi

# Добавляем новые переменные
cat >> "$ENV_FILE" << EOF

# Google Drive OAuth2 Configuration
GOOGLE_DRIVE_ENABLED=${GOOGLE_DRIVE_ENABLED}
GOOGLE_DRIVE_CLIENT_ID=${GOOGLE_DRIVE_CLIENT_ID}
GOOGLE_DRIVE_CLIENT_SECRET=${GOOGLE_DRIVE_CLIENT_SECRET}
GOOGLE_DRIVE_REFRESH_TOKEN=${GOOGLE_DRIVE_REFRESH_TOKEN}
GOOGLE_DRIVE_ROOT_FOLDER_ID=${GOOGLE_DRIVE_ROOT_FOLDER_ID}
EOF

echo -e "${GREEN}✅ .env файл оновлено${NC}"

# Устанавливаем права на .env файл (только для чтения владельцем)
chmod 600 "$ENV_FILE"
echo "🔒 Права на .env файл встановлено (600)"

# Устанавливаем dotenv если нужно
echo -e "${YELLOW}📦 Перевіряємо dotenv...${NC}"
cd "$STREAMAPP_DIR"
if ! npm list dotenv &> /dev/null; then
    echo "   Встановлюємо dotenv..."
    npm install dotenv
    echo -e "${GREEN}✅ dotenv встановлено${NC}"
else
    echo -e "${GREEN}✅ dotenv вже встановлено${NC}"
fi

# Экспортируем переменные в текущую сессию
echo -e "${YELLOW}📤 Експортуємо змінні оточення в поточну сесію...${NC}"
export GOOGLE_DRIVE_ENABLED
export GOOGLE_DRIVE_CLIENT_ID
export GOOGLE_DRIVE_CLIENT_SECRET
export GOOGLE_DRIVE_REFRESH_TOKEN
export GOOGLE_DRIVE_ROOT_FOLDER_ID

echo -e "${GREEN}✅ Змінні оточення експортовано${NC}"

# Проверяем, используется ли PM2
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Виявлено PM2${NC}"
    
    # Проверяем, запущен ли процесс через PM2
    PM2_PROCESS=$(pm2 list | grep -i "api\|livekit\|stream" | head -1 | awk '{print $2}')
    
    if [ -n "$PM2_PROCESS" ]; then
        echo "   Знайдено процес PM2: $PM2_PROCESS"
        echo -e "${YELLOW}🔄 Перезапускаємо процес PM2...${NC}"
        pm2 restart "$PM2_PROCESS" --update-env
        echo -e "${GREEN}✅ Процес перезапущено${NC}"
        
        # Показываем логи для проверки
        echo -e "${YELLOW}📋 Останні логи (через 3 секунди):${NC}"
        sleep 3
        pm2 logs "$PM2_PROCESS" --lines 20 --nostream
    else
        echo "   Процес PM2 не знайдено"
        echo "   Перезапустіть процес вручну: pm2 restart all --update-env"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 не встановлено${NC}"
fi

# Проверяем, используется ли systemd
if command -v systemctl &> /dev/null; then
    SERVICE_FILE="/etc/systemd/system/livekit-api.service"
    
    if [ -f "$SERVICE_FILE" ]; then
        echo -e "${YELLOW}📦 Виявлено systemd service${NC}"
        echo "   Оновіть service файл вручну з змінними оточення"
        echo "   Або використайте .env файл з вашим process manager"
    fi
fi

# Финальное сообщение
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Налаштування Google Drive OAuth2 завершено!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "📋 Перевірка налаштування:"
echo "   1. Перезапустіть сервер API (якщо ще не зроблено):"
echo "      - PM2: pm2 restart all --update-env"
echo "      - Node: pkill -f 'node.*api.js' && cd $STREAMAPP_DIR && node server/api.js &"
echo ""
echo "   2. Перевірте логи - має з'явитися:"
echo "      ✅ Google Drive API инициализирован через OAuth 2.0"
echo ""
echo "   3. Зробіть тестове завантаження відео"
echo ""
echo "📁 Структура в Google Drive буде:"
echo "   LiveKitRecordings/"
echo "   └── Azov_2/"
echo "       └── Стрімер_1/"
echo "           └── 2025-11-15/"
echo "               └── video.mp4"
echo ""
echo -e "${YELLOW}⚠️  Якщо використовуєте systemd, додайте змінні оточення в service файл${NC}"
echo "   Або налаштуйте завантаження .env файлу в вашому process manager"
echo ""

