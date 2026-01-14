import { requireAuth } from "@/lib/auth"
import { ReportsGenerator } from "@/components/reports/reports-generator"
import { ReportsCharts } from "@/components/reports/reports-charts"
import { AreaEntriesPie } from "@/components/reports/area-entries-pie"

export default async function ReportsPage() {
  const user = await requireAuth()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reportes y Estadísticas</h2>
        <p className="text-muted-foreground">Genera reportes de actividad y visualiza estadísticas del sistema</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ReportsGenerator userRole={user.role} />
        </div>
        <div className="lg:col-span-2">
          <ReportsCharts userRole={user.role} />
        </div>
      </div>
      <AreaEntriesPie userRole={user.role} />
    </div>
  )
}
