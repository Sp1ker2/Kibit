#!/bin/bash
# Скрипт для развертывания проекта на всех 5 серверах

echo "🚀 Развертывание LiveKit Stream App на всех серверах"
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

# Массив серверов
declare -A SERVERS=(
    ["195.133.17.131"]="root:iFG02M6Z:16205"
    ["195.133.17.179"]="root:kSE2oBmk:35614"
    ["195.133.39.17"]="root:66AMoRNN:13845"
    ["195.133.39.33"]="root:vHdUm7B2:42460"
    ["195.133.39.41"]="root:EReAGUNX:31966"
)

# Функция для развертывания на одном сервере
deploy_to_server() {
    local SERVER_IP=$1
    local USER=$2
    local PASS=$3
    local PORT=$4
    
    echo -e "${YELLOW}📦 Развертывание на $SERVER_IP:$PORT...${NC}"
    
    # Создаем директорию на сервере
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$PORT" "$USER@$SERVER_IP" "mkdir -p /www/wwwroot/LiveKit" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Не удалось подключиться к $SERVER_IP${NC}"
        return 1
    fi
    
    # Копируем файлы проекта
    echo "  Копирование файлов проекта..."
    sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P "$PORT" -r \
        streamApp/ \
        livekit/ \
        start-simple.sh \
        setup.sh \
        "$USER@$SERVER_IP:/www/wwwroot/LiveKit/" 2>/dev/null
    
    # Копируем базу данных только на первый сервер (основной)
    if [ "$SERVER_IP" = "195.133.17.131" ]; then
        echo "  Копирование базы данных на основной сервер..."
        sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P "$PORT" \
            streamApp/database.db \
            "$USER@$SERVER_IP:/www/wwwroot/LiveKit/streamApp/" 2>/dev/null
    fi
    
    # Выполняем настройку на сервере
    echo "  Настройка на сервере..."
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$PORT" "$USER@$SERVER_IP" << 'REMOTE_EOF'
cd /www/wwwroot/LiveKit

# Устанавливаем зависимости
echo "  Установка зависимостей..."
cd streamApp && npm install && cd ..

# Устанавливаем права
chmod +x *.sh 2>/dev/null
chmod +x streamApp/server/*.js 2>/dev/null

# Создаем папку recordings если нет
mkdir -p recordings

# Останавливаем старые процессы
pkill -f "livekit-server" 2>/dev/null
pkill -f "npm run api" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "node server/api.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "✅ Настройка завершена на $(hostname -I | awk '{print $1}')"
REMOTE_EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Успешно развернуто на $SERVER_IP${NC}"
    else
        echo -e "${RED}❌ Ошибка развертывания на $SERVER_IP${NC}"
    fi
    echo ""
}

# Развертываем на всех серверах
for SERVER_IP in "${!SERVERS[@]}"; do
    IFS=':' read -r USER PASS PORT <<< "${SERVERS[$SERVER_IP]}"
    deploy_to_server "$SERVER_IP" "$USER" "$PASS" "$PORT"
done

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Развертывание завершено!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📝 Следующие шаги:"
echo "   1. Настройте Nginx load balancer (см. setup-load-balancer.sh)"
echo "   2. Запустите сервисы на каждом сервере (см. start-all-servers.sh)"

