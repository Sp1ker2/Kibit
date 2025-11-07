#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LiveKit Desktop Recorder
Захват экранов с поддержкой виртуальных рабочих столов Windows
"""

import tkinter as tk
from tkinter import ttk, messagebox
import mss
import cv2
import numpy as np
import requests
import threading
import time
from datetime import datetime
import io
import sys
from PIL import Image
import pystray
from pystray import MenuItem as item

class LiveKitRecorder:
    def __init__(self):
        self.api_url = "https://kibitkostreamappv.pp.ua"
        self.username = None
        self.room = None
        self.is_recording = False
        self.video_writer = None
        self.recording_thread = None
        self.save_thread = None
        self.part_number = 1
        self.current_video_file = None
        self.tray_icon = None
        
        # Создаём главное окно
        self.root = tk.Tk()
        self.root.title("🎬 LiveKit Desktop Recorder")
        self.root.geometry("500x600")
        self.root.configure(bg='#1e1e1e')
        self.root.resizable(False, False)
        
        # Создаём интерфейс
        self.create_login_panel()
        self.create_screen_panel()
        self.create_recording_panel()
        
        # Показываем панель входа
        self.show_panel('login')
        
        # Обработка закрытия окна
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
    def create_login_panel(self):
        self.login_frame = tk.Frame(self.root, bg='#2a2a2a')
        
        # Заголовок
        tk.Label(self.login_frame, text="🎬 Авторизация", 
                font=('Segoe UI', 16, 'bold'), fg='white', bg='#2a2a2a').pack(pady=20)
        
        # Комната
        tk.Label(self.login_frame, text="Комната:", 
                font=('Segoe UI', 10), fg='#9ca3af', bg='#2a2a2a').pack(pady=(10,5))
        self.room_var = tk.StringVar()
        self.room_combo = ttk.Combobox(self.login_frame, textvariable=self.room_var, 
                                       state='readonly', width=50)
        self.room_combo.pack()
        
        # Логин
        tk.Label(self.login_frame, text="Логин:", 
                font=('Segoe UI', 10), fg='#9ca3af', bg='#2a2a2a').pack(pady=(20,5))
        self.username_entry = tk.Entry(self.login_frame, width=50, font=('Segoe UI', 11),
                                       bg='white', fg='black', relief=tk.SOLID, bd=1)
        self.username_entry.pack(pady=5)
        self.username_entry.focus()  # Автофокус на логин
        
        # Пароль
        tk.Label(self.login_frame, text="Пароль:", 
                font=('Segoe UI', 10), fg='#9ca3af', bg='#2a2a2a').pack(pady=(20,5))
        self.password_entry = tk.Entry(self.login_frame, width=50, show='●', font=('Segoe UI', 11),
                                       bg='white', fg='black', relief=tk.SOLID, bd=1)
        self.password_entry.pack(pady=5)
        
        # Кнопка входа
        self.login_btn = tk.Button(self.login_frame, text="Войти", 
                                   command=self.do_login,
                                   bg='#60a5fa', fg='white', 
                                   font=('Segoe UI', 12, 'bold'),
                                   width=40, height=2, relief=tk.FLAT)
        self.login_btn.pack(pady=30)
        
        # Загрузка комнат
        self.load_rooms()
        
    def create_screen_panel(self):
        self.screen_frame = tk.Frame(self.root, bg='#2a2a2a')
        
        tk.Label(self.screen_frame, text="📺 Выбор экранов", 
                font=('Segoe UI', 16, 'bold'), fg='white', bg='#2a2a2a').pack(pady=20)
        
        # Список экранов с чекбоксами
        list_frame = tk.Frame(self.screen_frame, bg='#1a1a1a')
        list_frame.pack(pady=20, padx=20, fill=tk.BOTH, expand=True)
        
        self.screen_vars = []
        with mss.mss() as sct:
            for i, monitor in enumerate(sct.monitors[1:], 1):  # Пропускаем monitors[0] (все экраны)
                var = tk.BooleanVar()
                self.screen_vars.append(var)
                cb = tk.Checkbutton(list_frame, 
                                   text=f"Экран {i} ({monitor['width']}×{monitor['height']})",
                                   variable=var,
                                   font=('Segoe UI', 11),
                                   fg='white', bg='#1a1a1a',
                                   selectcolor='#2a2a2a')
                cb.pack(anchor='w', pady=10, padx=20)
        
        # Кнопка запуска
        self.start_btn = tk.Button(self.screen_frame, text="▶ Начать запись", 
                                   command=self.start_recording,
                                   bg='#60a5fa', fg='white',
                                   font=('Segoe UI', 12, 'bold'),
                                   width=40, height=2, relief=tk.FLAT)
        self.start_btn.pack(pady=20)
        
    def create_recording_panel(self):
        self.recording_frame = tk.Frame(self.root, bg='#2a2a2a')
        
        # Статус
        self.status_label = tk.Label(self.recording_frame, text="🔴 Идёт запись", 
                                    font=('Segoe UI', 16, 'bold'),
                                    fg='white', bg='#7f1d1d', 
                                    width=40, height=2)
        self.status_label.pack(pady=20)
        
        # Информация
        info_frame = tk.Frame(self.recording_frame, bg='#1a1a1a')
        info_frame.pack(pady=20, padx=20, fill=tk.X)
        
        self.time_label = tk.Label(info_frame, text="Время: 00:00:00", 
                                  font=('Segoe UI', 12), fg='white', bg='#1a1a1a')
        self.time_label.pack(pady=10)
        
        self.saved_label = tk.Label(info_frame, text="Сохранено: 0 частей", 
                                   font=('Segoe UI', 12), fg='white', bg='#1a1a1a')
        self.saved_label.pack(pady=10)
        
        # Кнопка остановки
        self.stop_btn = tk.Button(self.recording_frame, text="⏹ Остановить запись", 
                                 command=self.stop_recording,
                                 bg='#ef4444', fg='white',
                                 font=('Segoe UI', 12, 'bold'),
                                 width=40, height=2, relief=tk.FLAT)
        self.stop_btn.pack(pady=10)
        
        # Кнопка сворачивания в трей
        self.minimize_btn = tk.Button(self.recording_frame, text="↓ Свернуть в трей", 
                                     command=self.minimize_to_tray,
                                     bg='#8b5cf6', fg='white',
                                     font=('Segoe UI', 11, 'bold'),
                                     width=40, height=2, relief=tk.FLAT)
        self.minimize_btn.pack(pady=10)
        
    def show_panel(self, panel):
        self.login_frame.pack_forget()
        self.screen_frame.pack_forget()
        self.recording_frame.pack_forget()
        
        if panel == 'login':
            self.login_frame.pack(fill=tk.BOTH, expand=True)
        elif panel == 'screen':
            self.screen_frame.pack(fill=tk.BOTH, expand=True)
        elif panel == 'recording':
            self.recording_frame.pack(fill=tk.BOTH, expand=True)
    
    def load_rooms(self):
        try:
            response = requests.get(f"{self.api_url}/api/room-list", timeout=10)
            if response.ok:
                rooms = response.json()
                room_names = [r['name'] for r in rooms]
                self.room_combo['values'] = room_names
                if room_names:
                    self.room_combo.current(0)
        except Exception as e:
            print(f"Ошибка загрузки комнат: {e}")
    
    def do_login(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()
        room = self.room_var.get()
        
        if not username or not password or not room:
            messagebox.showerror("Ошибка", "Заполните все поля!")
            return
        
        self.login_btn.config(state='disabled', text='Вход...')
        
        try:
            response = requests.post(
                f"{self.api_url}/api/auth/login",
                json={"username": username, "password": password, "room": room},
                timeout=10
            )
            
            if response.ok and response.json().get('success'):
                self.username = username
                self.room = room
                self.show_panel('screen')
            else:
                messagebox.showerror("Ошибка", "Неверный логин или пароль!")
        except Exception as e:
            messagebox.showerror("Ошибка", f"Не удалось подключиться: {e}")
        finally:
            self.login_btn.config(state='normal', text='Войти')
    
    def start_recording(self):
        selected_screens = [i for i, var in enumerate(self.screen_vars, 1) if var.get()]
        
        if not selected_screens:
            messagebox.showwarning("Предупреждение", "Выберите хотя бы один экран!")
            return
        
        self.selected_screens = selected_screens
        self.show_panel('recording')
        
        # Запускаем запись в отдельном потоке
        self.is_recording = True
        self.recording_thread = threading.Thread(target=self.recording_loop, daemon=True)
        self.recording_thread.start()
        
        # Запускаем автосохранение
        self.save_thread = threading.Thread(target=self.auto_save_loop, daemon=True)
        self.save_thread.start()
        
        # Обновление времени
        self.start_time = datetime.now()
        self.update_time()
        
        print("🎬 Запись началась")
    
    def recording_loop(self):
        """Захват кадров и запись в видео"""
        import tempfile
        
        # Создаём временный файл
        self.current_video_file = tempfile.mktemp(suffix='.mp4')
        
        with mss.mss() as sct:
            # Определяем размер захвата
            monitors = [sct.monitors[i] for i in self.selected_screens]
            
            if len(monitors) == 1:
                mon = monitors[0]
                width, height = mon['width'], mon['height']
            else:
                # Объединяем мониторы
                width = sum(m['width'] for m in monitors)
                height = max(m['height'] for m in monitors)
            
            # Создаём VideoWriter
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            self.video_writer = cv2.VideoWriter(
                self.current_video_file, fourcc, 30.0, (width, height)
            )
            
            print(f"📹 Запись: {width}×{height} @ 30 FPS")
            
            frame_time = 1.0 / 30.0  # 30 FPS
            
            while self.is_recording:
                start = time.time()
                
                try:
                    # Захватываем кадры
                    if len(monitors) == 1:
                        # Один монитор
                        sct_img = sct.grab(monitors[0])
                        frame = np.array(sct_img)
                        frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                    else:
                        # Несколько мониторов - объединяем
                        frames = []
                        for mon in monitors:
                            sct_img = sct.grab(mon)
                            img = np.array(sct_img)
                            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
                            frames.append(img)
                        
                        # Объединяем горизонтально
                        frame = np.hstack(frames)
                    
                    # Записываем кадр
                    self.video_writer.write(frame)
                    
                except Exception as e:
                    print(f"❌ Ошибка захвата: {e}")
                
                # Поддерживаем 30 FPS
                elapsed = time.time() - start
                sleep_time = max(0, frame_time - elapsed)
                time.sleep(sleep_time)
        
        # Закрываем видео
        if self.video_writer:
            self.video_writer.release()
            print("📹 VideoWriter закрыт")
    
    def auto_save_loop(self):
        """Автоматическое сохранение каждые 5 минут"""
        while self.is_recording:
            time.sleep(5 * 60)  # 5 минут
            if self.is_recording:
                print("⏰ 5 минут прошло, сохраняем...")
                self.save_current_video()
    
    def save_current_video(self):
        """Сохранение текущего видео на сервер"""
        try:
            # Останавливаем запись временно
            was_recording = self.is_recording
            
            if self.video_writer:
                self.video_writer.release()
                self.video_writer = None
            
            time.sleep(0.5)  # Даём время на завершение
            
            # Читаем файл
            if self.current_video_file and os.path.exists(self.current_video_file):
                with open(self.current_video_file, 'rb') as f:
                    video_data = f.read()
                
                file_size_mb = len(video_data) / 1024 / 1024
                print(f"📤 Загружаем {file_size_mb:.2f} MB на сервер...")
                
                # Отправляем на сервер
                timestamp = int(time.time() * 1000)
                filename = f"{self.username}_{timestamp}_part{self.part_number}.mp4"
                
                files = {'video': (filename, video_data, 'video/mp4')}
                data = {
                    'username': self.username,
                    'roomName': self.room,
                    'timestamp': str(timestamp)
                }
                
                response = requests.post(
                    f"{self.api_url}/api/recordings/upload",
                    files=files,
                    data=data,
                    timeout=300  # 5 минут на загрузку
                )
                
                if response.ok:
                    print(f"✅ Часть {self.part_number} сохранена ({file_size_mb:.2f} MB)")
                    self.root.after(0, lambda: self.saved_label.config(
                        text=f"Сохранено: {self.part_number} частей"
                    ))
                    self.part_number += 1
                    
                    # Удаляем временный файл
                    os.remove(self.current_video_file)
                else:
                    print(f"❌ Ошибка загрузки: {response.status_code}")
            
            # Продолжаем запись если надо
            if was_recording:
                self.recording_loop()
                
        except Exception as e:
            print(f"❌ Ошибка сохранения: {e}")
    
    def stop_recording(self):
        """Остановка записи"""
        print("🛑 Останавливаем запись...")
        self.is_recording = False
        
        # Ждём завершения потоков
        time.sleep(1)
        
        # Сохраняем последнюю часть
        self.save_current_video()
        
        self.show_panel('screen')
        print("✅ Запись остановлена")
    
    def update_time(self):
        """Обновление таймера записи"""
        if self.is_recording:
            elapsed = datetime.now() - self.start_time
            hours = int(elapsed.total_seconds() // 3600)
            minutes = int((elapsed.total_seconds() % 3600) // 60)
            seconds = int(elapsed.total_seconds() % 60)
            
            self.time_label.config(text=f"Время: {hours:02d}:{minutes:02d}:{seconds:02d}")
            self.root.after(1000, self.update_time)
    
    def minimize_to_tray(self):
        """Сворачивание в системный трей"""
        self.root.withdraw()
        
        # Создаём иконку трея
        if not self.tray_icon:
            image = Image.new('RGB', (64, 64), color='red')
            menu = pystray.Menu(
                item('🔴 Идёт запись', lambda: None, enabled=False),
                item('Показать окно', self.show_window),
                item('Выход', self.quit_app)
            )
            self.tray_icon = pystray.Icon("LiveKit", image, "LiveKit Recorder", menu)
            threading.Thread(target=self.tray_icon.run, daemon=True).start()
    
    def show_window(self, icon=None, item=None):
        """Показать окно из трея"""
        self.root.deiconify()
    
    def quit_app(self, icon=None, item=None):
        """Выход из приложения"""
        if self.is_recording:
            self.stop_recording()
        if self.tray_icon:
            self.tray_icon.stop()
        self.root.quit()
    
    def on_closing(self):
        """Обработка закрытия окна"""
        if self.is_recording:
            self.minimize_to_tray()
        else:
            self.quit_app()
    
    def run(self):
        """Запуск приложения"""
        self.root.mainloop()


if __name__ == "__main__":
    import os
    app = LiveKitRecorder()
    app.run()


