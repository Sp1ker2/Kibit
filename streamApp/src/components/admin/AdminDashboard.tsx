import { useState } from "react"
import { AdminHeader } from "./AdminHeader"
import { LivePage } from "./LivePage"
import { RecordingsPage } from "./RecordingsPage"
import { DriveRecordingsPage } from "./DriveRecordingsPage"
import { AccountsPage } from "./AccountsPage"
import { DatabasePage } from "./DatabasePage"
import { RecorderLogsPage } from "./RecorderLogsPage"

interface AdminDashboardProps {
  onLogout: () => void
  defaultPage?: "live" | "recordings" | "drive" | "accounts" | "rooms" | "database" | "logs"
}

export function AdminDashboard({ onLogout, defaultPage }: AdminDashboardProps) {
  const [activePage, setActivePage] = useState<"live" | "recordings" | "drive" | "accounts" | "rooms" | "database" | "logs">(defaultPage || "live")
  const [searchQuery, setSearchQuery] = useState("")

  const renderPage = () => {
    switch (activePage) {
      case "live":
        return <LivePage searchQuery={searchQuery} />
      case "recordings":
        return <RecordingsPage searchQuery={searchQuery} />
      case "drive":
        return <DriveRecordingsPage searchQuery={searchQuery} />
      case "accounts":
        return <AccountsPage />
      case "rooms":
        return <DatabasePage /> // Комнаты теперь в Database
      case "database":
        return <DatabasePage />
      case "logs":
        return <RecorderLogsPage />
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

