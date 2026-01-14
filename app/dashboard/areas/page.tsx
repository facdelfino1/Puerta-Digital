import { requireRole } from "@/lib/auth"
import { AreasList } from "@/components/areas/areas-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function AreasPage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Áreas</h2>
          <p className="text-muted-foreground">Administra las áreas de la empresa</p>
        </div>
        <Link href="/dashboard/areas/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Área
          </Button>
        </Link>
      </div>
      <AreasList />
    </div>
  )
}
