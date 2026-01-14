"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { MoreHorizontal, Edit, Trash2, Building2 } from "lucide-react"
import { apiFetch } from "@/utils/api"

export function AreasList() {
  const [areas, setAreas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError("")
      try {
        const data = await apiFetch("/areas", { authRedirect: true })
        const list = Array.isArray(data) ? data : (data?.results || [])
        if (alive) setAreas(list)
      } catch (e: any) {
        if (alive) setError(e.message || "Error cargando áreas")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Áreas</CardTitle>
        <CardDescription>Áreas de la empresa y su información</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>Empleados</TableHead>
                  <TableHead>Proveedores</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => {
                  const employeeCount = typeof area.employeeCount === "number" ? area.employeeCount : 0
                  const providerCount = typeof area.providerCount === "number" ? area.providerCount : 0
                  const total = employeeCount + providerCount
                  return (
                    <TableRow key={area.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{area.name}</p>
                            <p className="text-sm text-muted-foreground">{area.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{employeeCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{providerCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{total}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/areas/${area.id}`}>
                            <Button size="sm" variant="outline">
                              <Edit className="mr-2 h-4 w-4" />
                              Modificar
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === area.id}
                            onClick={async () => {
                              if (!confirm("¿Eliminar esta área?")) return
                              setDeletingId(area.id)
                              const prev = areas
                              setAreas((arr) => arr.filter((a) => a.id !== area.id))
                              try {
                                await apiFetch(`/areas/${area.id}`, { method: "DELETE", authRedirect: true })
                              } catch (e: any) {
                                setError(e.message || "Error eliminando área")
                                setAreas(prev)
                              } finally {
                                setDeletingId(null)
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingId === area.id ? "Eliminando..." : "Eliminar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
