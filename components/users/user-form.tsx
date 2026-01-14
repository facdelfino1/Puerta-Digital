"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Loader2, Image as ImageIcon, X } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/utils/api"
import { resolveMediaUrl } from "@/utils/media"

interface UserFormProps {
  user?: any | null
}

interface AreaOption {
  id: number
  name: string
}

const PERSON_TYPES = ["empleado", "proveedor", "guardia", "supervisor", "administrador"]
const BRANCH_OPTIONS = [
  { value: "PHQ Cordoba", label: "PHQ C\u00F3rdoba" },
  { value: "Buenos Aires", label: "Buenos Aires" },
  { value: "Rosario", label: "Rosario" },
  { value: "Santa Fe", label: "Santa Fe" },
  { value: "Buenos Aires Dds", label: "Buenos Aires Dds" },
]

const MAX_PHOTO_SIZE = 2 * 1024 * 1024

export function UserForm({ user }: UserFormProps) {
  const router = useRouter()
  const isEditing = Boolean(user?.id)
  const [form, setForm] = useState({
    name: user?.name ?? "",
    dni: user?.dni ?? "",
    email: user?.email ?? "",
    type: user?.type ?? "empleado",
    role: user?.role ?? "guardia",
    areaId: user?.areaId ? String(user.areaId) : "",
    branch: user?.branch ?? BRANCH_OPTIONS[0].value,
    photoUrl: user?.photoUrl ?? "",
    isActive: user?.isActive ?? true,
    password: "",
    confirmPassword: "",
  })
  const [areas, setAreas] = useState<AreaOption[]>([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [areasError, setAreasError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoPreviewUrl = resolveMediaUrl(form.photoUrl)

  const refreshCurrentSessionUser = async () => {
    if (typeof window === "undefined") return
    if (!user?.id) return
    const current = (window as any).__INITIAL_USER__
    if (!current || current.id !== user.id) return
    try {
      const me = await apiFetch("/auth/me", { authRedirect: true })
      if (me?.user) {
        (window as any).__INITIAL_USER__ = me.user
        window.dispatchEvent(new CustomEvent("auth:updated", { detail: me.user }))
      }
    } catch (err) {
      console.warn("No se pudo refrescar la sesiÃ³n actual", err)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      setAreasLoading(true)
      setAreasError(null)
      try {
        const data = await apiFetch("/areas", { authRedirect: true })
        if (!active) return
        const list = Array.isArray(data) ? data : data?.results || []
        setAreas(list.map((item: any) => ({ id: item.id, name: item.name })))
      } catch (err: any) {
        if (active) setAreasError(err?.message || "Error cargando Ã¡reas")
      } finally {
        if (active) setAreasLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isEditing && !form.areaId && areas.length > 0) {
      setForm((prev) => ({ ...prev, areaId: String(areas[0].id) }))
    }
  }, [areas, isEditing, form.areaId])

  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validatePasswords = () => {
    const pwd = form.password.trim()
    const confirm = form.confirmPassword.trim()
    if (!isEditing) {
      return pwd.length > 0 && pwd === confirm
    }
    if (pwd.length === 0 && confirm.length === 0) return true
    return pwd.length > 0 && pwd === confirm
  }

  const buildPayload = () => {
    if (!validatePasswords()) {
      throw new Error("Las contraseÃ±as no coinciden o estÃ¡n vacÃ­as.")
    }

    const safeName = (form.name ?? "").trim()
    const safeDni = (form.dni ?? "").trim()
    const safeEmail = (form.email ?? "").trim().toLowerCase()
    const safePhoto = (form.photoUrl ?? "").trim()
    const areaIdNumber = Number(form.areaId)
    if (!Number.isInteger(areaIdNumber) || areaIdNumber <= 0) {
      throw new Error("Debes seleccionar un Ã¡rea vÃ¡lida.")
    }

    const payload: Record<string, any> = {
      name: safeName,
      dni: safeDni,
      email: safeEmail,
      type: form.type,
      role: form.role,
      areaId: areaIdNumber,
      photoUrl: safePhoto,
      isActive: form.isActive,
    }

    const pwd = form.password.trim()
    if (pwd.length > 0) {
      payload.password = pwd
    } else if (!isEditing) {
      throw new Error("La contraseÃ±a es requerida al crear un usuario.")
    }

    if (!payload.name) throw new Error("El nombre completo es requerido.")
    if (!payload.dni) throw new Error("El DNI es requerido.")
    if (!payload.email) throw new Error("El correo electrÃ³nico es requerido.")

    return payload
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setInfo(null)
    try {
      const payload = buildPayload()
      setLoading(true)
      if (isEditing && user?.id) {
        await apiFetch(`/users/${user.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          authRedirect: true,
        })
        setInfo("Usuario actualizado correctamente.")
        await refreshCurrentSessionUser()
      } else {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify(payload),
          authRedirect: true,
        })
        setInfo("Usuario creado. Se enviÃ³ un correo de verificaciÃ³n si corresponde.")
        setForm({
          name: "",
          dni: "",
          email: "",
          type: "empleado",
          role: "guardia",
          areaId: areas[0] ? String(areas[0].id) : "",
          photoUrl: "",
          isActive: true,
          password: "",
          confirmPassword: "",
        })
      }
      router.push("/dashboard/users")
    } catch (err: any) {
      setError(err?.message || "Error al guardar el usuario.")
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen")
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError("La imagen debe pesar menos de 2MB")
      return
    }
    setUploadingPhoto(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("photo", file)
      const data = await apiFetch("/users/photo", {
        method: "POST",
        body: formData,
        authRedirect: true,
      })
      if (data?.photoUrl) {
        setForm((prev) => ({ ...prev, photoUrl: data.photoUrl }))
        setInfo("Foto subida correctamente.")
      }
    } catch (err: any) {
      setError(err?.message || "Error al subir la foto.")
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Actualiza la informaciÃ³n del usuario seleccionado."
            : "Completa los datos para crear una nueva cuenta de acceso al sistema."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                value={form.dni}
                onChange={(e) => handleChange("dni", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrÃ³nico</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de persona</Label>
              <Select value={form.type} onValueChange={(value) => handleChange("type", value)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PERSON_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="area">Ãrea</Label>
              <Select
                value={form.areaId}
                onValueChange={(value) => handleChange("areaId", value)}
                disabled={areasLoading}
              >
                <SelectTrigger id="area">
                  <SelectValue placeholder={areasLoading ? "Cargando..." : "Selecciona un Ã¡rea"} />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={String(area.id)}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {areasError && <p className="text-xs text-red-500">{areasError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol del sistema</Label>
              <Select value={form.role} onValueChange={(value) => handleChange("role", value)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="guardia">Guardia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Foto de perfil (opcional)</Label>
            <Input
              id="photoUrl"
              value={form.photoUrl}
              onChange={(e) => handleChange("photoUrl", e.target.value)}
              placeholder="https://... o sube un archivo"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                {uploadingPhoto ? "Subiendo..." : "Seleccionar"}
              </Button>
              {form.photoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => handleChange("photoUrl", "")}>
                  <X className="mr-1 h-4 w-4" /> Quitar
                </Button>
              )}
            </div>
            {photoPreviewUrl && (
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border">
                  <Image src={photoPreviewUrl} alt="Foto de usuario" fill className="object-cover" />
                </div>
                <p className="break-all text-xs text-muted-foreground">{form.photoUrl}</p>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">
                ContraseÃ±a {isEditing ? "(dejar en blanco para no cambiar)" : ""}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar contraseÃ±a {isEditing ? "(opcional)" : ""}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                required={!isEditing}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isActive">Cuenta activa</Label>
              <p className="text-xs text-muted-foreground">
                {form.isActive
                  ? "El usuario podrÃ¡ iniciar sesiÃ³n."
                  : "El usuario no podrÃ¡ acceder al sistema."}
              </p>
            </div>
            <Switch
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(value) => handleChange("isActive", value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : isEditing ? (
                "Actualizar usuario"
              ) : (
                "Crear usuario"
              )}
            </Button>
            <Link href="/dashboard/users">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}







