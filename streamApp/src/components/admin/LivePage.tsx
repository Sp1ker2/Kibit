import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { StreamViewer } from "./StreamViewer"
import { StreamCard } from "./StreamCard"
import { API_URL } from "@/config"

interface Stream {
  id: string
  name: string
  username: string
  numParticipants: number
  creationTime: number
}

const ITEMS_PER_PAGE = 18

interface LivePageProps {
  searchQuery: string
}

export function LivePage({ searchQuery }: LivePageProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [allStreams, setAllStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [videoElements, setVideoElements] = useState<Map<string, HTMLVideoElement>>(new Map())
  const isFirstLoadRef = useRef(true)

  // Callback для сохранения video элементов
  const handleVideoReady = useCallback((roomName: string, videoEl: HTMLVideoElement) => {
    setVideoElements(prev => new Map(prev).set(roomName, videoEl))
  }, [])

  // Загружаем список активных стримов
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        // Показываем loader только при первой загрузке
        if (isFirstLoadRef.current) {
          setLoading(true)
        }
        
        const response = await fetch(`${API_URL}/api/rooms`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || errorData.error || 'Не удалось загрузить стримы')
        }
        
        const rooms = await response.json()
        
        // Преобразуем данные комнат в формат стримов
        // Фильтруем только активные комнаты (где есть участники)
        const streams: Stream[] = rooms
          .filter((room: any) => room.numParticipants > 0)
          .map((room: any) => {
            // Извлекаем имя пользователя из названия комнаты (stream_username)
            const username = room.name.replace('stream_', '').replace(/_/g, ' ')
            
            return {
              id: room.id,
              name: room.name,
              username: username,
              numParticipants: room.numParticipants,
              creationTime: room.creationTime,
            }
          })
        
        setAllStreams(streams)
        setError("") // Очищаем ошибку при успешной загрузке
        
        // После первой загрузки снимаем флаг
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false
          setLoading(false)
        }
      } catch (err: any) {
        console.error('Ошибка загрузки стримов:', err)
        
        // Проверяем тип ошибки
        if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
          setError('API сервер не запущен. Запустите: ./start.sh')
        } else if (err.message?.includes('LiveKit')) {
          setError(err.message)
        } else {
          setError(err.message || 'Ошибка загрузки стримов')
        }
        
        // Снимаем loading даже при ошибке
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false
          setLoading(false)
        }
      }
    }

    // Загружаем сразу
    fetchStreams()

    // Обновляем каждые 2 секунды для быстрого отображения новых стримов
    const interval = setInterval(fetchStreams, 2000)

    return () => clearInterval(interval)
  }, [])

  // Фильтрация стримов по поисковому запросу
  const filteredStreams = allStreams.filter((stream) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const username = stream.username.toLowerCase()
    return username.includes(query)
  })

  // Сбрасываем страницу на первую при изменении поискового запроса
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])
  
  const totalPages = Math.ceil(filteredStreams.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentStreams = filteredStreams.slice(startIndex, endIndex)

  return (
    <div className="space-y-6">

      {/* Состояние загрузки */}
      {loading && allStreams.length === 0 && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-semibold">{error}</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Чтобы всё работало, нужно запустить:</p>
              <div className="bg-secondary p-3 rounded-md font-mono text-xs">
                <p>1. LiveKit сервер: <code className="text-foreground">livekit-server --dev</code></p>
                <p>2. API сервер: <code className="text-foreground">npm run api</code></p>
                <p className="mt-2">Или всё сразу: <code className="text-foreground">./start.sh</code></p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Нет активных стримов */}
      {!loading && !error && allStreams.length === 0 && (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 250px)' }}>
          <p className="text-2xl text-muted-foreground">
            Нет активных стримов
          </p>
        </div>
      )}

      {/* Список стримов */}
      {!error && currentStreams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {currentStreams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              onClick={() => setSelectedStream(stream)}
              onVideoReady={handleVideoReady}
            />
          ))}
        </div>
      )}

      {/* Пагинация - показываем только если больше одной страницы */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={`text-foreground hover:text-foreground ${
                    currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }`}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber: number
                if (totalPages <= 5) {
                  pageNumber = i + 1
                } else if (currentPage <= 3) {
                  pageNumber = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i
                } else {
                  pageNumber = currentPage - 2 + i
                }
                
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                      className="cursor-pointer text-foreground hover:text-foreground"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={`text-foreground hover:text-foreground ${
                    currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Просмотр стрима */}
      {selectedStream && (
        <StreamViewer
          username={selectedStream.username}
          videoElement={videoElements.get(selectedStream.name) || null}
          onClose={() => setSelectedStream(null)}
        />
      )}
    </div>
  )
}

