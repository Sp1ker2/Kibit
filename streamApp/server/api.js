// Простой API сервер для LiveKit
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { RoomServiceClient } from 'livekit-server-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { userDB } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Настройка multer для загрузки файлов с организацией по папкам: комната/username/дата
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Получаем данные из запроса
    const username = req.body.username || 'unknown';
    const roomName = req.body.roomName || 'unknown';
    
    // Получаем текущую дату в формате YYYY-MM-DD
    const now = new Date();
    const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Создаем путь: recordings/комната/username/YYYY-MM-DD
    const roomDir = join(RECORDINGS_DIR, roomName);
    const userDir = join(roomDir, username);
    const dateDir = join(userDir, dateFolder);
    
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
    
    cb(null, dateDir);
  },
  filename: function (req, file, cb) {
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

// ===== ЭНДПОИНТЫ ДЛЯ КОМНАТ (СПИСОК) =====

// Получить все комнаты из БД
app.get('/api/room-list', (req, res) => {
  try {
    const rooms = userDB.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Ошибка получения комнат:', error);
    res.status(500).json({ error: 'Ошибка получения комнат' });
  }
});

// Создать комнату
app.post('/api/room-list', (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Введите название комнаты' });
    }

    const room = userDB.createRoom(name, description);
    res.json(room);
  } catch (error) {
    console.error('Ошибка создания комнаты:', error);
    res.status(400).json({ error: error.message });
  }
});

// Обновить комнату
app.put('/api/room-list/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Введите название комнаты' });
    }

    const result = userDB.updateRoom(parseInt(id), name, description);
    res.json(result);
  } catch (error) {
    console.error('Ошибка обновления комнаты:', error);
    res.status(400).json({ error: error.message });
  }
});

// Удалить комнату
app.delete('/api/room-list/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = userDB.deleteRoom(parseInt(id));
    
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
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password, room } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = userDB.authenticate(username, password);
    
    if (user) {
      // Сохраняем выбранную комнату для пользователя
      if (room) {
        userDB.updateUserRoom(username, room);
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
app.get('/api/users', (req, res) => {
  try {
    const users = userDB.getAllUsers();
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
app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = userDB.updateUser(parseInt(id), username, password);
    res.json(user);
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    res.status(400).json({ error: error.message });
  }
});

// Удалить пользователя
app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = userDB.deleteUser(parseInt(id));
    
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
  try {
    console.log('📥 Получен запрос на загрузку записи');
    console.log('📋 Body:', req.body);
    console.log('📁 File:', req.file ? `${req.file.filename} (${req.file.size} bytes)` : 'NO FILE');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { username, roomName, timestamp } = req.body;
    const filename = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;

    console.log(`💾 Запись сохранена: ${filename}`);
    console.log(`   👤 Username: ${username || 'НЕ УКАЗАН'}`);
    console.log(`   📍 Комната: ${roomName || 'НЕ УКАЗАНА'}`);
    console.log(`   📂 Путь: ${filePath}`);
    console.log(`   📊 Размер: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    res.json({
      success: true,
      filename,
      size: fileSize,
      username: username || 'unknown',
      roomName: roomName || 'unknown'
    });
  } catch (error) {
    console.error('Ошибка загрузки записи:', error);
    res.status(500).json({ error: 'Failed to save recording' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API сервер запущен на http://0.0.0.0:${PORT}`);
  console.log(`📡 LiveKit: ${livekitHost}`);
  console.log(`📁 Записи: ${RECORDINGS_DIR}`);
});

