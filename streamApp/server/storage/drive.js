// Google Drive API для хранения видео записей
import { google } from 'googleapis';
import fs from 'fs/promises';
import { createReadStream, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Функция для получения переменных окружения (вызывается при каждом обращении)
function getEnvVar(name, defaultValue = undefined) {
  return process.env[name] || defaultValue;
}

// Переменные окружения для Google Drive API (используем функции для динамического получения)
const getGOOGLE_DRIVE_ENABLED = () => getEnvVar('GOOGLE_DRIVE_ENABLED') === 'true';
const getGOOGLE_DRIVE_SERVICE_ACCOUNT_PATH = () => getEnvVar('GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH') || 
  path.join(__dirname, '../../google-service-account.json');
const getGOOGLE_DRIVE_ROOT_FOLDER_ID = () => getEnvVar('GOOGLE_DRIVE_ROOT_FOLDER_ID', '16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx');
const getGOOGLE_DRIVE_ROOT_FOLDER_NAME = () => getEnvVar('GOOGLE_DRIVE_ROOT_FOLDER_NAME', 'LiveKitRecordings');
const getGOOGLE_DRIVE_USER_EMAIL = () => getEnvVar('GOOGLE_DRIVE_USER_EMAIL');
const getGOOGLE_DRIVE_CLIENT_ID = () => getEnvVar('GOOGLE_DRIVE_CLIENT_ID');
const getGOOGLE_DRIVE_CLIENT_SECRET = () => getEnvVar('GOOGLE_DRIVE_CLIENT_SECRET');
const getGOOGLE_DRIVE_REFRESH_TOKEN = () => getEnvVar('GOOGLE_DRIVE_REFRESH_TOKEN');

// Для совместимости экспортируем значения (обновляются динамически)
const GOOGLE_DRIVE_ENABLED = getGOOGLE_DRIVE_ENABLED();
const GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH = getGOOGLE_DRIVE_SERVICE_ACCOUNT_PATH();
const GOOGLE_DRIVE_ROOT_FOLDER_ID = getGOOGLE_DRIVE_ROOT_FOLDER_ID();
const GOOGLE_DRIVE_ROOT_FOLDER_NAME = getGOOGLE_DRIVE_ROOT_FOLDER_NAME();
const GOOGLE_DRIVE_USER_EMAIL = getGOOGLE_DRIVE_USER_EMAIL();
const GOOGLE_DRIVE_CLIENT_ID = getGOOGLE_DRIVE_CLIENT_ID();
const GOOGLE_DRIVE_CLIENT_SECRET = getGOOGLE_DRIVE_CLIENT_SECRET();
const GOOGLE_DRIVE_REFRESH_TOKEN = getGOOGLE_DRIVE_REFRESH_TOKEN();

// Диагностика: логируем состояние переменных окружения
console.log('🔍 Google Drive Configuration:');
console.log(`   GOOGLE_DRIVE_ENABLED: ${process.env.GOOGLE_DRIVE_ENABLED || 'НЕ ВСТАНОВЛЕНО'} (результат: ${GOOGLE_DRIVE_ENABLED})`);
console.log(`   GOOGLE_DRIVE_CLIENT_ID: ${GOOGLE_DRIVE_CLIENT_ID ? 'ВСТАНОВЛЕНО' : 'НЕ ВСТАНОВЛЕНО'}`);
console.log(`   GOOGLE_DRIVE_CLIENT_SECRET: ${GOOGLE_DRIVE_CLIENT_SECRET ? 'ВСТАНОВЛЕНО' : 'НЕ ВСТАНОВЛЕНО'}`);
console.log(`   GOOGLE_DRIVE_REFRESH_TOKEN: ${GOOGLE_DRIVE_REFRESH_TOKEN ? 'ВСТАНОВЛЕНО' : 'НЕ ВСТАНОВЛЕНО'}`);
console.log(`   GOOGLE_DRIVE_ROOT_FOLDER_ID: ${GOOGLE_DRIVE_ROOT_FOLDER_ID}`);

let authClient = null;
let drive = null;

// Инициализация Google Drive API (Service Account или OAuth 2.0)
function initDrive() {
  // Читаем переменные динамически при каждом вызове
  const enabled = getGOOGLE_DRIVE_ENABLED();
  const serviceAccountPath = getGOOGLE_DRIVE_SERVICE_ACCOUNT_PATH();
  const rootFolderId = getGOOGLE_DRIVE_ROOT_FOLDER_ID();
  const rootFolderName = getGOOGLE_DRIVE_ROOT_FOLDER_NAME();
  const userEmail = getGOOGLE_DRIVE_USER_EMAIL();
  const clientId = getGOOGLE_DRIVE_CLIENT_ID();
  const clientSecret = getGOOGLE_DRIVE_CLIENT_SECRET();
  const refreshToken = getGOOGLE_DRIVE_REFRESH_TOKEN();
  
  if (!enabled) {
    console.log('☁️  Google Drive отключен (GOOGLE_DRIVE_ENABLED=false)');
    console.log('   💡 Для включения установите: GOOGLE_DRIVE_ENABLED=true');
    console.log('   💡 И проверьте, что переменные CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN установлены');
    return false;
  }

  try {
    // Приоритет: Service Account с Domain-wide delegation
    if (existsSync(serviceAccountPath)) {
      console.log(`📄 Используется Service Account: ${serviceAccountPath}`);
      
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      
      // Если указан email пользователя, используем Domain-wide delegation
      if (userEmail) {
        console.log(`👤 Domain-wide delegation: действие от имени ${userEmail}`);
        authClient = new google.auth.JWT({
          email: serviceAccount.client_email,
          key: serviceAccount.private_key,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
          subject: userEmail // Делегирование от имени пользователя
        });
      } else {
        // Обычный Service Account (требует Shared Drive или Domain-wide delegation в настройках)
        authClient = new google.auth.GoogleAuth({
          credentials: serviceAccount,
          scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        console.log('⚠️  Внимание: Service Account без Domain-wide delegation может работать только с Shared Drives');
        console.log('   Установите GOOGLE_DRIVE_USER_EMAIL для Domain-wide delegation');
      }
      
      drive = google.drive({ version: 'v3', auth: authClient });
      console.log('✅ Google Drive API инициализирован через Service Account');
      return true;
    }
    
    // Fallback: OAuth 2.0 (если Service Account не найден)
    if (clientId && clientSecret && refreshToken) {
      console.log('📄 Используется OAuth 2.0');
      
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      authClient = oauth2Client;
      drive = google.drive({ version: 'v3', auth: authClient });
      console.log('✅ Google Drive API инициализирован через OAuth 2.0');
      return true;
    }

    console.error('❌ Google Drive credentials не найдены!');
    console.error('   Используйте один из вариантов:');
    console.error('   1. Service Account: поместите JSON файл в', GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH);
    console.error('   2. OAuth 2.0: установите GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN');
    return false;
  } catch (error) {
    console.error('❌ Ошибка инициализации Google Drive:', error);
    return false;
  }
}

// Получить или создать папку в Google Drive
async function getOrCreateFolder(parentFolderId, folderName) {
  if (!drive) {
    throw new Error('Google Drive не инициализирован');
  }

  try {
    // Ищем папку с таким именем в родительской папке
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files && response.data.files.length > 0) {
      // Папка существует, возвращаем её ID
      return response.data.files[0].id;
    }

    // Папка не существует, создаём её
    const folderResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId !== 'root' ? [parentFolderId] : []
      },
      fields: 'id, name'
    });

    console.log(`📁 Создана папка в Drive: ${folderName} (ID: ${folderResponse.data.id})`);
    return folderResponse.data.id;
  } catch (error) {
    console.error(`❌ Ошибка создания/поиска папки "${folderName}":`, error);
    throw error;
  }
}

// Получить или создать структуру папок: LiveKitRecordings/комната/username/дата
async function ensureFolderStructure(roomName, username, dateFolder) {
  // Получаем переменные динамически при каждом вызове
  const rootFolderIdEnv = getGOOGLE_DRIVE_ROOT_FOLDER_ID();
  const rootFolderName = getGOOGLE_DRIVE_ROOT_FOLDER_NAME();
  
  // Получаем или создаём корневую папку для записей
  let rootFolderId = rootFolderIdEnv;
  
  // Если ID указан (не 'root'), используем его напрямую
  if (rootFolderIdEnv === 'root') {
    // Если используется root, создаём папку LiveKitRecordings
    rootFolderId = await getOrCreateFolder('root', rootFolderName);
  } else {
    // Используем указанный ID папки напрямую (вже LiveKitRecordings)
    console.log(`📁 Используется папка Google Drive с ID: ${rootFolderId}`);
  }

  // Создаём структуру: LiveKitRecordings/комната/username/дата (без папки videos)
  const roomFolderId = await getOrCreateFolder(rootFolderId, roomName || 'unknown');
  const userFolderId = await getOrCreateFolder(roomFolderId, username || 'unknown');
  const dateFolderId = await getOrCreateFolder(userFolderId, dateFolder);

  // Возвращаем ID папки с датой - файлы будут загружаться напрямую туда
  return dateFolderId;
}

// Загрузить файл в Google Drive
async function uploadFileToDrive(filePath, roomName, username, dateFolder, fileName) {
  if (!drive) {
    throw new Error('Google Drive не инициализирован');
  }

  if (!GOOGLE_DRIVE_ENABLED) {
    throw new Error('Google Drive отключен');
  }

  try {
    // Получаем структуру папок
    const folderId = await ensureFolderStructure(roomName, username, dateFolder);
    
    // Получаем размер файла
    const fileStats = await fs.stat(filePath);

    console.log(`☁️  Загрузка файла в Google Drive: ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Загружаем файл в Drive через stream для больших файлов
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: 'video/mp4',
        body: createReadStream(filePath)
      },
      fields: 'id, name, webViewLink, size'
    });

    console.log(`✅ Файл загружен в Drive: ${fileName}`);
    console.log(`   📋 ID: ${response.data.id}`);
    console.log(`   🔗 Ссылка: ${response.data.webViewLink || 'N/A'}`);

    return {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      size: parseInt(response.data.size || fileStats.size),
      folderId: folderId
    };
  } catch (error) {
    console.error('❌ Ошибка загрузки файла в Google Drive:', error);
    throw error;
  }
}

// Получить список папок в родительской папке
async function listFolders(parentFolderId) {
  if (!drive) {
    throw new Error('Google Drive не инициализирован');
  }

  try {
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, createdTime, modifiedTime)',
      spaces: 'drive',
      orderBy: 'name'
    });

    return response.data.files || [];
  } catch (error) {
    console.error(`❌ Ошибка получения списка папок из "${parentFolderId}":`, error);
    throw error;
  }
}

// Получить список файлов в папке
async function listFiles(parentFolderId) {
  if (!drive) {
    throw new Error('Google Drive не инициализирован');
  }

  try {
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: 'files(id, name, size, createdTime, modifiedTime, webViewLink, thumbnailLink)',
      spaces: 'drive',
      orderBy: 'createdTime desc'
    });

    return response.data.files || [];
  } catch (error) {
    console.error(`❌ Ошибка получения списка файлов из "${parentFolderId}":`, error);
    throw error;
  }
}

// Получить прямую ссылку для скачивания файла
async function getDownloadUrl(fileId) {
  if (!drive) {
    throw new Error('Google Drive не инициализирован');
  }

  try {
    // Получаем информацию о файле
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, webViewLink, webContentLink, mimeType'
    });

    // Для видео файлов нужна прямая ссылка для скачивания
    // webContentLink - это прямая ссылка для скачивания, которая работает с video тегом
    // Добавляем параметр alt=media для прямого скачивания
    if (file.data.webContentLink) {
      // webContentLink уже содержит alt=media, можно использовать напрямую
      return file.data.webContentLink;
    } else {
      // Если webContentLink нет, создаем прямую ссылку вручную
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  } catch (error) {
    console.error(`❌ Ошибка получения ссылки на файл "${fileId}":`, error);
    throw error;
  }
}

// Получить информацию о файле по ID
async function getFileInfo(fileId) {
  if (!drive) {
    throw new Error('Google Drive не инициализирован');
  }

  try {
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, size, createdTime, modifiedTime, webViewLink, webContentLink, mimeType'
    });

    return file.data;
  } catch (error) {
    console.error(`❌ Ошибка получения информации о файле "${fileId}":`, error);
    throw error;
  }
}

// Инициализируем при импорте модуля
const isInitialized = initDrive();

export {
  uploadFileToDrive,
  ensureFolderStructure,
  listFolders,
  listFiles,
  getDownloadUrl,
  getFileInfo,
  GOOGLE_DRIVE_ENABLED,
  GOOGLE_DRIVE_ROOT_FOLDER_ID,
  isInitialized,
  drive // Экспортируем drive для прямого доступа если нужно
};

