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


class SimpleRecorder:
    def __init__(self):
        self.server_url = "wss://kibitkostreamappv.pp.ua:8443"
        self.api_url = "https://kibitkostreamappv.pp.ua"
        self.room = None
        self.username = None
        self.is_recording = False
        self.ws = None
        self.ws_thread = None
        self.recording_thread = None
        self.screen_vars = []
        self.video_writer = None
        self.video_file_path = None
        self.temp_dir = None
        self.part_number = 1
        self.last_upload_success = True

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

        print(f"👤 Користувач: {self.username} | 📍 Кімната: {self.room}")
        self.show_panel("screen")

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

        print("⏳ Очікування WebSocket з'єднання...")
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
            print(f"✅ Підключено до {ws_url}")
            self.update_status("🟢 Підключено")
            try:
                register_payload = json.dumps({
                    "type": "register",
                    "username": self.username,
                    "room": self.room
                })
                ws.send(register_payload)
                print(f"🆔 Зареєстровано стрімера: {self.username} -> {self.room}")
            except Exception as send_err:
                print(f"Помилка відправки register: {send_err}")

        def on_error(ws, error):
            print(f"❌ WebSocket помилка: {error}")
            self.update_status(f"❌ Помилка: {error}")

        def on_close(ws, close_status_code, close_msg):
            print(f"🔌 З'єднання закрито: {close_msg}")
            self.update_status("🔴 Відключено")

        try:
            self.ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_error=on_error,
                on_close=on_close
            )
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
            print("❌ Не вдалося створити відеофайл")
            return
        self.video_writer = writer
        self.video_file_path = file_path
        print(f"📼 Записуємо у файл: {file_path}")

    def finalize_video_writer(self):
        if self.video_writer:
            try:
                self.video_writer.release()
            except Exception as release_error:
                print(f"⚠️ Помилка закриття відео: {release_error}")
            finally:
                self.video_writer = None
        path = None
        if self.video_file_path and os.path.exists(self.video_file_path):
            path = self.video_file_path
        self.video_file_path = None
        return path

    def upload_video(self, file_path):
        if not file_path or not os.path.exists(file_path):
            return False
        if requests is None:
            print("ℹ️ requests не встановлено — пропускаємо завантаження.")
            return False

        file_size_mb = os.path.getsize(file_path) / 1024 / 1024
        print(f"⏫ Завантаження відео {file_size_mb:.2f} MB на сервер...")
        self.update_status(f"⏫ Завантаження {file_size_mb:.1f} MB...")

        try:
            timestamp = int(time.time() * 1000)
            data = {
                "username": self.username or "unknown",
                "roomName": self.room or "unknown",
                "timestamp": str(timestamp),
            }
            with open(file_path, "rb") as video_file:
                files = {"video": (os.path.basename(file_path), video_file, "video/mp4")}
                response = requests.post(
                    f"{self.api_url}/api/recordings/upload",
                    data=data,
                    files=files,
                    timeout=300,
                    verify=False
                )
        except Exception as exc:
            print(f"❌ Помилка завантаження: {exc}")
            self.update_status(f"❌ Помилка завантаження: {exc}")
            return False

        if response.ok:
            print(f"✅ Відео успішно збережено ({file_size_mb:.2f} MB)")
            self.update_status("✅ Відео збережено на сервері")
            try:
                os.remove(file_path)
            except Exception as remove_error:
                print(f"⚠️ Не вдалося видалити тимчасовий файл: {remove_error}")
            return True

        print(f"❌ Помилка завантаження: {response.status_code}")
        self.update_status(f"❌ Помилка завантаження ({response.status_code})")
        return False

    def recording_loop(self, monitor_indices):
        print("🎬 Початок запису...")
        upload_success = False

        try:
            with mss.mss() as sct:
                monitors = [sct.monitors[i + 1] for i in monitor_indices]
                print(f"Захоплюємо екрани: {monitor_indices}")

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
                                print(f"🔽 Зменшено розмір: {width}x{height} → {new_width}x{new_height}")

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
                                print(f"Помилка запису відео: {write_error}")

                        success, buffer = cv2.imencode(
                            ".jpg", composite, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                        )
                        if not success:
                            continue
                        frame_base64 = base64.b64encode(buffer).decode("utf-8")

                        if self.ws and hasattr(self.ws, "sock") and self.ws.sock and self.ws.sock.connected:
                            try:
                                message = json.dumps({
                                    "type": "frame",
                                    "user": self.username,
                                    "room": self.room,
                                    "data": frame_base64
                                })
                                self.ws.send(message)
                            except Exception as send_error:
                                print(f"Помилка відправки кадру: {send_error}")
                                continue

                            frame_count += 1
                            elapsed = time.time() - start_time
                            fps = frame_count / elapsed if elapsed > 0 else 0

                            if frame_count % 25 == 0:
                                print(f"📤 Відправлено {frame_count} кадрів | FPS: {fps:.1f}")

                            self.update_stats(f"📊 FPS: {fps:.1f} | Кадрів: {frame_count}")

                    except Exception as capture_error:
                        print(f"Помилка запису: {capture_error}")

                    elapsed = time.time() - loop_start
                    sleep_time = max(0, (1.0 / FRAME_RATE) - elapsed)
                    time.sleep(sleep_time)
        finally:
            final_path = self.finalize_video_writer()
            if final_path:
                upload_success = self.upload_video(final_path)
            self.last_upload_success = upload_success
            if upload_success and self.temp_dir and os.path.isdir(self.temp_dir):
                shutil.rmtree(self.temp_dir, ignore_errors=True)
                self.temp_dir = None

        print("🛑 Запис зупинено")

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

