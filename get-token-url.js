// Генерация URL для авторизации
const CLIENT_ID = '715131105158-e1uli3fbrasoib5pb0vge8805u90no0d.apps.googleusercontent.com';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const params = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPES,
  access_type: 'offline',
  prompt: 'consent'
});

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

console.log('');
console.log('='.repeat(70));
console.log('📋 ОТКРОЙ ЭТОТ URL В БРАУЗЕРЕ:');
console.log('='.repeat(70));
console.log('');
console.log(authUrl);
console.log('');
console.log('='.repeat(70));
console.log('');
console.log('💡 После авторизации скопируй код и отправь мне!');
console.log('');
