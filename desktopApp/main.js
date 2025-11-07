const { app, BrowserWindow, desktopCapturer, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
let isRecording = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // Открываем DevTools для отладки
  mainWindow.webContents.openDevTools();
  
  // Создаём трей при запуске
  createTray();
  
  // Обработка закрытия окна - сворачиваем в трей вместо выхода
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Создаём иконку для трея (используем встроенную или создаём простую)
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAIHSURBVFiF7ZbPaxNBFMe/M7ubTdI0bWxjq1YUxYOCePDgQQQv/gf+Bf4LXrx48eBBEMGDIHjyJIi0oBUVqaJVa5vYJm2ySbpJdjOzHpJNs5vdZGcTD34PywzvzXzf7Ly3+wbYYYcddjjbYN0A1UApFDqXqFanOeeTAI4BCADwA1gE8JLzp+l0+kEqlXq1zqBaC1QqlY6Xy+Wn');
  
  tray = new Tray(icon);
  
  updateTrayMenu();
  
  tray.setToolTip('LiveKit Stream Recorder');
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isRecording ? '🔴 Идёт запись' : '⚪ Запись остановлена',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Показать окно',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Скрыть окно',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// Обработка запроса на список источников захвата
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 300, height: 200 }
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Ошибка получения источников:', error);
    return [];
  }
});

// Обработка статуса записи
ipcMain.on('recording-status', (event, recording) => {
  isRecording = recording;
  updateTrayMenu();
  
  if (recording) {
    tray.setToolTip('🔴 LiveKit - Идёт запись');
  } else {
    tray.setToolTip('⚪ LiveKit - Запись остановлена');
  }
});

// Обработка команды сворачивания в трей
ipcMain.on('minimize-to-tray', () => {
  mainWindow.hide();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


