import { LogOut, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

interface AdminHeaderProps {
  onLogout: () => void
  activePage: "live" | "recordings" | "accounts" | "rooms" | "database"
  onPageChange: (page: "live" | "recordings" | "accounts" | "rooms" | "database") => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function AdminHeader({ onLogout, activePage, onPageChange, searchQuery, onSearchChange }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="flex h-16 w-full items-center justify-between gap-6 px-8">
        {/* Логотип слева */}
        <div className="flex items-center gap-3 min-w-[120px]">
          <h1 className="text-xl font-bold text-foreground">Admin</h1>
        </div>

        {/* Навигация и поиск по центру */}
        <div className="flex flex-1 items-center justify-center gap-6 max-w-4xl">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-secondary border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            />
          </div>
          
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink 
                  onClick={() => onPageChange("live")}
                  className={`${navigationMenuTriggerStyle()} cursor-pointer ${
                    activePage === "live" 
                      ? "text-foreground bg-accent" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Live
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink 
                  onClick={() => onPageChange("recordings")}
                  className={`${navigationMenuTriggerStyle()} cursor-pointer ${
                    activePage === "recordings" 
                      ? "text-foreground bg-accent" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Записи
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink 
                  onClick={() => onPageChange("accounts")}
                  className={`${navigationMenuTriggerStyle()} cursor-pointer ${
                    activePage === "accounts" 
                      ? "text-foreground bg-accent" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Аккаунты
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink 
                  onClick={() => onPageChange("rooms")}
                  className={`${navigationMenuTriggerStyle()} cursor-pointer ${
                    activePage === "rooms" 
                      ? "text-foreground bg-accent" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Комнаты
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink 
                  onClick={() => onPageChange("database")}
                  className={`${navigationMenuTriggerStyle()} cursor-pointer ${
                    activePage === "database" 
                      ? "text-foreground bg-accent" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🗄️ База данных
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Кнопка выхода справа */}
        <div className="flex items-center min-w-[120px] justify-end">
          <Button variant="outline" onClick={onLogout} className="gap-2 text-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span>Выйти</span>
          </Button>
        </div>
      </div>
    </header>
  )
}


