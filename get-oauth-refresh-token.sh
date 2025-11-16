#!/bin/bash
# Скрипт для получения OAuth 2.0 Refresh Token для Google Drive

echo "🔐 Получение OAuth 2.0 Refresh Token для Google Drive"
echo ""
echo "📋 ШАГ 1: Создайте OAuth 2.0 Client ID в Google Cloud Console"
echo "   1. Перейдите: https://console.cloud.google.com/apis/credentials"
echo "   2. Выберите проект: Stream"
echo "   3. Нажмите 'Create Credentials' → 'OAuth client ID'"
echo "   4. Application type: 'Desktop app'"
echo "   5. Name: 'StreamApp OAuth'"
echo "   6. Нажмите 'Create'"
echo "   7. Скопируйте Client ID и Client Secret"
echo ""
read -p "📝 Введите Client ID: " CLIENT_ID
read -p "📝 Введите Client Secret: " CLIENT_SECRET

echo ""
echo "🔗 Генерирую URL для авторизации..."
echo ""

# Создаем временный скрипт для генерации URL
cat > /tmp/oauth-url.js << EOF
const CLIENT_ID = '${CLIENT_ID}';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const authUrl = \`https://accounts.google.com/o/oauth2/v2/auth?client_id=\${CLIENT_ID}&redirect_uri=\${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=\${encodeURIComponent(SCOPE)}&access_type=offline&prompt=consent\`;

console.log('🔗 Перейдите по этой ссылке:');
console.log('');
console.log(authUrl);
console.log('');
console.log('📋 После авторизации вы получите код. Вставьте его ниже.');
EOF

node /tmp/oauth-url.js

echo ""
read -p "📝 Введите код из браузера: " AUTH_CODE

# Создаем скрипт для получения refresh token
cat > /tmp/get-token.js << EOF
const https = require('https');
const querystring = require('querystring');

const CLIENT_ID = '${CLIENT_ID}';
const CLIENT_SECRET = '${CLIENT_SECRET}';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const AUTH_CODE = '${AUTH_CODE}';

const postData = querystring.stringify({
  code: AUTH_CODE,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  redirect_uri: REDIRECT_URI,
  grant_type: 'authorization_code'
});

const options = {
  hostname: 'oauth2.googleapis.com',
  port: 443,
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': postData.length
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const token = JSON.parse(data);
      if (token.refresh_token) {
        console.log('');
        console.log('✅ Refresh Token получен!');
        console.log('');
        console.log('📋 Добавьте эти переменные в systemd:');
        console.log('');
        console.log('GOOGLE_DRIVE_CLIENT_ID=' + CLIENT_ID);
        console.log('GOOGLE_DRIVE_CLIENT_SECRET=' + CLIENT_SECRET);
        console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + token.refresh_token);
        console.log('');
      } else {
        console.error('❌ Ошибка: Refresh token не получен');
        console.error('Ответ:', data);
      }
    } catch (e) {
      console.error('❌ Ошибка парсинга ответа:', e);
      console.error('Ответ:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Ошибка запроса:', e);
});

req.write(postData);
req.end();
EOF

echo ""
echo "🔄 Получаю Refresh Token..."
node /tmp/get-token.js

# Очистка
rm -f /tmp/oauth-url.js /tmp/get-token.js

