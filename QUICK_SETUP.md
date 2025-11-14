# Быстрая настройка Google Drive

## Шаг 1: Определить тип аккаунта

Какой email создал папку LiveKitRecordings в Google Drive?
- Если @домен.com → Google Workspace → используй Domain-wide delegation
- Если @gmail.com → обычный Gmail → используй OAuth 2.0

## Шаг 2A: Если Google Workspace (Domain-wide delegation)

1. Открой Google Admin Console: https://admin.google.com/
2. Перейди в Security → API Controls → Domain-wide Delegation
3. Нажми "Add new"
4. Client ID: `107877455129798500191`
5. OAuth scopes: `https://www.googleapis.com/auth/drive.file`
6. Нажми "Authorize"

7. На сервере выполни:
```bash
export GOOGLE_DRIVE_USER_EMAIL="твой-email@домен.com"
cd /www/wwwroot/LiveKit/streamApp/server
pkill -f "node.*api.js"
export GOOGLE_DRIVE_ENABLED=true
export GOOGLE_DRIVE_ROOT_FOLDER_ID="16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
nohup node api.js > /tmp/streamapp-api.log 2>&1 &
```

## Шаг 2B: Если обычный Gmail (OAuth 2.0)

1. Создай OAuth 2.0 credentials (не Service Account):
   - Google Cloud Console → APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: Desktop app

2. Получи Refresh Token используя скрипт `get-google-drive-token.js`

3. На сервере выполни:
```bash
export GOOGLE_DRIVE_ENABLED=true
export GOOGLE_DRIVE_CLIENT_ID="твой-oauth-client-id"
export GOOGLE_DRIVE_CLIENT_SECRET="твой-oauth-client-secret"
export GOOGLE_DRIVE_REFRESH_TOKEN="твой-refresh-token"
export GOOGLE_DRIVE_ROOT_FOLDER_ID="16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
cd /www/wwwroot/LiveKit/streamApp/server
pkill -f "node.*api.js"
nohup node api.js > /tmp/streamapp-api.log 2>&1 &
```

