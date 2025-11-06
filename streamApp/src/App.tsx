import { useState, useEffect } from "react"
import { LoginForm } from "@/components/LoginForm"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { UserStreamPage } from "@/components/user/UserStreamPage"
import { DatabaseAdminPage } from "@/components/DatabaseAdminPage"

type UserType = "admin" | "user" | null

function App() {
  // Проверяем URL для /database роута
  const isDatabaseRoute = window.location.pathname === '/database'
  
  if (isDatabaseRoute) {
    return <DatabaseAdminPage />
  }
  const [userType, setUserType] = useState<UserType>(null)
  const [username, setUsername] = useState("")
  const [room, setRoom] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Восстанавливаем сессию при загрузке
  useEffect(() => {
    const savedUserType = localStorage.getItem("userType") as UserType
    const savedUsername = localStorage.getItem("username")
    const savedRoom = localStorage.getItem("room")

    if (savedUserType && savedUsername && savedRoom) {
      setUserType(savedUserType)
      setUsername(savedUsername)
      setRoom(savedRoom)
    }
    
    setIsLoading(false)
  }, [])

  const handleLogin = (type: "admin" | "user", name: string, selectedRoom: string) => {
    setUserType(type)
    setUsername(name)
    setRoom(selectedRoom)
    
    // Сохраняем в localStorage
    localStorage.setItem("userType", type)
    localStorage.setItem("username", name)
    localStorage.setItem("room", selectedRoom)
  }

  const handleLogout = () => {
    setUserType(null)
    setUsername("")
    setRoom("")
    
    // Очищаем localStorage
    localStorage.removeItem("userType")
    localStorage.removeItem("username")
    localStorage.removeItem("room")
  }

  // Показываем загрузку пока проверяем сессию
  if (isLoading) {
    return (
      <div className="dark">
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dark">
      {userType === "admin" ? (
        <AdminDashboard onLogout={handleLogout} />
      ) : userType === "user" ? (
        <UserStreamPage username={username} room={room} onLogout={handleLogout} />
      ) : (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <LoginForm onLogin={handleLogin} />
        </div>
      )}
    </div>
  )
}

export default App
