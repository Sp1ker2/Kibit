#!/bin/bash

# Скрипт для деплою системи логування на сервер
# Сервер: 195.133.39.41
# Домен: kibitkostreamappv.pp.ua

set -e

SERVER_IP="195.133.39.41"
SERVER_USER="root"
PROJECT_DIR="/www/wwwroot/LiveKit"

echo "🚀 Початок деплою системи логування..."

# Комітимо зміни локально
echo "📝 Комітимо зміни..."
git add PythonRecorderApp/simple_recorder.py streamApp/server/api.js streamApp/src/App.tsx streamApp/src/components/LoginForm.tsx streamApp/src/components/admin/AdminDashboard.tsx streamApp/src/components/admin/AdminHeader.tsx streamApp/src/components/admin/RecorderLogsPage.tsx 2>/dev/null || true

# Перевіряємо чи є зміни для коміту
if git diff --cached --quiet; then
    echo "ℹ️  Немає змін для коміту"
else
    git commit -m "Add recorder logs system: separate logs per user, web interface, API endpoints" || echo "⚠️  Помилка коміту (можливо вже закомічено)"
fi

echo "📦 Відправляємо файли на сервер..."

# Спочатку створюємо директорії на сервері якщо не існують
ssh ${SERVER_USER}@${SERVER_IP} << 'PREPARE_SSH'
cd /www/wwwroot/LiveKit
mkdir -p PythonRecorderApp
mkdir -p streamApp/server
mkdir -p streamApp/src
mkdir -p streamApp/src/components
mkdir -p streamApp/src/components/admin
PREPARE_SSH

# Відправляємо змінені файли на сервер через SCP
echo "📤 Відправка simple_recorder.py..."
scp PythonRecorderApp/simple_recorder.py ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/PythonRecorderApp/ || echo "⚠️  Помилка відправки simple_recorder.py"

echo "📤 Відправка api.js..."
scp streamApp/server/api.js ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/streamApp/server/ || echo "⚠️  Помилка відправки api.js"

echo "📤 Відправка App.tsx..."
scp streamApp/src/App.tsx ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/streamApp/src/ || echo "⚠️  Помилка відправки App.tsx"

echo "📤 Відправка LoginForm.tsx..."
scp streamApp/src/components/LoginForm.tsx ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/streamApp/src/components/ || echo "⚠️  Помилка відправки LoginForm.tsx"

echo "📤 Відправка AdminDashboard.tsx..."
scp streamApp/src/components/admin/AdminDashboard.tsx ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/streamApp/src/components/admin/ || echo "⚠️  Помилка відправки AdminDashboard.tsx"

echo "📤 Відправка AdminHeader.tsx..."
scp streamApp/src/components/admin/AdminHeader.tsx ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/streamApp/src/components/admin/ || echo "⚠️  Помилка відправки AdminHeader.tsx"

echo "📤 Відправка RecorderLogsPage.tsx..."
scp streamApp/src/components/admin/RecorderLogsPage.tsx ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/streamApp/src/components/admin/ || echo "⚠️  Помилка відправки RecorderLogsPage.tsx"

echo "🔧 Виконуємо налаштування на сервері..."

# Виконуємо команди на сервері
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /www/wwwroot/LiveKit

echo "📦 Збірка frontend..."
cd streamApp
npm run build

echo "🔄 Перезапуск API сервера..."
# Зупиняємо старий процес якщо є
pkill -f "node.*api.js" || true
sleep 2

# Запускаємо новий процес в фоні
cd /www/wwwroot/LiveKit/streamApp
nohup node server/api.js > /tmp/api-server.log 2>&1 &

echo "✅ Деплой завершено!"
echo "📋 Перевірте логи API: tail -f /tmp/api-server.log"
echo "📋 Сторінка логів: https://kibitkostreamappv.pp.ua/logs"

ENDSSH

echo ""
echo "✅ Деплой завершено успішно!"
echo "🌐 Сторінка логів: https://kibitkostreamappv.pp.ua/logs"
echo ""
echo "📝 Перевірте на сервері:"
echo "   ssh root@${SERVER_IP}"
echo "   tail -f /tmp/api-server.log"

