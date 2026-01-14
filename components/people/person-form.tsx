"use client"
import { useEffect, useRef, useState } from "react"
import type React from "react"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/utils/api"
import { resolveMediaUrl } from "@/utils/media"

interface Person {
  id?: number
  dni: string
  name: string
  email: string
  type: string
  areaId: number
  branch: string
  photoUrl?: string | null
  isActive: boolean
  supervisorUserId?: number | null
  supervisorName?: string | null
}

interface PersonFormProps {
  person?: Person
}

const MAX_PHOTO_SIZE = 2 * 1024 * 1024 // 2MB
const BRANCH_OPTIONS = [
  { value: "PHQ Cordoba", label: "PHQ C\u00F3rdoba" },
  { value: "Buenos Aires", label: "Buenos Aires" },
  { value: "Rosario", label: "Rosario" },
  { value: "Santa Fe", label: "Santa Fe" },
  { value: "Buenos Aires Dds", label: "Buenos Aires Dds" },
]
const SUPERVISOR_ALLOWED_ROLES = new Set(["supervisor", "administrador"])

const NO_SUPERVISOR_VALUE = '__no_supervisor__'

export function PersonForm({ person }: PersonFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    dni: person?.dni || "",
    name: person?.name || "",
    email: person?.email || "",
    type: person?.type || "empleado",
    areaId: person?.areaId?.toString() || "",
    branch: person?.branch || BRANCH_OPTIONS[0].value,
    isActive: person?.isActive ?? true,
    supervisorId: person?.supervisorUserId ? person.supervisorUserId.toString() : "",
  })
  const [photoPreview, setPhotoPreview] = useState(() => resolveMediaUrl(person?.photoUrl) || "")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [areas, setAreas] = useState<any[]>([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [areasError, setAreasError] = useState("")
  const [supervisors, setSupervisors] = useState<{ id: number; label: string }[]>([])
  const [supervisorsLoading, setSupervisorsLoading] = useState(true)
  const [supervisorsError, setSupervisorsError] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      setAreasLoading(true)
      setAreasError("")
      try {
        const data = await apiFetch("/areas", { authRedirect: true })
        const list = Array.isArray(data) ? data : data?.results || []
        if (active) setAreas(list)
      } catch (e: any) {
        if (active) setAreasError(e.message || "Error cargando areas")
      } finally {
        if (active) setAreasLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setSupervisorsLoading(true)
      setSupervisorsError("")
      try {
        const data = await apiFetch("/users", { authRedirect: true })
        const results = Array.isArray(data) ? data : data?.results || []
        let supervisorOptions = results
          .filter((user: any) => SUPERVISOR_ALLOWED_ROLES.has(user?.role))
          .map((user: any) => ({
            id: Number(user.id),
            label: user.name && user.name.trim().length > 0 ? user.name : user.email,
          }))
        if (person?.supervisorUserId) {
          const exists = supervisorOptions.some((option) => option.id === person.supervisorUserId)
          if (!exists) {
            supervisorOptions = [
              {
                id: person.supervisorUserId,
                label:
                  person.supervisorName && person.supervisorName.trim().length > 0
                    ? person.supervisorName
                    : `Supervisor #${person.supervisorUserId}`,
              },
              ...supervisorOptions,
            ]
          }
        }
        if (active) {
          setSupervisors(supervisorOptions)
        }
      } catch (err: any) {
        if (active) setSupervisorsError(err.message || "Error cargando supervisores")
      } finally {
        if (active) setSupervisorsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [person])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  const handlePickPhoto = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen")
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError("La imagen debe pesar menos de 2MB")
      return
    }

    setError("")
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setPhotoPreview(previewUrl)
    setPhotoFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (!formData.areaId) throw new Error("Debe seleccionar un area")

      const payload = new FormData()
      payload.append("dni", formData.dni.trim())
      payload.append("name", formData.name.trim())
      payload.append("type", formData.type)
      payload.append("areaId", formData.areaId)
      payload.append("branch", formData.branch)
      payload.append("isActive", formData.isActive ? "true" : "false")
      payload.append("email", formData.email.trim())
      payload.append("supervisorId", formData.supervisorId ? formData.supervisorId : "")

      if (photoFile) {
        payload.append("photo", photoFile)
      } else if (person?.photoUrl) {
        payload.append("photoUrl", person.photoUrl)
      }

      if (person?.id) {
        await apiFetch(`/people/${person.id}`, { method: "PUT", body: payload })
      } else {
        await apiFetch("/people", { method: "POST", body: payload })
      }

      router.push("/dashboard/people")
    } catch (err: any) {
      setError(err.message || "Error al guardar la persona. Intente nuevamente.")
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
        <Link href="/dashboard/people">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la lista
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{person ? "Editar Persona" : "Nueva Persona"}</CardTitle>
          <CardDescription>
            {person ? "Modifica la informacion de la persona" : "Completa los datos para registrar una nueva persona"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoPreview || ""} />
                <AvatarFallback className="text-lg">{formData.name.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="photo">Foto</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handlePickPhoto}>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir foto
                  </Button>
                  <p className="text-sm text-muted-foreground">JPG, PNG hasta 2MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dni">DNI *</Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) => handleInputChange("dni", e.target.value)}
                  placeholder="12345678"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empleado">Empleado</SelectItem>
                    <SelectItem value="proveedor">Proveedor</SelectItem>
                    <SelectItem value="guardia">Guardia</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Juan Perez"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisorId">Supervisado por</Label>
                <Select
                  value={formData.supervisorId ? formData.supervisorId : NO_SUPERVISOR_VALUE}
                  onValueChange={(value) =>
                    handleInputChange("supervisorId", value === NO_SUPERVISOR_VALUE ? "" : value)
                  }
                  disabled={supervisorsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={supervisorsLoading ? "Cargando supervisores..." : "Selecciona supervisor o administrador"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUPERVISOR_VALUE}>Sin supervisor asignado</SelectItem>
                    {supervisors.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id.toString()}>
                        {supervisor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {supervisorsError && <p className="text-xs text-red-500">{supervisorsError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Sucursal *</Label>
                <Select value={formData.branch} onValueChange={(value) => handleInputChange("branch", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCH_OPTIONS.map((branchOption) => (
                      <SelectItem key={branchOption.value} value={branchOption.value}>
                        {branchOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="juan@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area *</Label>
              <Select value={formData.areaId} onValueChange={(value) => handleInputChange("areaId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un area" />
                </SelectTrigger>
                <SelectContent>
                  {areasLoading ? (
                    <SelectItem disabled value="loading">
                      Cargando...
                    </SelectItem>
                  ) : (
                    areas.map((area) => (
                      <SelectItem key={area.id} value={area.id.toString()}>
                        {area.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {areasError && <p className="text-xs text-red-500">{areasError}</p>}
            </div>

            {person && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange("isActive", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive">Persona activa</Label>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2">
              <Link href="/dashboard/people">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Guardando..." : person ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}







