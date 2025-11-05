#!/bin/bash
# Скрипт для запуска сервисов на всех серверах

echo "🚀 Запуск сервисов на всех серверах"
echo ""

# Массив серверов
declare -A SERVERS=(
    ["195.133.17.131"]="root:iFG02M6Z:16205"
    ["195.133.17.179"]="root:kSE2oBmk:35614"
    ["195.133.39.17"]="root:66AMoRNN:13845"
    ["195.133.39.33"]="root:vHdUm7B2:42460"
    ["195.133.39.41"]="root:EReAGUNX:31966"
)

# Функция для запуска на одном сервере
start_server() {
    local SERVER_IP=$1
    local SERVER_INFO=$2
    IFS=':' read -r USER PASS PORT <<< "$SERVER_INFO"
    
    echo "▶️  Запуск сервисов на $SERVER_IP:$PORT..."
    
    # Проверяем sshpass
    if ! command -v sshpass &> /dev/null; then
        echo "❌ sshpass не установлен. Установите: brew install hudochenkov/sshpass/sshpass"
        return 1
    fi
    
    # Запускаем сервисы через SSH
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -p "$PORT" "$USER@$SERVER_IP" << 'REMOTE_EOF'
cd /www/wwwroot/LiveKit

# Останавливаем старые процессы
echo "Остановка старых процессов..."
pkill -f "livekit-server" 2>/dev/null
pkill -f "npm run api" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "node server/api.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Запускаем LiveKit сервер
echo "Запуск LiveKit..."
cd livekit
nohup livekit-server --dev --bind 0.0.0.0 > /tmp/livekit.log 2>&1 &
sleep 3

# Запускаем API сервер
echo "Запуск API..."
cd ../streamApp
nohup npm run api > /tmp/api.log 2>&1 &
sleep 2

# Запускаем Frontend
echo "Запуск Frontend..."
nohup npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/frontend.log 2>&1 &
sleep 5

# Проверяем порты
echo "Проверка портов:"
netstat -tuln | grep -E '3001|5173|7880' || ss -tuln | grep -E '3001|5173|7880' || echo "⚠️  Порты не найдены"

echo "✅ Сервисы запущены на $(hostname -I | awk '{print $1}')"
REMOTE_EOF

    if [ $? -eq 0 ]; then
        echo "✅ Сервисы запущены на $SERVER_IP"
    else
        echo "❌ Ошибка запуска на $SERVER_IP"
    fi
    echo ""
}

# Запускаем на всех серверах
for SERVER_IP in "${!SERVERS[@]}"; do
    start_server "$SERVER_IP" "${SERVERS[$SERVER_IP]}"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Запуск завершен!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Проверьте статус сервисов:"
echo "   ./check-all-servers.sh"

