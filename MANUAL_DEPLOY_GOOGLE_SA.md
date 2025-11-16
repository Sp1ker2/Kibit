# 📋 Ручной деплой Google Service Account

## Шаг 1: Скопировать JSON файл на сервер

### Вариант A: Через SFTP/SCP (если доступен)

```bash
# С локального компьютера:
scp -P 31966 streamApp/google-service-account.json root@195.133.39.41:/www/wwwroot/LiveKit/streamApp/
```

### Вариант B: Через веб-интерфейс / панель управления

1. Откройте панель управления сервером
2. Найдите файл `google-service-account.json` в папке `streamApp/`
3. Скопируйте содержимое файла `streamApp/google-service-account.json`
4. Создайте файл на сервере: `/www/wwwroot/LiveKit/streamApp/google-service-account.json`
5. Вставьте содержимое

### Вариант C: Создать на сервере напрямую

Подключитесь к серверу:
```bash
ssh root@195.133.39.41 -p 31966
```

Создайте файл:
```bash
nano /www/wwwroot/LiveKit/streamApp/google-service-account.json
```

Вставьте содержимое файла `streamApp/google-service-account.json` и сохраните (Ctrl+O, Enter, Ctrl+X).

## Шаг 2: Настроить переменные окружения

На сервере выполните:

```bash
# Создаем директорию для drop-in файлов
mkdir -p /etc/systemd/system/streamapp-api.service.d

# Создаем файл с переменными окружения
cat > /etc/systemd/system/streamapp-api.service.d/google-drive.conf << 'EOF'
[Service]
Environment="GOOGLE_DRIVE_ENABLED=true"
Environment="GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json"
Environment="GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
EOF

# Перезагружаем systemd
systemctl daemon-reload

# Перезапускаем сервис
systemctl restart streamapp-api.service

# Проверяем статус
systemctl status streamapp-api.service
```

## Шаг 3: Проверить логи

```bash
# Смотрим логи API сервера
journalctl -u streamapp-api.service -f --no-pager -n 50

# Или если логи в файле:
tail -f /var/log/streamapp/api.log
```

Должны увидеть:
```
✅ Google Drive API инициализирован через Service Account
📁 Используется папка Google Drive с ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx
```

## Шаг 4: Проверить переменные окружения

```bash
systemctl show streamapp-api.service | grep GOOGLE_DRIVE
```

Должно быть:
```
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx
```

## Шаг 5: Проверить права доступа к файлу

```bash
ls -lh /www/wwwroot/LiveKit/streamApp/google-service-account.json
chmod 644 /www/wwwroot/LiveKit/streamApp/google-service-account.json
```

## ⚠️ ВАЖНО: Расшарить папку в Google Drive

**Перед тестированием загрузки:**

1. Откройте Google Drive: https://drive.google.com
2. Найдите папку с ID `16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx`
3. Правой кнопкой → "Настройки доступа" / "Share"
4. Добавьте email: `stream@stream-478121.iam.gserviceaccount.com`
5. Установите права: **"Редактор" (Editor)**
6. Сохраните

**Без этого шага загрузка не будет работать!**

## 🧪 Тестирование

После настройки попробуйте записать видео через `simple_recorder.py`. В логах должно появиться:

```
☁️  Начинаем загрузку в Google Drive...
☁️  Загрузка файла в Google Drive: filename.mp4 (X.XX MB)
✅ Файл загружен в Drive: filename.mp4
   📋 ID: 1abc...
   🔗 Ссылка: https://drive.google.com/file/d/...
```

## 📝 Содержимое файла для копирования

Файл находится в: `streamApp/google-service-account.json`

Или скопируйте содержимое из файла, который предоставил пользователь:
`/Users/bogdanprihodko/Downloads/stream-478121-fb929b5a4072.json`


