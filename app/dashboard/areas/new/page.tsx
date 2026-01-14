import { requireRole } from "@/lib/auth"
import { AreaForm } from "@/components/areas/area-form"

export default async function NewAreaPage() {
  await requireRole(["supervisor", "administrador"])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AreaForm />
    </div>
  )
}
