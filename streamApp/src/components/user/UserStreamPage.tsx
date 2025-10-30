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
      
      // ВАЖНО: getDisplayMedia должен быть вызван ПЕРВЫМ, сразу из обработчика клика!
      console.log("Запрашиваем доступ к экрану...")
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true // Захватываем звук с экрана
      })
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
        const videoTrack = stream.getVideoTracks()[0]
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
      
      // Подключаемся
      await newRoom.connect(LIVEKIT_SERVER_URL, token)
      console.log("Подключено к комнате")
      setRoom(newRoom)

      // Публикуем видео трек в комнату
      const videoTrack = stream.getVideoTracks()[0]
      console.log("Публикуем видео трек...")
      await newRoom.localParticipant.publishTrack(videoTrack)
      console.log("Видео трек опубликован")

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
      console.error("Ошибка запуска стрима:", err)
      let errorMessage = "Не удалось запустить стрим. "
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "Вы отменили захват экрана. Разрешите доступ к экрану для стриминга."
      } else if (err.message?.includes('connect')) {
        errorMessage = "Не удалось подключиться к LiveKit серверу. Убедитесь что сервер запущен."
      } else {
        errorMessage += err.message || "Неизвестная ошибка."
      }
      
      setError(errorMessage)
      if (room) {
        room.disconnect()
        setRoom(null)
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

