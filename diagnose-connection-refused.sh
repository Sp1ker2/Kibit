#!/bin/bash
# Диагностика ошибки ERR_CONNECTION_REFUSED

echo "🔍 Диагностика проблемы подключения..."
echo ""

# Проверка Nginx
echo "1. Проверка Nginx:"
if systemctl is-active --quiet nginx 2>/dev/null || service nginx status > /dev/null 2>&1; then
    echo "✅ Nginx запущен"
else
    echo "❌ Nginx НЕ запущен!"
    echo "   Запустите: sudo systemctl start nginx"
fi
echo ""

# Проверка портов 80 и 443
echo "2. Проверка портов 80 и 443:"
if netstat -tulpn 2>/dev/null | grep -q ':80 ' || ss -tulpn 2>/dev/null | grep -q ':80 '; then
    echo "✅ Порт 80 слушается"
else
    echo "❌ Порт 80 НЕ слушается!"
fi

if netstat -tulpn 2>/dev/null | grep -q ':443 ' || ss -tulpn 2>/dev/null | grep -q ':443 '; then
    echo "✅ Порт 443 слушается (HTTPS)"
else
    echo "⚠️  Порт 443 НЕ слушается (HTTPS не настроен)"
fi
echo ""

# Проверка конфигурации Nginx
echo "3. Проверка конфигурации Nginx:"
if nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Конфигурация корректна"
else
    echo "❌ Ошибка в конфигурации Nginx:"
    nginx -t
fi
echo ""

# Проверка что порты 5173, 3001, 7880 работают
echo "4. Проверка портов приложения:"
netstat -tulpn 2>/dev/null | grep -E '5173|3001|7880' || ss -tulpn 2>/dev/null | grep -E '5173|3001|7880'
echo ""

# Проверка firewall
echo "5. Проверка firewall:"
if command -v ufw > /dev/null; then
    ufw status | head -5
elif command -v firewall-cmd > /dev/null; then
    firewall-cmd --list-ports
fi
echo ""

# Логи Nginx
echo "6. Последние ошибки Nginx:"
tail -10 /var/log/nginx/error.log 2>/dev/null || echo "Логи недоступны"
echo ""

# Рекомендации
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 БЫСТРОЕ ИСПРАВЛЕНИЕ:"
echo ""
echo "Если Nginx не запущен:"
echo "  sudo systemctl start nginx"
echo ""
echo "Если порт 80 закрыт:"
echo "  sudo ufw allow 80/tcp"
echo "  sudo ufw allow 443/tcp"
echo ""
echo "Если конфигурация неправильная:"
echo "  sudo bash /www/wwwroot/LiveKit/fix-livekit-connection.sh"
echo ""
echo "Перезагрузите Nginx:"
echo "  sudo systemctl reload nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

