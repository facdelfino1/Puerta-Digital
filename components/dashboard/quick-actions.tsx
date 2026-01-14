"use client"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/lib/auth"
import { UserPlus, UserCheck, FileText, Users, Settings } from "lucide-react"

interface QuickActionsProps {
  userRole: UserRole
}

export function QuickActions({ userRole }: QuickActionsProps) {
  const actions = [
    {
      title: "Registrar Ingreso",
      description: "Registrar entrada de persona",
      icon: UserCheck,
      href: "/dashboard/access?action=entry",
      roles: ["guardia", "supervisor", "administrador"],
    },
    {
      title: "Registrar Egreso",
      description: "Registrar salida de persona",
      icon: UserCheck,
      href: "/dashboard/access?action=exit",
      roles: ["guardia", "supervisor", "administrador"],
    },
    {
      title: "Nueva Persona",
      description: "Agregar empleado o proveedor",
      icon: UserPlus,
      href: "/dashboard/people/new",
      roles: ["supervisor", "administrador"],
    },
    {
      title: "Generar Reporte",
      description: "Crear reporte de actividad",
      icon: FileText,
      href: "/dashboard/reports",
      roles: ["guardia", "supervisor", "administrador"],
    },
    {
      title: "Configuración",
      description: "Ajustes del sistema",
      icon: Settings,
      href: "/dashboard/settings",
      roles: ["administrador"],
    },
  ]

  const filteredActions = actions.filter((action) => action.roles.includes(userRole))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones Rápidas</CardTitle>
        <CardDescription>Funciones principales según tu rol</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {filteredActions.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.title} href={action.href}>
                <Button variant="outline" className="w-full justify-start h-auto p-4 bg-transparent">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </Button>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
