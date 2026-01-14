"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { UserRole } from "@/lib/auth"
import { FileText, Download, ChevronDown } from "lucide-react"
import { apiFetch } from "@/utils/api"

interface ReportsGeneratorProps {
  userRole: UserRole
}

interface Area {
  id: number
  name: string
}

interface DateRange {
  start: string
  end: string
}

const PRESET_RANGE: Record<string, () => DateRange> = {
  daily: () => {
    const today = new Date().toISOString().split("T")[0]
    return { start: today, end: today }
  },
  weekly: () => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    return {
      start: startOfWeek.toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    }
  },
  monthly: () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      start: startOfMonth.toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    }
  },
}

export function ReportsGenerator({ userRole }: ReportsGeneratorProps) {
  const [reportType, setReportType] = useState("daily")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [includeVehicles, setIncludeVehicles] = useState(false)
  const [exportFormat, setExportFormat] = useState("excel")
  const [isGenerating, setIsGenerating] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [areas, setAreas] = useState<Area[]>([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [areasError, setAreasError] = useState("")
  const [areasOpen, setAreasOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setAreasLoading(true)
      setAreasError("")
      try {
        const data = await apiFetch("/areas", { authRedirect: true })
        if (!alive) return
        const list: Area[] = Array.isArray(data) ? data : data?.results || data?.areas || []
        setAreas(list)
      } catch (err: any) {
        if (alive) setAreasError(err.message || "Error cargando areas")
      } finally {
        if (alive) setAreasLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const handleAreaChange = (areaId: string, checked: boolean) => {
    setSelectedAreas((prev) => {
      if (checked) {
        if (prev.includes(areaId)) return prev
        return [...prev, areaId]
      }
      return prev.filter((id) => id !== areaId)
    })
  }

  const handleSelectAllAreas = (checked: boolean) => {
    if (!areas.length) return
    setSelectedAreas(checked ? areas.map((area) => area.id.toString()) : [])
  }

  const resolveDateRange = (): DateRange => {
    if (reportType === "custom") {
      return { start: startDate, end: endDate }
    }
    return PRESET_RANGE[reportType]?.() ?? { start: "", end: "" }
  }

  const allAreasSelected = !areasLoading && areas.length > 0 && selectedAreas.length === areas.length

  const handleGenerateReport = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsGenerating(true)
    setSuccessMessage("")
    setErrorMessage("")

    try {
      if (exportFormat !== "excel") {
        setErrorMessage("De momento solo se encuentra disponible la exportacion a Excel.")
        return
      }

      const range = resolveDateRange()
      const selectedAreaNumbers = selectedAreas.map((id) => Number(id)).filter((value) => !Number.isNaN(value))
      const payload = {
        startDate: range.start,
        endDate: range.end,
        areaId: selectedAreaNumbers.length === 1 ? selectedAreaNumbers[0] : null,
        areaIds: selectedAreaNumbers,
        personId: null,
        includeVehicles,
        format: exportFormat,
      }

      const response = await apiFetch("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        authRedirect: true,
        rawResponse: true,
      })

      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const data = await response.json()
        setErrorMessage(data?.error || "La respuesta del servidor no fue un archivo descargable.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `reporte-${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setSuccessMessage("Reporte descargado correctamente.")
    } catch (err: any) {
      setErrorMessage(err.message || "Error al generar el reporte")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Generar Reporte</span>
        </CardTitle>
        <CardDescription>Configura y descarga reportes de ingresos y egresos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleGenerateReport} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de reporte</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Hoy</SelectItem>
                <SelectItem value="weekly">Esta semana</SelectItem>
                <SelectItem value="monthly">Este mes</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportType === "custom" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">Fecha inicio</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Fecha fin</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {["guardia", "supervisor", "administrador"].includes(userRole) && (
            <Collapsible open={areasOpen} onOpenChange={setAreasOpen} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Filtrar por area</Label>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" aria-label="Mostrar areas">
                    <span className="text-sm">
                      {selectedAreas.length === 0
                        ? "Todas"
                        : allAreasSelected
                          ? "Todas seleccionadas"
                          : `${selectedAreas.length} seleccionada(s)`}
                    </span>
                    <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${areasOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                  {areasLoading && <p className="text-xs text-muted-foreground">Cargando areas...</p>}
                  {areasError && <p className="text-xs text-red-500">{areasError}</p>}
                  {!areasLoading && areas.length > 0 && (
                    <div className="flex items-center space-x-2 border-b pb-2">
                      <Checkbox
                        id="area-all"
                        checked={allAreasSelected}
                        onCheckedChange={(checked) => handleSelectAllAreas(Boolean(checked))}
                      />
                      <Label htmlFor="area-all" className="text-sm font-normal">
                        Seleccionar todas
                      </Label>
                    </div>
                  )}
                  {!areasLoading &&
                    areas.map((area) => (
                      <div key={area.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`area-${area.id}`}
                          checked={selectedAreas.includes(area.id.toString())}
                          onCheckedChange={(checked) => handleAreaChange(area.id.toString(), Boolean(checked))}
                        />
                        <Label htmlFor={`area-${area.id}`} className="text-sm font-normal">
                          {area.name}
                        </Label>
                      </div>
                    ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-vehicles"
                checked={includeVehicles}
                onCheckedChange={(checked) => setIncludeVehicles(checked as boolean)}
              />
              <Label htmlFor="include-vehicles" className="text-sm font-normal">
                Incluir detalles de vehiculos
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Formato de exportacion</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf" disabled>
                  PDF (.pdf) - no disponible
                </SelectItem>
                <SelectItem value="csv" disabled>
                  CSV (.csv) - no disponible
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(successMessage || errorMessage) && (
            <Alert variant={errorMessage ? "destructive" : "default"}>
              <AlertDescription>{errorMessage || successMessage}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isGenerating}>
            <Download className="mr-2 h-4 w-4" />
            {isGenerating ? "Generando..." : "Generar y descargar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
