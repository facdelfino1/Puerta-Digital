import { requireRole } from "@/lib/auth"
import { VehicleForm } from "@/components/vehicles/vehicle-form"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

interface VehicleEditPageProps {
  params: { id: string }
}

export default async function VehicleEditPage({ params }: VehicleEditPageProps) {
  await requireRole(["supervisor", "administrador"])

  const id = params.id
  const token = cookies().get("token")?.value
  if (!token) {
    redirect("/login")
  }

  // redirige si no hay token
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/vehicles/${id}`, {
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  })

  if (res.status === 404) {
    notFound()
  }

  if (!res.ok) {
    // Error genérico: regresar al listado
    redirect("/dashboard/vehicles")
  }

  const data = await res.json()
  // Acepta { vehicle } o el objeto directo
  const vehicle = data?.vehicle ?? data
  if (!vehicle?.id) {
    notFound()
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <VehicleForm vehicle={vehicle} />
    </div>
  )
}
