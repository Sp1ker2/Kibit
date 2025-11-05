#!/bin/bash

# Скрипт для отправки базы данных на сервер
SERVER="195.133.17.131"
PORT="16205"
USER="th3dw0l9"
PASS="a8188437"
PROJECT_DIR="/www/wwwroot/LiveKit"

echo "🚀 Отправка базы данных на сервер $SERVER:$PORT..."

# Проверяем, что база данных существует локально
if [ ! -f "streamApp/database.db" ]; then
    echo "❌ База данных не найдена: streamApp/database.db"
    exit 1
fi

# Копируем базу данных на сервер
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P $PORT \
    streamApp/database.db $USER@$SERVER:$PROJECT_DIR/streamApp/database.db

if [ $? -eq 0 ]; then
    echo "✅ База данных успешно скопирована на сервер"
    
    # Выполняем команды на сервере для обновления роли
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p $PORT $USER@$SERVER << 'REMOTE_SCRIPT'
cd /www/wwwroot/LiveKit/streamApp

# Обновляем базу данных на сервере
python3 << 'PYTHON_SCRIPT'
import sqlite3
import sys

try:
    db = sqlite3.connect('database.db')
    cursor = db.cursor()
    
    # Проверяем структуру таблицы
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    column_names = [col[1] for col in columns]
    
    # Добавляем колонку role если её нет
    if 'role' not in column_names:
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
        print("✅ Колонка role добавлена")
    
    # Убеждаемся, что Admin имеет роль admin
    cursor.execute("UPDATE users SET role = ? WHERE username = ?", ('admin', 'Admin'))
    
    # Проверяем, существует ли пользователь b
    cursor.execute("SELECT * FROM users WHERE username = ?", ('b',))
    user = cursor.fetchone()
    
    if user:
        # Обновляем существующего пользователя
        cursor.execute("UPDATE users SET password = ?, role = ? WHERE username = ?", ('b', 'admin', 'b'))
        print("✅ Пользователь b обновлен: пароль = b, роль = admin")
    else:
        # Создаем нового пользователя
        cursor.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ('b', 'b', 'admin'))
        print("✅ Пользователь b создан: пароль = b, роль = admin")
    
    # Проверяем результат
    cursor.execute("SELECT id, username, password, role FROM users WHERE role = ?", ('admin',))
    admins = cursor.fetchall()
    
    print("\n✅ Все пользователи с ролью admin на сервере:")
    for admin in admins:
        print(f"   id={admin[0]}, username={admin[1]}, password={admin[2]}, role={admin[3]}")
    
    db.commit()
    db.close()
    
    print("\n✅ База данных на сервере обновлена!")
except Exception as e:
    print(f"❌ Ошибка: {e}")
    sys.exit(1)
PYTHON_SCRIPT

REMOTE_SCRIPT

    echo ""
    echo "✅ Все готово! База данных обновлена на сервере."
else
    echo "❌ Ошибка при копировании базы данных"
    exit 1
fi
