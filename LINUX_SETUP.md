# 🐧 Настройка на Linux сервере

## Что делать на вашем сервере:

### 1. Остановите все процессы и освободите порты:

```bash
cd /www/wwwroot/LiveKit
chmod +x cleanup.sh
./cleanup.sh
```

### 2. Проверьте версию Node.js:

```bash
node --version
```

**Требуется Node.js 14+, рекомендуется 18+**

Если версия старая (меньше 14), обновите:
```bash
# Установка Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Или через nvm (рекомендуется):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### 3. Переустановите зависимости:

```bash
cd streamApp
rm -rf node_modules package-lock.json
npm install
cd ..
```

### 4. Исправьте права доступа:

```bash
chmod -R 755 streamApp/node_modules
chmod +x streamApp/node_modules/.bin/*
chmod +x *.sh
```

### 5. Запустите приложение:

```bash
./start.sh
```

## 🔥 Типичные проблемы:

### "Permission denied" на vite

**Причина:** Неправильные права доступа

**Решение:**
```bash
chmod -R 755 streamApp/node_modules
chmod +x streamApp/node_modules/.bin/vite
```

### "SyntaxError: Unexpected reserved word"

**Причина:** Старая версия Node.js (< 14)

**Решение:** Обновите Node.js до версии 18+

### "listen udp: bind: address already in use"

**Причина:** Порты уже заняты

**Решение:**
```bash
./cleanup.sh
# Или вручную:
fuser -k 7880/tcp
fuser -k 7881/tcp
fuser -k 7882/udp
fuser -k 5173/tcp
fuser -k 3001/tcp
```

### Не открывается с других устройств

**Проверьте firewall:**
```bash
# Ubuntu/Debian
sudo ufw allow 5173
sudo ufw allow 3001
sudo ufw allow 7880

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=7880/tcp
sudo firewall-cmd --reload
```

**Проверьте, что сервер слушает на всех интерфейсах:**
```bash
netstat -tulpn | grep -E '5173|3001|7880'
```

Должно быть `0.0.0.0:5173`, а не `127.0.0.1:5173`

## 📱 Доступ из интернета

Если хотите открыть доступ из интернета (не локальной сети):

1. **Используйте Nginx как reverse proxy:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001/api/;
    }
}
```

2. **Настройте SSL с Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

3. **Обновите конфигурацию в коде:**
Измените `streamApp/src/config.ts` чтобы использовать ваш домен вместо динамического определения хоста.

