"use client"
import { useState, useEffect } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save, ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/utils/api"

interface Vehicle {
  id?: number
  licensePlate: string
  personId: number
  brand: string
  model: string
  color: string
  isActive: boolean
}

interface PersonOption {
  id: number
  name: string
  dni?: string
}

interface VehicleFormProps {
  vehicle?: Vehicle
}

export function VehicleForm({ vehicle }: VehicleFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [people, setPeople] = useState<PersonOption[]>([])
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [peopleError, setPeopleError] = useState("")
  const [formData, setFormData] = useState({
    licensePlate: vehicle?.licensePlate || "",
    personId: vehicle?.personId?.toString() || "",
    brand: vehicle?.brand || "",
    model: vehicle?.model || "",
    color: vehicle?.color || "",
    isActive: vehicle?.isActive ?? true,
  })

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoadingPeople(true)
      setPeopleError("")
      try {
        // Cargar personas (propietarios) para asignar al vehículo
        const data = await apiFetch("/people", { authRedirect: true })
        const all: PersonOption[] = Array.isArray(data) ? data : (data?.results || [])
        const list = all.filter((p: any) => (p?.type || "").toLowerCase() === "proveedor")
        if (!active) return
        setPeople(list)
      } catch (e: any) {
        if (!active) return
        setPeopleError(e.message || "Error al cargar personas")
      } finally {
        if (active) setLoadingPeople(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const payload = {
        licensePlate: formData.licensePlate.trim().toUpperCase(),
        personId: Number(formData.personId),
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        color: formData.color.trim(),
        isActive: formData.isActive,
      }

      if (!payload.personId) {
        throw new Error("Debe seleccionar un propietario")
      }

      if (vehicle?.id) {
        await apiFetch(`/vehicles/${vehicle.id}`, {
          method: "PUT",
            body: JSON.stringify(payload),
        })
      } else {
        await apiFetch("/vehicles", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }

      router.push("/dashboard/vehicles")
    } catch (err: any) {
      setError(err.message || "Error al guardar el vehículo. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard/vehicles">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a vehículos
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          disabled={loadingPeople}
          onClick={() => {
            // recargar proveedores
      setLoadingPeople(true)
            setPeopleError("")
            apiFetch("/people")
              .then((d) => {
                const all: any[] = Array.isArray(d) ? d : (d?.results || [])
                const list = all.filter((p: any) => (p?.type || "").toLowerCase() === "proveedor")
                setPeople(list)
              })
              .catch((e) => setPeopleError(e.message || "Error recargando personas"))
              .finally(() => setLoadingPeople(false))
          }}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loadingPeople ? "animate-spin" : ""}`} />
          {loadingPeople ? "Cargando..." : "Recargar"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{vehicle ? "Editar Vehículo" : "Nuevo Vehículo"}</CardTitle>
          <CardDescription>
            {vehicle ? "Modifica la información del vehículo" : "Completa los datos para registrar un nuevo vehículo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate">Patente *</Label>
                <Input
                  id="licensePlate"
                  value={formData.licensePlate}
                  onChange={(e) => handleInputChange("licensePlate", e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner">Proveedor *</Label>
                <Select
                  value={formData.personId}
                  onValueChange={(value) => handleInputChange("personId", value)}
                  disabled={loadingPeople || !!peopleError}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPeople ? "Cargando..." : "Selecciona un proveedor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {peopleError && <p className="text-xs text-red-500">{peopleError}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange("brand", e.target.value)}
                  placeholder="Ford"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modelo *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => handleInputChange("model", e.target.value)}
                  placeholder="Transit"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleInputChange("color", e.target.value)}
                placeholder="Blanco"
              />
            </div>

            {vehicle && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange("isActive", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive">Vehículo activo</Label>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2">
              <Link href="/dashboard/vehicles">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading || loadingPeople}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Guardando..." : vehicle ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
