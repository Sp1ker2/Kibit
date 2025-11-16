# Исправление проблемы с /videos и Google Drive

## Что было исправлено:

### 1. ✅ Название корневой папки Google Drive
- Изменено с `LiveKitRecordings` на `LiveLitRecornigs` (как вы указали)
- Файл: `streamApp/server/storage/drive.js`

### 2. ✅ Структура папок в Google Drive
- Теперь создается структура: `LiveLitRecornigs/Комната/Пользователь/Дата/videos/`
- Видео файлы теперь загружаются в подпапку `videos` внутри папки даты
- Файл: `streamApp/server/storage/drive.js` (функция `ensureFolderStructure`)

### 3. ✅ API endpoint для получения видео
- Обновлен endpoint `/api/drive/dates/:dateId/videos` для поиска видео в подпапке `videos`
- Поддерживается обратная совместимость (если папки `videos` нет, ищет в самой папке даты)
- Файл: `streamApp/server/api.js`

### 4. ✅ Конфигурация Vite
- Добавлены настройки для SPA роутинга
- Файл: `streamApp/vite.config.ts`

## Что нужно проверить на сервере:

### 1. Проверьте, что Vite dev server запущен:
```bash
cd /www/wwwroot/LiveKit/streamApp
npm run dev
```

Или проверьте, запущен ли процесс:
```bash
ps aux | grep vite
```

### 2. Проверьте конфигурацию Nginx:
Убедитесь, что в конфигурации Nginx есть правильный прокси для frontend:

```nginx
# Прокси для Frontend (Vite dev server)
location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

### 3. Проверьте переменные окружения для Google Drive:
```bash
# Убедитесь, что Google Drive включен
export GOOGLE_DRIVE_ENABLED=true

# Проверьте путь к Service Account JSON файлу
export GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=/www/wwwroot/LiveKit/google-service-account.json

# Проверьте ID корневой папки (если используете существующую)
export GOOGLE_DRIVE_ROOT_FOLDER_ID=ваш_id_папки

# Или имя папки (если создается автоматически)
export GOOGLE_DRIVE_ROOT_FOLDER_NAME=LiveLitRecornigs
```

### 4. Перезапустите API сервер:
```bash
cd /www/wwwroot/LiveKit/streamApp
# Остановите старый процесс
pkill -f "node server/api.js"
# Запустите заново
npm run api
```

### 5. Проверьте доступность API:
```bash
curl http://localhost:3001/api/drive/rooms
```

Если Google Drive настроен правильно, должен вернуться список комнат.

## Структура папок в Google Drive:

После исправлений структура будет такой:
```
LiveLitRecornigs/
  └── Azov_2/
      └── Стрімер_1/
          └── 2025-11-14/
              └── videos/
                  ├── video1.mp4
                  ├── video2.mp4
                  └── ...
```

## Тестирование:

1. Откройте в браузере: `https://kibitkostreamappv.pp.ua:8443/videos`
2. Должна загрузиться страница с видео из Google Drive
3. Навигация: Комнаты → Пользователи → Даты → Видео

## Если проблема сохраняется:

1. Проверьте логи API сервера:
```bash
tail -f /www/wwwroot/LiveKit/streamApp/logs/api.log
```

2. Проверьте логи Nginx:
```bash
tail -f /var/log/nginx/error.log
```

3. Проверьте, что Google Drive API ключ правильный и имеет доступ к папке `LiveLitRecornigs`

4. Убедитесь, что Service Account имеет права на чтение папки в Google Drive



