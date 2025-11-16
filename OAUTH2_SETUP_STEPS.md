# Пошаговая настройка OAuth 2.0 для Google Drive

## Шаг 1: Настроить OAuth Consent Screen

1. В Google Cloud Console перейди в **APIs & Services** → **OAuth consent screen**
2. Выбери **External** (для обычного Gmail аккаунта)
3. Заполни обязательные поля:
   - **App name**: `LiveKit Drive Uploader`
   - **User support email**: `spotifysosichlen@gmail.com`
   - **Developer contact information**: `spotifysosichlen@gmail.com`
4. Добавь **Scopes**:
   - Нажми "Add or Remove Scopes"
   - Выбери `.../auth/drive.file`
   - Или введи вручную: `https://www.googleapis.com/auth/drive.file`
   - Сохрани
5. Нажми "Save and Continue"
6. Пропусти "Test users" (для личного аккаунта не нужно)
7. Вернись в "Credentials"

## Шаг 2: Создать OAuth 2.0 Credentials

1. В разделе **Credentials** нажми **Create Credentials** → **OAuth client ID**
2. Если появится предупреждение о OAuth consent screen - проигнорируй или нажми "Configure Consent Screen" и заверши Шаг 1
3. Выбери **Application type**: **Desktop app**
4. Введи **Name**: `LiveKit Drive Uploader`
5. Нажми **Create**
6. **ВАЖНО**: Скопируй или скачай:
   - **Client ID** (длинная строка с цифрами)
   - **Client Secret** (строка с буквами и цифрами)
   - Или нажми "Download JSON" и сохрани файл

## Шаг 3: Получить Refresh Token

После получения Client ID и Client Secret, выполни на сервере:

```bash
ssh root@195.133.39.41
cd /tmp
export GOOGLE_DRIVE_CLIENT_ID="твой-client-id"
export GOOGLE_DRIVE_CLIENT_SECRET="твой-client-secret"
node get-google-drive-token.js
```

1. Скрипт покажет URL - открой его в браузере
2. Авторизуйся через `spotifysosichlen@gmail.com`
3. Скопируй код авторизации из браузера
4. Вставь код в терминал
5. Скопируй **Refresh Token** из результата

## Шаг 4: Настроить API сервер

После получения Refresh Token, выполни:

```bash
cd /www/wwwroot/LiveKit/streamApp/server
export GOOGLE_DRIVE_ENABLED=true
export GOOGLE_DRIVE_CLIENT_ID="твой-client-id"
export GOOGLE_DRIVE_CLIENT_SECRET="твой-client-secret"
export GOOGLE_DRIVE_REFRESH_TOKEN="твой-refresh-token"
export GOOGLE_DRIVE_ROOT_FOLDER_ID="16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
pkill -f "node.*api.js"
nohup node api.js > /tmp/streamapp-api.log 2>&1 &
```

## Проверка

Проверь логи:
```bash
tail -f /tmp/streamapp-api.log
```

Должно быть:
- ✅ `Google Drive API инициализирован через OAuth 2.0`

После этого попробуй загрузить видео через рекордер - файл должен появиться в Google Drive!

