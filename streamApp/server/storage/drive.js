// Google Drive API для хранения видео записей
import { google } from 'googleapis';
import fs from 'fs/promises';
import { createReadStream, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Переменные окружения для Google Drive API
const GOOGLE_DRIVE_ENABLED = process.env.GOOGLE_DRIVE_ENABLED === 'true';
const GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH || 
  path.join(__dirname, '../../google-service-account.json'); // Путь к JSON файлу Service Account
// ID папки Google Drive (если указан, используется он; если 'root', создаётся папка с именем GOOGLE_DRIVE_ROOT_FOLDER_NAME)
const GOOGLE_DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '16DE2JsZUMjRzupy2m-sDUZHGPXW9bCrx'; // ID корневой папки в Drive
const GOOGLE_DRIVE_ROOT_FOLDER_NAME = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'LiveKitRecordings'; // Имя корневой папки
// Email пользователя для Domain-wide delegation (Service Account будет действовать от его имени)
const GOOGLE_DRIVE_USER_EMAIL = process.env.GOOGLE_DRIVE_USER_EMAIL; // Например: 'user@example.com'

// Поддержка старого OAuth 2.0 (если используется)
const GOOGLE_DRIVE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const GOOGLE_DRIVE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const GOOGLE_DRIVE_REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

let authClient = null;
let drive = null;

// Инициализация Google Drive API (Service Account или OAuth 2.0)
function initDrive() {
  if (!GOOGLE_DRIVE_ENABLED) {
    console.log('☁️  Google Drive отключен (GOOGLE_DRIVE_ENABLED=false)');
    return false;
  }

  try {
    // Приоритет: Service Account с Domain-wide delegation
    if (existsSync(GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH)) {
      console.log(`📄 Используется Service Account: ${GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH}`);
      
      const serviceAccount = JSON.parse(readFileSync(GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH, 'utf8'));
      
      // Если указан email пользователя, используем Domain-wide delegation
      if (GOOGLE_DRIVE_USER_EMAIL) {
        console.log(`👤 Domain-wide delegation: действие от имени ${GOOGLE_DRIVE_USER_EMAIL}`);
        authClient = new google.auth.JWT({
          email: serviceAccount.client_email,
          key: serviceAccount.private_key,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
          subject: GOOGLE_DRIVE_USER_EMAIL // Делегирование от имени пользователя
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
    if (GOOGLE_DRIVE_CLIENT_ID && GOOGLE_DRIVE_CLIENT_SECRET && GOOGLE_DRIVE_REFRESH_TOKEN) {
      console.log('📄 Используется OAuth 2.0');
      
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_DRIVE_CLIENT_ID,
        GOOGLE_DRIVE_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      oauth2Client.setCredentials({
        refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN
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

// Получить или создать структуру папок: комната/username/дата
async function ensureFolderStructure(roomName, username, dateFolder) {
  // Получаем или создаём корневую папку для записей
  let rootFolderId = GOOGLE_DRIVE_ROOT_FOLDER_ID;
  
  // Если ID указан (не 'root'), используем его напрямую
  if (GOOGLE_DRIVE_ROOT_FOLDER_ID === 'root') {
    // Если используется root, создаём папку LiveKitRecordings
    rootFolderId = await getOrCreateFolder('root', GOOGLE_DRIVE_ROOT_FOLDER_NAME);
  } else {
    // Используем указанный ID папки напрямую
    console.log(`📁 Используется папка Google Drive с ID: ${rootFolderId}`);
  }

  // Создаём структуру: комната/username/дата
  const roomFolderId = await getOrCreateFolder(rootFolderId, roomName || 'unknown');
  const userFolderId = await getOrCreateFolder(roomFolderId, username || 'unknown');
  const dateFolderId = await getOrCreateFolder(userFolderId, dateFolder);

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

// Инициализируем при импорте модуля
const isInitialized = initDrive();

export {
  uploadFileToDrive,
  ensureFolderStructure,
  GOOGLE_DRIVE_ENABLED,
  isInitialized
};

