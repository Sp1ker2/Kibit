import { useState } from "react"
import { AdminHeader } from "./AdminHeader"
import { LivePage } from "./LivePage"
import { RecordingsPage } from "./RecordingsPage"
import { AccountsPage } from "./AccountsPage"
import { DatabasePage } from "./DatabasePage"

interface AdminDashboardProps {
  onLogout: () => void
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activePage, setActivePage] = useState<"live" | "recordings" | "accounts" | "rooms" | "database">("live")
  const [searchQuery, setSearchQuery] = useState("")

  const renderPage = () => {
    switch (activePage) {
      case "live":
        return <LivePage searchQuery={searchQuery} />
      case "recordings":
        return <RecordingsPage searchQuery={searchQuery} />
      case "accounts":
        return <AccountsPage />
      case "rooms":
        return <DatabasePage /> // Комнаты теперь в Database
      case "database":
        return <DatabasePage />
      default:
        return <LivePage searchQuery={searchQuery} />
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <AdminHeader 
        onLogout={onLogout} 
        activePage={activePage} 
        onPageChange={setActivePage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <main className="w-full py-6 px-8">
        {renderPage()}
      </main>
    </div>
  )
}

