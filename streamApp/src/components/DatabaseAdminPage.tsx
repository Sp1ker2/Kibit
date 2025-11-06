import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Edit2, Check, X, Plus, Loader2, LogOut, Database } from "lucide-react"
import { API_URL } from "@/config"

interface User {
  id: number
  username: string
  password: string
  role: string
  room_name: string | null
  created_at: string
}

interface Room {
  id: number
  name: string
  description: string | null
}

// Пароль для доступа к БД (можно изменить)
const DB_PASSWORD = "database2024"

export function DatabaseAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"users" | "rooms">("users")
  const [error, setError] = useState("")
  
  // Редактирование пользователя
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editUser, setEditUser] = useState<Partial<User>>({})
  
  // Редактирование комнаты
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)
  const [editRoom, setEditRoom] = useState<Partial<Room>>({})
  
  // Новая комната
  const [newRoom, setNewRoom] = useState({ name: "", description: "" })
  
  // Новый пользователь
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" as "user" | "admin", room_name: "" })

  // Проверка пароля при загрузке
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('db_auth')
    if (savedAuth === DB_PASSWORD) {
      setIsAuthenticated(true)
      fetchData()
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === DB_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('db_auth', password)
      setError("")
      fetchData()
    } else {
      setError("Неверный пароль доступа к БД")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('db_auth')
    setPassword("")
  }

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([fetchUsers(), fetchRooms()])
    setLoading(false)
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err)
    }
  }

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/room-list`)
      if (response.ok) {
        const data = await response.json()
        setRooms(data)
      }
    } catch (err) {
      console.error('Ошибка загрузки комнат:', err)
    }
  }

  // Редактирование пользователя
  const startEditUser = (user: User) => {
    setEditingUserId(user.id)
    setEditUser(user)
  }

  const saveEditUser = async () => {
    if (!editUser.username || !editUser.password) return

    try {
      const response = await fetch(`${API_URL}/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUser)
      })

      if (response.ok) {
        setEditingUserId(null)
        fetchUsers()
      } else {
        alert('Ошибка обновления')
      }
    } catch (err) {
      console.error('Ошибка обновления:', err)
      alert('Ошибка обновления')
    }
  }

  const deleteUser = async (id: number) => {
    if (!confirm('Удалить пользователя из БД?')) return

    try {
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchUsers()
      }
    } catch (err) {
      console.error('Ошибка удаления:', err)
    }
  }

  const createUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      alert('Введите логин и пароль')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username.trim(),
          password: newUser.password.trim(),
          role: newUser.role,
          room_name: newUser.room_name || null
        })
      })

      if (response.ok) {
        setNewUser({ username: "", password: "", role: "user", room_name: "" })
        fetchUsers()
        alert('Пользователь создан!')
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка создания')
      }
    } catch (err) {
      console.error('Ошибка создания:', err)
      alert('Ошибка создания')
    }
  }

  // Редактирование комнаты
  const startEditRoom = (room: Room) => {
    setEditingRoomId(room.id)
    setEditRoom(room)
  }

  const saveEditRoom = async () => {
    if (!editRoom.name) return

    try {
      const response = await fetch(`${API_URL}/api/room-list/${editingRoomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRoom)
      })

      if (response.ok) {
        setEditingRoomId(null)
        fetchRooms()
      }
    } catch (err) {
      console.error('Ошибка обновления:', err)
    }
  }

  const deleteRoom = async (id: number) => {
    if (!confirm('Удалить комнату из БД?')) return

    try {
      const response = await fetch(`${API_URL}/api/room-list/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchRooms()
      }
    } catch (err) {
      console.error('Ошибка удаления:', err)
    }
  }

  const createRoom = async () => {
    if (!newRoom.name.trim()) {
      alert('Введите название комнаты')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/room-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoom)
      })

      if (response.ok) {
        setNewRoom({ name: "", description: "" })
        fetchRooms()
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка создания')
      }
    } catch (err) {
      console.error('Ошибка создания:', err)
    }
  }

  // Форма входа
  if (!isAuthenticated) {
    return (
      <div className="dark">
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-6 w-6" />
                Доступ к базе данных
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="db-password">Пароль БД</Label>
                    <Input
                      id="db-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Введите пароль для доступа к БД"
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button type="submit" className="w-full">
                    Войти в БД
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Защищённый доступ к управлению базой данных
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Интерфейс управления БД
  return (
    <div className="dark">
      <div className="min-h-screen w-full bg-background">
        {/* Шапка */}
        <header className="sticky top-0 z-50 w-full border-b bg-background backdrop-blur">
          <div className="flex h-16 w-full items-center justify-between px-8">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6" />
              <h1 className="text-xl font-bold">Управление базой данных</h1>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Выйти
            </Button>
          </div>
        </header>

        {/* Контент */}
        <main className="container max-w-7xl mx-auto py-8 px-4">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Табы */}
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "users" ? "default" : "outline"}
                  onClick={() => setActiveTab("users")}
                >
                  👥 Таблица Users ({users.length})
                </Button>
                <Button
                  variant={activeTab === "rooms" ? "default" : "outline"}
                  onClick={() => setActiveTab("rooms")}
                >
                  🏠 Таблица Rooms ({rooms.length})
                </Button>
              </div>

              {/* Таблица пользователей */}
              {activeTab === "users" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Таблица Users</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Форма создания пользователя */}
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h3 className="font-semibold mb-3">Создать нового пользователя</h3>
                      <div className="grid grid-cols-5 gap-2">
                        <Input
                          placeholder="Username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        />
                        <Input
                          placeholder="Password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        />
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({...newUser, role: e.target.value as "user" | "admin"})}
                          className="h-10 rounded border px-3 bg-background"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                        <select
                          value={newUser.room_name}
                          onChange={(e) => setNewUser({...newUser, room_name: e.target.value})}
                          className="h-10 rounded border px-3 bg-background"
                        >
                          <option value="">Не указана</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.name}>📍 {r.name}</option>
                          ))}
                        </select>
                        <Button onClick={createUser}>
                          <Plus className="h-4 w-4 mr-2" />
                          Создать
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className="p-3">ID</th>
                            <th className="p-3">Username</th>
                            <th className="p-3">Password</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Room</th>
                            <th className="p-3">Created</th>
                            <th className="p-3">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id} className="border-b hover:bg-accent/30">
                              {editingUserId === user.id ? (
                                <>
                                  <td className="p-3">{user.id}</td>
                                  <td className="p-3">
                                    <Input
                                      value={editUser.username || ""}
                                      onChange={(e) => setEditUser({...editUser, username: e.target.value})}
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      value={editUser.password || ""}
                                      onChange={(e) => setEditUser({...editUser, password: e.target.value})}
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <select
                                      value={editUser.role || "user"}
                                      onChange={(e) => setEditUser({...editUser, role: e.target.value})}
                                      className="h-8 rounded border px-2 bg-background"
                                    >
                                      <option value="user">user</option>
                                      <option value="admin">admin</option>
                                    </select>
                                  </td>
                                  <td className="p-3">
                                    <select
                                      value={editUser.room_name || ""}
                                      onChange={(e) => setEditUser({...editUser, room_name: e.target.value || null})}
                                      className="h-8 rounded border px-2 bg-background"
                                    >
                                      <option value="">NULL</option>
                                      {rooms.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-3 text-xs text-muted-foreground">{user.created_at}</td>
                                  <td className="p-3">
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={saveEditUser}>
                                        <Check className="h-4 w-4 text-green-500" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                                        <X className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-3 text-muted-foreground">{user.id}</td>
                                  <td className="p-3 font-medium">{user.username}</td>
                                  <td className="p-3 font-mono text-xs">{user.password}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                      {user.role}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    {user.room_name ? (
                                      <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                                        📍 {user.room_name}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">NULL</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-xs text-muted-foreground">{new Date(user.created_at).toLocaleString('ru-RU')}</td>
                                  <td className="p-3">
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => startEditUser(user)}>
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => deleteUser(user.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Таблица комнат */}
              {activeTab === "rooms" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Таблица Rooms (Организации)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Форма создания */}
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h3 className="font-semibold mb-3">Создать новую комнату</h3>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Название (например: Moscow)"
                          value={newRoom.name}
                          onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
                        />
                        <Input
                          placeholder="Описание (опционально)"
                          value={newRoom.description}
                          onChange={(e) => setNewRoom({...newRoom, description: e.target.value})}
                        />
                        <Button onClick={createRoom}>
                          <Plus className="h-4 w-4 mr-2" />
                          Создать
                        </Button>
                      </div>
                    </div>

                    {/* Таблица */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className="p-3">ID</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rooms.map((room) => (
                            <tr key={room.id} className="border-b hover:bg-accent/30">
                              {editingRoomId === room.id ? (
                                <>
                                  <td className="p-3">{room.id}</td>
                                  <td className="p-3">
                                    <Input
                                      value={editRoom.name || ""}
                                      onChange={(e) => setEditRoom({...editRoom, name: e.target.value})}
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      value={editRoom.description || ""}
                                      onChange={(e) => setEditRoom({...editRoom, description: e.target.value})}
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={saveEditRoom}>
                                        <Check className="h-4 w-4 text-green-500" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingRoomId(null)}>
                                        <X className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-3 text-muted-foreground">{room.id}</td>
                                  <td className="p-3 font-medium">📍 {room.name}</td>
                                  <td className="p-3 text-muted-foreground">{room.description || '-'}</td>
                                  <td className="p-3">
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => startEditRoom(room)}>
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => deleteRoom(room.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

