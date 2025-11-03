#!/bin/bash
# Установка SSL сертификата для домена

DOMAIN="kibitkostreamappv.pp.ua"

echo "🔒 Установка SSL сертификата для $DOMAIN..."
echo ""

# Проверяем что certbot установлен
if ! command -v certbot &> /dev/null; then
    echo "📦 Устанавливаем Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

echo "✅ Certbot установлен"
echo ""

# Проверяем что домен указывает на этот сервер
echo "🔍 Проверка DNS..."
DNS_IP=$(dig +short $DOMAIN | tail -1)
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo "   DNS указывает на: $DNS_IP"
echo "   IP сервера: $SERVER_IP"

if [ "$DNS_IP" != "$SERVER_IP" ] && [ "$DNS_IP" != "195.133.17.131" ]; then
    echo "⚠️  DNS может быть неправильно настроен"
    echo "   Убедитесь что домен указывает на IP: 195.133.17.131"
    read -p "Продолжить установку SSL? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔒 Устанавливаем SSL сертификат..."
echo ""

# Устанавливаем SSL через certbot
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL сертификат установлен!"
    echo ""
    echo "🌐 Теперь сайт доступен по HTTPS:"
    echo "   https://$DOMAIN"
    echo ""
    echo "🔄 Перезагружаем Nginx..."
    systemctl reload nginx
    echo ""
    echo "✅ Готово!"
else
    echo ""
    echo "❌ Ошибка установки SSL сертификата"
    echo ""
    echo "Попробуйте вручную:"
    echo "  sudo certbot --nginx -d $DOMAIN"
fi

