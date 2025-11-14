# 🔧 Настройка Google Drive через Service Account

## ✅ У тебя уже есть Service Account JSON файл!

Файл: `Stream IAM Admin.json`

## 📋 Что нужно сделать:

### 1. Скопировать JSON файл на сервер

```bash
# Скопируй JSON файл на сервер
scp "Stream IAM Admin.json" root@195.133.39.41:/www/wwwroot/LiveKit/streamApp/google-service-account.json

# Или если файл в другой директории:
cd /Users/bogdanprihodko/Downloads
scp "Stream IAM Admin.json" root@195.133.39.41:/www/wwwroot/LiveKit/streamApp/google-service-account.json
```

### 2. Дать доступ Service Account к папке в Google Drive

**Важно!** Service Account имеет email: `stream@stream-478121.iam.gserviceaccount.com`

Нужно дать этому email доступ к папке в Google Drive:

#### Вариант A: Использовать существующую папку

1. Открой Google Drive в браузере
2. Создай папку "LiveKitRecordings" (или используй существующую)
3. Кликни правой кнопкой на папку → "Поделиться"
4. Добавь email: `stream@stream-478121.iam.gserviceaccount.com`
5. Дай права: **Редактор** (Editor)
6. Скопируй ID папки из URL (после `/folders/`)
   - Например: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
   - ID = `1a2b3c4d5e6f7g8h9i0j`

#### Вариант B: Автоматическое создание папки

Код автоматически создаст папку "LiveKitRecordings" в корне Drive, но нужно дать Service Account доступ к ней:

1. После первого запуска найди созданную папку "LiveKitRecordings"
2. Дай доступ Service Account email к этой папке

### 3. Настроить переменные окружения

На сервере добавь в `.env` или systemd service:

```bash
export GOOGLE_DRIVE_ENABLED=true

# Опционально: ID конкретной папки (если используешь существующую)
# export GOOGLE_DRIVE_ROOT_FOLDER_ID="1a2b3c4d5e6f7g8h9i0j"

# Опционально: имя корневой папки (по умолчанию "LiveKitRecordings")
# export GOOGLE_DRIVE_ROOT_FOLDER_NAME="LiveKitRecordings"
```

### 4. Задеплоить файлы и перезапустить API

```bash
# Скопируй обновленные файлы
scp streamApp/server/storage/drive.js root@195.133.39.41:/www/wwwroot/LiveKit/streamApp/server/storage/drive.js
scp streamApp/server/api.js root@195.133.39.41:/www/wwwroot/LiveKit/streamApp/server/api.js
scp streamApp/package.json root@195.133.39.41:/www/wwwroot/LiveKit/streamApp/package.json

# На сервере установи зависимости и перезапусти
ssh root@195.133.39.41 << 'EOF'
cd /www/wwwroot/LiveKit/streamApp
npm install
export GOOGLE_DRIVE_ENABLED=true
pkill -f "node.*api.js"
nohup node server/api.js > /tmp/streamapp-api.log 2>&1 &
sleep 2
tail -30 /tmp/streamapp-api.log
EOF
```

## ✅ Проверка

После запуска в логах должно быть:

```
📄 Используется Service Account: /www/wwwroot/LiveKit/streamApp/google-service-account.json
✅ Google Drive API инициализирован через Service Account
```

## 🔒 Безопасность

- **НЕ коммить** JSON файл с Service Account в Git!
- Файл должен быть доступен только для чтения серверу
- Service Account имеет доступ только к файлам, к которым дали доступ

## 📝 Важно!

**Service Account НЕ видит файлы в твоем личном Google Drive автоматически!**

Нужно **вручную дать доступ** Service Account email к папке:
- Email: `stream@stream-478121.iam.gserviceaccount.com`
- Права: Редактор (Editor)

Без этого Service Account не сможет создавать файлы в твоей папке Drive.

