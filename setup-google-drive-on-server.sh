#!/bin/bash
# Скрипт для настройки Google Drive на сервере
# Выполнить на сервере: bash setup-google-drive-on-server.sh

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
    echo "Или скопируйте файл streamApp/google-service-account.json на сервер"
    exit 1
fi

echo "✅ Файл найден: $SERVICE_ACCOUNT_FILE"
echo ""

# Создаем директорию для drop-in файлов
echo "📁 Создание директории для systemd drop-in..."
mkdir -p /etc/systemd/system/streamapp-api.service.d

# Создаем файл с переменными окружения
echo "⚙️  Настройка переменных окружения..."
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
echo "✅ Настройка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Убедитесь, что папка в Google Drive (ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx)"
echo "      расшарена для Service Account: stream@stream-478121.iam.gserviceaccount.com"
echo "      с правами 'Редактор' (Editor)"
echo ""
echo "   2. Проверьте логи:"
echo "      journalctl -u streamapp-api.service -f"
echo ""
echo "   3. Должны увидеть:"
echo "      ✅ Google Drive API инициализирован через Service Account"
echo ""


