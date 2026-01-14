"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Sector,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/utils/api"
import type { UserRole } from "@/lib/auth"

interface AreaPerson {
  name: string
  dni?: string | null
  type?: string | null
  entryTime?: string | Date | null
}

interface AreaEntry {
  areaId: number | null
  areaName: string
  totalEntries: number
  peopleInside?: AreaPerson[]
}

interface AreaEntriesPieProps {
  userRole: UserRole
}

function generateColor(index: number) {
  const goldenAngle = 137.508
  const hue = (index * goldenAngle) % 360
  const saturation = 70
  const lightness = 48
  return `hsl(${hue}deg ${saturation}% ${lightness}%)`
}

export function AreaEntriesPie({ userRole }: AreaEntriesPieProps) {
  const [areas, setAreas] = useState<AreaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadData = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      const runSilent = Boolean(silent)
      if (runSilent) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const data = await apiFetch("/reports/area-entries", { authRedirect: true })
        const list = Array.isArray(data?.areas) ? (data.areas as AreaEntry[]) : []
        setAreas(
          list.filter(
            (area) => area.totalEntries > 0 || (area.peopleInside?.length ?? 0) > 0,
          ),
        )
        setLastUpdated(new Date())
      } catch (err: any) {
        setError(err?.message || "Error cargando grafico por area")
        setAreas([])
      } finally {
        if (runSilent) {
          setIsRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const interval = setInterval(() => {
      loadData({ silent: true }).catch(() => {
        /* ignored */
      })
    }, 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  const totalEntries = useMemo(
    () => areas.reduce((sum, area) => sum + area.totalEntries, 0),
    [areas],
  )

  const chartData = useMemo(
    () =>
      areas.map((area, index) => ({
        ...area,
        color: generateColor(index),
      })),
    [areas],
  )

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180
    const {
      cx,
      cy,
      midAngle,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
      payload,
      percent,
      value,
    } = props
    const sin = Math.sin(-RADIAN * midAngle)
    const cos = Math.cos(-RADIAN * midAngle)
    const sx = cx + (outerRadius + 6) * cos
    const sy = cy + (outerRadius + 6) * sin
    const mx = cx + (outerRadius + 18) * cos
    const my = cy + (outerRadius + 18) * sin
    const ex = mx + (cos >= 0 ? 1 : -1) * 12
    const ey = my
    const textAnchor = cos >= 0 ? "start" : "end"

    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} fontWeight={600}>
          {payload.areaName}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#111827">
          {`${value} ingresos`}
        </text>
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 12}
          y={ey}
          dy={18}
          textAnchor={textAnchor}
          fill="#6b7280"
        >
          {`(${(percent * 100).toFixed(1)}%)`}
        </text>
      </g>
    )
  }

  const selectedArea = selectedIndex != null ? chartData[selectedIndex] : null

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Ingresos de empleados por area</CardTitle>
          <CardDescription>
            Distribucion de ingresos unicos de empleados durante el dia. Disponible para el rol {userRole}.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && !loading && (
            <span className="text-xs text-muted-foreground">
              Actualizado: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadData({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aun no se registran ingresos de empleados en el dia.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="totalEntries"
                    nameKey="areaName"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    activeIndex={activeIndex ?? undefined}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(selectedIndex)}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.areaName} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, payload) => [
                      `${value} ingresos`,
                      payload.payload.areaName,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => value}
                    wrapperStyle={{ fontSize: "0.825rem" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Total del dia</p>
                <p className="text-2xl font-semibold">{totalEntries}</p>
              </div>
              <div className="space-y-2">
                {chartData.map((area, index) => {
                  const percent =
                    totalEntries > 0 ? ((area.totalEntries / totalEntries) * 100).toFixed(1) : "0.0"
                  const isActive = (selectedIndex ?? activeIndex) === index
                  return (
                    <button
                      key={`${area.areaId ?? "null"}-${area.areaName}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(selectedIndex)}
                      onClick={() => {
                        const nextSelected = selectedIndex === index ? null : index
                        setSelectedIndex(nextSelected)
                        setActiveIndex(nextSelected)
                      }}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                        isActive ? "border-primary bg-primary/10" : "hover:bg-muted"
                      }`}
                      style={{ borderColor: isActive ? area.color : undefined }}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ background: area.color }}
                          aria-hidden="true"
                        />
                        {area.areaName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {area.totalEntries} ({percent}%)
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Personas dentro</p>
                {selectedArea == null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Selecciona un area para ver quienes se encuentran dentro actualmente.
                  </p>
                ) : (selectedArea.peopleInside?.length ?? 0) === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No hay personas registradas dentro de esta area en este momento.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selectedArea.peopleInside?.map((person) => (
                      <li key={`${person.dni ?? ""}-${person.name}`} className="text-sm leading-tight">
                        <span className="font-medium">{person.name}</span>
                        {person.dni && <span className="text-muted-foreground"> • DNI {person.dni}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
