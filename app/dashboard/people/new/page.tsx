import { requireRole } from "@/lib/auth"
import { PersonForm } from "@/components/people/person-form"

export default async function NewPersonPage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Nueva Persona</h2>
        <p className="text-muted-foreground">Registra una nueva persona (empleado, proveedor o personal interno) en el sistema</p>
      </div>
      <PersonForm />
    </div>
  )
}

