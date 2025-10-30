// Простой API сервер для LiveKit
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { RoomServiceClient } from 'livekit-server-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
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
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
  console.log('📁 Папка recordings создана');
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, RECORDINGS_DIR);
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

// ===== ЭНДПОИНТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ =====

// Авторизация
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = userDB.authenticate(username, password);
    
    if (user) {
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
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = userDB.createUser(username, password);
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { username, roomName } = req.body;
    const filename = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;

    console.log(`💾 Запись сохранена: ${filename}, размер: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    res.json({
      success: true,
      filename,
      size: fileSize,
      username,
      roomName
    });
  } catch (error) {
    console.error('Ошибка загрузки записи:', error);
    res.status(500).json({ error: 'Failed to save recording' });
  }
});

// Получить список записей
app.get('/api/recordings', async (req, res) => {
  try {
    const files = await fs.readdir(RECORDINGS_DIR);
    
    const recordings = await Promise.all(
      files
        .filter(file => file.endsWith('.webm'))
        .map(async (file) => {
          const filePath = join(RECORDINGS_DIR, file);
          const stats = await fs.stat(filePath);
          
          // Извлекаем username из имени файла (username_timestamp.webm)
          const [username] = file.split('_');
          const timestamp = parseInt(file.split('_')[1]?.replace('.webm', '') || '0');
          
          return {
            id: file,
            filename: file,
            username: username || 'Unknown',
            size: stats.size,
            duration: 0, // Можно добавить реальную длительность
            date: stats.mtime.toISOString(),
            timestamp
          };
        })
    );

    // Сортируем по дате (новые сверху)
    recordings.sort((a, b) => b.timestamp - a.timestamp);

    res.json(recordings);
  } catch (error) {
    console.error('Ошибка получения записей:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// Стримить запись (поддержка Range для мотания)
app.get('/api/recordings/stream/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = join(RECORDINGS_DIR, filename);

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
app.get('/api/recordings/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = join(RECORDINGS_DIR, filename);

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

