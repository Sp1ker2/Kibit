const { ipcRenderer } = require('electron');
const { Room, RoomEvent, createLocalVideoTrack } = require('livekit-client');

// Конфигурация
const API_URL = 'https://kibitkostreamappv.pp.ua';
const LIVEKIT_URL = 'wss://kibitkostreamappv.pp.ua';

// Состояние
let currentUser = null;
let currentRoom = null;
let livekitRoom = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingCount = 1;
let recordingInterval = null;
let startTime = null;
let timerInterval = null;
let selectedSources = [];

// DOM элементы
const loginSection = document.getElementById('loginSection');
const monitorSection = document.getElementById('monitorSection');
const streamSection = document.getElementById('streamSection');
const roomSelect = document.getElementById('roomSelect');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const monitorList = document.getElementById('monitorList');
const startStreamBtn = document.getElementById('startStreamBtn');
const stopStreamBtn = document.getElementById('stopStreamBtn');
const logoutBtn = document.getElementById('logoutBtn');
const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const status = document.getElementById('status');
const recordingTime = document.getElementById('recordingTime');
const recordingCountEl = document.getElementById('recordingCount');

// Загрузка комнат при старте
loadRooms();

async function loadRooms() {
  try {
    const response = await fetch(`${API_URL}/api/room-list`);
    if (response.ok) {
      const rooms = await response.json();
      roomSelect.innerHTML = '<option value="">Выберите комнату</option>';
      rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;
        option.textContent = room.name;
        roomSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Ошибка загрузки комнат:', err);
  }
}

// Авторизация
loginBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  const room = roomSelect.value;

  if (!username || !password || !room) {
    showError('Заполните все поля');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Вход...';

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, room })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      currentUser = { username, room };
      hideError();
      loginSection.classList.add('hidden');
      await showMonitorSelection();
    } else {
      showError(data.error || 'Ошибка авторизации');
    }
  } catch (err) {
    console.error('Ошибка:', err);
    showError('Не удалось подключиться к серверу');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Войти';
  }
});

// Показ выбора мониторов
async function showMonitorSelection() {
  try {
    const sources = await ipcRenderer.invoke('get-sources');
    
    // Фильтруем только экраны
    const screens = sources.filter(s => s.name.includes('Screen') || s.name.includes('Entire'));
    
    monitorList.innerHTML = '';
    selectedSources = [];

    screens.forEach(source => {
      const div = document.createElement('div');
      div.className = 'monitor-option';
      div.dataset.sourceId = source.id;
      
      div.innerHTML = `
        <img src="${source.thumbnail}" alt="${source.name}">
        <span>${source.name}</span>
      `;
      
      div.addEventListener('click', () => {
        div.classList.toggle('selected');
        
        if (div.classList.contains('selected')) {
          selectedSources.push({ id: source.id, name: source.name });
        } else {
          selectedSources = selectedSources.filter(s => s.id !== source.id);
        }
        
        startStreamBtn.disabled = selectedSources.length === 0;
      });
      
      monitorList.appendChild(div);
    });

    monitorSection.classList.remove('hidden');
    startStreamBtn.disabled = true;
  } catch (err) {
    console.error('Ошибка загрузки мониторов:', err);
    showError('Не удалось получить список мониторов');
  }
}

// Запуск стрима
startStreamBtn.addEventListener('click', async () => {
  if (selectedSources.length === 0) {
    alert('Выберите хотя бы один монитор');
    return;
  }

  startStreamBtn.disabled = true;
  startStreamBtn.textContent = 'Запуск...';

  try {
    await startStreaming();
    monitorSection.classList.add('hidden');
    streamSection.classList.remove('hidden');
    status.className = 'status recording';
    status.textContent = '🔴 Идёт запись';
    startRecordingTimer();
  } catch (err) {
    console.error('Ошибка запуска стрима:', err);
    alert('Ошибка: ' + err.message);
  } finally {
    startStreamBtn.disabled = false;
    startStreamBtn.textContent = 'Запустить стрим';
  }
});

// Остановка стрима
stopStreamBtn.addEventListener('click', async () => {
  await stopStreaming();
  streamSection.classList.add('hidden');
  monitorSection.classList.remove('hidden');
  stopRecordingTimer();
});

// Выход
logoutBtn.addEventListener('click', () => {
  if (livekitRoom) {
    stopStreaming();
  }
  currentUser = null;
  streamSection.classList.add('hidden');
  monitorSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
  usernameInput.value = '';
  passwordInput.value = '';
});

// Функция старта стриминга
async function startStreaming() {
  console.log('Запуск стриминга...');
  
  // Захватываем выбранные экраны
  const streams = [];
  
  for (const source of selectedSources) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080
        }
      }
    });
    streams.push(stream);
  }

  // Если несколько мониторов - объединяем в Canvas
  let finalStream;
  if (streams.length === 1) {
    finalStream = streams[0];
  } else {
    finalStream = await combineStreams(streams);
  }

  // Показываем превью
  preview.srcObject = finalStream;
  placeholder.style.display = 'none';

  // Начинаем запись
  mediaRecorder = new MediaRecorder(finalStream, {
    mimeType: 'video/webm;codecs=vp9'
  });

  recordedChunks = [];
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000); // Сохраняем каждую секунду
  console.log('📹 Запись началась');

  // Автосохранение каждые 5 минут
  recordingInterval = setInterval(async () => {
    console.log('⏰ 5 минут прошло, сохраняем...');
    await saveRecording();
  }, 5 * 60 * 1000);

  // Подключаемся к LiveKit для live просмотра
  await connectToLiveKit(finalStream);
  
  console.log('✅ Стрим запущен');
}

// Объединение нескольких потоков в один через Canvas
async function combineStreams(streams) {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Создаём видео элементы для каждого потока
  const videos = streams.map(stream => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    return video;
  });

  // Рисуем кадры на canvas
  function drawFrame() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (videos.length === 2) {
      // 2 монитора - рядом
      ctx.drawImage(videos[0], 0, 0, canvas.width / 2, canvas.height);
      ctx.drawImage(videos[1], canvas.width / 2, 0, canvas.width / 2, canvas.height);
    } else {
      // 3+ мониторов - сетка
      const cols = Math.ceil(Math.sqrt(videos.length));
      const rows = Math.ceil(videos.length / cols);
      const w = canvas.width / cols;
      const h = canvas.height / rows;
      
      videos.forEach((video, i) => {
        const x = (i % cols) * w;
        const y = Math.floor(i / cols) * h;
        ctx.drawImage(video, x, y, w, h);
      });
    }

    requestAnimationFrame(drawFrame);
  }

  drawFrame();

  // Получаем поток из canvas
  return canvas.captureStream(30); // 30 FPS
}

// Подключение к LiveKit
async function connectToLiveKit(stream) {
  try {
    const token = await generateToken(
      `stream_${currentUser.username}`,
      currentUser.username
    );

    livekitRoom = new Room();
    await livekitRoom.connect(LIVEKIT_URL, token);
    console.log('✅ Подключено к LiveKit');

    // Публикуем видео
    const videoTrack = stream.getVideoTracks()[0];
    await livekitRoom.localParticipant.publishTrack(videoTrack, {
      videoEncoding: {
        maxBitrate: 8000000,
        maxFramerate: 30
      },
      simulcast: false
    });

    console.log('✅ Видео опубликовано в LiveKit');
  } catch (err) {
    console.error('Ошибка LiveKit:', err);
  }
}

// Генерация токена (копия из веб версии)
async function generateToken(roomName, participantName) {
  const LIVEKIT_API_KEY = 'devkey';
  const LIVEKIT_API_SECRET = 'secret';

  const { SignJWT } = await import('https://cdn.jsdelivr.net/npm/jose@5/+esm');
  
  const now = Math.floor(Date.now() / 1000);
  
  const token = await new SignJWT({
    exp: now + (24 * 60 * 60),
    iss: LIVEKIT_API_KEY,
    nbf: now - (5 * 60),
    sub: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true
    }
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(LIVEKIT_API_SECRET));

  return token;
}

// Сохранение записи
async function saveRecording() {
  if (recordedChunks.length === 0) {
    console.log('⚠️ Нет данных');
    return;
  }

  try {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const fileSize = blob.size;
    
    console.log(`💾 Сохраняем ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    const formData = new FormData();
    const timestamp = Date.now();
    const filename = `${currentUser.username}_${timestamp}_part${recordingCount}.webm`;
    
    formData.append('username', currentUser.username);
    formData.append('roomName', currentUser.room);
    formData.append('timestamp', timestamp.toString());
    formData.append('video', blob, filename);

    const response = await fetch(`${API_URL}/api/recordings/upload`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      console.log(`✅ Часть ${recordingCount} сохранена`);
      recordingCountEl.textContent = `Сохранено: ${recordingCount} частей`;
      recordingCount++;
      recordedChunks = [];
    } else {
      console.error('❌ Ошибка сохранения');
    }
  } catch (err) {
    console.error('❌ Ошибка:', err);
  }
}

// Остановка стриминга
async function stopStreaming() {
  console.log('🛑 Останавливаем...');
  
  // Останавливаем автосохранение
  if (recordingInterval) {
    clearInterval(recordingInterval);
  }

  // Сохраняем последнюю часть
  if (recordedChunks.length > 0) {
    await saveRecording();
  }

  // Останавливаем запись
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  // Отключаемся от LiveKit
  if (livekitRoom) {
    livekitRoom.disconnect();
    livekitRoom = null;
  }

  // Останавливаем превью
  if (preview.srcObject) {
    preview.srcObject.getTracks().forEach(track => track.stop());
    preview.srcObject = null;
  }

  placeholder.style.display = 'flex';
  status.className = 'status idle';
  status.textContent = 'Стрим остановлен';
  
  console.log('✅ Остановлено');
}

// Таймер записи
function startRecordingTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    recordingTime.textContent = `Время: ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }, 1000);
}

function stopRecordingTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  recordingTime.textContent = 'Время: 00:00:00';
  recordingCountEl.textContent = 'Сохранено: 0 частей';
  recordingCount = 1;
}

function pad(num) {
  return num.toString().padStart(2, '0');
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}


