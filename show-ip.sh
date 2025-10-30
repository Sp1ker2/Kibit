#!/bin/bash

echo "🌐 Ваш IP адрес для доступа из локальной сети:"
echo ""

# Пытаемся получить IP разными способами
if command -v ipconfig &> /dev/null; then
    # macOS
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
elif command -v hostname &> /dev/null; then
    # Linux
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    echo "❌ Не удалось определить IP адрес автоматически"
    echo ""
    echo "Определите вручную:"
    echo "  macOS:   ipconfig getifaddr en0"
    echo "  Linux:   hostname -I"
    echo "  Windows: ipconfig"
else
    echo "   📱 Откройте на другом устройстве:"
    echo ""
    echo "   👉 http://${IP}:5173"
    echo ""
    echo "   (Устройство должно быть в той же Wi-Fi сети)"
fi

echo ""


