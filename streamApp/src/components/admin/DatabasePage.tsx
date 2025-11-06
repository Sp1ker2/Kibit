import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Edit2, Check, X, Plus, Loader2 } from "lucide-react"
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

export function DatabasePage() {
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"users" | "rooms">("users")
  
  // Редактирование пользователя
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editUser, setEditUser] = useState<Partial<User>>({})
  
  // Редактирование комнаты
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)
  const [editRoom, setEditRoom] = useState<Partial<Room>>({})
  
  // Новая комната
  const [newRoom, setNewRoom] = useState({ name: "", description: "" })

  useEffect(() => {
    fetchData()
  }, [])

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
      }
    } catch (err) {
      console.error('Ошибка обновления:', err)
    }
  }

  const deleteUser = async (id: number) => {
    if (!confirm('Удалить пользователя?')) return

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
    if (!confirm('Удалить комнату?')) return

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
    if (!newRoom.name.trim()) return

    try {
      const response = await fetch(`${API_URL}/api/room-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoom)
      })

      if (response.ok) {
        setNewRoom({ name: "", description: "" })
        fetchRooms()
      }
    } catch (err) {
      console.error('Ошибка создания:', err)
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
      <Card>
        <CardHeader>
          <CardTitle>🗄️ Управление базой данных</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === "users" ? "default" : "outline"}
              onClick={() => setActiveTab("users")}
            >
              👥 Пользователи ({users.length})
            </Button>
            <Button
              variant={activeTab === "rooms" ? "default" : "outline"}
              onClick={() => setActiveTab("rooms")}
            >
              🏠 Комнаты/Организации ({rooms.length})
            </Button>
          </div>

          {activeTab === "users" && (
            <div className="space-y-2">
              <h3 className="font-semibold mb-4">Таблица Users</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">Username</th>
                      <th className="p-2">Password</th>
                      <th className="p-2">Role</th>
                      <th className="p-2">Room</th>
                      <th className="p-2">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-accent/50">
                        {editingUserId === user.id ? (
                          <>
                            <td className="p-2">{user.id}</td>
                            <td className="p-2">
                              <Input
                                value={editUser.username || ""}
                                onChange={(e) => setEditUser({...editUser, username: e.target.value})}
                                className="h-8"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={editUser.password || ""}
                                onChange={(e) => setEditUser({...editUser, password: e.target.value})}
                                className="h-8"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={editUser.role || "user"}
                                onChange={(e) => setEditUser({...editUser, role: e.target.value})}
                                className="h-8 rounded border px-2"
                              >
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <select
                                value={editUser.room_name || ""}
                                onChange={(e) => setEditUser({...editUser, room_name: e.target.value})}
                                className="h-8 rounded border px-2"
                              >
                                <option value="">Не указана</option>
                                {rooms.map(r => (
                                  <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
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
                            <td className="p-2">{user.id}</td>
                            <td className="p-2 font-medium">{user.username}</td>
                            <td className="p-2 text-muted-foreground">{user.password}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-2">
                              {user.room_name && (
                                <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                                  📍 {user.room_name}
                                </span>
                              )}
                            </td>
                            <td className="p-2">
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
            </div>
          )}

          {activeTab === "rooms" && (
            <div className="space-y-4">
              <h3 className="font-semibold">Таблица Rooms</h3>
              
              {/* Форма создания */}
              <Card className="bg-accent/20">
                <CardContent className="pt-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Название комнаты"
                        value={newRoom.name}
                        onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Описание"
                        value={newRoom.description}
                        onChange={(e) => setNewRoom({...newRoom, description: e.target.value})}
                      />
                    </div>
                    <Button onClick={createRoom}>
                      <Plus className="h-4 w-4 mr-2" />
                      Создать
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Таблица комнат */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id} className="border-b hover:bg-accent/50">
                        {editingRoomId === room.id ? (
                          <>
                            <td className="p-2">{room.id}</td>
                            <td className="p-2">
                              <Input
                                value={editRoom.name || ""}
                                onChange={(e) => setEditRoom({...editRoom, name: e.target.value})}
                                className="h-8"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={editRoom.description || ""}
                                onChange={(e) => setEditRoom({...editRoom, description: e.target.value})}
                                className="h-8"
                              />
                            </td>
                            <td className="p-2">
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
                            <td className="p-2">{room.id}</td>
                            <td className="p-2 font-medium">📍 {room.name}</td>
                            <td className="p-2 text-muted-foreground">{room.description || '-'}</td>
                            <td className="p-2">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

