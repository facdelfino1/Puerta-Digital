"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendingUp, Users, Building2 } from "lucide-react"
import type { UserRole } from "@/lib/auth"
import { apiFetch } from "@/utils/api"

interface ReportsChartsProps {
  userRole: UserRole
}

interface StatsResponse {
  ingresosHoy: number
  personasDentro: number
  areasActivas: number
}

type DetailType = "entries" | "inside" | "areas" | null

interface DetailState {
  open: boolean
  title: string
  type: DetailType
  loading: boolean
  error: string
  records: any[]
  search: string
}

// --- CORRECCIÓN 1: Definir la interfaz para los registros del log ---
interface LogRecord {
  logId?: number;
  personName: string;
  dni: string;
  area?: string | null;
  entryTime?: string;
  exitTime?: string;
  guardName?: string | null;
}

const CARD_CONFIG = [
  {
    title: "Total Ingresos Hoy",
    label: "Entradas registradas",
    icon: TrendingUp,
    color: "text-green-600",
    statKey: "ingresosHoy",
    detailType: "entries" as DetailType,
  },
  {
    title: "Personas Dentro",
    label: "En instalaciones",
    icon: Users,
    color: "text-blue-600",
    statKey: "personasDentro",
    detailType: "inside" as DetailType,
  },
  {
    title: "Areas Activas",
    label: "Con personal dentro",
    icon: Building2,
    color: "text-orange-600",
    statKey: "areasActivas",
    detailType: "areas" as DetailType,
  },
]

export function ReportsCharts({ userRole }: ReportsChartsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [detail, setDetail] = useState<DetailState>({
    open: false,
    title: "",
    type: null,
    loading: false,
    error: "",
    records: [],
    search: "",
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const data = await apiFetch("/reports/stats", { authRedirect: true })
        if (!alive) return
        setStats(data?.stats || null)
      } catch (err: any) {
        if (!alive) return
        setError(err.message || "Error obteniendo estadisticas")
        setStats(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const closeDetail = () =>
    setDetail({
      open: false,
      title: "",
      type: null,
      loading: false,
      error: "",
      records: [],
      search: "",
    })

  const fetchDetail = async (type: DetailType, search: string) => {
    if (!type) return
    setDetail((prev) => ({ ...prev, loading: true, error: "" }))
    try {
      let records: any[] = []

      if (type === "entries" || type === "inside") {
        const queryParam = search ? `&q=${encodeURIComponent(search)}` : ""
        const endpointType = type === "entries" ? "entriesToday" : "inside"
        const data = await apiFetch(`/dashboard/details?type=${endpointType}${queryParam}`, {
          authRedirect: true,
        })
        records = Array.isArray(data?.records) ? data.records : []
      } else if (type === "areas") {
        const data = await apiFetch("/reports/area-entries", { authRedirect: true })
        const rawAreas = Array.isArray(data?.areas) ? data.areas : []
        const normalized = rawAreas.map((area: any) => ({
          areaName: area.areaName || "Sin area",
          totalEntries: area.totalEntries ?? 0,
          peopleInside: Array.isArray(area.peopleInside) ? area.peopleInside : [],
        }))
        const filtered = normalized
          .map((area) => {
            if (!search.trim()) return area
            const term = search.toLowerCase()
            const matches = area.peopleInside.filter((person: any) => {
              const name = (person.name || "").toLowerCase()
              const dni = (person.dni || "").toLowerCase()
              return name.includes(term) || dni.includes(term)
            })
            return { ...area, peopleInside: matches }
          })
          .filter(
            (area) =>
              area.totalEntries > 0 ||
              (Array.isArray(area.peopleInside) && area.peopleInside.length > 0),
          )
        records = filtered
      }

      setDetail((prev) => ({
        ...prev,
        loading: false,
        error: "",
        records,
      }))
    } catch (err: any) {
      setDetail((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Error obteniendo detalle",
        records: [],
      }))
    }
  }

  const openDetail = (title: string, type: DetailType) => {
    if (!type) return
    setDetail({
      open: true,
      title,
      type,
      loading: true,
      error: "",
      records: [],
      search: "",
    })
    fetchDetail(type, "")
  }

  const handleDetailSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    fetchDetail(detail.type, detail.search)
  }

  const renderDetailContent = () => {
    if (!detail.type) return null

    if (detail.loading) {
      return <p className="py-4 text-sm text-muted-foreground">Cargando...</p>
    }

    if (detail.error) {
      return <p className="py-4 text-sm text-red-500">{detail.error}</p>
    }

    if (detail.records.length === 0) {
      return <p className="py-4 text-sm text-muted-foreground">No hay informacion disponible para los filtros seleccionados.</p>
    }

    if (detail.type === "areas") {
      return (
        <div className="space-y-4">
          {detail.records.map((area: any) => (
            <Card key={area.areaName} className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{area.areaName}</CardTitle>
                <CardDescription>
                  {area.peopleInside?.length || 0} personas actualmente dentro
                </CardDescription>
              </CardHeader>
              <CardContent>
                {area.peopleInside?.length ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>DNI</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Area</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {area.peopleInside.map((person: any) => (
                          <TableRow key={`${person.dni || ""}-${person.name}`}>
                            <TableCell>{person.name}</TableCell>
                            <TableCell>{person.dni || "-"}</TableCell>
                            <TableCell className="capitalize">{person.type || "Desconocido"}</TableCell>
                            <TableCell>{area.areaName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay personas registradas en esta area.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Guardia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.records.map((row: any) => (
              <TableRow key={row.logId || `${row.personName}-${row.entryTime}`}>
                <TableCell>{row.personName}</TableCell>
                <TableCell>{row.dni}</TableCell>
                <TableCell>{row.area || "Sin area"}</TableCell>
                <TableCell>{new Date(row.entryTime || row.exitTime).toLocaleString() || "-"}</TableCell>
                <TableCell>{row.guardName || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando estadisticas...</p>
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CARD_CONFIG.map((card) => {
          const Icon = card.icon
          const value = stats ? (stats as any)[card.statKey] ?? 0 : 0
          return (
            <Card
              key={card.title}
              onClick={() => openDetail(card.title, card.detailType)}
              className="cursor-pointer transition hover:shadow-md"
              role="button"
              tabIndex={0}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={detail.open} onOpenChange={closeDetail}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{detail.title}</DialogTitle>
            <DialogDescription>
              {detail.type === "entries" && "Listado de ingresos registrados durante el dia seleccionado."}
              {detail.type === "inside" && "Personas que permanecen dentro actualmente."}
              {detail.type === "areas" && "Areas con personal dentro y su cantidad de personas."}
            </DialogDescription>
          </DialogHeader>

          {detail.type && (
            <form onSubmit={handleDetailSearch} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Buscar por nombre o DNI..."
                value={detail.search}
                onChange={(event) => setDetail((prev) => ({ ...prev, search: event.target.value }))}
              />
              <Button type="submit" className="sm:w-auto">
                Buscar
              </Button>
            </form>
          )}

          {renderDetailContent()}
        </DialogContent>
      </Dialog>
    </>
  )
}
