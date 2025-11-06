// База данных SQLite для пользователей
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../database.db');
const db = new Database(dbPath);

// Создаем таблицу пользователей
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    room_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Миграция: добавляем поле room_name если его нет (для старых БД)
try {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasRoomName = columns.some(col => col.name === 'room_name');
  
  if (!hasRoomName) {
    console.log('🔄 Миграция БД: добавляем поле room_name...');
    db.exec('ALTER TABLE users ADD COLUMN room_name TEXT');
    console.log('✅ Миграция завершена!');
  }
} catch (err) {
  console.warn('⚠️ Миграция не требуется или уже выполнена:', err.message);
}

// Создаем таблицу комнат
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Инициализируем базу с начальными пользователями
const initUsers = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
  
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO users (username, password, role, room_name) VALUES (?, ?, ?, ?)');
    // Админ в комнате admin
    insert.run('admin', 'admin', 'admin', 'admin');
    // Обычные пользователи в комнате vinissa
    insert.run('test_1', 'test_1', 'user', 'vinissa');
    insert.run('test_2', 'test_2', 'user', 'vinissa');
    console.log('✅ Начальные пользователи созданы:');
    console.log('   📍 admin/admin (комната: admin, роль: admin)');
    console.log('   📍 test_1/test_1 (комната: vinissa, роль: user)');
    console.log('   📍 test_2/test_2 (комната: vinissa, роль: user)');
  }
};

// Инициализируем базу с начальными комнатами
const initRooms = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO rooms (name, description) VALUES (?, ?)');
    insert.run('admin', 'Комната администраторов - автоматические права админа');
    insert.run('Azov_1', 'Организация Azov 1');
    insert.run('Azov_2', 'Организация Azov 2');
    insert.run('Berd_1', 'Организация Berd 1');
    insert.run('Berd_2', 'Организация Berd 2');
    insert.run('Borci', 'Организация Borci');
    insert.run('vinissa', 'Организация Vinissa');
    insert.run('vinissa_2', 'Организация Vinissa 2');
    insert.run('Gazon', 'Организация Gazon');
    insert.run('ZP', 'Организация ZP');
    insert.run('Kiev', 'Организация Kiev');
    insert.run('Tokyo', 'Организация Tokyo');
    console.log('✅ Комнаты созданы: admin, Azov_1, Azov_2, Berd_1, Berd_2, Borci, vinissa, vinissa_2, Gazon, ZP, Kiev, Tokyo');
  }
};

initUsers();
initRooms();

// API для работы с пользователями
export const userDB = {
  // Получить всех пользователей
  getAllUsers() {
    return db.prepare('SELECT id, username, password, role, room_name, created_at FROM users ORDER BY id ASC').all();
  },

  // Найти пользователя по логину
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  // Создать пользователя
  createUser(username, password, role = 'user', roomName = null) {
    try {
      const result = db.prepare('INSERT INTO users (username, password, role, room_name) VALUES (?, ?, ?, ?)').run(username, password, role, roomName);
      return { id: result.lastInsertRowid, username, password, role, room_name: roomName };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('Пользователь с таким логином уже существует');
      }
      throw err;
    }
  },

  // Обновить пользователя
  updateUser(id, username, password) {
    try {
      db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run(username, password, id);
      return { id, username, password };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('Пользователь с таким логином уже существует');
      }
      throw err;
    }
  },

  // Удалить пользователя
  deleteUser(id) {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // Аутентификация
  authenticate(username, password) {
    const user = this.findByUsername(username);
    if (user && user.password === password) {
      // Возвращаем роль напрямую из БД, если не установлена - по умолчанию "user"
      const role = user.role || 'user';
      return { id: user.id, username: user.username, role, room_name: user.room_name };
    }
    return null;
  },

  // Обновить комнату пользователя
  updateUserRoom(username, roomName) {
    db.prepare('UPDATE users SET room_name = ? WHERE username = ?').run(roomName, username);
    return { username, room_name: roomName };
  },

  // Получить все комнаты
  getAllRooms() {
    return db.prepare('SELECT id, name, description FROM rooms ORDER BY id ASC').all();
  },

  // Создать комнату
  createRoom(name, description = '') {
    try {
      const result = db.prepare('INSERT INTO rooms (name, description) VALUES (?, ?)').run(name, description);
      return { id: result.lastInsertRowid, name, description };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('Комната с таким названием уже существует');
      }
      throw err;
    }
  },

  // Обновить комнату
  updateRoom(id, name, description) {
    try {
      db.prepare('UPDATE rooms SET name = ?, description = ? WHERE id = ?').run(name, description, id);
      return { id, name, description };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('Комната с таким названием уже существует');
      }
      throw err;
    }
  },

  // Удалить комнату
  deleteRoom(id) {
    const result = db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

export default db;

