import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, Loader2 } from "lucide-react"
import { API_URL } from "@/config"

interface Room {
  id: number
  name: string
  description: string
}

export function RoomsManagementPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomDescription, setNewRoomDescription] = useState("")
  const [creating, setCreating] = useState(false)

  // Загрузка комнат
  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/room-list`)
      if (response.ok) {
        const data = await response.json()
        setRooms(data)
      }
    } catch (err) {
      console.error('Ошибка загрузки комнат:', err)
      setError('Не удалось загрузить список комнат')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newRoomName.trim()) {
      setError('Введите название комнаты')
      return
    }

    setCreating(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/room-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRoomName,
          description: newRoomDescription
        })
      })

      if (response.ok) {
        setNewRoomName('')
        setNewRoomDescription('')
        fetchRooms()
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка создания комнаты')
      }
    } catch (err) {
      console.error('Ошибка создания комнаты:', err)
      setError('Не удалось создать комнату')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRoom = async (id: number) => {
    if (!confirm('Вы уверены что хотите удалить эту комнату?')) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/room-list/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchRooms()
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка удаления комнаты')
      }
    } catch (err) {
      console.error('Ошибка удаления комнаты:', err)
      setError('Не удалось удалить комнату')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Форма создания комнаты */}
      <Card>
        <CardHeader>
          <CardTitle>Создать новую комнату</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="roomName">Название комнаты</Label>
              <Input
                id="roomName"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Комната 1"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="roomDescription">Описание (опционально)</Label>
              <Input
                id="roomDescription"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Описание комнаты"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={creating}>
              <Plus className="h-4 w-4 mr-2" />
              {creating ? 'Создание...' : 'Создать комнату'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Список комнат */}
      <Card>
        <CardHeader>
          <CardTitle>Список комнат ({rooms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rooms.length === 0 ? (
              <p className="text-muted-foreground">Нет созданных комнат</p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{room.name}</h3>
                    {room.description && (
                      <p className="text-sm text-muted-foreground">{room.description}</p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteRoom(room.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

