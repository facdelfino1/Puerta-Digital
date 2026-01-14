import { requireRole } from "@/lib/auth"
import { AreaForm } from "@/components/areas/area-form"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

interface AreaEditPageProps {
  params: { id: string }
}

export default async function AreaEditPage({ params }: AreaEditPageProps) {
  await requireRole(["supervisor", "administrador"])
  const token = cookies().get("token")?.value
  if (!token) redirect("/login")
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/areas/${params.id}`,
    {
      headers: { Cookie: `token=${token}` },
      cache: "no-store",
    }
  )
  if (res.status === 404) notFound()
  if (!res.ok) redirect("/dashboard/areas")
  const data = await res.json()
  const area = data?.area ?? data
  if (!area?.id) notFound()
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AreaForm area={area} />
    </div>
  )
}
