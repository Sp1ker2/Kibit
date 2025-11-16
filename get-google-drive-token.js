#!/usr/bin/env node
/**
 * Скрипт для получения OAuth 2.0 Refresh Token для Google Drive
 * Использование: node get-google-drive-token.js
 */

import { google } from 'googleapis';
import readline from 'readline';
import { URL } from 'url';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // For desktop apps
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Ошибка: установи переменные окружения:');
  console.error('   export GOOGLE_DRIVE_CLIENT_ID="твой-client-id"');
  console.error('   export GOOGLE_DRIVE_CLIENT_SECRET="твой-client-secret"');
  process.exit(1);
}

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

console.log('📋 Открой этот URL в браузере:');
console.log('');
console.log(authUrl);
console.log('');
console.log('После авторизации скопируй код из браузера и вставь его ниже:');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Вставь код авторизации: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('');
    console.log('✅ Успешно! Вот твои токены:');
    console.log('');
    console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('');
    console.log('💡 Добавь эту переменную в окружение API сервера');
    console.log('');
    
    rl.close();
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error.message);
    rl.close();
    process.exit(1);
  }
});

