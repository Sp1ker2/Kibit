import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

interface StreamViewerProps {
  username: string
  videoElement: HTMLVideoElement | null
  onClose: () => void
}

export function StreamViewer({ username, videoElement, onClose }: StreamViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Перемещаем video элемент в полноэкранный контейнер
    if (videoElement && containerRef.current) {
      const clonedVideo = videoElement.cloneNode(false) as HTMLVideoElement
      clonedVideo.srcObject = videoElement.srcObject
      clonedVideo.autoplay = true
      clonedVideo.playsInline = true
      clonedVideo.muted = false // Включаем звук в полноэкранном режиме
      clonedVideo.className = "w-full h-full object-contain"
      
      containerRef.current.appendChild(clonedVideo)
      
      return () => {
        if (clonedVideo && clonedVideo.parentNode) {
          clonedVideo.srcObject = null
          clonedVideo.remove()
        }
      }
    }
  }, [videoElement])

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
            <div ref={containerRef} className="w-full h-full" />

            {/* Индикатор LIVE */}
            <div className="absolute top-4 left-4">
              <Badge className="bg-red-600 hover:bg-red-700">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

