# Настройка OAuth 2.0 для Google Drive (обычный Gmail)

Для обычного Gmail аккаунта нужно использовать OAuth 2.0 вместо Service Account.

## Шаг 1: Создать OAuth 2.0 Credentials

1. Открой Google Cloud Console: https://console.cloud.google.com/
2. Перейди в APIs & Services → Credentials
3. Нажми "Create Credentials" → "OAuth client ID"
4. Выбери "Desktop app" (или "Web application")
5. Сохрани **Client ID** и **Client Secret**

## Шаг 2: Получить Refresh Token

1. Скачай и запусти скрипт для получения refresh token
2. Авторизуйся через браузер
3. Скопируй refresh token

## Шаг 3: Установить переменные окружения

```bash
export GOOGLE_DRIVE_ENABLED=true
export GOOGLE_DRIVE_CLIENT_ID="твой-client-id"
export GOOGLE_DRIVE_CLIENT_SECRET="твой-client-secret"
export GOOGLE_DRIVE_REFRESH_TOKEN="твой-refresh-token"
export GOOGLE_DRIVE_ROOT_FOLDER_ID="16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
```

## Шаг 4: Перезапустить API сервер

