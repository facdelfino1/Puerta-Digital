"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { logout } from "@/utils/api"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  Settings,
  Shield,
  LogOut,
  Building2,
  Car,
  UserCog,
} from "lucide-react"

interface SidebarProps {
  user: User
}

const navigation = [
  {
    name: "Gestion de Proveedores",
    href: "/dashboard/providers",
    icon: FileText,
    roles: ["supervisor", "administrador"],
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["guardia", "supervisor", "administrador"],
  },
  {
    name: "Registro de Acceso",
    href: "/dashboard/access",
    icon: UserCheck,
    roles: ["guardia", "supervisor", "administrador"],
  },
  {
    name: "Gestion de Personas",
    href: "/dashboard/people",
    icon: Users,
    roles: ["supervisor", "administrador"],
  },
  {
    name: "Vehiculos",
    href: "/dashboard/vehicles",
    icon: Car,
    roles: ["supervisor", "administrador"],
  },
  {
    name: "Areas",
    href: "/dashboard/areas",
    icon: Building2,
    roles: ["supervisor", "administrador"],
  },
  {
    name: "Reportes",
    href: "/dashboard/reports",
    icon: FileText,
    roles: ["guardia", "supervisor", "administrador"],
  },
  {
    name: "Usuarios",
    href: "/dashboard/users",
    icon: UserCog,
    roles: ["supervisor", "administrador"],
  },
  {
    name: "Configuracion",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["administrador"],
  },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const filteredNavigation = navigation.filter((item) => item.roles.includes(user.role))

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Shield className="h-8 w-8 text-sidebar-primary" />
        <span className="ml-2 text-lg font-semibold text-sidebar-foreground">Puerta Digital</span>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {filteredNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-4 text-sm text-sidebar-foreground">
          <p className="font-medium">{user.name}</p>
          <p className="text-sidebar-foreground/70 capitalize">{user.role}</p>
        </div>
        <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesion
        </Button>
      </div>
    </div>
  )
}
