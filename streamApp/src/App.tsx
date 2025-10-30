import { useState, useEffect } from "react"
import { LoginForm } from "@/components/LoginForm"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { UserStreamPage } from "@/components/user/UserStreamPage"

type UserType = "admin" | "user" | null

function App() {
  const [userType, setUserType] = useState<UserType>(null)
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Восстанавливаем сессию при загрузке
  useEffect(() => {
    const savedUserType = localStorage.getItem("userType") as UserType
    const savedUsername = localStorage.getItem("username")

    if (savedUserType && savedUsername) {
      setUserType(savedUserType)
      setUsername(savedUsername)
    }
    
    setIsLoading(false)
  }, [])

  const handleLogin = (type: "admin" | "user", name: string) => {
    setUserType(type)
    setUsername(name)
    
    // Сохраняем в localStorage
    localStorage.setItem("userType", type)
    localStorage.setItem("username", name)
  }

  const handleLogout = () => {
    setUserType(null)
    setUsername("")
    
    // Очищаем localStorage
    localStorage.removeItem("userType")
    localStorage.removeItem("username")
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
        <UserStreamPage username={username} onLogout={handleLogout} />
      ) : (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <LoginForm onLogin={handleLogin} />
        </div>
      )}
    </div>
  )
}

export default App
