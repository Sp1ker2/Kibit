@echo off
chcp 65001 >nul
echo 🔨 СБОРКА EXE ФАЙЛА ДЛЯ WINDOWS
echo ================================
echo.

REM Проверяем что мы в правильной директории
if not exist "PythonRecorderApp\simple_recorder.py" (
    echo ❌ Файл simple_recorder.py не найден!
    echo Запустите скрипт из директории LiveKit
    pause
    exit /b 1
)

REM Активируем виртуальное окружение если есть
if exist ".venv\Scripts\activate.bat" (
    echo ✅ Активирую виртуальное окружение...
    call .venv\Scripts\activate.bat
) else (
    echo ⚠️ Виртуальное окружение не найдено, используем системный Python
)

REM Устанавливаем PyInstaller если его нет
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo 📦 Устанавливаю PyInstaller...
    pip install pyinstaller
)

echo.
echo 🔨 Начинаю сборку EXE...
echo.

REM Собираем EXE файл
pyinstaller ^
    --name=SimpleRecorder ^
    --onefile ^
    --windowed ^
    --icon=NONE ^
    --hidden-import=tkinter ^
    --hidden-import=cv2 ^
    --hidden-import=mss ^
    --hidden-import=numpy ^
    --hidden-import=websocket ^
    --hidden-import=requests ^
    --hidden-import=PIL ^
    --hidden-import=certifi ^
    --collect-all=cv2 ^
    --collect-all=mss ^
    --collect-all=websocket ^
    PythonRecorderApp\simple_recorder.py

if %errorlevel% equ 0 (
    echo.
    echo ✅ СБОРКА ЗАВЕРШЕНА!
    echo.
    echo 📁 EXE файл находится в: dist\SimpleRecorder.exe
    echo.
    echo 🚀 Запустите: dist\SimpleRecorder.exe
) else (
    echo.
    echo ❌ Ошибка при сборке!
    pause
    exit /b 1
)

pause

