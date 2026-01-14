"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UserRole } from "@/lib/auth"
import { Search, ArrowRight, ArrowLeft, Clock, Car } from "lucide-react"
import { apiFetch } from "@/utils/api"

interface AccessHistoryProps {
  userRole: UserRole
}

type AccessLog = {
  id: number
  person_name: string
  dni: string
  action: "entry" | "exit"
  entry_time: string
  exit_time?: string | null
  guard_name?: string
  vehicle_plate?: string | null
  notes?: string | null
  person_type?: string | null
}

export function AccessHistory({ userRole }: AccessHistoryProps) {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/access_logs")
      const raw = Array.isArray(res) ? res : res?.accessLogs || res?.results || []
      const mapped: AccessLog[] = raw.map((it: any) => ({
        id: it.id,
        person_name: it.personName || it.person_name || "",
        dni: it.personDni || it.dni || "",
        action: it.exit_time ? "exit" : "entry",
        entry_time: it.entry_time,
        exit_time: it.exit_time ?? null,
        guard_name: it.guardName || it.guard_name || undefined,
        vehicle_plate: it.vehiclePlate || it.vehicle_plate || null,
        notes: it.notes ?? null,
        person_type: it.personType || it.person_type || null,
      }))
      setLogs(mapped)
    } catch (_) {
      setError("Error al cargar historial de accesos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    const handler = () => fetchLogs()
    if (typeof window !== "undefined") {
      window.addEventListener("access:logs-updated", handler)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("access:logs-updated", handler)
      }
    }
  }, [])

  const filteredHistory = logs.filter((record) => {
    const normalizedType = (record.person_type || "").toLowerCase()

    const matchesSearch =
      record.person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.dni.includes(searchTerm) ||
      (record.vehicle_plate && record.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesAction =
      actionFilter === "all" ||
      (actionFilter === "entry" && record.action === "entry") ||
      (actionFilter === "exit" && record.action === "exit")

    const matchesType =
      typeFilter === "all" ||
      (normalizedType ? normalizedType === typeFilter : fallbackTypeMatch(record.dni, typeFilter))

    return matchesSearch && matchesAction && matchesType
  })

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Historial de Accesos</span>
        </CardTitle>
        <CardDescription>Registros recientes de ingresos y egresos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, DNI o vehículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex space-x-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="entry">Ingresos</SelectItem>
                <SelectItem value="exit">Egresos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="empleado">Empleados</SelectItem>
                <SelectItem value="proveedor">Proveedores</SelectItem>
                <SelectItem value="guardia">Guardias</SelectItem>
                <SelectItem value="supervisor">Supervisores</SelectItem>
                <SelectItem value="administrador">Administradores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {filteredHistory.map((record) => {
              const ts = record.exit_time || record.entry_time
              return (
                <div key={record.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {record.exit_time ? (
                        <ArrowLeft className="h-5 w-5 text-red-500" />
                      ) : (
                        <ArrowRight className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center space-x-2">
                        <p className="font-medium">{record.person_name}</p>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {getTypeLabel(record)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>DNI: {record.dni}</span>
                        {record.vehicle_plate && (
                          <>
                            <span>-</span>
                            <div className="flex items-center space-x-1">
                              <Car className="h-3 w-3" />
                              <span>{record.vehicle_plate}</span>
                            </div>
                          </>
                        )}
                      </div>
                      {record.notes && <p className="mt-1 text-xs text-muted-foreground">{record.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={
                        record.exit_time
                          ? "bg-rose-100 text-rose-700 hover:bg-rose-100"
                          : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      }
                    >
                      {record.exit_time ? "Egreso" : "Ingreso"}
                    </Badge>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <div>{formatDate(ts)}</div>
                      <div className="font-mono">{formatTime(ts)}</div>
                    </div>
                    {userRole !== "guardia" && record.guard_name && (
                      <div className="mt-1 text-xs text-muted-foreground">por {record.guard_name}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {filteredHistory.length === 0 && !loading && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No se encontraron registros con los filtros aplicados</p>
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-muted-foreground">Cargando...</p>}
        {error && <p className="py-4 text-center text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  )

  function fallbackTypeMatch(dni: string, filter: string) {
    if (filter === "empleado") return !dni.startsWith("9")
    if (filter === "proveedor") return dni.startsWith("9")
    return false
  }
}

function getTypeLabel(record: AccessLog) {
  const normalized = (record.person_type || "").toLowerCase()
  if (!normalized) {
    return record.dni.startsWith("9") ? "Proveedor" : "Empleado"
  }
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
      return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }
}

