import { useState, useEffect } from 'react';
import { Card } from '../ui/card';

interface LogFile {
  filename: string;
  username: string;
  room: string;
  size: number;
  modified: string;
  path: string;
}

interface LogContent {
  filename: string;
  username: string;
  room: string;
  size: number;
  modified: string;
  lines: string[];
  totalLines: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function RecorderLogsPage() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/recorder/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogFiles(data);
      } else {
        console.error('Ошибка получения списка логов:', response.statusText);
      }
    } catch (error) {
      console.error('Ошибка получения списка логов:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLogContent = async (filename: string) => {
    try {
      const response = await fetch(`${API_URL}/api/recorder/logs/${encodeURIComponent(filename)}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedLog(data);
      } else {
        console.error('Ошибка получения логов:', response.statusText);
        alert('Не удалось загрузить логи');
      }
    } catch (error) {
      console.error('Ошибка получения логов:', error);
      alert('Не удалось загрузить логи');
    }
  };

  const deleteLog = async (filename: string) => {
    if (!confirm(`Удалить лог-файл ${filename}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/recorder/logs/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        // Обновляем список
        await fetchLogFiles();
        // Если удаленный файл был выбран, очищаем его
        if (selectedLog && selectedLog.filename === filename) {
          setSelectedLog(null);
        }
      } else {
        alert('Не удалось удалить лог-файл');
      }
    } catch (error) {
      console.error('Ошибка удаления лог-файла:', error);
      alert('Не удалось удалить лог-файл');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  useEffect(() => {
    fetchLogFiles();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (selectedLog) {
        fetchLogContent(selectedLog.filename);
      }
      fetchLogFiles();
    }, 5000); // Обновление каждые 5 секунд

    return () => clearInterval(interval);
  }, [autoRefresh, selectedLog]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogFiles();
    if (selectedLog) {
      fetchLogContent(selectedLog.filename);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📋 Логи рекордеров</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Обновление...' : '🔄 Обновить'}
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded ${
              autoRefresh
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            {autoRefresh ? '⏸️ Остановить автообновление' : '▶️ Автообновление'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Список лог-файлов */}
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Активные рекордеры ({logFiles.length})</h2>
          {logFiles.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Нет активных рекордеров
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {logFiles.map((logFile) => (
                <div
                  key={logFile.filename}
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    selectedLog?.filename === logFile.filename
                      ? 'bg-blue-100 border-blue-500'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => fetchLogContent(logFile.filename)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-lg">
                        👤 {logFile.username}
                      </div>
                      <div className="text-sm text-gray-600">
                        📍 {logFile.room}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        📁 {logFile.filename}
                      </div>
                      <div className="text-xs text-gray-500">
                        📏 {formatFileSize(logFile.size)} • 🕐 {formatDate(logFile.modified)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLog(logFile.filename);
                      }}
                      className="ml-2 px-2 py-1 text-red-600 hover:bg-red-100 rounded text-sm"
                      title="Удалить лог"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Содержимое выбранного лог-файла */}
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">
            {selectedLog ? `Логи: ${selectedLog.username} / ${selectedLog.room}` : 'Выберите рекордер'}
          </h2>
          {selectedLog ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 mb-2">
                Всего строк: {selectedLog.totalLines} • Размер: {formatFileSize(selectedLog.size)} • 
                Обновлено: {formatDate(selectedLog.modified)}
                {selectedLog.totalLines > 10000 && (
                  <span className="text-orange-600 ml-2">
                    (показаны последние 10000 строк)
                  </span>
                )}
              </div>
              <div className="bg-black text-green-400 p-4 rounded font-mono text-xs max-h-[600px] overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {selectedLog.lines.join('\n')}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              Выберите рекордер из списка слева для просмотра логов
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

