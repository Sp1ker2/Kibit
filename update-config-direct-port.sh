#!/bin/bash
# Обновление config.ts для использования прямого порта 7880

CONFIG_FILE="/www/wwwroot/LiveKit/streamApp/src/config.ts"

echo "🔧 Обновление config.ts для прямого подключения к порту 7880..."
echo ""

# Создаем резервную копию
cp ${CONFIG_FILE} ${CONFIG_FILE}.bak
echo "✅ Создана резервная копия: ${CONFIG_FILE}.bak"
echo ""

# Обновляем конфигурацию
cat > ${CONFIG_FILE} <<'EOF'
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

// LiveKit URL - используем прямой порт 7880 (проксирование через Nginx не работает)
// Всегда используем прямой порт для LiveKit
export const LIVEKIT_URL = `${wsProtocol}//${host}:7880`;

console.log('🌐 Конфигурация:');
console.log('   API:', API_URL);
console.log('   LiveKit:', LIVEKIT_URL);
EOF

echo "✅ Файл ${CONFIG_FILE} обновлен"
echo ""
echo "📋 Изменения:"
echo "   - LIVEKIT_URL теперь всегда использует прямой порт 7880"
echo "   - Убрано проксирование через Nginx"
echo ""
echo "⚠️  ВАЖНО: Порт 7880 должен быть открыт в firewall!"
echo ""
echo "Проверка порта:"
if netstat -tulpn 2>/dev/null | grep -q 7880 || ss -tulpn 2>/dev/null | grep -q 7880; then
    echo "✅ Порт 7880 слушается"
else
    echo "❌ Порт 7880 НЕ слушается"
fi
echo ""
echo "Проверка firewall:"
if ufw status | grep -q "7880"; then
    echo "✅ Порт 7880 открыт в firewall"
else
    echo "⚠️  Порт 7880 может быть закрыт в firewall"
    echo "   Откройте: sudo ufw allow 7880/tcp"
fi
echo ""
echo "✅ Готово! Теперь LiveKit будет подключаться напрямую к порту 7880"
echo ""
echo "🔄 После обновления:"
echo "   1. Перезагрузите daemon в панели (чтобы перезапустить frontend)"
echo "   2. Обновите страницу в браузере (Ctrl+F5)"
echo "   3. Попробуйте запустить стрим"

