import { requireRole } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UsersList } from "@/components/users/users-list"

export default async function UsersPage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
          <p className="text-muted-foreground">
            Administra las cuentas de acceso para administradores, supervisores y guardias del sistema.
          </p>
        </div>
        <Link href="/dashboard/users/new">
          <Button>
            Nueva Persona
          </Button>
        </Link>
      </div>
      <UsersList />
    </div>
  )
}
