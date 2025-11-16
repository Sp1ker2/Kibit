import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Folder, FileVideo, ArrowLeft, Play, Loader2, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RecordingPlayer } from "./RecordingPlayer"
import { API_URL } from "@/config"

interface DriveFolder {
  id: string
  name: string
  createdTime?: string
  modifiedTime?: string
  roomId?: string
  userId?: string
}

interface DriveVideo {
  id: string
  name: string
  size: number
  createdTime?: string
  modifiedTime?: string
  webViewLink?: string
  thumbnailLink?: string
}

type ViewType = 'rooms' | 'users' | 'dates' | 'videos'

interface DriveRecordingsPageProps {
  searchQuery: string
}

export function DriveRecordingsPage({ searchQuery }: DriveRecordingsPageProps) {
  const [viewType, setViewType] = useState<ViewType>('rooms')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  
  // Навигация
  const [selectedRoom, setSelectedRoom] = useState<DriveFolder | null>(null)
  const [selectedUser, setSelectedUser] = useState<DriveFolder | null>(null)
  const [selectedDate, setSelectedDate] = useState<DriveFolder | null>(null)
  
  // Данные
  const [rooms, setRooms] = useState<DriveFolder[]>([])
  const [users, setUsers] = useState<DriveFolder[]>([])
  const [dates, setDates] = useState<DriveFolder[]>([])
  const [videos, setVideos] = useState<DriveVideo[]>([])
  
  const [selectedVideo, setSelectedVideo] = useState<DriveVideo | null>(null)
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null)

  // Загрузка комнат
  const loadRooms = async () => {
    try {
      setLoading(true)
      setError("")
      
      const response = await fetch(`${API_URL}/api/drive/rooms`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Не удалось загрузить комнаты')
      }

      const data = await response.json()
      setRooms(data)
      setViewType('rooms')
      setSelectedRoom(null)
      setSelectedUser(null)
      setSelectedDate(null)
    } catch (err: any) {
      console.error('Ошибка загрузки комнат:', err)
      setError(err.message || 'Ошибка загрузки комнат из Google Drive')
    } finally {
      setLoading(false)
    }
  }

  // Загрузка пользователей в комнате
  const loadUsers = async (roomId: string) => {
    try {
      setLoading(true)
      setError("")
      
      const response = await fetch(`${API_URL}/api/drive/rooms/${roomId}/users`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Не удалось загрузить пользователей')
      }

      const data = await response.json()
      setUsers(data)
      setViewType('users')
      setSelectedUser(null)
      setSelectedDate(null)
    } catch (err: any) {
      console.error('Ошибка загрузки пользователей:', err)
      setError(err.message || 'Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  // Загрузка дат у пользователя
  const loadDates = async (userId: string) => {
    try {
      setLoading(true)
      setError("")
      
      const response = await fetch(`${API_URL}/api/drive/users/${userId}/dates`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Не удалось загрузить даты')
      }

      const data = await response.json()
      setDates(data)
      setViewType('dates')
      setSelectedDate(null)
    } catch (err: any) {
      console.error('Ошибка загрузки дат:', err)
      setError(err.message || 'Ошибка загрузки дат')
    } finally {
      setLoading(false)
    }
  }

  // Загрузка видео в дате
  const loadVideos = async (dateId: string) => {
    try {
      setLoading(true)
      setError("")
      
      const response = await fetch(`${API_URL}/api/drive/dates/${dateId}/videos`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Не удалось загрузить видео')
      }

      const data = await response.json()
      setVideos(data)
      setViewType('videos')
    } catch (err: any) {
      console.error('Ошибка загрузки видео:', err)
      setError(err.message || 'Ошибка загрузки видео')
    } finally {
      setLoading(false)
    }
  }

  // Обработчики навигации
  const handleRoomClick = (room: DriveFolder) => {
    setSelectedRoom(room)
    loadUsers(room.id)
  }

  const handleUserClick = (user: DriveFolder) => {
    setSelectedUser(user)
    loadDates(user.id)
  }

  const handleDateClick = (date: DriveFolder) => {
    setSelectedDate(date)
    loadVideos(date.id)
  }

  const handleBack = () => {
    if (viewType === 'videos' && selectedDate) {
      // Вернуться к датам
      if (selectedUser) {
        loadDates(selectedUser.id)
      }
    } else if (viewType === 'dates' && selectedUser) {
      // Вернуться к пользователям
      if (selectedRoom) {
        loadUsers(selectedRoom.id)
      }
    } else if (viewType === 'users' && selectedRoom) {
      // Вернуться к комнатам
      loadRooms()
    }
  }

  const handleVideoClick = async (video: DriveVideo) => {
    setSelectedVideo(video)
    setLoading(true)
    
    try {
      // Получаем прямую ссылку на видео
      const response = await fetch(`${API_URL}/api/drive/files/${video.id}/stream`)
      
      if (!response.ok) {
        throw new Error('Не удалось получить ссылку на видео')
      }

      const data = await response.json()
      setVideoStreamUrl(data.url || video.webViewLink || '')
    } catch (err: any) {
      console.error('Ошибка получения ссылки на видео:', err)
      setError(err.message || 'Ошибка получения ссылки на видео')
      setVideoStreamUrl(video.webViewLink || '')
    } finally {
      setLoading(false)
    }
  }

  // Форматирование размера файла
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Форматирование даты
  const formatDate = (dateString?: string): string => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Загружаем комнаты при монтировании
  useEffect(() => {
    loadRooms()
  }, [])

  // Фильтрация по поисковому запросу
  const filteredItems = () => {
    const items = 
      viewType === 'rooms' ? rooms :
      viewType === 'users' ? users :
      viewType === 'dates' ? dates :
      videos

    if (!searchQuery) return items

    const query = searchQuery.toLowerCase()
    return items.filter(item => 
      item.name.toLowerCase().includes(query)
    )
  }

  if (loading && viewType === 'rooms' && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">❌ Ошибка</p>
            <p>{error}</p>
            <Button onClick={loadRooms} className="mt-4">
              Попробовать снова
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Хлебные крошки */}
      {(viewType !== 'rooms' || selectedRoom || selectedUser || selectedDate) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadRooms}
                className="h-auto p-0"
              >
                <HardDrive className="h-4 w-4 mr-1" />
                Комнаты
              </Button>
              {selectedRoom && (
                <>
                  <span>/</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRoomClick(selectedRoom)}
                    className="h-auto p-0"
                  >
                    {selectedRoom.name}
                  </Button>
                </>
              )}
              {selectedUser && (
                <>
                  <span>/</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUserClick(selectedUser)}
                    className="h-auto p-0"
                  >
                    {selectedUser.name}
                  </Button>
                </>
              )}
              {selectedDate && (
                <>
                  <span>/</span>
                  <span>{selectedDate.name}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Кнопка "Назад" */}
      {viewType !== 'rooms' && (
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
      )}

      {/* Заголовок */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewType === 'rooms' && '📁 Комнаты'}
            {viewType === 'users' && `👥 Пользователи в комнате "${selectedRoom?.name}"`}
            {viewType === 'dates' && `📅 Даты пользователя "${selectedUser?.name}"`}
            {viewType === 'videos' && `🎬 Видео от ${selectedDate?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {viewType === 'rooms' && filteredItems().map((room: DriveFolder) => (
                <Card
                  key={room.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleRoomClick(room)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Folder className="h-8 w-8 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-semibold">{room.name}</p>
                        {room.modifiedTime && (
                          <p className="text-sm text-muted-foreground">
                            {formatDate(room.modifiedTime)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {viewType === 'users' && filteredItems().map((user: DriveFolder) => (
                <Card
                  key={user.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleUserClick(user)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Folder className="h-8 w-8 text-green-500" />
                      <div className="flex-1">
                        <p className="font-semibold">{user.name}</p>
                        {user.modifiedTime && (
                          <p className="text-sm text-muted-foreground">
                            {formatDate(user.modifiedTime)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {viewType === 'dates' && filteredItems().map((date: DriveFolder) => (
                <Card
                  key={date.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleDateClick(date)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Folder className="h-8 w-8 text-purple-500" />
                      <div className="flex-1">
                        <p className="font-semibold">{date.name}</p>
                        {date.modifiedTime && (
                          <p className="text-sm text-muted-foreground">
                            {formatDate(date.modifiedTime)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {viewType === 'videos' && filteredItems().map((video: DriveVideo) => (
                <Card
                  key={video.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleVideoClick(video)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <FileVideo className="h-8 w-8 text-red-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{video.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(video.size)}
                          </p>
                        </div>
                      </div>
                      {video.createdTime && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(video.createdTime)}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleVideoClick(video)
                        }}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Смотреть
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && filteredItems().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'Ничего не найдено' : 'Пусто'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Плеер видео */}
      {selectedVideo && videoStreamUrl && (
        <RecordingPlayer
          path={videoStreamUrl}
          username={selectedUser?.name || selectedVideo.name}
          onClose={() => {
            setSelectedVideo(null)
            setVideoStreamUrl(null)
          }}
        />
      )}
    </div>
  )
}

