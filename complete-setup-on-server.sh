#!/bin/bash
# ПОЛНЫЙ скрипт настройки для выполнения НА СЕРВЕРЕ
# Скопируйте весь этот скрипт на сервер и выполните: bash complete-setup-on-server.sh
# 
# Или выполните на локальной машине через SSH:
#   ssh root@195.133.39.41 -p 22 < complete-setup-on-server.sh
#   или
#   ssh root@195.133.39.41 -p 31966 < complete-setup-on-server.sh

echo "🚀 Полная настройка Google Drive на сервере"
echo ""

# Шаг 1: Создание JSON файла
echo "📄 Шаг 1: Создание Service Account JSON файла..."
mkdir -p /www/wwwroot/LiveKit/streamApp

# ⚠️ ВАЖНО: Замените содержимое ниже на ваш Service Account JSON
# Получите его в Google Cloud Console: https://console.cloud.google.com/iam-admin/serviceaccounts
# Скопируйте весь JSON и замените содержимое между строками JSON_EOF

cat > /www/wwwroot/LiveKit/streamApp/google-service-account.json << 'JSON_EOF'
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "YOUR_SERVICE_ACCOUNT_EMAIL@YOUR_PROJECT_ID.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/YOUR_SERVICE_ACCOUNT_EMAIL%40YOUR_PROJECT_ID.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
JSON_EOF

echo ""
echo "⚠️  ВАЖНО: Отредактируйте файл /www/wwwroot/LiveKit/streamApp/google-service-account.json"
echo "   Замените все значения YOUR_* на реальные из вашего Service Account JSON"
echo ""

chmod 644 /www/wwwroot/LiveKit/streamApp/google-service-account.json
echo "✅ JSON файл создан: /www/wwwroot/LiveKit/streamApp/google-service-account.json"
echo ""

# Шаг 2: Настройка переменных окружения
echo "⚙️  Шаг 2: Настройка переменных окружения..."
mkdir -p /etc/systemd/system/streamapp-api.service.d

cat > /etc/systemd/system/streamapp-api.service.d/google-drive.conf << 'EOF'
[Service]
Environment="GOOGLE_DRIVE_ENABLED=true"
Environment="GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json"
Environment="GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
EOF

echo "✅ Переменные окружения настроены"
echo ""

# Шаг 3: Перезапуск сервиса
echo "🔄 Шаг 3: Перезапуск сервиса..."
systemctl daemon-reload
systemctl restart streamapp-api.service

echo "✅ Сервис перезапущен"
echo ""

# Шаг 4: Проверка статуса
echo "📋 Шаг 4: Проверка статуса сервиса..."
systemctl status streamapp-api.service --no-pager -l | head -15
echo ""

# Шаг 5: Проверка переменных окружения
echo "📋 Шаг 5: Проверка переменных окружения..."
systemctl show streamapp-api.service | grep GOOGLE_DRIVE
echo ""

# Шаг 6: Показ логов
echo "📋 Шаг 6: Последние 30 строк логов:"
journalctl -u streamapp-api.service -n 30 --no-pager | tail -30
echo ""

echo "================================"
echo "✅ Настройка завершена!"
echo "================================"
echo ""
echo "📋 Проверьте логи выше - должны увидеть:"
echo "   ✅ Google Drive API инициализирован через Service Account"
echo "   📁 Используется папка Google Drive с ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
echo ""

