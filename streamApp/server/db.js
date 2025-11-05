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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Инициализируем базу с начальными пользователями (Admin и User)
const initUsers = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
  
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    insert.run('Admin', 'Admin');
    insert.run('User', 'User');
    console.log('✅ Начальные пользователи созданы: Admin, User');
  }
};

initUsers();

// API для работы с пользователями
export const userDB = {
  // Получить всех пользователей
  getAllUsers() {
    return db.prepare('SELECT id, username, password, role, created_at FROM users ORDER BY id ASC').all();
  },

  // Найти пользователя по логину
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  // Создать пользователя
  createUser(username, password, role = 'user') {
    try {
      const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, role);
      return { id: result.lastInsertRowid, username, password, role };
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
      return { id: user.id, username: user.username, role };
    }
    return null;
  }
};

export default db;

