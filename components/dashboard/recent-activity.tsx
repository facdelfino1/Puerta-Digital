"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UserRole } from "@/lib/auth"
import { ArrowRight, ArrowLeft, Clock } from "lucide-react"
import { apiFetch } from "@/utils/api"

interface RecentActivityProps {
  userRole: UserRole
}

interface ActivityItem {
  id: string
  type: "entry" | "exit"
  personName: string
  area: string
  vehicle: string | null
  time: string
  timestamp: number
}

export function RecentActivity({ userRole }: RecentActivityProps) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const data = await apiFetch("/access_logs?limit=50", { authRedirect: true })
        const list = Array.isArray(data) ? data : data?.accessLogs || data?.results || []
        if (!alive) return
        const normalized = normalizeAccessLogs(list)
        setItems(normalized)
      } catch (e: any) {
        if (alive) setError(e?.message || "Error cargando actividad")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <div>Cargando...</div>
  if (error) return <div>{error}</div>

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Ultimos registros de ingreso y egreso</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay movimientos registrados todavia.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>Ultimos registros de ingreso y egreso</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {items.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {activity.type === "entry" ? (
                      <ArrowRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowLeft className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{activity.personName}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.area}
                      {activity.vehicle ? ` - ${activity.vehicle}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    className={
                      activity.type === "entry"
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                    }
                  >
                    {activity.type === "entry" ? "Ingreso" : "Egreso"}
                  </Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-1 h-4 w-4" />
                    {activity.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function normalizeAccessLogs(rawLogs: any[]): ActivityItem[] {
  const formatDate = (value: any) => {
    if (!value) return null
    const date =
      value instanceof Date
        ? value
        : new Date(typeof value === "string" ? value.replace(" ", "T") : value)
    if (Number.isNaN(date.getTime())) return null
    return {
      timestamp: date.getTime(),
      label: new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date),
    }
  }

  const vehicleLabel = (log: any) => {
    const parts = [log?.vehiclePlate, log?.vehicleBrand, log?.vehicleModel]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
    return parts.length ? parts.join(" / ") : null
  }

  const areaLabel = (log: any) => {
    if (typeof log?.area === "string" && log.area.trim().length > 0) return log.area
    if (typeof log?.personType === "string") {
      const normalized = log.personType.toLowerCase()
      switch (normalized) {
        case "empleado":
          return "Empleado"
        case "proveedor":
          return "Proveedor"
        case "guardia":
          return "Guardia"
        case "supervisor":
          return "Supervisor"
        case "administrador":
          return "Administrador"
        default:
          return log.personType
      }
    }
    if (typeof log?.guardName === "string" && log.guardName.trim()) {
      return `Controlado por ${log.guardName}`
    }
    return ""
  }

  const events = rawLogs.flatMap((log) => {
    const entry = formatDate(log.entry_time ?? log.entryTime)
    const exit = formatDate(log.exit_time ?? log.exitTime)
    const base = {
      personName: log.personName ?? log.person_name ?? "Desconocido",
      area: areaLabel(log),
      vehicle: vehicleLabel(log),
    }
    const rows: ActivityItem[] = []
    if (entry) {
      rows.push({
        id: `${log.id}-entry`,
        type: "entry",
        time: entry.label,
        timestamp: entry.timestamp,
        ...base,
      })
    }
    if (exit) {
      rows.push({
        id: `${log.id}-exit`,
        type: "exit",
        time: exit.label,
        timestamp: exit.timestamp,
        ...base,
      })
    }
    return rows
  })

  return events.sort((a, b) => b.timestamp - a.timestamp)
}
