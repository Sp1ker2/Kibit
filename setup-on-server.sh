#!/bin/bash
# Скрипт для выполнения НА СЕРВЕРЕ
# Скопируйте этот скрипт на сервер и выполните: bash setup-on-server.sh

echo "🚀 Настройка Google Drive на сервере"
echo ""

# Путь к Service Account JSON
SERVICE_ACCOUNT_FILE="/www/wwwroot/LiveKit/streamApp/google-service-account.json"

# Проверяем, что файл существует
if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo "❌ Файл не найден: $SERVICE_ACCOUNT_FILE"
    echo ""
    echo "📋 Создайте файл вручную:"
    echo "   nano $SERVICE_ACCOUNT_FILE"
    echo ""
    echo "И вставьте содержимое файла streamApp/google-service-account.json"
    exit 1
fi

echo "✅ Файл найден: $SERVICE_ACCOUNT_FILE"
echo ""

# Создаем директорию для drop-in файлов
echo "📁 Создание директории для systemd drop-in..."
mkdir -p /etc/systemd/system/streamapp-api.service.d

# Создаем файл с переменными окружения
echo "⚙️  Создание файла с переменными окружения..."
cat > /etc/systemd/system/streamapp-api.service.d/google-drive.conf << 'EOF'
[Service]
Environment="GOOGLE_DRIVE_ENABLED=true"
Environment="GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json"
Environment="GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
EOF

# Устанавливаем права на файл Service Account
echo "🔐 Установка прав доступа..."
chmod 644 "$SERVICE_ACCOUNT_FILE"

# Перезагружаем systemd
echo "🔄 Перезагрузка systemd..."
systemctl daemon-reload

# Перезапускаем сервис
echo "🔄 Перезапуск streamapp-api.service..."
systemctl restart streamapp-api.service

# Проверяем статус
echo ""
echo "📋 Статус сервиса:"
systemctl status streamapp-api.service --no-pager -l | head -15

# Проверяем переменные окружения
echo ""
echo "📋 Переменные окружения:"
systemctl show streamapp-api.service | grep GOOGLE_DRIVE

echo ""
echo "📋 Последние 30 строк логов:"
journalctl -u streamapp-api.service -n 30 --no-pager | tail -30

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📋 Проверьте логи выше - должны увидеть:"
echo "   ✅ Google Drive API инициализирован через Service Account"
echo "   📁 Используется папка Google Drive с ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
echo ""


