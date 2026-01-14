"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Edit, Trash2, Car, RefreshCw } from "lucide-react"
import { apiFetch } from "@/utils/api"

interface Vehicle {
  id: number
  licensePlate: string
  brand: string
  model: string
  color?: string
  ownerName: string
  ownerDni?: string
  personId?: number
  providerVehicleAccess?: boolean
}

export function VehiclesList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadVehicles = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiFetch("/vehicles", { authRedirect: true })
      const list: Vehicle[] = Array.isArray(data) ? data : data?.results || []
      setVehicles(list)
    } catch (e: any) {
      setError(e.message || "Error al cargar vehiculos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadVehicles()
    setRefreshing(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este vehiculo?")) return
    setDeletingId(id)
    const prev = vehicles
    setVehicles((v) => v.filter((x) => x.id !== id))
    try {
      await apiFetch(`/vehicles/${id}`, { method: "DELETE", authRedirect: true })
    } catch (e: any) {
      setError(e.message || "Error eliminando vehiculo")
      setVehicles(prev)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = vehicles.filter((v) => {
    const term = searchTerm.toLowerCase()
    return (
      v.licensePlate?.toLowerCase().includes(term) ||
      v.brand?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term) ||
      v.ownerName?.toLowerCase().includes(term) ||
      v.ownerDni?.toLowerCase().includes(term)
    )
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lista de Vehiculos</CardTitle>
            <CardDescription>Vehiculos registrados de proveedores</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualizando" : "Actualizar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por patente, marca, modelo o propietario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600">
            {error}{" "}
            <button className="underline" onClick={handleRefresh}>
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando vehiculos...</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehiculo</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Estado proveedor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Car className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{vehicle.licensePlate}</p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.color && ` - ${vehicle.color}`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vehicle.ownerName}</p>
                        {vehicle.ownerDni && (
                          <p className="text-sm text-muted-foreground">DNI: {vehicle.ownerDni}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vehicle.providerVehicleAccess ? "default" : "destructive"}>
                        {vehicle.providerVehicleAccess ? "Habilitado" : "Bloqueado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/vehicles/${vehicle.id}`}>
                          <Button size="sm" variant="outline">
                            <Edit className="mr-2 h-4 w-4" />
                            Modificar
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === vehicle.id}
                          onClick={() => handleDelete(vehicle.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deletingId === vehicle.id ? "Eliminando..." : "Eliminar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No se encontraron vehiculos con los criterios de busqueda
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
