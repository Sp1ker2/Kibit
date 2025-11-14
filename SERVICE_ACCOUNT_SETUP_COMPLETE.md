# 🔧 Настройка Google Drive с Service Account

## ✅ Что уже сделано:

1. ✅ Service Account JSON файл скопирован в проект: `streamApp/google-service-account.json`
2. ✅ Создан скрипт для деплоя: `deploy-google-service-account.sh`

## 📋 Что нужно сделать:

### 1. Убедитесь, что папка в Google Drive расшарена

**Service Account Email:** `stream@stream-478121.iam.gserviceaccount.com`

**Папка ID:** `16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx`

**Как проверить:**
1. Откройте Google Drive: https://drive.google.com
2. Найдите папку с ID `16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx` (или используйте прямую ссылку)
3. Кликните правой кнопкой → "Настройки доступа" / "Share"
4. Добавьте email: `stream@stream-478121.iam.gserviceaccount.com`
5. Дайте права: **"Редактор" (Editor)** или **"Соавтор" (Contributor)**
6. Нажмите "Отправить" / "Send"

### 2. Запустите деплой Service Account

```bash
cd /Users/bogdanprihodko/Downloads/LiveKit
./deploy-google-service-account.sh
```

Этот скрипт:
- ✅ Скопирует Service Account JSON на все app серверы
- ✅ Настроит переменные окружения через systemd
- ✅ Перезапустит API сервис на всех серверах

### 3. Проверьте логи после деплоя

После деплоя проверьте логи API сервера:

```bash
ssh root@195.133.39.41 -p 31966
tail -f /var/log/streamapp/api.log
# или
journalctl -u streamapp-api.service -f
```

Должны увидеть:
```
✅ Google Drive API инициализирован через Service Account
📁 Используется папка Google Drive с ID: 16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx
```

### 4. Тестовая загрузка

Попробуйте записать видео через `simple_recorder.py`. После записи в логах должно быть:

```
☁️  Начинаем загрузку в Google Drive...
✅ Загрузка в Google Drive завершена за X.XX сек
💾 Сховище: google_drive
🔗 Google Drive: https://drive.google.com/file/d/...
```

## ⚠️ Важные замечания:

### Вариант 1: Service Account без Domain-wide delegation (текущий)

**Работает только если:**
- ✅ Папка в Google Drive расшарена для Service Account email
- ✅ Даны права "Редактор" или "Соавтор"

**Не работает:**
- ❌ Создание файлов в корне Drive (root)
- ❌ Создание файлов в личных папках без доступа

### Вариант 2: Domain-wide delegation (для Google Workspace)

Если у вас Google Workspace аккаунт (не личный Gmail):
1. Включите Domain-wide delegation в Google Cloud Console
2. Добавьте `GOOGLE_DRIVE_USER_EMAIL=spotifysosichlen@gmail.com` в переменные окружения
3. Service Account сможет действовать от имени пользователя

**Текущая настройка использует Вариант 1.**

### Вариант 3: OAuth 2.0 (для личного Gmail)

Если Service Account не работает (ошибка "storage quota" или "access denied"):
- Нужно использовать OAuth 2.0
- Смотрите инструкции в `OAUTH2_SETUP_STEPS.md`

## 🔍 Проверка статуса

После деплоя проверьте статус сервиса:

```bash
ssh root@195.133.39.41 -p 31966
systemctl status streamapp-api.service
```

Проверьте переменные окружения:

```bash
systemctl show streamapp-api.service | grep GOOGLE_DRIVE
```

Должно быть:
```
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/streamApp/google-service-account.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx
```

## 📝 Troubleshooting

### Ошибка: "Service Accounts do not have storage quota"

Это означает, что Service Account не может загружать файлы в личный Gmail Drive. Решения:
1. Расшарить папку для Service Account (как описано выше)
2. Использовать OAuth 2.0 вместо Service Account

### Ошибка: "File not found" или "Permission denied"

Проверьте:
1. Файл `google-service-account.json` существует на сервере
2. Права доступа к файлу (должен быть доступен для чтения)
3. Папка в Drive расшарена для Service Account email

### Ошибка: "The user does not have sufficient permissions"

Проверьте права доступа к папке в Google Drive. Service Account должен иметь права "Редактор" или "Соавтор".


