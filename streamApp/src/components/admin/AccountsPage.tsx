import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Trash2, Edit2, Check, X, Loader2 } from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { API_URL } from "@/config"

interface Account {
  id: number
  username: string
  password: string
  role?: string
  room_name?: string
}

const ITEMS_PER_PAGE = 10

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState<"admin" | "user">("user")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  // Форма создания
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "user">("user")
  const [newRoom, setNewRoom] = useState("")
  const [availableRooms, setAvailableRooms] = useState<{id: number, name: string, description: string}[]>([])

  // Загружаем пользователей и комнаты при монтировании
  useEffect(() => {
    fetchAccounts()
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/room-list`)
      if (response.ok) {
        const data = await response.json()
        setAvailableRooms(data)
        if (data.length > 0 && !newRoom) {
          setNewRoom(data[0].name)
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки комнат:', err)
    }
  }

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/users`)
      if (!response.ok) throw new Error('Ошибка загрузки пользователей')
      const data = await response.json()
      setAccounts(data)
      setError("")
    } catch (err: any) {
      console.error('Ошибка загрузки пользователей:', err)
      setError("Не удалось загрузить пользователей")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      alert("Заполните все поля")
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newUsername.trim(), 
          password: newPassword.trim(),
          role: newRole,
          room_name: newRoom
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setNewUsername("")
        setNewPassword("")
        setNewRole("user")
        if (availableRooms.length > 0) {
          setNewRoom(availableRooms[0].name)
        }
        fetchAccounts() // Перезагружаем список
      } else {
        alert(data.error || "Ошибка создания пользователя")
      }
    } catch (err) {
      console.error('Ошибка создания пользователя:', err)
      alert("Не удалось создать пользователя")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить аккаунт?")) return

    try {
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchAccounts() // Перезагружаем список
      } else {
        alert("Ошибка удаления пользователя")
      }
    } catch (err) {
      console.error('Ошибка удаления пользователя:', err)
      alert("Не удалось удалить пользователя")
    }
  }

  const handleStartEdit = (account: Account) => {
    setEditingId(account.id)
    setEditUsername(account.username)
    setEditPassword(account.password)
    setEditRole((account.role || "user") as "admin" | "user")
  }

  const handleSaveEdit = async (id: number) => {
    if (!editUsername.trim() || !editPassword.trim()) {
      alert("Заполните все поля")
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: editUsername.trim(), 
          password: editPassword.trim(),
          role: editRole
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setEditingId(null)
        fetchAccounts() // Перезагружаем список
      } else {
        alert(data.error || "Ошибка обновления пользователя")
      }
    } catch (err) {
      console.error('Ошибка обновления пользователя:', err)
      alert("Не удалось обновить пользователя")
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditUsername("")
    setEditPassword("")
  }

  // Пагинация
  const totalPages = Math.ceil(accounts.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentAccounts = accounts.slice(startIndex, endIndex)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Форма создания слева */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Создать аккаунт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Логин</Label>
              <Input
                id="username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Введите логин"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Введите пароль"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <select
                id="role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newRoom">Комната (организация)</Label>
              <select
                id="newRoom"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">Выберите организацию</option>
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.name}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleCreate} className="w-full">
              Создать
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Список аккаунтов справа */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Список аккаунтов ({accounts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Загрузка */}
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-destructive text-center py-8">{error}</p>
            ) : (
              <div className="space-y-1.5">
                {accounts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Нет аккаунтов
                  </p>
                ) : (
                currentAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {editingId === account.id ? (
                      <>
                        {/* Режим редактирования */}
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <Input
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            placeholder="Логин"
                            className="h-7 text-sm"
                          />
                          <Input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Пароль"
                            className="h-7 text-sm"
                          />
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as "admin" | "user")}
                            className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="user">Пользователь</option>
                            <option value="admin">Администратор</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleSaveEdit(account.id)}
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Обычный режим */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-foreground">
                              {account.username}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              account.role === 'admin' 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {account.role === 'admin' ? 'Админ' : 'Пользователь'}
                            </span>
                            {account.room_name && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                📍 {account.room_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Пароль: {account.password}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleStartEdit(account)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDelete(account.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
              
              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="flex justify-center pt-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={`text-foreground hover:text-foreground cursor-pointer ${
                            currentPage === 1 ? "pointer-events-none opacity-50" : ""
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
                          className={`text-foreground hover:text-foreground cursor-pointer ${
                            currentPage === totalPages ? "pointer-events-none opacity-50" : ""
                          }`}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

