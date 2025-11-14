#!/bin/bash
# Скрипт для развертывания Google Service Account JSON на серверах

echo "🚀 Развертывание Google Service Account на серверах"
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

# Массив app серверов (где работает API)
# Формат: IP:USER:PASS:PORT
APP_SERVERS=(
    "195.133.17.131:root:iFG02M6Z:16205"
    "195.133.17.179:root:kSE2oBmk:35614"
    "195.133.39.17:root:66AMoRNN:13845"
    "195.133.39.33:root:vHdUm7B2:42460"
    "195.133.39.41:root:EReAGUNX:31966"
)

SERVICE_ACCOUNT_FILE="streamApp/google-service-account.json"

# Проверяем, что файл существует
if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo -e "${RED}❌ Файл не найден: $SERVICE_ACCOUNT_FILE${NC}"
    exit 1
fi

# Функция для развертывания на одном сервере
deploy_to_server() {
    local SERVER_IP=$1
    local USER=$2
    local PASS=$3
    local PORT=$4
    
    echo -e "${YELLOW}📦 Развертывание на $SERVER_IP:$PORT...${NC}"
    
    # Копируем Service Account JSON на сервер
    echo "  Копирование Service Account JSON..."
    sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P "$PORT" \
        "$SERVICE_ACCOUNT_FILE" \
        "$USER@$SERVER_IP:/www/wwwroot/LiveKit/streamApp/google-service-account.json" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Не удалось скопировать файл на $SERVER_IP${NC}"
        return 1
    fi
    
    # Настраиваем переменные окружения через systemd drop-in
    echo "  Настройка переменных окружения..."
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$PORT" "$USER@$SERVER_IP" << 'REMOTE_EOF'
# Создаем директорию для drop-in файлов
mkdir -p /etc/systemd/system/streamapp-api.service.d

# Создаем файл с переменными окружения для Google Drive
cat > /etc/systemd/system/streamapp-api.service.d/google-drive.conf << 'ENV_EOF'
[Service]
Environment="GOOGLE_DRIVE_ENABLED=true"
Environment="GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json"
Environment="GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
ENV_EOF

# Перезагружаем systemd и перезапускаем сервис
systemctl daemon-reload
systemctl restart streamapp-api.service

echo "  ✅ Google Drive настроен на сервере"
echo "  📋 Проверка статуса сервиса:"
systemctl status streamapp-api.service --no-pager -l | head -10
REMOTE_EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Успешно настроено на $SERVER_IP${NC}"
    else
        echo -e "${RED}❌ Ошибка настройки на $SERVER_IP${NC}"
        return 1
    fi
}

# Развертываем на всех app серверах
SUCCESS=0
FAILED=0

for SERVER_INFO in "${APP_SERVERS[@]}"; do
    IFS=':' read -r SERVER_IP USER PASS PORT <<< "$SERVER_INFO"
    if deploy_to_server "$SERVER_IP" "$USER" "$PASS" "$PORT"; then
        ((SUCCESS++))
    else
        ((FAILED++))
    fi
    echo ""
done

echo "================================"
echo -e "${GREEN}✅ Успешно: $SUCCESS${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Ошибок: $FAILED${NC}"
fi
echo "================================"
echo ""
echo "📋 ВАЖНО: Убедитесь, что папка в Google Drive (ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx)"
echo "   расшарена для Service Account: stream@stream-478121.iam.gserviceaccount.com"
echo "   с правами 'Редактор' (Editor)"
echo ""

