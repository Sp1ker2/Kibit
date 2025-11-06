import { useEffect, useRef } from "react"
import { Room, RoomEvent, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from "livekit-client"
import { LIVEKIT_SERVER_URL, generateToken } from "@/lib/livekit"

interface StreamPreviewProps {
  roomName: string
  onRoomReady?: (room: Room, videoElement: HTMLVideoElement) => void
}

export function StreamPreview({ roomName, onRoomReady }: StreamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    let mounted = true
    const newRoom = new Room()
    roomRef.current = newRoom

    const connectToStream = async () => {
      try {
        console.log('🔌 Подключаемся к комнате:', roomName)
        
        // Генерируем токен для просмотра
        const token = await generateToken(roomName, `preview_${Date.now()}`)
        
        // Подключаемся к комнате
        await newRoom.connect(LIVEKIT_SERVER_URL, token)
        
        if (!mounted) {
          newRoom.disconnect()
          return
        }

        console.log('✅ Подключено к комнате:', roomName, 'Участников:', newRoom.remoteParticipants.size)

        // Обработчик новых треков
        newRoom.on(RoomEvent.TrackSubscribed, (
          track: RemoteTrack,
          _publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          console.log('📹 Получен трек:', track.kind, 'от', participant.identity)
          if (track.kind === 'video' && videoRef.current) {
            track.attach(videoRef.current)
            console.log('✅ Видео прикреплено к элементу')
          }
        })

        // Обработчик отключения участников
        newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          console.log('👋 Участник отключился:', participant.identity)
        })

        // Проверяем уже существующие треки
        newRoom.remoteParticipants.forEach(participant => {
          console.log('👤 Проверяем участника:', participant.identity)
          participant.trackPublications.forEach(publication => {
            if (publication.track && publication.kind === 'video' && videoRef.current) {
              console.log('📹 Найден видео трек, прикрепляем...')
              publication.track.attach(videoRef.current)
            }
          })
        })

        // Передаем room и video наружу
        if (videoRef.current && onRoomReady) {
          onRoomReady(newRoom, videoRef.current)
        }

      } catch (err) {
        console.error('❌ Ошибка подключения к превью:', err)
      }
    }

    connectToStream()

    return () => {
      console.log('🔴 Отключаемся от комнаты:', roomName)
      mounted = false
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
    }
  }, [roomName])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
    />
  )
}

