import { requireRole } from "@/lib/auth"
import { SystemSettings } from "@/components/settings/system-settings"

export default async function SettingsPage() {
  await requireRole(["administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h2>
        <p className="text-muted-foreground">Administra la configuración general del sistema</p>
      </div>
      <SystemSettings />
    </div>
  )
}
