"use client"
import { useState } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/utils/api"

interface Area {
  id?: number
  name: string
  description: string
  isActive: boolean
}

interface AreaFormProps {
  area?: Area
}

export function AreaForm({ area }: AreaFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: area?.name || "",
    description: area?.description || "",
    isActive: area?.isActive ?? true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isActive: formData.isActive,
      }

      if (area?.id) {
        await apiFetch(`/areas/${area.id}`, { method: "PUT", body: JSON.stringify(payload) })
      } else {
        await apiFetch("/areas", { method: "POST", body: JSON.stringify(payload) })
      }

      router.push("/dashboard/areas")
    } catch (err: any) {
      setError(err.message || "Error al guardar el área. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/areas">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a áreas
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{area ? "Editar Área" : "Nueva Área"}</CardTitle>
          <CardDescription>
            {area ? "Modifica la información del área" : "Completa los datos para crear una nueva área"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del área *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Administración"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Descripción del área y sus funciones..."
                rows={4}
              />
            </div>

            {area && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange("isActive", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive">Área activa</Label>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2">
              <Link href="/dashboard/areas">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Guardando..." : area ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
