import { requireRole } from "@/lib/auth"
import { VehiclesList } from "@/components/vehicles/vehicles-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function VehiclesPage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Vehículos</h2>
          <p className="text-muted-foreground">Administra los vehículos de proveedores</p>
        </div>
        <Link href="/dashboard/vehicles/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Vehículo
          </Button>
        </Link>
      </div>
      <VehiclesList />
    </div>
  )
}
