"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Settings, Save, Database, Bell, Shield } from "lucide-react"
import { apiFetch } from "@/utils/api"

export function SystemSettings() {
  const [settings, setSettings] = useState({
    companyName: "",
    timezone: "America/Argentina/Buenos_Aires",
    sessionTimeout: "24",
    autoLogout: true,
    emailNotifications: true,
    smsNotifications: false,
    requirePhotoUpload: true,
    allowBulkImport: true,
    maxLoginAttempts: "3",
    passwordMinLength: "8",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Carga inicial de settings
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingInitial(true)
      setError("")
      try {
        const data = await apiFetch("/settings", { authRedirect: true })
        // Se asume backend retorna objeto directo o { settings: {...} }
        const raw = data?.settings ?? data
        if (raw && alive) {
          setSettings({
            companyName: raw.companyName ?? "",
            timezone: raw.timezone ?? "America/Argentina/Buenos_Aires",
            sessionTimeout: String(raw.sessionTimeout ?? "24"),
            autoLogout: !!raw.autoLogout,
            emailNotifications: !!raw.emailNotifications,
            smsNotifications: !!raw.smsNotifications,
            requirePhotoUpload: !!raw.requirePhotoUpload,
            allowBulkImport: !!raw.allowBulkImport,
            maxLoginAttempts: String(raw.maxLoginAttempts ?? "3"),
            passwordMinLength: String(raw.passwordMinLength ?? "8"),
          })
        }
      } catch (e: any) {
        if (alive) setError(e.message || "Error cargando configuración")
      } finally {
        if (alive) setLoadingInitial(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loadingInitial) return
    setIsLoading(true)
    setError("")
    setSuccess("")
    try {
      const payload = {
        companyName: settings.companyName.trim(),
        timezone: settings.timezone,
        sessionTimeout: Number(settings.sessionTimeout),
        autoLogout: settings.autoLogout,
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        requirePhotoUpload: settings.requirePhotoUpload,
        allowBulkImport: settings.allowBulkImport,
        maxLoginAttempts: Number(settings.maxLoginAttempts),
        passwordMinLength: Number(settings.passwordMinLength),
      }
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
        authRedirect: true,
      })
      setSuccess("Configuración guardada exitosamente")
    } catch (e: any) {
      setError(e.message || "Error al guardar la configuración")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loadingInitial ? (
        <p className="text-sm text-muted-foreground">Cargando configuración...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Configuración General</span>
              </CardTitle>
              <CardDescription>Configuración básica del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la empresa</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) => handleInputChange("companyName", e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona horaria</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => handleInputChange("timezone", value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                      <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                      <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                      <SelectItem value="America/Lima">Lima (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Configuración de Seguridad</span>
                </CardTitle>
                <CardDescription>Autenticación y políticas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Tiempo de sesión (horas)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      min={1}
                      max={72}
                      value={settings.sessionTimeout}
                      onChange={(e) => handleInputChange("sessionTimeout", e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxLoginAttempts">Máximo intentos de login</Label>
                    <Input
                      id="maxLoginAttempts"
                      type="number"
                      min={1}
                      max={10}
                      value={settings.maxLoginAttempts}
                      onChange={(e) => handleInputChange("maxLoginAttempts", e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autoLogout"
                      checked={settings.autoLogout}
                      onCheckedChange={(c) => handleInputChange("autoLogout", c as boolean)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="autoLogout">Cerrar sesión automáticamente por inactividad</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requirePhotoUpload"
                      checked={settings.requirePhotoUpload}
                      onCheckedChange={(c) => handleInputChange("requirePhotoUpload", c as boolean)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="requirePhotoUpload">Requerir foto al registrar personas</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notificaciones</span>
              </CardTitle>
              <CardDescription>Alertas y avisos automáticos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="emailNotifications"
                    checked={settings.emailNotifications}
                    onCheckedChange={(c) => handleInputChange("emailNotifications", c as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="emailNotifications">Notificaciones por email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="smsNotifications"
                    checked={settings.smsNotifications}
                    onCheckedChange={(c) => handleInputChange("smsNotifications", c as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="smsNotifications">Notificaciones por SMS</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Gestión de Datos</span>
              </CardTitle>
              <CardDescription>Importación y mantenimiento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowBulkImport"
                  checked={settings.allowBulkImport}
                  onCheckedChange={(c) => handleInputChange("allowBulkImport", c as boolean)}
                  disabled={isLoading}
                />
                <Label htmlFor="allowBulkImport">Permitir importación masiva</Label>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Acciones de mantenimiento</h4>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled>
                    Respaldar base de datos
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled>
                    Limpiar logs antiguos
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled>
                    Exportar configuración
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
