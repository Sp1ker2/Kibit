#!/bin/bash

echo "🔨 СБОРКА EXE ФАЙЛА"
echo "==================="
echo ""

# Переходим в директорию с Python файлом
cd PythonRecorderApp

# Устанавливаем зависимости
echo "📦 Устанавливаю зависимости..."
pip install -r requirements.txt

echo ""
echo "🔨 Начинаю сборку EXE..."
echo ""

# Собираем EXE файл
pyinstaller --clean --noconfirm --onefile --noconsole \
    --hidden-import=tkinter \
    --hidden-import=cv2 \
    --hidden-import=mss \
    --hidden-import=numpy \
    --hidden-import=websocket \
    --hidden-import=requests \
    --hidden-import=certifi \
    --name=SimpleRecorder \
    simple_recorder.py

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

cd ..

