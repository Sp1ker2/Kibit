#!/bin/bash

# Альтернативный скрипт - просто создает .env файл с Google Drive настройками
# Можно использовать, если ваш process manager не загружает .env автоматически

set -e

echo "🔐 Створення .env файлу для Google Drive OAuth2..."

# Путь к проекту на сервере
PROJECT_DIR="${PROJECT_DIR:-/www/wwwroot/LiveKit}"
STREAMAPP_DIR="${PROJECT_DIR}/streamApp"
ENV_FILE="${STREAMAPP_DIR}/.env"

# Параметри Google Drive OAuth2 (за замовчуванням пусті; заповніть своїми значеннями)
GOOGLE_DRIVE_ENABLED="${GOOGLE_DRIVE_ENABLED:-true}"
GOOGLE_DRIVE_CLIENT_ID="${GOOGLE_DRIVE_CLIENT_ID:-CHANGEME_CLIENT_ID}"
GOOGLE_DRIVE_CLIENT_SECRET="${GOOGLE_DRIVE_CLIENT_SECRET:-CHANGEME_CLIENT_SECRET}"
GOOGLE_DRIVE_REFRESH_TOKEN="${GOOGLE_DRIVE_REFRESH_TOKEN:-CHANGEME_REFRESH_TOKEN}"
GOOGLE_DRIVE_ROOT_FOLDER_ID="${GOOGLE_DRIVE_ROOT_FOLDER_ID:-CHANGEME_ROOT_FOLDER_ID}"

# Проверяем существование директории
if [ ! -d "$STREAMAPP_DIR" ]; then
    echo "❌ Директорія ${STREAMAPP_DIR} не існує!"
    echo "   Вкажіть правильний шлях: PROJECT_DIR=/path/to/project ./setup-google-drive-env-file.sh"
    exit 1
fi

# Создаем .env файл
cat > "$ENV_FILE" << EOF
# Google Drive OAuth2 Configuration
GOOGLE_DRIVE_ENABLED=${GOOGLE_DRIVE_ENABLED}
GOOGLE_DRIVE_CLIENT_ID=${GOOGLE_DRIVE_CLIENT_ID}
GOOGLE_DRIVE_CLIENT_SECRET=${GOOGLE_DRIVE_CLIENT_SECRET}
GOOGLE_DRIVE_REFRESH_TOKEN=${GOOGLE_DRIVE_REFRESH_TOKEN}
GOOGLE_DRIVE_ROOT_FOLDER_ID=${GOOGLE_DRIVE_ROOT_FOLDER_ID}
EOF

chmod 600 "$ENV_FILE"

echo "✅ .env файл створено: ${ENV_FILE}"
echo ""
echo "📋 Вміст файлу:"
cat "$ENV_FILE"
echo ""
echo "⚠️  Перезапустіть сервер API для застосування змін"

