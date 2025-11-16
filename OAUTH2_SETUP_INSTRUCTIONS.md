# 🔐 Настройка OAuth 2.0 для Google Drive

## ❌ Проблема

Service Account **не может** загружать файлы в обычный Google Drive пользователя, даже если папка расшарена. Ошибка:
```
Service Accounts do not have storage quota. 
Use OAuth delegation instead.
```

## ✅ Решение: OAuth 2.0

Нужно использовать OAuth 2.0 вместо Service Account.

---

## 📋 Пошаговая инструкция

### Шаг 1: Создайте OAuth 2.0 Client ID

1. Перейдите: https://console.cloud.google.com/apis/credentials?project=stream-478121
2. Нажмите **"Create Credentials"** → **"OAuth client ID"**
3. Если появится предупреждение о OAuth consent screen:
   - Нажмите **"Configure Consent Screen"**
   - User type: **"External"** → Create
   - App name: `StreamApp`
   - User support email: `spotifysosichlen@gmail.com`
   - Developer contact: `spotifysosichlen@gmail.com`
   - Нажмите **"Save and Continue"**
   - Scopes: нажмите **"Add or Remove Scopes"**
     - Найдите и добавьте: `https://www.googleapis.com/auth/drive.file`
     - Нажмите **"Update"** → **"Save and Continue"**
   - Test users: добавьте `spotifysosichlen@gmail.com`
   - Нажмите **"Save and Continue"** → **"Back to Dashboard"**
4. Вернитесь в Credentials → **"Create Credentials"** → **"OAuth client ID"**
5. Application type: **"Desktop app"**
6. Name: `StreamApp OAuth`
7. Нажмите **"Create"**
8. **Скопируйте Client ID и Client Secret** (они понадобятся!)

---

### Шаг 2: Получите Refresh Token

#### Вариант A: Через Google OAuth Playground (ПРОЩЕ)

1. Перейдите: https://developers.google.com/oauthplayground/
2. В правом верхнем углу нажмите ⚙️ (Settings)
3. Поставьте галочку **"Use your own OAuth credentials"**
4. Вставьте ваш **Client ID** и **Client Secret**
5. В левой панели найдите **"Drive API v3"**
6. Выберите scope: `https://www.googleapis.com/auth/drive.file`
7. Нажмите **"Authorize APIs"**
8. Войдите в аккаунт `spotifysosichlen@gmail.com`
9. Разрешите доступ
10. Нажмите **"Exchange authorization code for tokens"**
11. **Скопируйте Refresh Token** (длинная строка)

#### Вариант B: Через скрипт (на сервере)

```bash
# На сервере:
cd /www/wwwroot/LiveKit
bash get-oauth-refresh-token.sh
```

---

### Шаг 3: Настройте переменные окружения на сервере

Выполните на сервере:

```bash
# Создайте drop-in файл для OAuth
cat > /etc/systemd/system/streamapp-api.service.d/google-drive-oauth.conf << 'EOF'
[Service]
Environment="GOOGLE_DRIVE_ENABLED=true"
Environment="GOOGLE_DRIVE_CLIENT_ID=ВАШ_CLIENT_ID"
Environment="GOOGLE_DRIVE_CLIENT_SECRET=ВАШ_CLIENT_SECRET"
Environment="GOOGLE_DRIVE_REFRESH_TOKEN=ВАШ_REFRESH_TOKEN"
Environment="GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx"
EOF

# Перезагрузите systemd и перезапустите сервис
systemctl daemon-reload
systemctl restart streamapp-api.service

# Проверьте логи
journalctl -u streamapp-api.service -n 20 --no-pager | grep -E "(Google Drive|OAuth|✅)"
```

**Замените:**
- `ВАШ_CLIENT_ID` → ваш Client ID
- `ВАШ_CLIENT_SECRET` → ваш Client Secret  
- `ВАШ_REFRESH_TOKEN` → ваш Refresh Token

---

### Шаг 4: Проверка

После настройки проверьте логи:

```bash
tail -f /var/log/streamapp/api.log
```

Должно быть:
```
✅ Google Drive API инициализирован через OAuth 2.0
```

Теперь попробуйте загрузить видео - оно должно сохраниться в Google Drive!

---

## 🔍 Проверка переменных окружения

```bash
systemctl show streamapp-api.service | grep GOOGLE_DRIVE
```

Должны быть:
- `GOOGLE_DRIVE_ENABLED=true`
- `GOOGLE_DRIVE_CLIENT_ID=...`
- `GOOGLE_DRIVE_CLIENT_SECRET=...`
- `GOOGLE_DRIVE_REFRESH_TOKEN=...`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID=16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx`

---

## ❓ Частые проблемы

### "invalid_client" или "invalid_grant"
- Проверьте, что Client ID и Client Secret правильные
- Убедитесь, что OAuth consent screen настроен правильно
- Проверьте, что вы добавили себя в Test users

### "access_denied"
- Убедитесь, что scope `https://www.googleapis.com/auth/drive.file` добавлен в OAuth consent screen

### Видео всё ещё сохраняется локально
- Проверьте логи: `tail -f /var/log/streamapp/api.log`
- Убедитесь, что переменные окружения применены: `systemctl daemon-reload && systemctl restart streamapp-api.service`

