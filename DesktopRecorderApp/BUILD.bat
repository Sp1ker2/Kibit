@echo off
echo ===================================
echo   LiveKit Desktop Recorder
echo   Сборка EXE файла
echo ===================================
echo.

echo [1/3] Проверка .NET SDK...
dotnet --version
if %errorlevel% neq 0 (
    echo ОШИБКА: .NET SDK не установлен!
    echo Скачайте с: https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)

echo.
echo [2/3] Восстановление пакетов...
dotnet restore
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось восстановить пакеты!
    pause
    exit /b 1
)

echo.
echo [3/3] Сборка Release...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось собрать проект!
    pause
    exit /b 1
)

echo.
echo ===================================
echo   ✅ ГОТОВО!
echo ===================================
echo.
echo EXE файл находится в:
echo bin\Release\net8.0-windows\win-x64\publish\LiveKitRecorder.exe
echo.
echo Размер: ~15 MB
echo Можно копировать на любой Windows ПК!
echo.
pause


