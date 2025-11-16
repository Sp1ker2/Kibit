import os
import sys
import math
import json
import time
import base64
import shutil
import threading
import tempfile
import tkinter as tk
from datetime import datetime
from tkinter import ttk, messagebox
from urllib.parse import quote_plus

import cv2
import mss
import numpy as np
import websocket

requests = None
InsecureRequestWarning = None
try:  # optional dependency
    requests = __import__("requests")
    exceptions_mod = __import__("requests.packages.urllib3.exceptions", fromlist=[""])
    InsecureRequestWarning = getattr(exceptions_mod, "InsecureRequestWarning", None)
    if InsecureRequestWarning:
        requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
except Exception:
    requests = None
    InsecureRequestWarning = None

# Google Drive API (optional dependency)
google_drive_available = False
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    google_drive_available = True
except ImportError as e:
    google_drive_available = False
    print(f"⚠️ Google Drive API не встановлено: {e}")
    print("   📦 Встановіть: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")

# Google Drive налаштування (читаємо з оточення; секрети не зберігаємо в коді)
GOOGLE_DRIVE_CLIENT_ID = os.getenv("GOOGLE_DRIVE_CLIENT_ID", "")
GOOGLE_DRIVE_CLIENT_SECRET = os.getenv("GOOGLE_DRIVE_CLIENT_SECRET", "")
GOOGLE_DRIVE_REFRESH_TOKEN = os.getenv("GOOGLE_DRIVE_REFRESH_TOKEN", "")
GOOGLE_DRIVE_ROOT_FOLDER_ID = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "")
GOOGLE_DRIVE_ENABLED = os.getenv("GOOGLE_DRIVE_ENABLED", "false").lower() in ("1", "true", "yes")

if sys.version_info < (3, 8):  # pragma: no cover
    raise RuntimeError("Потрібен Python 3.8+")

FRAME_RATE = 12
JPEG_QUALITY = 80
MAX_WIDTH = 1920
MAX_HEIGHT = 1080


def compose_grid(frames, columns=None):
    if not frames:
        raise ValueError("Немає кадрів")

    if columns is None:
        columns = math.ceil(math.sqrt(len(frames)))

    rows = math.ceil(len(frames) / columns)
    target_height = min(frame.shape[0] for frame in frames)

    resized = []
    for frame in frames:
        if frame.shape[0] != target_height:
            ratio = target_height / frame.shape[0]
            new_width = int(frame.shape[1] * ratio)
            frame = cv2.resize(frame, (new_width, target_height))
        resized.append(frame)

    pad_count = rows * columns - len(resized)
    if pad_count:
        black = np.zeros_like(resized[0])
        resized.extend([black] * pad_count)

    row_frames = []
    for row in range(rows):
        start = row * columns
        end = start + columns
        row_frames.append(cv2.hconcat(resized[start:end]))

    return cv2.vconcat(row_frames)


class Logger:
    """Клас для логування в файл, консоль та на сервер"""
    def __init__(self, log_file_path, api_url=None, username=None, room=None):
        self.log_file_path = log_file_path
        self.log_file = None
        self.api_url = api_url
        self.username = username
        self.room = room
        self.last_sync = 0
        self.log_buffer = []
        
        if log_file_path:
            try:
                # Створюємо директорію якщо не існує
                log_dir = os.path.dirname(log_file_path)
                if log_dir and not os.path.exists(log_dir):
                    os.makedirs(log_dir, exist_ok=True)
                # Відкриваємо файл для додавання
                self.log_file = open(log_file_path, 'a', encoding='utf-8')
            except Exception as e:
                print(f"⚠️ Не вдалося відкрити файл логу: {e}")
                self.log_file = None
    
    def log(self, message):
        """Записує повідомлення в консоль, файл та на сервер"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        
        # Виводимо в консоль
        print(log_message)
        
        # Записуємо в файл
        if self.log_file:
            try:
                self.log_file.write(log_message + "\n")
                self.log_file.flush()  # Примусово записуємо в файл
            except Exception as e:
                print(f"⚠️ Помилка запису в файл логу: {e}")
        
        # Відправляємо на сервер (якщо налаштовано)
        if self.api_url and self.username and self.room and requests:
            try:
                self.log_buffer.append(log_message)
                # Відправляємо на сервер кожні 5 секунд або якщо буфер переповнений
                current_time = time.time()
                if len(self.log_buffer) >= 10 or (current_time - self.last_sync) >= 5:
                    self._sync_to_server()
            except Exception as e:
                # Логуємо помилку (але не блокуючи виконання)
                print(f"⚠️ Помилка додавання до буферу логів: {e}")
    
    def _sync_to_server(self):
        """Відправляє буфер логів на сервер"""
        if not self.log_buffer or not requests:
            return
        
        try:
            # Відправляємо логи на сервер
            log_data = {
                "username": self.username,
                "room": self.room,
                "logs": self.log_buffer.copy()  # Копіюємо щоб не втратити дані
            }
            
            # Використовуємо verify=False для самопідписаних сертифікатів (як і в інших місцях)
            response = requests.post(
                f"{self.api_url}/api/recorder/logs/sync",
                json=log_data,
                verify=False,  # Вимикаємо перевірку SSL (як в upload_video)
                timeout=10  # Збільшуємо таймаут
            )
            
            if response.status_code == 200:
                synced_count = len(self.log_buffer)
                self.log_buffer.clear()
                self.last_sync = time.time()
                print(f"✅ Синхронізовано {synced_count} записів логів на сервер")
            else:
                print(f"⚠️ Помилка синхронізації логів: HTTP {response.status_code}")
                print(f"   Відповідь: {response.text[:200]}")
        except requests.exceptions.Timeout:
            print(f"⚠️ Таймаут синхронізації логів (сервер не відповів за 10 сек)")
        except requests.exceptions.ConnectionError as e:
            print(f"⚠️ Помилка з'єднання при синхронізації логів: {e}")
        except Exception as e:
            # Показуємо помилку для дебагу
            print(f"⚠️ Помилка синхронізації логів: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
    
    def close(self):
        """Закриває файл логу та відправляє останні логи на сервер"""
        # Відправляємо останні логи перед закриттям
        if self.log_buffer:
            self._sync_to_server()
        
        if self.log_file:
            try:
                self.log_file.close()
            except Exception:
                pass


class SimpleRecorder:
    def __init__(self):
        self.server_url = "wss://kibitkostreamappv.pp.ua:8444"  # WebSocket сервер на порту 8444
        # API URL: спочатку пробуємо пряме з'єднання через порт 3001, потім через nginx
        # Для локального використання можна використовувати http://195.133.39.41:3001
        self.api_url = "http://195.133.39.41:3001"  # Пряме з'єднання до API сервера
        self.room = None
        self.username = None
        self.is_recording = False
        self.ws = None
        self.ws_connected = False  # Флаг состояния WebSocket
        self.ws_thread = None
        self.recording_thread = None
        self.screen_vars = []
        self.video_writer = None
        self.video_file_path = None
        self.temp_dir = None
        self.part_number = 1
        self.last_upload_success = True
        self.drive_service = None
        self.google_drive_initialized = False
        self.logger = None  # Логер буде створений після встановлення username і room

        self.root = tk.Tk()
        self.root.title("🎬 Simple Screen Recorder")
        self.root.geometry("440x560")
        self.root.configure(bg="#111827")
        self.root.resizable(False, False)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background="#111827")
        style.configure("Card.TFrame", background="#1f2937", relief="flat")
        style.configure("Title.TLabel", background="#111827", foreground="#e5e7eb",
                        font=("Segoe UI", 18, "bold"))
        style.configure("Label.TLabel", background="#1f2937", foreground="#9ca3af",
                        font=("Segoe UI", 10))
        style.configure("Value.TLabel", background="#1f2937", foreground="#e5e7eb",
                        font=("Segoe UI", 12))
        style.configure("TCombobox", fieldbackground="#1f2937", background="#1f2937",
                        foreground="#e5e7eb")
        style.configure("Card.TButton", background="#2563eb", foreground="#f9fafb",
                        font=("Segoe UI", 11, "bold"), padding=10)
        style.map("Card.TButton",
                  background=[("active", "#1d4ed8")],
                  foreground=[("disabled", "#9ca3af")])

        self.create_login_panel()
        self.screen_frame = None
        self.recording_frame = None

        self.show_panel("login")
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        print(f"🎛️ Якість: FPS {FRAME_RATE}, JPEG {JPEG_QUALITY}, "
              f"макс. {MAX_WIDTH}x{MAX_HEIGHT}")
        
        # Перевіряємо Google Drive
        if GOOGLE_DRIVE_ENABLED:
            if google_drive_available:
                print("☁️ Google Drive API доступний")
            else:
                print("⚠️ Google Drive API не встановлено")
                print("   📦 Встановіть: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
                print("   ⚠️ Завантаження буде на сервер замість Google Drive")
        else:
            print("ℹ️ Google Drive вимкнено (GOOGLE_DRIVE_ENABLED=False)")
        
        # Ініціалізація Google Drive буде виконана пізніше, коли буде username і room

    def create_login_panel(self):
        self.login_frame = ttk.Frame(self.root, style="TFrame")
        card = ttk.Frame(self.login_frame, style="Card.TFrame")
        card.pack(padx=32, pady=48, fill=tk.BOTH, expand=True)

        ttk.Label(card, text="🎬 Вхід у систему", style="Title.TLabel").pack(pady=(10, 18))

        ttk.Label(card, text="Виберіть кімнату", style="Label.TLabel").pack(anchor="w", padx=8, pady=(0, 6))
        rooms_list = [
            "Azov_1", "Azov_2", "Berd_1", "Berd_2", "Borci",
            "vinissa", "vinissa_2", "Gazon", "ZP", "Kiev", "Tokyo", "admin"
        ]
        self.room_var = tk.StringVar(value="Azov_2")
        room_dropdown = ttk.Combobox(card, textvariable=self.room_var, values=rooms_list,
                                     state="readonly", style="TCombobox")
        room_dropdown.pack(fill=tk.X, padx=8, pady=(0, 18))

        ttk.Label(card, text="Ваш нікнейм", style="Label.TLabel").pack(anchor="w", padx=8, pady=(0, 6))
        self.username_entry = ttk.Entry(card, font=("Segoe UI", 11))
        self.username_entry.pack(fill=tk.X, padx=8, pady=(0, 18))
        self.username_entry.insert(0, "Стрімер_1")

        ttk.Button(card, text="Почати стрім →", style="Card.TButton",
                   command=self.do_login).pack(fill=tk.X, padx=8, pady=(6, 0))

        ttk.Label(card, text="* Стрім почнеться після вибору екранів", style="Label.TLabel") \
            .pack(anchor="center", pady=(18, 4))
    
    def _init_google_drive(self):
        """Ініціалізація Google Drive API"""
        if not google_drive_available:
            return False
        
        try:
            # Створюємо credentials з refresh token
            creds = Credentials(
                token=None,
                refresh_token=GOOGLE_DRIVE_REFRESH_TOKEN,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=GOOGLE_DRIVE_CLIENT_ID,
                client_secret=GOOGLE_DRIVE_CLIENT_SECRET,
                scopes=["https://www.googleapis.com/auth/drive.file"]
            )
            
            # Оновлюємо access token
            creds.refresh(Request())
            
            # Створюємо Drive service
            self.drive_service = build("drive", "v3", credentials=creds)
            self.google_drive_initialized = True
            print("✅ Google Drive API ініціалізовано")
            return True
        except Exception as e:
            print(f"❌ Помилка ініціалізації Google Drive: {e}")
            import traceback
            traceback.print_exc()
            self.google_drive_initialized = False
            return False
    
    def _get_or_create_folder(self, parent_folder_id, folder_name):
        """Отримати або створити папку в Google Drive"""
        if not self.google_drive_initialized or not self.drive_service:
            return None
        
        try:
            # Шукаємо папку
            query = f"'{parent_folder_id}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = self.drive_service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)'
            ).execute()
            
            items = results.get('files', [])
            if items:
                return items[0]['id']
            
            # Створюємо папку якщо не знайдено
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id] if parent_folder_id != 'root' else []
            }
            folder = self.drive_service.files().create(
                body=file_metadata,
                fields='id'
            ).execute()
            
            print(f"📁 Створено папку в Drive: {folder_name} (ID: {folder.get('id')})")
            return folder.get('id')
        except Exception as e:
            print(f"❌ Помилка створення/пошуку папки '{folder_name}': {e}")
            return None
    
    def _ensure_folder_structure(self):
        """Створити структуру папок: LiveKitRecordings/комната/username/дата"""
        if not self.google_drive_initialized or not self.drive_service:
            return None
        
        try:
            # Отримуємо поточну дату в форматі YYYY-MM-DD
            date_folder = datetime.now().strftime("%Y-%m-%d")
            
            # Створюємо структуру: LiveKitRecordings/комната/username/дата
            root_folder_id = GOOGLE_DRIVE_ROOT_FOLDER_ID
            room_folder_id = self._get_or_create_folder(root_folder_id, self.room or 'unknown')
            if not room_folder_id:
                return None
            
            user_folder_id = self._get_or_create_folder(room_folder_id, self.username or 'unknown')
            if not user_folder_id:
                return None
            
            date_folder_id = self._get_or_create_folder(user_folder_id, date_folder)
            if not date_folder_id:
                return None
            
            return date_folder_id
        except Exception as e:
            print(f"❌ Помилка створення структури папок: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _upload_to_google_drive(self, file_path):
        """Завантажити файл напряму в Google Drive"""
        if not GOOGLE_DRIVE_ENABLED or not google_drive_available:
            return False
        
        if not self.google_drive_initialized:
            print("⚠️ Google Drive не ініціалізовано, намагаємося ініціалізувати...")
            if not self._init_google_drive():
                return False
        
        try:
            file_size_mb = os.path.getsize(file_path) / 1024 / 1024
            print(f"☁️ Завантаження відео {file_size_mb:.2f} MB в Google Drive...")
            print(f"   📍 Структура: LiveKitRecordings/{self.room or 'unknown'}/{self.username or 'unknown'}/дата/")
            
            # Створюємо структуру папок
            folder_id = self._ensure_folder_structure()
            if not folder_id:
                print("❌ Не вдалося створити структуру папок в Google Drive")
                return False
            
            # Завантажуємо файл
            file_metadata = {
                'name': os.path.basename(file_path),
                'parents': [folder_id]
            }
            
            media = MediaFileUpload(
                file_path,
                mimetype='video/mp4',
                resumable=True
            )
            
            file = self.drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, size'
            ).execute()
            
            print(f"✅ Відео завантажено в Google Drive")
            print(f"   📋 ID: {file.get('id')}")
            print(f"   🔗 Посилання: {file.get('webViewLink', 'N/A')}")
            
            return True
        except Exception as e:
            print(f"❌ Помилка завантаження в Google Drive: {e}")
            import traceback
            traceback.print_exc()
            return False

    def create_screen_panel(self):
        if self.screen_frame is not None:
            self.screen_frame.pack_forget()
            self.screen_frame.destroy()

        self.screen_frame = ttk.Frame(self.root, style="TFrame")
        card = ttk.Frame(self.screen_frame, style="Card.TFrame")
        card.pack(padx=24, pady=32, fill=tk.BOTH, expand=True)

        ttk.Label(card, text="📺 Виберіть екрани", style="Title.TLabel").pack(pady=(10, 16))

        list_container = tk.Frame(card, bg="#0f172a", bd=0, highlightthickness=0)
        list_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 16))

        self.screen_vars = []
        try:
            with mss.mss() as sct:
                for i, monitor in enumerate(sct.monitors[1:], 1):
                    var = tk.BooleanVar(value=(i == 1))
                    self.screen_vars.append(var)
                    cb = tk.Checkbutton(
                        list_container,
                        text=f"Екран {i} ({monitor['width']}×{monitor['height']})",
                        variable=var,
                        font=("Segoe UI", 11),
                        fg="#e5e7eb",
                        bg="#0f172a",
                        selectcolor="#1f2937",
                        activebackground="#0f172a",
                        anchor="w",
                        padx=12,
                        pady=6,
                    )
                    cb.pack(fill=tk.X, pady=6)
        except Exception as grab_error:
            ttk.Label(list_container,
                      text=f"Не вдалося визначити екрани: {grab_error}",
                      background="#0f172a",
                      foreground="#f87171",
                      font=("Segoe UI", 10)).pack(fill=tk.X, pady=12)

        ttk.Button(card, text="▶ Почати запис", style="Card.TButton",
                   command=self.start_recording).pack(fill=tk.X, padx=8, pady=(12, 0))

    def create_recording_panel(self):
        if self.recording_frame is not None:
            self.recording_frame.pack_forget()
            self.recording_frame.destroy()

        self.recording_frame = ttk.Frame(self.root, style="TFrame")
        card = ttk.Frame(self.recording_frame, style="Card.TFrame")
        card.pack(padx=24, pady=32, fill=tk.BOTH, expand=True)

        ttk.Label(card, text="🔴 Запис активний", style="Title.TLabel",
                  foreground="#f87171").pack(pady=(16, 10))

        self.status_label = ttk.Label(card, text="Підключення...", style="Value.TLabel")
        self.status_label.pack(pady=(12, 6))

        self.stats_label = ttk.Label(card, text="", style="Label.TLabel")
        self.stats_label.pack(pady=(0, 18))

        ttk.Button(card, text="⏹ Зупинити запис", style="Card.TButton",
                   command=self.stop_recording).pack(fill=tk.X, padx=8, pady=(10, 0))

    def show_panel(self, panel_name):
        for frame in [self.login_frame, self.screen_frame, self.recording_frame]:
            if frame is not None:
                frame.pack_forget()

        if panel_name == "login":
            self.login_frame.pack(fill=tk.BOTH, expand=True)
        elif panel_name == "screen":
            if self.screen_frame is None:
                self.create_screen_panel()
            self.screen_frame.pack(fill=tk.BOTH, expand=True)
        elif panel_name == "recording":
            if self.recording_frame is None:
                self.create_recording_panel()
            self.recording_frame.pack(fill=tk.BOTH, expand=True)

    def do_login(self):
        self.room = self.room_var.get().strip()
        self.username = self.username_entry.get().strip()

        if not self.room or not self.username:
            messagebox.showerror("Помилка", "Заповніть всі поля!")
            return

        if len(self.username) < 2:
            messagebox.showerror("Помилка", "Нікнейм занадто короткий!")
            return
        
        # Ініціалізуємо логер для цього користувача/кімнати
        # Зберігаємо логи в постійній директорії біля проекту або в домашній директорії
        # Спочатку пробуємо створити в home/.livekit_recorder_logs
        home_dir = os.path.expanduser("~")
        logs_dir = os.path.join(home_dir, ".livekit_recorder_logs")
        
        # Якщо не вдалося, використовуємо temp директорію як fallback
        if not os.path.exists(logs_dir):
            try:
                os.makedirs(logs_dir, exist_ok=True)
            except Exception:
                logs_dir = os.path.join(tempfile.gettempdir(), "simple_recorder_logs")
        
        log_filename = f"{self.username}_{self.room}.log"
        log_file_path = os.path.join(logs_dir, log_filename)
        
        # Закриваємо попередній логер якщо він існує
        if self.logger:
            self.logger.close()
        
        # Створюємо новий логер (з підтримкою відправки на сервер)
        self.logger = Logger(log_file_path, self.api_url, self.username, self.room)
        self.logger.log(f"🎬 Ініціалізація рекордера для {self.username} / {self.room}")
        self.logger.log(f"📁 Файл логів: {log_file_path}")
        self.logger.log(f"🌐 API URL для синхронізації: {self.api_url}")
        self.logger.log(f"📡 Синхронізація логів: {'Увімкнено' if requests else 'Вимкнено (requests не встановлено)'}")
        
        # Ініціалізуємо Google Drive після встановлення username і room
        if GOOGLE_DRIVE_ENABLED and google_drive_available and not self.google_drive_initialized:
            self.logger.log(f"☁️ Ініціалізація Google Drive для {self.username} / {self.room}...")
            try:
                self._init_google_drive()
            except Exception as e:
                self.logger.log(f"⚠️ Не вдалося ініціалізувати Google Drive: {e}")
                import traceback
                traceback.print_exc()
                self.google_drive_initialized = False

        if self.logger:
            self.logger.log(f"👤 Користувач: {self.username} | 📍 Кімната: {self.room}")
        else:
            print(f"👤 Користувач: {self.username} | 📍 Кімната: {self.room}")
        self.show_panel("screen")

    def _log(self, message):
        """Допоміжний метод для логування: пише в logger якщо є, інакше в консоль"""
        if self.logger:
            self.logger.log(message)
        else:
            print(message)

    def start_recording(self):
        if not self.username or not self.room:
            messagebox.showerror("Помилка", "Спочатку увійдіть!")
            self.show_panel("login")
            return

        selected = [i for i, var in enumerate(self.screen_vars) if var.get()]
        if not selected and self.screen_vars:
            self.screen_vars[0].set(True)
            selected = [0]
        if not selected:
            messagebox.showerror("Помилка", "Не знайдено екранів.")
            return

        self.is_recording = True
        self.part_number = 1
        self.video_writer = None
        self.video_file_path = None

        if self.temp_dir and os.path.isdir(self.temp_dir) and self.last_upload_success:
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        self.temp_dir = tempfile.mkdtemp(prefix="simple_recorder_")

        self.show_panel("recording")

        self.ws_thread = threading.Thread(target=self.websocket_loop, daemon=True)
        self.ws_thread.start()

        self._log("⏳ Очікування WebSocket з'єднання...")
        time.sleep(2)

        self.recording_thread = threading.Thread(
            target=self.recording_loop,
            args=(selected,),
            daemon=True
        )
        self.recording_thread.start()

    def websocket_loop(self):
        ws_url = f"{self.server_url}?room={self.room}&role=publisher&name={quote_plus(self.username)}"

        def on_open(ws):
            self._log(f"✅ Підключено до {ws_url}")
            self.ws_connected = True  # Устанавливаем флаг подключения
            self.update_status("🟢 Підключено")
            try:
                # WebSocket сервер ожидает "join", не "register"!
                register_payload = json.dumps({
                    "type": "join",
                    "username": self.username,
                    "room": self.room
                })
                ws.send(register_payload)
                self._log(f"🆔 Зареєстровано стрімера: {self.username} -> {self.room}")
                
                # Регистрация в HTTP API
                if requests:
                    try:
                        api_register_url = f"{self.api_url}/api/stream/register"
                        requests.post(api_register_url, json={
                            "room": self.room,
                            "username": self.username
                        }, verify=True, timeout=5)
                        self._log(f"✅ HTTP API registration successful")
                    except Exception as api_err:
                        self._log(f"⚠️ HTTP API registration failed: {api_err}")
            except Exception as send_err:
                self._log(f"Помилка відправки join: {send_err}")

        def on_error(ws, error):
            self._log(f"❌ WebSocket помилка: {error}")
            self.update_status(f"❌ Помилка: {error}")

        def on_close(ws, close_status_code, close_msg):
            self._log(f"🔌 З'єднання закрито: {close_msg}")
            self.ws_connected = False  # Сбрасываем флаг подключения
            self.update_status("🔴 Відключено")
            
            # Отмена регистрации в HTTP API
            if requests:
                try:
                    api_unregister_url = f"{self.api_url}/api/stream/unregister"
                    requests.post(api_unregister_url, json={
                        "room": self.room,
                        "username": self.username
                    }, verify=True, timeout=5)
                    self._log(f"👋 HTTP API unregistration successful")
                except Exception as api_err:
                    self._log(f"⚠️ HTTP API unregistration failed: {api_err}")

        try:
            self.ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_error=on_error,
                on_close=on_close
            )
            # Let's Encrypt SSL - используем certifi сертификаты
            try:
                import certifi
                import ssl
                self.ws.run_forever(sslopt={"ca_certs": certifi.where()})
            except ImportError:
                # Fallback без проверки сертификата если certifi не установлен
                self.ws.run_forever(sslopt={"cert_reqs": __import__("ssl").CERT_NONE})
        except Exception as e:  # pragma: no cover
            print(f"Помилка WebSocket: {e}")
            import traceback
            traceback.print_exc()
            self.update_status(f"❌ Помилка: {e}")

    def ensure_video_writer(self, frame):
        if self.video_writer is not None:
            return
        if self.temp_dir is None:
            self.temp_dir = tempfile.mkdtemp(prefix="simple_recorder_")
        height, width = frame.shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_room = (self.room or "room").replace(" ", "_")
        safe_user = (self.username or "user").replace(" ", "_")
        filename = f"{safe_room}_{safe_user}_{timestamp}.mp4"
        file_path = os.path.join(self.temp_dir, filename)
        writer = cv2.VideoWriter(file_path, fourcc, FRAME_RATE, (width, height))
        if not writer.isOpened():  # pragma: no cover
            self._log("❌ Не вдалося створити відеофайл")
            return
        self.video_writer = writer
        self.video_file_path = file_path
        self._log(f"📼 Записуємо у файл: {file_path}")

    def finalize_video_writer(self):
        if self.video_writer:
            try:
                self.video_writer.release()
            except Exception as release_error:
                self._log(f"⚠️ Помилка закриття відео: {release_error}")
            finally:
                self.video_writer = None
        path = None
        if self.video_file_path and os.path.exists(self.video_file_path):
            path = self.video_file_path
        self.video_file_path = None
        return path

    def upload_video(self, file_path):
        if not file_path or not os.path.exists(file_path):
            self._log("⚠️ Файл не існує для завантаження")
            return False
        if requests is None:
            self._log("ℹ️ requests не встановлено — пропускаємо завантаження.")
            return False

        file_size_mb = os.path.getsize(file_path) / 1024 / 1024
        file_size_bytes = os.path.getsize(file_path)
        self._log(f"⏫ Завантаження відео {file_size_mb:.2f} MB ({file_size_bytes} bytes) на сервер...")
        self._log(f"   📍 URL: {self.api_url}/api/recordings/upload")
        self._log(f"   👤 Username: {self.username or 'unknown'}")
        self._log(f"   📍 Room: {self.room or 'unknown'}")
        self.update_status(f"⏫ Завантаження {file_size_mb:.1f} MB...")

        upload_start_time = time.time()
        try:
            timestamp = int(time.time() * 1000)
            data = {
                "username": self.username or "unknown",
                "roomName": self.room or "unknown",
                "timestamp": str(timestamp),
            }
            print(f"📤 Початок POST запиту...")
            with open(file_path, "rb") as video_file:
                files = {"video": (os.path.basename(file_path), video_file, "video/mp4")}
                # Увеличено таймаут до 600 секунд (10 минут) для больших файлов и загрузки в Google Drive
                response = requests.post(
                    f"{self.api_url}/api/recordings/upload",
                    data=data,
                    files=files,
                    timeout=600,  # 10 минут
                    verify=False,
                    stream=False  # Отключаем streaming для более надежной загрузки
                )
                
            upload_duration = time.time() - upload_start_time
            self._log(f"📥 Отримано відповідь за {upload_duration:.2f} сек")
            self._log(f"   📊 Status: {response.status_code}")
            
        except requests.exceptions.Timeout as timeout_err:
            self._log(f"❌ Таймаут завантаження (більше 600 сек): {timeout_err}")
            self.update_status("❌ Таймаут завантаження")
            return False
        except requests.exceptions.ConnectionError as conn_err:
            self._log(f"❌ Помилка з'єднання: {conn_err}")
            self.update_status("❌ Помилка з'єднання")
            return False
        except Exception as exc:
            self._log(f"❌ Помилка завантаження: {type(exc).__name__}: {exc}")
            import traceback
            traceback.print_exc()
            self.update_status(f"❌ Помилка: {type(exc).__name__}")
            return False

        if response.ok:
            try:
                response_data = response.json()
                self._log(f"✅ Відео успішно збережено ({file_size_mb:.2f} MB)")
                if 'storage' in response_data:
                    storage = response_data.get('storage', 'unknown')
                    self._log(f"   💾 Сховище: {storage}")
                    # Проверяем разные варианты названия ключей для Google Drive ссылки
                    drive_link = (
                        response_data.get('driveWebLink') or 
                        response_data.get('webViewLink') or 
                        response_data.get('googleDriveLink')
                    )
                    if storage in ('google_drive', 'google_drive_uploading') and drive_link:
                        self._log(f"   🔗 Google Drive: {drive_link}")
                    elif storage == 'google_drive_uploading':
                        self._log(f"   ⏳ Завантаження в Google Drive триває...")
                self.update_status("✅ Відео збережено на сервері")
                try:
                    os.remove(file_path)
                    self._log(f"🗑️ Тимчасовий файл видалено")
                except Exception as remove_error:
                    self._log(f"⚠️ Не вдалося видалити тимчасовий файл: {remove_error}")
                return True
            except Exception as json_err:
                self._log(f"⚠️ Не вдалося розпарсити JSON відповідь: {json_err}")
                self._log(f"   Відповідь: {response.text[:200]}")
                # Но все равно считаем успешным, если статус 200-299
                self.update_status("✅ Відео збережено")
                return True

        self._log(f"❌ Помилка завантаження: {response.status_code}")
        self._log(f"   Відповідь: {response.text[:500]}")
        self.update_status(f"❌ Помилка ({response.status_code})")
        return False

    def recording_loop(self, monitor_indices):
        self._log("🎬 Початок запису...")
        upload_success = False

        try:
            with mss.mss() as sct:
                monitors = [sct.monitors[i + 1] for i in monitor_indices]
                self._log(f"Захоплюємо екрани: {monitor_indices}")

                frame_count = 0
                start_time = time.time()

                while self.is_recording:
                    loop_start = time.time()

                    try:
                        screenshots = [sct.grab(mon) for mon in monitors]
                        frames = [np.array(img) for img in screenshots]
                        frames = [cv2.cvtColor(f, cv2.COLOR_BGRA2BGR) for f in frames]

                        if len(frames) > 1:
                            composite = compose_grid(frames)
                        else:
                            composite = frames[0]

                        height, width = composite.shape[:2]
                        if MAX_WIDTH and MAX_HEIGHT and (width > MAX_WIDTH or height > MAX_HEIGHT):
                            scale = min(MAX_WIDTH / width, MAX_HEIGHT / height)
                            new_width = int(width * scale)
                            new_height = int(height * scale)
                            composite = cv2.resize(
                                composite,
                                (new_width, new_height),
                                interpolation=cv2.INTER_AREA
                            )
                            if frame_count == 0:
                                self._log(f"🔽 Зменшено розмір: {width}x{height} → {new_width}x{new_height}")

                        clock = datetime.now().strftime("%H:%M:%S")
                        label = f"{self.username or 'Streamer'} | {clock}"
                        (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
                        padding_x = 18
                        padding_y = 12
                        rect_width = text_w + padding_x * 2
                        rect_height = text_h + padding_y * 2
                        cv2.rectangle(composite, (12, 12), (12 + rect_width, 12 + rect_height), (0, 0, 0), -1)
                        cv2.rectangle(composite, (12, 12), (12 + rect_width, 12 + rect_height), (96, 165, 250), 2)
                        text_x = 12 + padding_x
                        text_y = 12 + padding_y + text_h - baseline
                        cv2.putText(composite, label, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.75,
                                    (255, 255, 255), 2)

                        self.ensure_video_writer(composite)
                        if self.video_writer:
                            try:
                                self.video_writer.write(composite)
                            except Exception as write_error:
                                self._log(f"Помилка запису відео: {write_error}")

                        success, buffer = cv2.imencode(
                            ".jpg", composite, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                        )
                        if not success:
                            continue
                        frame_base64 = base64.b64encode(buffer).decode("utf-8")

                        # Проверяем WebSocket соединение через флаг
                        if self.ws_connected and self.ws:
                            try:
                                message = json.dumps({
                                    "type": "frame",
                                    "user": self.username,
                                    "room": self.room,
                                    "data": frame_base64
                                })
                                self.ws.send(message)
                                frame_count += 1
                                elapsed = time.time() - start_time
                                fps = frame_count / elapsed if elapsed > 0 else 0

                                if frame_count % 25 == 0:
                                    self._log(f"📤 Відправлено {frame_count} кадрів | FPS: {fps:.1f}")

                                self.update_stats(f"📊 FPS: {fps:.1f} | Кадрів: {frame_count}")
                            except Exception as send_error:
                                self._log(f"⚠️ Помилка відправки кадру: {send_error}")
                                continue
                        else:
                            # Дебаг: почему не отправляем
                            if frame_count == 0 or frame_count % 60 == 0:
                                self._log(f"⚠️ WebSocket не підключено, кадр не відправлено (frame {frame_count})")

                    except Exception as capture_error:
                        self._log(f"Помилка запису: {capture_error}")

                    elapsed = time.time() - loop_start
                    sleep_time = max(0, (1.0 / FRAME_RATE) - elapsed)
                    time.sleep(sleep_time)
        finally:
            final_path = self.finalize_video_writer()
            if final_path:
                # Спочатку завантажуємо в Google Drive (якщо увімкнено)
                self._log(f"🔍 Перевірка Google Drive:")
                self._log(f"   GOOGLE_DRIVE_ENABLED: {GOOGLE_DRIVE_ENABLED}")
                self._log(f"   google_drive_available: {google_drive_available}")
                self._log(f"   self.google_drive_initialized: {self.google_drive_initialized}")
                
                if GOOGLE_DRIVE_ENABLED and google_drive_available:
                    # Якщо не ініціалізовано, спробуємо зараз
                    if not self.google_drive_initialized:
                        self._log("⚠️ Google Drive не ініціалізовано, намагаємося ініціалізувати...")
                        self._init_google_drive()
                    
                    if self.google_drive_initialized:
                        self._log("☁️ Завантаження в Google Drive...")
                        drive_upload_success = self._upload_to_google_drive(final_path)
                        if drive_upload_success:
                            self._log("✅ Відео завантажено в Google Drive")
                            # Після успішного завантаження в Drive можемо видалити локальний файл
                            try:
                                os.remove(final_path)
                                self._log("🗑️ Локальний файл видалено після завантаження в Google Drive")
                            except Exception as remove_error:
                                self._log(f"⚠️ Не вдалося видалити локальний файл: {remove_error}")
                            self.last_upload_success = True
                            if self.temp_dir and os.path.isdir(self.temp_dir):
                                shutil.rmtree(self.temp_dir, ignore_errors=True)
                                self.temp_dir = None
                            self._log("🛑 Запис зупинено")
                            return
                        else:
                            self._log("⚠️ Не вдалося завантажити в Google Drive, завантажуємо на сервер...")
                    else:
                        self._log("⚠️ Google Drive не ініціалізовано, завантажуємо на сервер...")
                else:
                    if not GOOGLE_DRIVE_ENABLED:
                        self._log("ℹ️ Google Drive вимкнено, завантажуємо на сервер...")
                    elif not google_drive_available:
                        self._log("⚠️ Google Drive API не доступний, завантажуємо на сервер...")
                
                # Якщо Google Drive не працює або вимкнено, завантажуємо на сервер
                upload_success = self.upload_video(final_path)
                self.last_upload_success = upload_success
                if upload_success and self.temp_dir and os.path.isdir(self.temp_dir):
                    shutil.rmtree(self.temp_dir, ignore_errors=True)
                    self.temp_dir = None

        self._log("🛑 Запис зупинено")

    def stop_recording(self):
        self.is_recording = False
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
        self.show_panel("screen")

    def update_status(self, text):
        try:
            self.status_label.config(text=text)
        except Exception:
            pass

    def update_stats(self, text):
        try:
            self.stats_label.config(text=text)
        except Exception:
            pass

    def on_closing(self):
        self.is_recording = False
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
        self.root.destroy()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    SimpleRecorder().run()

