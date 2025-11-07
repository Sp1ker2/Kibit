@echo off
echo ===================================
echo   LiveKit Desktop Recorder
echo   Python → Windows EXE
echo ===================================
echo.

echo [1/4] Проверка Python...
python --version
if %errorlevel% neq 0 (
    echo ОШИБКА: Python не установлен!
    echo Скачайте: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo.
echo [2/4] Установка зависимостей...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось установить пакеты!
    pause
    exit /b 1
)

echo.
echo [3/4] Сборка EXE (займёт 2-3 минуты)...
pyinstaller build.spec --clean
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось собрать EXE!
    pause
    exit /b 1
)

echo.
echo [4/4] Готово!
echo.
echo ===================================
echo   ✅ EXE ФАЙЛ ГОТОВ!
echo ===================================
echo.
echo Файл находится в:
echo dist\LiveKitRecorder.exe
echo.
echo Размер: ~25-30 MB
echo.
pause


