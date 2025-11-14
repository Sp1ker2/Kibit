# 📁 Настройка Google Drive для хранения видео записей

## ✅ Реализовано

1. **Модуль Google Drive** (`streamApp/server/storage/drive.js`)
   - Автоматическое создание структуры папок: `комната/username/дата`
   - Загрузка файлов в Google Drive
   - Удаление локальных файлов после успешной загрузки

2. **Интеграция в API** (`streamApp/server/api.js`)
   - Если Google Drive включен → загружает в Drive и удаляет локальный файл
   - Если Drive выключен или ошибка → сохраняет локально (fallback)

## 🔧 Настройка Google Drive API

### Шаг 1: Создание проекта в Google Cloud Console

1. Перейди в [Google Cloud Console](https://console.cloud.google.com/)
2. Создай новый проект или выбери существующий
3. Включи **Google Drive API**:
   - APIs & Services → Enable APIs and Services
   - Поиск "Google Drive API" → Enable

### Шаг 2: Создание OAuth 2.0 credentials

1. APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Application type: **Desktop app** или **Web application**
3. Скачай JSON файл с credentials (client_id и client_secret)

### Шаг 3: Получение Refresh Token

Для получения refresh token нужно авторизоваться один раз. Есть несколько способов:

#### Вариант A: Через скрипт (рекомендуется)

Создай файл `get-refresh-token.js`:

```javascript
import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Для desktop app

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const scopes = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('🔗 Перейди по этой ссылке для авторизации:');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('📋 Введи код из браузера: ', (code) => {
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('❌ Ошибка получения токена:', err);
      return;
    }
    console.log('\n✅ Refresh Token:');
    console.log(token.refresh_token);
    rl.close();
  });
});
```

Запусти:
```bash
node get-refresh-token.js
```

#### Вариант B: Через онлайн инструменты

Используй [Google OAuth Playground](https://developers.google.com/oauthplayground/):
1. Выбери "Drive API v3" → scope `https://www.googleapis.com/auth/drive.file`
2. Authorize APIs
3. Exchange authorization code for tokens
4. Скопируй Refresh Token

### Шаг 4: Установка зависимостей

```bash
cd streamApp
npm install
# Или если уже установлен:
npm install googleapis@^144.0.0
```

### Шаг 5: Настройка переменных окружения

Добавь в `.env` или экспортируй переменные:

```bash
# Включить Google Drive
export GOOGLE_DRIVE_ENABLED=true

# Google Drive API credentials
export GOOGLE_DRIVE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_DRIVE_CLIENT_SECRET="your-client-secret"
export GOOGLE_DRIVE_REFRESH_TOKEN="your-refresh-token"

# Опционально: ID корневой папки в Drive (по умолчанию создаст "LiveKitRecordings")
export GOOGLE_DRIVE_ROOT_FOLDER_ID="root"
export GOOGLE_DRIVE_ROOT_FOLDER_NAME="LiveKitRecordings"
```

### Шаг 6: Перезапуск API сервера

```bash
cd /www/wwwroot/LiveKit/streamApp
pkill -f "node.*api.js"
nohup node server/api.js > /tmp/streamapp-api.log 2>&1 &
```

## 📋 Структура папок в Google Drive

```
LiveKitRecordings/              (корневая папка)
  ├── Azov_2/                   (комната)
  │   ├── Стрімер_1/            (username)
  │   │   └── 2025-11-14/       (дата)
  │   │       └── video.mp4     (файл)
  │   └── fjfjjf/
  │       └── 2025-11-14/
  └── admin/
      └── ...
```

## 🔍 Проверка работы

1. Загрузи видео через рекордер
2. Проверь логи:
   ```bash
   tail -f /tmp/streamapp-api.log
   ```
3. Должны быть сообщения:
   - `☁️  Загрузка в Google Drive...`
   - `📁 Создана папка в Drive: ...`
   - `✅ Файл загружен в Drive: ...`
   - `🗑️  Локальный файл удален после загрузки в Drive`

## ⚙️ Fallback режим

Если Google Drive не включен (`GOOGLE_DRIVE_ENABLED=false`) или произошла ошибка:
- Файлы сохраняются локально в `/www/wwwroot/LiveKit/recordings/`
- Структура папок та же: `комната/username/дата/`

## 🔒 Безопасность

- **НЕ коммить** `.env` файл с credentials в Git
- Храни credentials в безопасном месте
- Используй минимальные scopes (`drive.file` вместо `drive`)

## 📝 Примечания

- Google Drive имеет лимиты на размер файла (обычно 15GB на файл для обычных аккаунтов, 5TB для Google Workspace)
- Free tier Google Drive имеет 15GB общего хранилища
- Для production рекомендуется использовать Google Workspace с неограниченным хранилищем

