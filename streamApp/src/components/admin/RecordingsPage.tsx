import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, HardDrive, Download, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { RecordingPlayer } from "./RecordingPlayer"
import { API_URL } from "@/config"

interface Recording {
  id: string
  filename: string
  username: string
  size: number
  duration: number
  date: string
  timestamp: number
}

const ITEMS_PER_PAGE = 18

interface RecordingsPageProps {
  searchQuery: string
}

export function RecordingsPage({ searchQuery }: RecordingsPageProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [allRecordings, setAllRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const isFirstLoadRef = useRef(true)

  // Загружаем список записей
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        if (isFirstLoadRef.current) {
          setLoading(true)
        }

        const response = await fetch(`${API_URL}/api/recordings`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || errorData.error || 'Не удалось загрузить записи')
        }

        const recordings = await response.json()
        setAllRecordings(recordings)
        setError("")

        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false
          setLoading(false)
        }
      } catch (err: any) {
        console.error('Ошибка загрузки записей:', err)

        if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
          setError('API сервер не запущен. Запустите: ./start.sh')
        } else {
          setError(err.message || 'Ошибка загрузки записей')
        }

        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false
          setLoading(false)
        }
      }
    }

    fetchRecordings()

    // Обновляем каждые 5 секунд
    const interval = setInterval(fetchRecordings, 5000)

    return () => clearInterval(interval)
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Фильтрация записей по поисковому запросу (по нику и дате)
  const filteredRecordings = allRecordings.filter((recording) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const username = recording.username.toLowerCase()
    const date = formatDate(recording.date).toLowerCase()
    return username.includes(query) || date.includes(query)
  })

  // Сбрасываем страницу на первую при изменении поискового запроса
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])
  
  const totalPages = Math.ceil(filteredRecordings.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentRecordings = filteredRecordings.slice(startIndex, endIndex)

  const handleDownload = (filename: string) => {
    window.open(`${API_URL}/api/recordings/${filename}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Состояние загрузки */}
      {loading && allRecordings.length === 0 && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-semibold">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Нет записей */}
      {!loading && !error && allRecordings.length === 0 && (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 250px)' }}>
          <p className="text-2xl text-muted-foreground">
            Нет записанных стримов
          </p>
        </div>
      )}

      {/* Список записей */}
      {!error && currentRecordings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {currentRecordings.map((recording) => (
            <Card
              key={recording.id}
              onClick={() => setSelectedRecording(recording)}
            >
              <CardContent className="p-0">
                {/* Превью видео */}
                <div className="relative aspect-video bg-black overflow-hidden group">
                  <video
                    src={`${API_URL}/api/recordings/stream/${recording.filename}#t=0.1`}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                </div>

                {/* Информация */}
                <div className="px-2 py-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="font-medium text-sm text-foreground">
                      {recording.username.length > 12 
                        ? `${recording.username.slice(0, 12)}...` 
                        : recording.username}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 flex-shrink-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(recording.filename)
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Скачать
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatDate(recording.date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatSize(recording.size)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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

      {/* Просмотр записи */}
      {selectedRecording && (
        <RecordingPlayer
          filename={selectedRecording.filename}
          username={selectedRecording.username}
          onClose={() => setSelectedRecording(null)}
        />
      )}
    </div>
  )
}

