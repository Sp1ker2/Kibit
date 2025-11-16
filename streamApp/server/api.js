// Простой API сервер для LiveKit
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { RoomServiceClient } from 'livekit-server-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

// Загружаем переменные окружения из .env файла (если есть)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const dotenv = await import('dotenv');
  const envPath = join(__dirname, '../.env');
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('✅ Переменные окружения загружены из .env файла');
  }
} catch (err) {
  // dotenv не установлен - продолжаем без него
  console.log('ℹ️  dotenv не установлен, используем системные переменные окружения');
}

import { 
  uploadFileToDrive, 
  GOOGLE_DRIVE_ENABLED,
  GOOGLE_DRIVE_ROOT_FOLDER_ID,
  listFolders,
  listFiles,
  getDownloadUrl,
  getFileInfo
} from './storage/drive.js';

// Выбираем БД: PostgreSQL для production, SQLite для dev
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbModule = USE_POSTGRES ? './db-postgres.js' : './db.js';
const { userDB } = await import(dbModule);

console.log(`🗄️ Используется БД: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);

const app = express();
const PORT = 3001;

// LiveKit credentials (из dev режима)
const livekitHost = 'http://localhost:7880';
const apiKey = 'devkey';
const apiSecret = 'secret';

const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);

// Путь к папке recordings
const RECORDINGS_DIR = join(__dirname, '../../recordings');

// Создаем папку recordings если её нет
if (!existsSync(RECORDINGS_DIR)) {
  mkdirSync(RECORDINGS_DIR, { recursive: true });
  console.log('📁 Папка recordings создана');
}

// Настройка multer для загрузки файлов во временную папку (локальный /tmp)
// Это предотвращает зависание при записи больших файлов в NFS
const TEMP_UPLOAD_DIR = '/tmp/streamapp-uploads';
if (!existsSync(TEMP_UPLOAD_DIR)) {
  mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  console.log('📁 Создана временная папка для загрузок:', TEMP_UPLOAD_DIR);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Пишем сначала в локальный /tmp для быстрой записи
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Сохраняем оригинальное имя файла
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Разрешаем запросы со всех IP
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// ===== СТАТИЧЕСКИЕ СТРАНИЦЫ (ДО API РОУТОВ) =====
// Обслуживание статических файлов (HTML страницы)
const PUBLIC_DIR = join(__dirname, '../public');

// Служим logs.html напрямую (до інших роутів, щоб не перехоплювались)
app.get('/logs.html', (req, res) => {
  const filePath = join(PUBLIC_DIR, 'logs.html');
  if (!existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  res.sendFile(filePath);
});

// Редирект /logs на /logs.html
app.get('/logs', (req, res) => {
  res.redirect('/logs.html');
});

// Статические файлы для /public
app.use('/public', express.static(PUBLIC_DIR));

// ===== ЭНДПОИНТЫ ДЛЯ КОМНАТ (СПИСОК) =====

// Получить все комнаты из БД
app.get('/api/room-list', async (req, res) => {
  try {
    const rooms = await userDB.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Ошибка получения комнат:', error);
    res.status(500).json({ error: 'Ошибка получения комнат' });
  }
});

// Создать комнату
app.post('/api/room-list', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Введите название комнаты' });
    }

    const room = await userDB.createRoom(name, description);
    res.json(room);
  } catch (error) {
    console.error('Ошибка создания комнаты:', error);
    res.status(400).json({ error: error.message });
  }
});

// Обновить комнату
app.put('/api/room-list/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Введите название комнаты' });
    }

    const result = await userDB.updateRoom(parseInt(id), name, description);
    res.json(result);
  } catch (error) {
    console.error('Ошибка обновления комнаты:', error);
    res.status(400).json({ error: error.message });
  }
});

// Удалить комнату
app.delete('/api/room-list/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await userDB.deleteRoom(parseInt(id));
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Комната не найдена' });
    }
  } catch (error) {
    console.error('Ошибка удаления комнаты:', error);
    res.status(500).json({ error: 'Ошибка удаления комнаты' });
  }
});

// ===== ЭНДПОИНТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ =====

// Авторизация
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, room } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = await userDB.authenticate(username, password);
    
    if (user) {
      // Сохраняем выбранную комнату для пользователя
      if (room) {
        await userDB.updateUserRoom(username, room);
        user.room_name = room;
        
        // 🔑 ЛОГИКА ПРАВ ДОСТУПА:
        // 1. Если в БД роль "admin" - ВСЕГДА админ (независимо от комнаты)
        // 2. Если в БД роль "user" - проверяем комнату:
        //    - комната "admin" -> даем права админа
        //    - другая комната -> обычный пользователь
        
        if (user.role === 'admin') {
          // Админ из БД всегда остается админом
          console.log(`👑 ${username} - постоянный администратор (комната: ${room})`);
        } else {
          // Для обычных пользователей проверяем комнату
          if (room.toLowerCase() === 'admin') {
            user.role = 'admin';
            console.log(`🔑 Пользователь ${username} получил права админа (комната: ${room})`);
          } else {
            user.role = 'user';
            console.log(`👤 Пользователь ${username} вошел как user (комната: ${room})`);
          }
        }
      }
      
      res.json({ success: true, user });
    } else {
      res.status(401).json({ error: 'Неверный логин или пароль' });
    }
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const users = await userDB.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// Создать пользователя
app.post('/api/users', (req, res) => {
  try {
    const { username, password, role, room } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = userDB.createUser(username, password, role || 'user', room || null);
    console.log(`👤 Создан пользователь: ${username}, комната: ${room || 'не указана'}`);
    res.json(user);
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(400).json({ error: error.message });
  }
});

// Обновить пользователя
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, room_name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = await userDB.updateUser(parseInt(id), username, password, role, room_name);
    res.json(user);
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    res.status(400).json({ error: error.message });
  }
});

// Удалить пользователя
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await userDB.deleteUser(parseInt(id));
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

// ===== ЭНДПОИНТЫ ДЛЯ LIVEKIT =====

// Получить список активных комнат (стримов)
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await roomService.listRooms();
    
    // Обогащаем данные о комнатах РЕАЛЬНЫМ количеством участников
    const roomsWithParticipants = await Promise.all(
      rooms.map(async (room) => {
        try {
          const participants = await roomService.listParticipants(room.name);
          
          // ВАЖНО: исключаем preview-подключения (это НЕ реальные стримеры!)
          const realParticipants = participants.filter(p => 
            !p.identity.startsWith('preview_')
          );
          
          const actualParticipants = realParticipants.length;
          
          return {
            id: room.sid,
            name: room.name,
            numParticipants: actualParticipants, // Реальное кол-во без preview!
            maxParticipants: room.maxParticipants,
            creationTime: Number(room.creationTime), // BigInt -> Number
            participants: realParticipants.map(p => ({
              identity: p.identity,
              name: p.name,
              isSpeaking: p.isSpeaking,
            })),
          };
        } catch (error) {
          console.warn(`Не удалось получить участников комнаты ${room.name}:`, error.message);
          return {
            id: room.sid,
            name: room.name,
            numParticipants: 0, // При ошибке = 0 участников
            maxParticipants: room.maxParticipants,
            creationTime: Number(room.creationTime), // BigInt -> Number
            participants: [],
          };
        }
      })
    );

    res.json(roomsWithParticipants);
  } catch (error) {
    console.error('Ошибка получения комнат:', error);
    
    // Проверяем тип ошибки
    if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'LiveKit сервер не доступен',
        message: 'Запустите LiveKit сервер: livekit-server --dev',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка получения списка комнат',
      message: error.message 
    });
  }
});

// Получить информацию о конкретной комнате
app.get('/api/rooms/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    const participants = await roomService.listParticipants(roomName);
    
    res.json({
      roomName,
      participants: participants.map(p => ({
        identity: p.identity,
        name: p.name,
        sid: p.sid,
        state: p.state,
        tracks: p.tracks,
      })),
    });
  } catch (error) {
    console.error('Ошибка получения комнаты:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Загрузить запись
app.post('/api/recordings/upload', upload.single('video'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    console.log('📥 Получен запрос на загрузку записи');
    console.log('📋 Body:', req.body);
    console.log('📁 File:', req.file ? `${req.file.filename} (${req.file.size} bytes)` : 'NO FILE');
    const isGoogleDriveEnabled = process.env.GOOGLE_DRIVE_ENABLED === 'true';
    console.log(`☁️  Google Drive включен: ${isGoogleDriveEnabled}`);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { username, roomName, timestamp } = req.body;
    const filename = req.file.filename;
    tempFilePath = req.file.path; // Файл во временной папке /tmp
    const fileSize = req.file.size;

    console.log(`💾 Файл получен во временной папке: ${tempFilePath}`);
    console.log(`   👤 Username: ${username || 'НЕ УКАЗАН'}`);
    console.log(`   📍 Комната: ${roomName || 'НЕ УКАЗАНА'}`);
    console.log(`   📊 Размер: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Получаем текущую дату в формате YYYY-MM-DD
    const now = new Date();
    const dateFolder = now.toISOString().split('T')[0];

    let uploadResult = null;
    let finalFilePath = null;

    // Если Google Drive включен, загружаем туда АСИНХРОННО (в фоне)
    // Сначала сохраняем файл локально, затем загружаем в Drive в фоне
    // Это предотвращает timeout от nginx при долгой загрузке в Google Drive
    
    // Подготовка путей для локального сохранения
    const roomDir = join(RECORDINGS_DIR, roomName || 'unknown');
    const userDir = join(roomDir, username || 'unknown');
    const dateDir = join(userDir, dateFolder);
    finalFilePath = join(dateDir, filename);
    
    // Создаем папки если их нет
    if (!existsSync(roomDir)) {
      mkdirSync(roomDir, { recursive: true });
      console.log(`📁 Создана папка комнаты: ${roomName}`);
    }
    if (!existsSync(userDir)) {
      mkdirSync(userDir, { recursive: true });
      console.log(`📁 Создана папка пользователя: ${username}`);
    }
    if (!existsSync(dateDir)) {
      mkdirSync(dateDir, { recursive: true });
      console.log(`📁 Создана папка даты: ${dateFolder}`);
    }
    
    // Переносим файл из /tmp в финальное местоположение (быстро)
    console.log(`🚚 Переносим файл из ${tempFilePath} в ${finalFilePath}...`);
    await fs.rename(tempFilePath, finalFilePath);
    console.log(`✅ Файл успешно сохранен локально: ${finalFilePath}`);
    
    // Отправляем ответ клиенту СРАЗУ (не ждем Google Drive)
    res.json({
      success: true,
      filename,
      size: fileSize,
      username: username || 'unknown',
      roomName: roomName || 'unknown',
      storage: isGoogleDriveEnabled ? 'google_drive_uploading' : 'local',
      message: isGoogleDriveEnabled ? 'Файл сохранен локально, загрузка в Google Drive начата...' : 'Файл сохранен локально'
    });
    
    // Если Google Drive включен, загружаем в фоне (не блокируем ответ)
    if (isGoogleDriveEnabled) {
      // Запускаем загрузку в Google Drive асинхронно (не ждем)
      (async () => {
        try {
          console.log('☁️  Начинаем асинхронную загрузку в Google Drive...');
          const uploadStartTime = Date.now();
          
          uploadResult = await uploadFileToDrive(
            finalFilePath, // Используем уже сохраненный файл
            roomName || 'unknown',
            username || 'unknown',
            dateFolder,
            filename
          );
          
          const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
          console.log(`✅ Загрузка в Google Drive завершена за ${uploadDuration} сек`);
          console.log(`   📋 ID: ${uploadResult.fileId}`);
          console.log(`   🔗 Ссылка: ${uploadResult.webViewLink || 'N/A'}`);
          
          // Удаляем локальный файл после успешной загрузки в Drive
          await fs.unlink(finalFilePath);
          console.log('🗑️  Локальный файл удален после загрузки в Drive');
        } catch (driveError) {
          console.error('❌ Ошибка асинхронной загрузки в Google Drive:', driveError);
          console.error('   Stack:', driveError.stack);
          console.log('⚠️  Файл остается в локальном хранилище');
          // Файл остается локально при ошибке
        }
      })();
      return; // Выходим, ответ уже отправлен
    }
    
    // Если Google Drive отключен, файл уже сохранен локально выше
    // Здесь ничего не делаем, ответ уже отправлен
  } catch (error) {
    console.error('❌ Ошибка загрузки записи:', error);
    
    // Удаляем временный файл если он остался
    if (tempFilePath && existsSync(tempFilePath)) {
      try {
        await fs.unlink(tempFilePath);
        console.log('🗑️  Временный файл удален');
      } catch (unlinkError) {
        console.error('⚠️  Не удалось удалить временный файл:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Failed to save recording', details: error.message });
  }
});

// Получить список записей (поддерживает обе структуры: старую и новую)
app.get('/api/recordings', async (req, res) => {
  try {
    const recordings = [];
    
    // Читаем содержимое папки recordings
    const items = await fs.readdir(RECORDINGS_DIR);
    
    for (const item of items) {
      const itemPath = join(RECORDINGS_DIR, item);
      const itemStat = await fs.stat(itemPath);
      
      // СЛУЧАЙ 1: Это файл в корне (старая структура - архив)
      if (itemStat.isFile() && item.endsWith('.webm')) {
        // Извлекаем username из имени файла (username_timestamp.webm)
        const [username] = item.split('_');
        const timestampMatch = item.match(/_(\d+)\./);
        const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : itemStat.mtimeMs;
        
        recordings.push({
          id: item,
          filename: item,
          path: item, // Файл в корне
          username: username || 'Unknown',
          roomName: 'archive', // Помечаем старые записи как "archive"
          size: itemStat.size,
          duration: 0,
          date: itemStat.mtime.toISOString(),
          dateFolder: itemStat.mtime.toISOString().split('T')[0], // Дата из файла
          timestamp
        });
        continue;
      }
      
      // СЛУЧАЙ 2: Это папка (может быть комната или старая структура username/)
      if (itemStat.isDirectory()) {
        const folderName = item;
        
        // Читаем содержимое папки
        const subItems = await fs.readdir(itemPath);
        
        for (const subItem of subItems) {
          const subItemPath = join(itemPath, subItem);
          
          try {
            const subItemStat = await fs.stat(subItemPath);
            
            if (subItemStat.isDirectory()) {
              // Это папка username или дата
              // Проверяем есть ли внутри папки с датами (значит это структура комната/username/дата)
              const innerItems = await fs.readdir(subItemPath);
              
              for (const innerItem of innerItems) {
                const innerPath = join(subItemPath, innerItem);
                const innerStat = await fs.stat(innerPath);
                
                if (innerStat.isDirectory()) {
                  // Это папка даты: комната/username/дата/
                  const roomName = folderName;
                  const username = subItem;
                  const dateFolder = innerItem;
                  
                  // Читаем файлы
                  const files = await fs.readdir(innerPath);
                  
                  for (const file of files) {
                    if (!file.endsWith('.webm')) continue;
                    
                    const filePath = join(innerPath, file);
                    const stats = await fs.stat(filePath);
                    
                    const timestampMatch = file.match(/_(\d+)_/);
                    const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : stats.mtimeMs;
                    
                    recordings.push({
                      id: `${roomName}/${username}/${dateFolder}/${file}`,
                      filename: file,
                      path: `${roomName}/${username}/${dateFolder}/${file}`,
                      username: username,
                      roomName: roomName, // Добавляем комнату
                      size: stats.size,
                      duration: 0,
                      date: stats.mtime.toISOString(),
                      dateFolder: dateFolder,
                      timestamp
                    });
                  }
                }
              }
            }
          } catch (err) {
            continue;
          }
        }
      }
    }

    // Сортируем по timestamp (новые сверху)
    recordings.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`📹 Найдено записей: ${recordings.length}`);
    res.json(recordings);
  } catch (error) {
    console.error('Ошибка получения записей:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// Стримить запись (поддержка Range для мотания)
// Путь может быть: username/YYYY-MM-DD/filename.webm
app.get('/api/recordings/stream/:path(*)', async (req, res) => {
  try {
    const { path } = req.params;
    const filePath = join(RECORDINGS_DIR, path);

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const stat = await fs.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Парсим Range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/webm',
      });

      const { createReadStream } = await import('fs');
      const stream = createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Без Range - отправляем весь файл
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/webm',
      });

      const { createReadStream } = await import('fs');
      const stream = createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('Ошибка стриминга записи:', error);
    res.status(500).json({ error: 'Failed to stream recording' });
  }
});

// Скачать запись
// Путь может быть: username/YYYY-MM-DD/filename.webm
app.get('/api/recordings/download/:path(*)', (req, res) => {
  try {
    const { path } = req.params;
    const filePath = join(RECORDINGS_DIR, path);

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Ошибка скачивания записи:', error);
    res.status(500).json({ error: 'Failed to download recording' });
  }
});

// ===== ЭНДПОИНТЫ ДЛЯ GOOGLE DRIVE =====

// Получить список комнат (папок в корневой папке)
app.get('/api/drive/rooms', async (req, res) => {
  try {
    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Google Drive не включен' });
    }

    const folders = await listFolders(GOOGLE_DRIVE_ROOT_FOLDER_ID);
    
    const rooms = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      createdTime: folder.createdTime,
      modifiedTime: folder.modifiedTime
    }));

    res.json(rooms);
  } catch (error) {
    console.error('Ошибка получения списка комнат из Google Drive:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить список комнат' });
  }
});

// Получить список пользователей в комнате
app.get('/api/drive/rooms/:roomId/users', async (req, res) => {
  try {
    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Google Drive не включен' });
    }

    const { roomId } = req.params;
    const folders = await listFolders(roomId);
    
    const users = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      createdTime: folder.createdTime,
      modifiedTime: folder.modifiedTime,
      roomId: roomId
    }));

    res.json(users);
  } catch (error) {
    console.error('Ошибка получения списка пользователей из Google Drive:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить список пользователей' });
  }
});

// Получить список дат у пользователя
app.get('/api/drive/users/:userId/dates', async (req, res) => {
  try {
    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Google Drive не включен' });
    }

    const { userId } = req.params;
    const folders = await listFolders(userId);
    
    // Сортируем даты по убыванию (новые сначала)
    const dates = folders
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        createdTime: folder.createdTime,
        modifiedTime: folder.modifiedTime,
        userId: userId
      }))
      .sort((a, b) => b.name.localeCompare(a.name));

    res.json(dates);
  } catch (error) {
    console.error('Ошибка получения списка дат из Google Drive:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить список дат' });
  }
});

// Получить список видео в дате
app.get('/api/drive/dates/:dateId/videos', async (req, res) => {
  try {
    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Google Drive не включен' });
    }

    const { dateId } = req.params;
    
    // Сначала ищем папку "videos" внутри папки даты
    const folders = await listFolders(dateId);
    const videosFolder = folders.find(f => f.name.toLowerCase() === 'videos');
    
    // Если папка videos найдена, используем её, иначе используем саму папку даты (для обратной совместимости)
    const targetFolderId = videosFolder ? videosFolder.id : dateId;
    
    const files = await listFiles(targetFolderId);
    
    // Фильтруем только видео файлы
    const videos = files
      .filter(file => {
        const mimeType = file.mimeType || '';
        return mimeType.startsWith('video/') || 
               mimeType === 'application/vnd.google-apps.video' ||
               /\.(mp4|webm|avi|mov|mkv)$/i.test(file.name);
      })
      .map(file => ({
        id: file.id,
        name: file.name,
        size: file.size ? parseInt(file.size) : 0,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        thumbnailLink: file.thumbnailLink
      }));

    res.json(videos);
  } catch (error) {
    console.error('Ошибка получения списка видео из Google Drive:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить список видео' });
  }
});

// Получить прямую ссылку для просмотра видео
app.get('/api/drive/files/:fileId/stream', async (req, res) => {
  try {
    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Google Drive не включен' });
    }

    const { fileId } = req.params;
    const fileInfo = await getFileInfo(fileId);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    // Получаем прямую ссылку для скачивания/просмотра
    const downloadUrl = await getDownloadUrl(fileId);
    
    if (!downloadUrl) {
      return res.status(404).json({ error: 'Не удалось получить ссылку на файл' });
    }

    // Возвращаем JSON с прямой ссылкой вместо редиректа
    // Это позволяет video тегу использовать ссылку напрямую
    res.json({ 
      url: downloadUrl,
      webViewLink: fileInfo.webViewLink 
    });
  } catch (error) {
    console.error('Ошибка получения ссылки на видео из Google Drive:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить ссылку на видео' });
  }
});

// Получить информацию о файле
app.get('/api/drive/files/:fileId', async (req, res) => {
  try {
    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Google Drive не включен' });
    }

    const { fileId } = req.params;
    const fileInfo = await getFileInfo(fileId);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    res.json({
      id: fileInfo.id,
      name: fileInfo.name,
      size: fileInfo.size ? parseInt(fileInfo.size) : 0,
      createdTime: fileInfo.createdTime,
      modifiedTime: fileInfo.modifiedTime,
      webViewLink: fileInfo.webViewLink,
      webContentLink: fileInfo.webContentLink,
      mimeType: fileInfo.mimeType
    });
  } catch (error) {
    console.error('Ошибка получения информации о файле из Google Drive:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить информацию о файле' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    googleDrive: process.env.GOOGLE_DRIVE_ENABLED === 'true'
  });
});

// ===== ЭНДПОИНТЫ ДЛЯ ЛОГОВ РЕКОРДЕРА =====

// Получить список активных рекордеров (лог-файлов)
app.get('/api/recorder/logs', async (req, res) => {
  try {
    const os = (await import('os')).default;
    const path = (await import('path')).default;
    const { readdir, stat } = await import('fs/promises');
    
    // Путь к директории с логами (постоянное хранилище)
    // Сначала пробуем ~/.livekit_recorder_logs, потом /tmp/simple_recorder_logs
    const homeDir = os.homedir();
    let logsDir = path.join(homeDir, '.livekit_recorder_logs');
    
    // Если основной путь не существует, пробуем temp
    if (!existsSync(logsDir)) {
      const tmpDir = os.tmpdir();
      logsDir = path.join(tmpDir, 'simple_recorder_logs');
    }
    
    // Проверяем существование директории
    if (!existsSync(logsDir)) {
      return res.json([]);
    }
    
    // Читаем все файлы в директории
    const files = await readdir(logsDir);
    
    // Фильтруем только .log файлы и получаем информацию о них
    const logFiles = await Promise.all(
      files
        .filter(file => file.endsWith('.log'))
        .map(async (file) => {
          const filePath = path.join(logsDir, file);
          const stats = await stat(filePath);
          
          // Парсим имя файла: username_room.log
          const nameWithoutExt = file.replace('.log', '');
          const parts = nameWithoutExt.split('_');
          const username = parts[0] || 'unknown';
          const room = parts.slice(1).join('_') || 'unknown';
          
          return {
            filename: file,
            username,
            room,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            path: filePath
          };
        })
    );
    
    // Сортируем по времени модификации (новые первыми)
    logFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json(logFiles);
  } catch (error) {
    console.error('Ошибка получения списка логов:', error);
    res.status(500).json({ error: 'Ошибка получения списка логов' });
  }
});

// Получить содержимое лог-файла конкретного рекордера
app.get('/api/recorder/logs/:filename', async (req, res) => {
  try {
    const os = (await import('os')).default;
    const path = (await import('path')).default;
    const { readFile, stat } = await import('fs/promises');
    
    const { filename } = req.params;
    
    // Проверяем безопасность имени файла
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Неверное имя файла' });
    }
    
    // Путь к директории с логами (тот же что в списке)
    const homeDir = os.homedir();
    let logsDir = path.join(homeDir, '.livekit_recorder_logs');
    if (!existsSync(logsDir)) {
      const tmpDir = os.tmpdir();
      logsDir = path.join(tmpDir, 'simple_recorder_logs');
    }
    const filePath = path.join(logsDir, filename);
    
    // Проверяем существование файла
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Лог-файл не найден' });
    }
    
    // Получаем информацию о файле
    const stats = await stat(filePath);
    
    // Парсим имя файла
    const nameWithoutExt = filename.replace('.log', '');
    const parts = nameWithoutExt.split('_');
    const username = parts[0] || 'unknown';
    const room = parts.slice(1).join('_') || 'unknown';
    
    // Читаем файл (ограничиваем последними 10000 строками для производительности)
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-10000); // Последние 10000 строк
    
    res.json({
      filename,
      username,
      room,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      lines: lastLines,
      totalLines: lines.length
    });
  } catch (error) {
    console.error('Ошибка чтения лог-файла:', error);
    res.status(500).json({ error: 'Ошибка чтения лог-файла' });
  }
});

// Синхронизация логов с клиента (Python рекордер отправляет логи на сервер)
app.post('/api/recorder/logs/sync', async (req, res) => {
  try {
    const os = (await import('os')).default;
    const path = (await import('path')).default;
    const { appendFile, mkdir } = await import('fs/promises');
    
    const { username, room, logs } = req.body;
    
    if (!username || !room || !logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Неверные данные: нужны username, room, logs (массив)' });
    }
    
    // Путь к директории с логами (тот же что в списке)
    const homeDir = os.homedir();
    let logsDir = path.join(homeDir, '.livekit_recorder_logs');
    
    // Создаем директорию если не существует
    if (!existsSync(logsDir)) {
      try {
        await mkdir(logsDir, { recursive: true });
      } catch (err) {
        const tmpDir = os.tmpdir();
        logsDir = path.join(tmpDir, 'simple_recorder_logs');
        if (!existsSync(logsDir)) {
          await mkdir(logsDir, { recursive: true });
        }
      }
    }
    
    // Имя файла лога
    const filename = `${username}_${room}.log`;
    const filePath = path.join(logsDir, filename);
    
    // Добавляем логи в файл
    const logText = logs.join('\n') + '\n';
    await appendFile(filePath, logText, 'utf-8');
    
    res.json({ success: true, message: `Синхронизировано ${logs.length} записей` });
  } catch (error) {
    console.error('Ошибка синхронизации логов:', error);
    res.status(500).json({ error: 'Ошибка синхронизации логов' });
  }
});

// Удалить лог-файл
app.delete('/api/recorder/logs/:filename', async (req, res) => {
  try {
    const os = (await import('os')).default;
    const path = (await import('path')).default;
    const { unlink } = await import('fs/promises');
    
    const { filename } = req.params;
    
    // Проверяем безопасность имени файла
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Неверное имя файла' });
    }
    
    // Путь к директории с логами (тот же что в списке)
    const homeDir = os.homedir();
    let logsDir = path.join(homeDir, '.livekit_recorder_logs');
    if (!existsSync(logsDir)) {
      const tmpDir = os.tmpdir();
      logsDir = path.join(tmpDir, 'simple_recorder_logs');
    }
    const filePath = path.join(logsDir, filename);
    
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Лог-файл не найден' });
    }
    
    await unlink(filePath);
    
    res.json({ success: true, message: 'Лог-файл удален' });
  } catch (error) {
    console.error('Ошибка удаления лог-файла:', error);
    res.status(500).json({ error: 'Ошибка удаления лог-файла' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API сервер запущен на http://0.0.0.0:${PORT}`);
  console.log(`📡 LiveKit: ${livekitHost}`);
  console.log(`📁 Записи: ${RECORDINGS_DIR}`);
  console.log(`📋 Сторінка логів: http://0.0.0.0:${PORT}/logs.html`);
});

