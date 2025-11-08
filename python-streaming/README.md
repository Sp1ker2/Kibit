# Python Streaming Toolkit

Этот каталог содержит:

- `PythonRecorderApp/simple_recorder.py` — Tkinter клиент захвата экрана, отправляющий JPEG кадры на HTTPS/WebSocket сервер.
- `PythonRecorderApp/simple_requirements.txt` — зависимости Python клиента.
- `simple-stream-server/` — Node.js сервер (Express + ws) для ретрансляции потоков, статические страницы просмотра и админка.

## Запуск сервера
```bash
cd simple-stream-server
npm install
node server.js
```

## Запуск Python клиента
```bash
python -m venv .venv
source .venv/bin/activate  # или .venv\Scripts\activate
pip install -r PythonRecorderApp/simple_requirements.txt
python PythonRecorderApp/simple_recorder.py
```

После подключения стримеров открыть `https://<хост>:8443` для списка комнат или `https://<хост>:8443/admin.html` для админ-панели.
