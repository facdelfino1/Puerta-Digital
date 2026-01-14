import { requireRole } from "@/lib/auth"
import { PersonForm } from "@/components/people/person-form"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

interface PersonPageProps {
  params: { id: string }
}

export default async function PersonPage({ params }: PersonPageProps) {
  await requireRole(["supervisor", "administrador"])
  const token = cookies().get("token")?.value
  if (!token) redirect("/login")
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/people/${params.id}`, {
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  })
  if (res.status === 404) notFound()
  if (!res.ok) redirect("/dashboard/people")
  const data = await res.json()
  const person = data?.person ?? data
  if (!person?.id) notFound()
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Editar Persona</h2>
        <p className="text-muted-foreground">Modifica la información de {person.name}</p>
      </div>
      <PersonForm person={person} />
    </div>
  )
}
/* Removed duplicate default export function PersonPage */
