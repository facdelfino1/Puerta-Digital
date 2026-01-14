"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AccessControl } from "@/components/access/access-control"
import { AccessHistory } from "@/components/access/access-history"
import { apiFetch } from "@/utils/api"
import { AccessLiveFeed } from "@/components/access/access-live-feed"

export default function AccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get("action") || undefined

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiFetch("/auth/me") // 🔑 backend valida cookie httpOnly
        if (!data?.user) {
          router.push("/login")
          return
        }
        setUser(data.user)
      } catch (err) {
        console.error("Error obteniendo sesión:", err)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [router])

  if (loading) return <div>⏳ Cargando sesión...</div>
  if (!user) return null

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Control de Acceso</h2>
        <p className="text-muted-foreground">
          Registra ingresos y egresos de personas y proveedores
        </p>
      </div>
      <AccessLiveFeed />
      <div className="grid gap-4 lg:grid-cols-2">
        <AccessControl user={user} defaultAction={action} />
        <AccessHistory userRole={user.role} />
      </div>
    </div>
  )
}
