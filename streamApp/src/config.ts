// Динамическая конфигурация для работы в локальной сети

// Получаем текущий хост из браузера
const getCurrentHost = () => {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
};

// API URL (используем текущий хост)
export const API_URL = `http://${getCurrentHost()}:3001`;

// LiveKit URL (используем текущий хост)
export const LIVEKIT_URL = `ws://${getCurrentHost()}:7880`;

console.log('🌐 Конфигурация:');
console.log('   API:', API_URL);
console.log('   LiveKit:', LIVEKIT_URL);


