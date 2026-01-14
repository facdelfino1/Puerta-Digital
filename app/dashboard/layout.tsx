"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/hooks/useAuth"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Se hidrata desde window.__INITIAL_USER__ inyectado en la page para evitar fetch extra.
  const { user, loading, status } = useAuth({ autoRedirect: false, hydrateFromWindow: true })

  if (loading || status === "loading") return <p>Cargando sesión...</p>
  if (status === "unauthenticated") return <p>Sesión expirada. Recarga la página.</p>

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user!} />
      <div className="flex flex-1 flex-col">
        <Header user={user!} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
