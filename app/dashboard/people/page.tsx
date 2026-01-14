import { requireRole } from "@/lib/auth"
import { PeopleList } from "@/components/people/people-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UserPlus } from "lucide-react"

export default async function PeoplePage() {
  const user = await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Personas</h2>
          <p className="text-muted-foreground">Administra empleados, proveedores y personal autorizado del sistema</p>
        </div>
        <Link href="/dashboard/people/new">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Nueva Persona
          </Button>
        </Link>
      </div>
      <PeopleList userRole={user.role} />
    </div>
  )
}
