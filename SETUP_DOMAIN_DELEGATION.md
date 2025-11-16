# Настройка Domain-wide Delegation для Google Drive

## Проблема
Service Accounts не имеют собственного хранилища в Google Drive. Нужно использовать Domain-wide delegation.

## Решение

### Шаг 1: Включить Domain-wide delegation в Google Cloud Console

1. Открой Google Cloud Console: https://console.cloud.google.com/
2. Перейди в IAM & Admin → Service Accounts
3. Найди Service Account: `stream@stream-478121.iam.gserviceaccount.com`
4. Открой его и перейди во вкладку "Details"
5. Нажми "Enable Domain-wide Delegation" (или "Show Domain-wide Delegation")
6. Скопируй **Client ID** (например: `107877455129798500191`)

### Шаг 2: Настроить в Google Workspace Admin Console

1. Открой Google Admin Console: https://admin.google.com/
2. Перейди в Security → API Controls → Domain-wide Delegation
3. Нажми "Add new"
4. Вставь Client ID из шага 1
5. В "OAuth scopes" добавь:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
6. Нажми "Authorize"

### Шаг 3: Установить переменную окружения

```bash
export GOOGLE_DRIVE_USER_EMAIL="твой-email@gmail.com"
```

Где `твой-email@gmail.com` - это email твоего Google аккаунта, который владеет папкой Google Drive.

### Шаг 4: Перезапустить API сервер

```bash
cd /www/wwwroot/LiveKit/streamApp/server
export GOOGLE_DRIVE_ENABLED=true
export GOOGLE_DRIVE_USER_EMAIL="твой-email@gmail.com"
export GOOGLE_DRIVE_ROOT_FOLDER_ID="16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
pkill -f "node.*api.js"
nohup node api.js > /tmp/streamapp-api.log 2>&1 &
```

## Альтернатива: Shared Drive

Если у тебя Google Workspace, можешь создать Shared Drive:
1. Создай Shared Drive в Google Drive
2. Перемести папку LiveKitRecordings туда
3. Дай доступ Service Account email к Shared Drive
4. Обнови GOOGLE_DRIVE_ROOT_FOLDER_ID на ID папки в Shared Drive

