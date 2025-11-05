import { useState, useEffect, useRef } from "react"
import { Room } from "livekit-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VideoOff, Radio, LogOut } from "lucide-react"
import { LIVEKIT_SERVER_URL, generateToken, generateRoomName } from "@/lib/livekit"
import { API_URL } from "@/config"

interface UserStreamPageProps {
  username: string
  onLogout: () => void
}

export function UserStreamPage({ username, onLogout }: UserStreamPageProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string>("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    // Cleanup при выходе
    return () => {
      if (room) {
        room.disconnect()
      }
    }
  }, [room])

  const startStream = async () => {
    try {
      setError("")
      console.log("Начинаем запуск стрима...")
      
      // Проверяем доступность mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("getDisplayMedia не доступен. Убедитесь что используете HTTPS или localhost")
      }
      
      // ВАЖНО: getDisplayMedia должен быть вызван ПЕРВЫМ, сразу из обработчика клика!
      // ПРИМЕЧАНИЕ: getDisplayMedia НЕ поддерживает exact и min constraints, только ideal
      console.log("Запрашиваем доступ к экрану...")
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 }
        },
        audio: true // Захватываем звук с экрана
      })
      
      // Получаем видео трек один раз и используем везде
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) {
        throw new Error("Не удалось получить видео трек")
      }
      
      // Применяем настройки качества к видео треку
      // Настраиваем параметры видео трека для максимального качества
      const settings = videoTrack.getSettings()
      console.log("📹 Настройки видео трека:", settings)
      
      // Применяем ограничения для максимального качества
      try {
        await videoTrack.applyConstraints({
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 }
        })
        
        const newSettings = videoTrack.getSettings()
        console.log("✅ Применены настройки качества:", newSettings)
        console.log("📊 Финальное разрешение:", newSettings.width, "x", newSettings.height, "@", newSettings.frameRate, "fps")
      } catch (err) {
        console.warn("⚠️ Не удалось применить ограничения, используем доступное:", err)
        // Пробуем с более мягкими ограничениями
        try {
          await videoTrack.applyConstraints({
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          })
        } catch (err2) {
          console.warn("⚠️ Не удалось применить даже мягкие ограничения:", err2)
          // Используем то что есть
        }
      }
      
      console.log("Доступ к экрану получен")

      // Устанавливаем состояние стриминга СРАЗУ
      setIsStreaming(true)

      // Начинаем запись
      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
        })
        
        recordedChunksRef.current = []
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data)
          }
        }
        
        mediaRecorder.start(1000) // Сохраняем каждую секунду
        mediaRecorderRef.current = mediaRecorder
        console.log("📹 Запись началась")
      } catch (err) {
        console.error("❌ Ошибка запуска записи:", err)
      }

      // Показываем превью сразу
      if (videoRef.current) {
        console.log("Устанавливаем srcObject для видео элемента")
        console.log("Треки в потоке:", stream.getTracks().map(t => `${t.kind} - ${t.label}`))
        videoRef.current.srcObject = stream
        
        // Проверяем что поток активен
        console.log("Видео трек активен:", videoTrack?.enabled, "готов:", videoTrack?.readyState)
        
        // Форсируем воспроизведение
        videoRef.current.play().then(() => {
          console.log("✅ Видео воспроизводится")
        }).catch(err => {
          console.error("❌ Ошибка воспроизведения видео:", err)
        })
      } else {
        console.error("❌ videoRef.current is null!")
      }

      // Генерируем токен
      const roomName = generateRoomName(username)
      console.log("Имя комнаты:", roomName)
      
      const token = await generateToken(roomName, username)
      console.log("Токен сгенерирован")
      
      // Создаем комнату
      const newRoom = new Room()
      console.log("Подключаемся к серверу:", LIVEKIT_SERVER_URL)
      console.log("🌐 Полный URL для подключения:", LIVEKIT_SERVER_URL)
      
      // Подключаемся с таймаутом
      try {
        await Promise.race([
          newRoom.connect(LIVEKIT_SERVER_URL, token),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: не удалось подключиться к LiveKit серверу за 10 секунд')), 10000)
          )
        ])
        console.log("✅ Подключено к комнате")
      } catch (connectError: any) {
        console.error("❌ Ошибка подключения к LiveKit:", connectError)
        throw new Error(`Не удалось подключиться к LiveKit серверу (${LIVEKIT_SERVER_URL}). Проверьте что сервер запущен на порту 7880 и Nginx настроен для проксирования WebSocket. Ошибка: ${connectError.message || connectError}`)
      }
      
      setRoom(newRoom)

      // Публикуем видео трек в комнату с настройками качества
      console.log("Публикуем видео трек...")
      
      // Получаем текущие настройки трека
      const trackSettings = videoTrack.getSettings()
      const currentWidth = trackSettings.width || 1920
      const currentHeight = trackSettings.height || 1080
      const currentFrameRate = trackSettings.frameRate || 60
      
      console.log("📹 Настройки видео трека:", {
        width: currentWidth,
        height: currentHeight,
        frameRate: currentFrameRate,
        aspectRatio: trackSettings.aspectRatio,
        deviceId: trackSettings.deviceId
      })
      
      // Устанавливаем фиксированный высокий битрейт для стабильного качества
      // Для 1920x1080@60fps оптимальный битрейт: 8-10 Mbps
      // Для меньших разрешений используем пропорциональный битрейт
      const resolutionMultiplier = (currentWidth * currentHeight) / (1920 * 1080)
      const frameRateMultiplier = currentFrameRate / 60
      const baseBitrate = 8_000_000 // 8 Mbps базовая для 1080p@60fps
      const fixedBitrate = Math.floor(baseBitrate * resolutionMultiplier * frameRateMultiplier)
      
      // Ограничиваем разумными значениями
      const finalBitrate = Math.max(3_000_000, Math.min(fixedBitrate, 10_000_000)) // От 3 до 10 Mbps
      
      console.log(`📊 Фиксированный битрейт: ${(finalBitrate / 1_000_000).toFixed(2)} Mbps для ${currentWidth}x${currentHeight}@${currentFrameRate}fps`)
      
      // Публикуем с фиксированными настройками качества
      // Отключаем simulcast для стабильного фиксированного качества (без адаптации)
      await newRoom.localParticipant.publishTrack(videoTrack, {
        videoEncoding: {
          maxBitrate: finalBitrate, // Фиксированный высокий битрейт
          maxFramerate: currentFrameRate, // Максимальный FPS
        },
        simulcast: false, // ОТКЛЮЧЕНО для стабильного фиксированного качества (не адаптируется)
        // dtx: false, // Отключаем DTX (Discontinuous Transmission) для постоянной передачи
      })
      
      console.log(`✅ Видео трек опубликован с фиксированным качеством: ${(finalBitrate / 1_000_000).toFixed(2)} Mbps @ ${currentFrameRate} FPS (${currentWidth}x${currentHeight})`)
      console.log("⚠️ Simulcast отключен - качество будет стабильным без адаптации")

      // Публикуем аудио трек если есть
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        console.log("Публикуем аудио трек...")
        await newRoom.localParticipant.publishTrack(audioTrack)
        console.log("Аудио трек опубликован")
      }

      console.log("✅ Стрим запущен успешно!")

      // Обработка остановки захвата экрана
      videoTrack.onended = () => {
        console.log("Захват экрана остановлен пользователем")
        stopStream()
      }
      
    } catch (err: any) {
      console.error("❌ Ошибка запуска стрима:", err)
      console.error("Детали ошибки:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: LIVEKIT_SERVER_URL
      })
      
      let errorMessage = "Не удалось запустить стрим. "
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "Вы отменили захват экрана. Разрешите доступ к экрану для стриминга."
      } else if (err.message?.includes('connect') || err.message?.includes('LiveKit') || err.message?.includes('Timeout')) {
        errorMessage = `Не удалось подключиться к LiveKit серверу.\n\n` +
          `URL: ${LIVEKIT_SERVER_URL}\n\n` +
          `Проверьте:\n` +
          `1. LiveKit сервер запущен: livekit-server --dev\n` +
          `2. Порт 7880 открыт и доступен\n` +
          `3. Nginx настроен для проксирования WebSocket на /rtc\n` +
          `4. HTTPS работает (для wss:// подключения)\n\n` +
          `Ошибка: ${err.message || err}`
      } else {
        errorMessage += err.message || "Неизвестная ошибка."
      }
      
      setError(errorMessage)
      
      // Очищаем состояние при ошибке
      setIsStreaming(false)
      if (room) {
        try {
        room.disconnect()
        } catch (e) {
          console.error("Ошибка при отключении:", e)
        }
        setRoom(null)
      }
      
      // Останавливаем треки если они были захвачены
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
          tracks.forEach(track => track.stop())
          videoRef.current.srcObject = null
        } catch (e) {
          console.error("Ошибка при остановке треков:", e)
        }
      }
    }
  }

  const stopStream = async () => {
    console.log("🛑 Останавливаем стрим...")
    
    // Останавливаем запись
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      console.log("📹 Запись остановлена")
      
      // Ждем завершения записи и сохраняем
      mediaRecorderRef.current.onstop = async () => {
        try {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
          const fileSize = blob.size
          
          console.log("💾 Сохраняем запись, размер:", (fileSize / 1024 / 1024).toFixed(2), "MB")
          
          // Создаем FormData для отправки
          const formData = new FormData()
          const filename = `${username}_${Date.now()}.webm`
          formData.append('video', blob, filename)
          formData.append('username', username)
          formData.append('roomName', generateRoomName(username))
          
          // Отправляем на сервер
          const response = await fetch(`${API_URL}/api/recordings/upload`, {
            method: 'POST',
            body: formData
          })
          
          if (response.ok) {
            console.log("✅ Запись успешно сохранена")
          } else {
            console.error("❌ Ошибка сохранения записи")
          }
        } catch (err) {
          console.error("❌ Ошибка при сохранении:", err)
        }
      }
    }
    
    // Останавливаем треки
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    
    // Отключаемся от комнаты
    if (room) {
      room.disconnect()
      setRoom(null)
    }
    
    setIsStreaming(false)
    console.log("✅ Стрим остановлен")
  }

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Шапка */}
      <header className="sticky top-0 z-50 w-full border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95">
        <div className="flex h-16 w-full items-center justify-between px-8">
          <div className="flex items-center gap-3">

            <Badge variant="secondary" className="text-sm">
              {username}
            </Badge>
          </div>
          
          <Button variant="outline" onClick={onLogout} className="gap-2 text-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span>Выйти</span>
          </Button>
        </div>
      </header>

      {/* Контент */}
      <main className="container max-w-4xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Ошибка */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive font-semibold">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Запустите LiveKit сервер: <code className="bg-background px-2 py-1 rounded">livekit-server --dev</code>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Превью стрима */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-contain ${!isStreaming ? 'hidden' : ''}`}
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-secondary">
                    <VideoOff className="h-20 w-20 text-muted-foreground" />
                    <p className="text-muted-foreground text-lg">
                      Нажмите "Запустить стрим" для начала трансляции экрана
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Управление */}
          <div className="flex justify-center gap-4">
            {!isStreaming ? (
              <Button
                onClick={startStream}
                size="lg"
                className="gap-2"
              >
                <Radio className="h-5 w-5" />
                Запустить стрим
              </Button>
            ) : (
              <Button
                onClick={stopStream}
                variant="destructive"
                size="lg"
                className="gap-2"
              >
                <VideoOff className="h-5 w-5" />
                Остановить трансляцию
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

