#!/bin/bash

# Скрипт для автоматического деплоя на сервер
SERVER="195.133.17.131"
PORT="16205"
USER="th3dw0l9"
PASS="a8188437"

echo "🚀 Деплой на сервер $SERVER:$PORT..."

# Команды для выполнения на сервере
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p $PORT $USER@$SERVER <<'REMOTE_SCRIPT'
sudo bash <<'SCRIPT'
DOMAIN="kibitkostreamappv.pp.ua"

echo "🚀 Настройка домена ${DOMAIN}..."

# Удаляем default
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-available/default

# Создаем директории
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Создаем конфигурацию
cat > /etc/nginx/sites-available/${DOMAIN} <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kibitkostreamappv.pp.ua;

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
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /rtc {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location ~ ^/(live|twirp) {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Активируем
rm -f /etc/nginx/sites-enabled/${DOMAIN}
ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}

# Проверяем и перезагружаем
nginx -t && systemctl reload nginx && echo "✅ Готово! http://${DOMAIN}"
SCRIPT
REMOTE_SCRIPT

echo "✅ Деплой завершен!"

