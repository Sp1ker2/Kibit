#!/bin/bash
# Автоматический деплой Google Drive на сервер через SSH

echo "🚀 Автоматический деплой Google Drive на сервер"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверяем sshpass
if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}❌ sshpass не установлен${NC}"
    echo "Установите:"
    echo "  macOS:   brew install hudochenkov/sshpass/sshpass"
    echo "  Linux:   sudo apt-get install sshpass"
    exit 1
fi

# Настройки сервера
SERVER_IP="195.133.39.41"
SERVER_PORT="${SSH_PORT:-22}"  # По умолчанию 22, можно изменить: SSH_PORT=31966 ./auto-deploy-google-drive.sh
SERVER_USER="root"
SERVER_PASS="EReAGUNX"
SERVICE_ACCOUNT_FILE="streamApp/google-service-account.json"
REMOTE_FILE="/www/wwwroot/LiveKit/streamApp/google-service-account.json"

# Проверяем, что файл существует
if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo -e "${RED}❌ Файл не найден: $SERVICE_ACCOUNT_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Шаг 1: Копирование JSON файла на сервер...${NC}"

# Копируем JSON файл на сервер
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P "$SERVER_PORT" \
    "$SERVICE_ACCOUNT_FILE" \
    "$SERVER_USER@$SERVER_IP:$REMOTE_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Не удалось скопировать файл на сервер${NC}"
    echo ""
    echo "Попробуйте вручную:"
    echo "  scp -P $SERVER_PORT $SERVICE_ACCOUNT_FILE $SERVER_USER@$SERVER_IP:$REMOTE_FILE"
    exit 1
fi

echo -e "${GREEN}✅ Файл скопирован${NC}"
echo ""

echo -e "${YELLOW}⚙️  Шаг 2: Настройка переменных окружения на сервере...${NC}"

# Выполняем команды на сервере
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" << 'REMOTE_SCRIPT'
set -e

echo "  📁 Создание директории для systemd drop-in..."
mkdir -p /etc/systemd/system/streamapp-api.service.d

echo "  ⚙️  Создание файла с переменными окружения..."
cat > /etc/systemd/system/streamapp-api.service.d/google-drive.conf << 'EOF'
[Service]
Environment="GOOGLE_DRIVE_ENABLED=true"
Environment="GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json"
Environment="GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
EOF

echo "  🔐 Установка прав доступа..."
chmod 644 /www/wwwroot/LiveKit/streamApp/google-service-account.json

echo "  🔄 Перезагрузка systemd..."
systemctl daemon-reload

echo "  🔄 Перезапуск streamapp-api.service..."
systemctl restart streamapp-api.service

echo "  ✅ Настройка завершена!"
REMOTE_SCRIPT

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка выполнения команд на сервере${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Переменные окружения настроены${NC}"
echo ""

echo -e "${YELLOW}📋 Шаг 3: Проверка статуса сервиса...${NC}"

# Проверяем статус сервиса
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" \
    "systemctl status streamapp-api.service --no-pager -l | head -20"

echo ""
echo -e "${YELLOW}📋 Шаг 4: Проверка переменных окружения...${NC}"

# Проверяем переменные окружения
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" \
    "systemctl show streamapp-api.service | grep GOOGLE_DRIVE"

echo ""
echo -e "${YELLOW}📋 Шаг 5: Последние 30 строк логов...${NC}"

# Показываем последние логи
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" \
    "journalctl -u streamapp-api.service -n 30 --no-pager | tail -30"

echo ""
echo "================================"
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo "================================"
echo ""
echo "📋 Что дальше:"
echo "   1. Проверьте логи выше - должны увидеть:"
echo "      ✅ Google Drive API инициализирован через Service Account"
echo "      📁 Используется папка Google Drive с ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
echo ""
echo "   2. Попробуйте записать видео через simple_recorder.py"
echo ""
echo "   3. Для просмотра логов в реальном времени на сервере:"
echo "      ssh $SERVER_USER@$SERVER_IP -p $SERVER_PORT"
echo "      journalctl -u streamapp-api.service -f"
echo ""

