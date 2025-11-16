#!/bin/bash

echo "🔨 СБОРКА EXE ФАЙЛА ДЛЯ WINDOWS"
echo "================================"

# Проверяем что мы в правильной директории
if [ ! -f "PythonRecorderApp/simple_recorder.py" ]; then
    echo "❌ Файл simple_recorder.py не найден!"
    echo "Запустите скрипт из директории LiveKit"
    exit 1
fi

# Активируем виртуальное окружение
if [ -d ".venv" ]; then
    echo "✅ Активирую виртуальное окружение..."
    source .venv/bin/activate
else
    echo "⚠️ Виртуальное окружение не найдено, используем системный Python"
fi

# Устанавливаем PyInstaller если его нет
if ! python -c "import PyInstaller" 2>/dev/null; then
    echo "📦 Устанавливаю PyInstaller..."
    pip install pyinstaller
fi

echo ""
echo "🔨 Начинаю сборку EXE..."
echo ""

# Собираем EXE файл
pyinstaller \
    --name="SimpleRecorder" \
    --onefile \
    --windowed \
    --icon=NONE \
    --add-data "PythonRecorderApp:PythonRecorderApp" \
    --hidden-import=tkinter \
    --hidden-import=cv2 \
    --hidden-import=mss \
    --hidden-import=numpy \
    --hidden-import=websocket \
    --hidden-import=requests \
    --hidden-import=PIL \
    --hidden-import=certifi \
    --collect-all=cv2 \
    --collect-all=mss \
    --collect-all=websocket \
    PythonRecorderApp/simple_recorder.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ СБОРКА ЗАВЕРШЕНА!"
    echo ""
    echo "📁 EXE файл находится в: dist/SimpleRecorder.exe"
    echo ""
    echo "🚀 Запустите: dist/SimpleRecorder.exe"
else
    echo ""
    echo "❌ Ошибка при сборке!"
    exit 1
fi

