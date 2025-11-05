#!/bin/bash
# Скрипт для настройки SSH ключей на всех серверах

echo "🔑 Настройка SSH ключей для всех серверов"
echo ""

# Проверяем наличие SSH ключа
if [ ! -f ~/.ssh/id_rsa.pub ]; then
    echo "📝 Генерируем SSH ключ..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    echo "✅ SSH ключ создан"
    echo ""
fi

# Массив серверов
declare -A SERVERS=(
    ["195.133.17.131"]="iFG02M6Z"
    ["195.133.17.179"]="kSE2oBmk"
    ["195.133.39.17"]="66AMoRNN"
    ["195.133.39.33"]="vHdUm7B2"
    ["195.133.39.41"]="EReAGUNX"
)

# Проверяем sshpass
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass не установлен"
    echo "Установите: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

# Копируем ключ на все серверы
for SERVER_IP in "${!SERVERS[@]}"; do
    PASSWORD="${SERVERS[$SERVER_IP]}"
    echo "📤 Копируем ключ на $SERVER_IP..."
    
    sshpass -p "$PASSWORD" ssh-copy-id -o StrictHostKeyChecking=no root@"$SERVER_IP" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Ключ скопирован на $SERVER_IP"
    else
        echo "❌ Ошибка копирования на $SERVER_IP"
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Настройка SSH ключей завершена!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Теперь можно убрать пароли из inventory.ini:"
echo "   Замените: ansible_ssh_pass=... на: # ansible_ssh_pass=..."
echo ""
echo "Или можно оставить пароли как есть - они будут использоваться как fallback"

