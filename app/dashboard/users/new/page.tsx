import { requireRole } from "@/lib/auth"
import { UserForm } from "@/components/users/user-form"

export default async function NewUserPage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Nuevo Usuario</h2>
        <p className="text-muted-foreground">Registra una nueva cuenta de acceso para el sistema.</p>
      </div>
      <UserForm />
    </div>
  )
}
