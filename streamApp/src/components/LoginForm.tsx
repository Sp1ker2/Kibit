import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_URL } from "@/config"

interface Room {
  id: number
  name: string
  description: string
}

interface LoginFormProps {
  onLogin: (userType: "admin" | "user", username: string, room: string) => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [rooms, setRooms] = useState<Room[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingRooms, setLoadingRooms] = useState(true)

  // Загружаем список комнат при монтировании
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch(`${API_URL}/api/room-list`)
        if (response.ok) {
          const data = await response.json()
          setRooms(data)
          // Автоматически выбираем первую комнату
          if (data.length > 0) {
            setSelectedRoom(data[0].name)
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки комнат:', err)
      } finally {
        setLoadingRooms(false)
      }
    }

    fetchRooms()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    // Проверяем что комната выбрана
    if (!selectedRoom) {
      setError("Выберите комнату")
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: login, password, room: selectedRoom }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Используем роль из ответа API напрямую
        const userType = (data.user.role || "user") as "admin" | "user"
        onLogin(userType, data.user.username, selectedRoom)
      } else {
        setError(data.error || "Ошибка авторизации")
      }
    } catch (err) {
      console.error('Ошибка авторизации:', err)
      setError("Не удалось подключиться к серверу. Запустите: ./start.sh")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Войдите в аккаунт</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="room">Комната</Label>
              {loadingRooms ? (
                <div className="text-sm text-muted-foreground">Загрузка комнат...</div>
              ) : (
                <select
                  id="room"
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Выберите комнату</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.name}>
                      {room.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login">Логин</Label>
              <Input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button type="submit" className="w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </Button>
        <div className="text-sm text-muted-foreground text-center mt-2">
          <a 
            href="/logs" 
            className="text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault()
              window.location.href = '/logs'
            }}
          >
            📋 Переглянути логи рекордерів
          </a>
        </div>
      </CardFooter>
    </Card>
  )
}

