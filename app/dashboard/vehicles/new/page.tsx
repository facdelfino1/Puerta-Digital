import { requireRole } from "@/lib/auth"
import { VehicleForm } from "@/components/vehicles/vehicle-form"

export default async function NewVehiclePage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Nuevo Vehículo</h2>
        <p className="text-muted-foreground">
          Registra un nuevo vehículo asociado a un proveedor
        </p>
      </div>
      <VehicleForm />
    </div>
  )
}
