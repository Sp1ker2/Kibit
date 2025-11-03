#!/bin/bash

echo "🚀 Настройка LiveKit Stream Application"
echo ""

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите его: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js установлен: $(node --version)"

# Проверяем npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен!"
    exit 1
fi

echo "✅ npm установлен: $(npm --version)"

# Проверяем LiveKit server
if ! command -v livekit-server &> /dev/null; then
    echo "❌ livekit-server не найден!"
    echo ""
    echo "Установите его:"
    echo "  macOS:   brew install livekit"
    echo "  Linux:   curl -sSL https://get.livekit.io | bash"
    exit 1
fi

echo "✅ livekit-server установлен"
echo ""

# Устанавливаем зависимости React приложения
echo "📦 Устанавливаем зависимости React приложения..."
cd streamApp
npm install
if [ $? -ne 0 ]; then
    echo "❌ Ошибка установки зависимостей!"
    exit 1
fi
cd ..

echo ""
echo "✅ Все зависимости установлены!"
echo ""

# Создаем папку для записей если её нет
if [ ! -d "recordings" ]; then
    mkdir recordings
    echo "📁 Создана папка recordings/"
fi

# Создаем базу данных если её нет
if [ ! -f "database.db" ]; then
    echo "🗄️  Создается база данных..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Настройка завершена успешно!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎬 Для запуска приложения выполните:"
echo "   ./start.sh"
echo ""
echo "👤 Учетные записи по умолчанию:"
echo "   Админ:       Admin / Admin"
echo "   Пользователь: User / User"
echo ""

