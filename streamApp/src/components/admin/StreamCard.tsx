import { useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StreamPreview } from "./StreamPreview"
import { Room } from "livekit-client"

interface Stream {
  id: string
  name: string
  username: string
  numParticipants: number
  creationTime: number
}

interface StreamCardProps {
  stream: Stream
  onClick: () => void
  onVideoReady: (roomName: string, videoEl: HTMLVideoElement) => void
}

export function StreamCard({ stream, onClick, onVideoReady }: StreamCardProps) {
  const handleRoomReady = useCallback((room: Room, videoEl: HTMLVideoElement) => {
    onVideoReady(stream.name, videoEl)
  }, [stream.name, onVideoReady])

  return (
    <Card
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Превью видео */}
        <div className="relative aspect-video bg-black overflow-hidden">
          <StreamPreview 
            roomName={stream.name}
            onRoomReady={handleRoomReady}
          />
          {/* Индикатор LIVE */}
          <div className="absolute top-1.5 left-1.5 z-10">
            <Badge className="bg-red-600 hover:bg-red-700 text-xs py-0 px-1.5 h-5">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            </Badge>
          </div>
        </div>

        {/* Информация */}
        <div className="px-2 py-1.5">
          <h3 className="font-medium text-sm text-foreground line-clamp-1">
            {stream.username}
          </h3>
        </div>
      </CardContent>
    </Card>
  )
}

