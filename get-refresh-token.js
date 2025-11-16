#!/usr/bin/env node
/**
 * Скрипт для получения OAuth 2.0 Refresh Token для Google Drive
 * Запусти на своем компьютере (не на сервере)
 */

import { google } from 'googleapis';
import readline from 'readline';

// ⚠️ ВАЖНО: Замените на свои значения из Google Cloud Console
// Получите их здесь: https://console.cloud.google.com/apis/credentials
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // For desktop apps
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Force consent screen to get refresh token
});

console.log('');
console.log('='.repeat(70));
console.log('📋 ОТКРОЙ ЭТОТ URL В БРАУЗЕРЕ:');
console.log('='.repeat(70));
console.log('');
console.log(authUrl);
console.log('');
console.log('='.repeat(70));
console.log('');
console.log('💡 Инструкции:');
console.log('1. Скопируй URL выше');
console.log('2. Открой его в браузере');
console.log('3. Авторизуйся через spotifysosichlen@gmail.com');
console.log('4. Скопируй код авторизации из браузера');
console.log('5. Вставь код ниже и нажми Enter');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('📥 Вставь код авторизации: ', async (code) => {
  try {
    console.log('');
    console.log('⏳ Получаю токены...');
    const { tokens } = await oauth2Client.getToken(code.trim());
    
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ УСПЕШНО! Refresh Token получен:');
    console.log('='.repeat(70));
    console.log('');
    console.log(tokens.refresh_token);
    console.log('');
    console.log('='.repeat(70));
    console.log('');
    console.log('💡 Скопируй этот refresh token и отправь мне!');
    console.log('   Или выполни на сервере:');
    console.log('');
    console.log('   export GOOGLE_DRIVE_REFRESH_TOKEN="' + tokens.refresh_token + '"');
    console.log('');
    
    rl.close();
  } catch (error) {
    console.error('');
    console.error('❌ Ошибка получения токена:', error.message);
    if (error.message.includes('invalid_grant')) {
      console.error('💡 Возможно, код уже использован. Попробуй снова с новым URL.');
    }
    rl.close();
    process.exit(1);
  }
});


