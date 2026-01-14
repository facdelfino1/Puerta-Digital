import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { UserForm } from "@/components/users/user-form"

interface UserPageProps {
  params: { id: string }
}

export default async function UserPage({ params }: UserPageProps) {
  await requireRole(["supervisor", "administrador"])
  const token = cookies().get("token")?.value
  if (!token) redirect("/login")

  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/${params.id}`, {
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  })

  if (res.status === 404) notFound()
  if (!res.ok) redirect("/dashboard/users")

  const data = await res.json()
  const user = data?.user ?? data
  if (!user?.id) notFound()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Editar Usuario</h2>
        <p className="text-muted-foreground">Actualiza la informacion de {user.name || user.email}</p>
      </div>
      <UserForm user={user} />
    </div>
  )
}
