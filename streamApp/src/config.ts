// Динамическая конфигурация для работы через домен

// Получаем протокол и хост из браузера
const getProtocol = () => {
  if (typeof window === 'undefined') return 'http:';
  return window.location.protocol;
};

const getHost = () => {
  if (typeof window === 'undefined') return 'localhost';
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return hostname;
  }
  return hostname;
};

// Определяем протоколы
const isSecure = getProtocol() === 'https:';
const wsProtocol = isSecure ? 'wss:' : 'ws:';
const httpProtocol = isSecure ? 'https:' : 'http:';

const host = getHost();
const isLocal = host === 'localhost' || host === '127.0.0.1';

// API URL
export const API_URL = isLocal 
  ? `${httpProtocol}//${host}:3001`
  : `${httpProtocol}//${host}`;

// LiveKit URL - используем Nginx прокси с SSL терминированием
// Клиент подключается к wss://host/rtc, Nginx проксирует на ws://127.0.0.1:7880/rtc
// LiveKit клиент автоматически добавляет /rtc к URL
export const LIVEKIT_URL = isLocal
  ? `${wsProtocol}//${host}:7880`  // localhost - прямое подключение
  : `${wsProtocol}//${host}`;  // Для домена - через Nginx прокси (/rtc)

console.log('🌐 Конфигурация:');
console.log('   API:', API_URL);
console.log('   LiveKit:', LIVEKIT_URL);


