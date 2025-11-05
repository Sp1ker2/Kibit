#!/bin/bash
# Скрипт для проверки статуса всех серверов

echo "🔍 Проверка статуса всех серверов"
echo ""

# Массив серверов
declare -A SERVERS=(
    ["195.133.17.131"]="root:iFG02M6Z:16205"
    ["195.133.17.179"]="root:kSE2oBmk:35614"
    ["195.133.39.17"]="root:66AMoRNN:13845"
    ["195.133.39.33"]="root:vHdUm7B2:42460"
    ["195.133.39.41"]="root:EReAGUNX:31966"
)

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Функция для проверки одного сервера
check_server() {
    local SERVER_IP=$1
    local SERVER_INFO=$2
    IFS=':' read -r USER PASS PORT <<< "$SERVER_INFO"
    
    echo -e "${YELLOW}Проверка $SERVER_IP:$PORT...${NC}"
    
    if ! command -v sshpass &> /dev/null; then
        echo -e "${RED}❌ sshpass не установлен${NC}"
        return 1
    fi
    
    # Проверяем доступность сервера
    if sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$PORT" "$USER@$SERVER_IP" "echo 'OK'" &>/dev/null; then
        echo -e "${GREEN}✅ Сервер доступен${NC}"
        
        # Проверяем порты
        sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -p "$PORT" "$USER@$SERVER_IP" << 'REMOTE_EOF'
echo "Порты:"
netstat -tuln | grep -E '3001|5173|7880' || ss -tuln | grep -E '3001|5173|7880' || echo "⚠️  Порты не слушаются"

echo ""
echo "Процессы:"
ps aux | grep -E 'livekit-server|npm run api|npm run dev|vite|node server/api.js' | grep -v grep || echo "⚠️  Процессы не найдены"

echo ""
echo "Логи (последние 5 строк):"
echo "--- LiveKit ---"
tail -n 5 /tmp/livekit.log 2>/dev/null || echo "Нет логов"
echo "--- API ---"
tail -n 5 /tmp/api.log 2>/dev/null || echo "Нет логов"
echo "--- Frontend ---"
tail -n 5 /tmp/frontend.log 2>/dev/null || echo "Нет логов"
REMOTE_EOF
    else
        echo -e "${RED}❌ Сервер недоступен${NC}"
    fi
    echo ""
}

# Проверяем все серверы
for SERVER_IP in "${!SERVERS[@]}"; do
    check_server "$SERVER_IP" "${SERVERS[$SERVER_IP]}"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Проверка завершена!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

