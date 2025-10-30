import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { API_URL } from "@/config"

interface RecordingPlayerProps {
  filename: string
  username: string
  onClose: () => void
}

export function RecordingPlayer({ filename, username, onClose }: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Закрытие по ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="w-full max-w-6xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl">{username}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              controls
              autoPlay
              className="w-full h-full"
              src={`${API_URL}/api/recordings/stream/${filename}`}
            >
              Ваш браузер не поддерживает воспроизведение видео.
            </video>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

