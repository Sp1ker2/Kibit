// База данных PostgreSQL для пользователей
import pkg from 'pg';
const { Pool } = pkg;

// Конфигурация подключения к PostgreSQL на Server1
const pool = new Pool({
  host: '195.133.17.131',  // Server1 - мастер БД
  port: 5432,
  database: 'livekit_stream',
  user: 'livekit_user',
  password: 'LiveKit2024SecurePass',
  max: 20,  // Максимум 20 одновременных подключений
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Проверка подключения
pool.on('connect', () => {
  console.log('✅ Подключено к PostgreSQL на Server1');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка PostgreSQL:', err);
});

// Инициализация таблиц и данных
const initDatabase = async () => {
  try {
    // Создаём таблицы если их нет
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        room_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаём индексы
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_room ON users(room_name)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name)
    `);

    console.log('✅ Таблицы PostgreSQL созданы');

    // Инициализируем комнаты
    const roomCount = await pool.query('SELECT COUNT(*) as count FROM rooms');
    if (roomCount.rows[0].count === 0) {
      const rooms = [
        ['admin', 'Комната администраторов - автоматические права админа'],
        ['vinissa', 'Организация Vinissa'],
        ['Azov_1', 'Организация Azov 1'],
        ['Azov_2', 'Организация Azov 2'],
        ['Berd_1', 'Организация Berd 1'],
        ['Berd_2', 'Организация Berd 2'],
        ['Borci', 'Организация Borci'],
        ['vinissa_2', 'Организация Vinissa 2'],
        ['Gazon', 'Организация Gazon'],
        ['ZP', 'Организация ZP'],
        ['Kiev', 'Организация Kiev'],
        ['Tokyo', 'Организация Tokyo']
      ];

      for (const [name, desc] of rooms) {
        await pool.query(
          'INSERT INTO rooms (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
          [name, desc]
        );
      }
      console.log('✅ Комнаты созданы: admin, Azov_1, Azov_2, Berd_1, Berd_2, Borci, vinissa, vinissa_2, Gazon, ZP, Kiev, Tokyo');
    }

    // Инициализируем пользователей
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    if (userCount.rows[0].count === 0) {
      const users = [
        ['admin', 'admin', 'admin', 'admin'],
        ['test_1', 'test_1', 'user', 'vinissa'],
        ['test_2', 'test_2', 'user', 'vinissa']
      ];

      for (const [username, password, role, room] of users) {
        await pool.query(
          'INSERT INTO users (username, password, role, room_name) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
          [username, password, role, room]
        );
      }
      console.log('✅ Начальные пользователи созданы:');
      console.log('   📍 admin/admin (комната: admin, роль: admin)');
      console.log('   📍 test_1/test_1 (комната: vinissa, роль: user)');
      console.log('   📍 test_2/test_2 (комната: vinissa, роль: user)');
    }
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
  }
};

// Запускаем инициализацию
initDatabase();

// API для работы с пользователями
export const userDB = {
  // Получить всех пользователей
  async getAllUsers() {
    const result = await pool.query(
      'SELECT id, username, password, role, room_name, created_at FROM users ORDER BY id ASC'
    );
    return result.rows;
  },

  // Найти пользователя по логину
  async findByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  },

  // Создать пользователя
  async createUser(username, password, role = 'user', room_name = null) {
    try {
      const result = await pool.query(
        'INSERT INTO users (username, password, role, room_name) VALUES ($1, $2, $3, $4) RETURNING *',
        [username, password, role, room_name]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') { // unique constraint
        throw new Error('Пользователь с таким логином уже существует');
      }
      throw err;
    }
  },

  // Обновить пользователя
  async updateUser(id, username, password, role, room_name) {
    try {
      const result = await pool.query(
        'UPDATE users SET username = $1, password = $2, role = $3, room_name = $4 WHERE id = $5 RETURNING *',
        [username, password, role, room_name, id]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Пользователь с таким логином уже существует');
      }
      throw err;
    }
  },

  // Удалить пользователя
  async deleteUser(id) {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount > 0;
  },

  // Аутентификация
  async authenticate(username, password) {
    const user = await this.findByUsername(username);
    if (user && user.password === password) {
      const role = user.role || 'user';
      return { id: user.id, username: user.username, role, room_name: user.room_name };
    }
    return null;
  },

  // Обновить комнату пользователя
  async updateUserRoom(username, roomName) {
    await pool.query(
      'UPDATE users SET room_name = $1 WHERE username = $2',
      [roomName, username]
    );
    return { username, room_name: roomName };
  },

  // Получить все комнаты
  async getAllRooms() {
    const result = await pool.query(
      'SELECT id, name, description FROM rooms ORDER BY id ASC'
    );
    return result.rows;
  },

  // Создать комнату
  async createRoom(name, description = '') {
    try {
      const result = await pool.query(
        'INSERT INTO rooms (name, description) VALUES ($1, $2) RETURNING *',
        [name, description]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Комната с таким названием уже существует');
      }
      throw err;
    }
  },

  // Обновить комнату
  async updateRoom(id, name, description) {
    try {
      const result = await pool.query(
        'UPDATE rooms SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description, id]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Комната с таким названием уже существует');
      }
      throw err;
    }
  },

  // Удалить комнату
  async deleteRoom(id) {
    const result = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

export default pool;

