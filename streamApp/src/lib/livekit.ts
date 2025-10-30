// Сервис для работы с LiveKit
// В продакшене токены должны генерироваться на бэкенде

import { LIVEKIT_URL } from '@/config'

export const LIVEKIT_SERVER_URL = LIVEKIT_URL

// Для разработки с livekit-server --dev
export const LIVEKIT_API_KEY = "devkey"
export const LIVEKIT_API_SECRET = "secret"

/**
 * Генерирует имя комнаты для пользователя
 */
export function generateRoomName(username: string): string {
  return `stream_${username.toLowerCase().replace(/\s+/g, '_')}`
}

/**
 * Временная функция для генерации токена
 * В продакшене это должно делаться на сервере
 * 
 * Для работы требуется установить: npm install jose
 */
export async function generateToken(
  roomName: string,
  participantName: string,
  metadata?: string
): Promise<string> {
  try {
    // Импортируем jose динамически
    const { SignJWT } = await import('jose')
    
    const token = await new SignJWT({
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      iss: LIVEKIT_API_KEY,
      nbf: Math.floor(Date.now() / 1000),
      sub: participantName,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
      },
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(new TextEncoder().encode(LIVEKIT_API_SECRET))

    return token
  } catch (error) {
    console.error('Ошибка генерации токена:', error)
    throw new Error('Не удалось сгенерировать токен для подключения')
  }
}

