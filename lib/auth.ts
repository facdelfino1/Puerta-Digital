import { apiFetch } from "@/utils/api"
import { cookies } from "next/headers"

export type UserRole = "guardia" | "supervisor" | "administrador"

export interface User {
  id: number
  email: string
  name: string
  role: UserRole
  photoUrl?: string | null
}

export async function requireAuth(): Promise<User> {
  try {
    // En entorno servidor (RSC/SSR), reenviar token desde cookies de Next
    if (typeof window === "undefined") {
      const token = cookies().get("token")?.value
      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      })
      if (!res.ok) throw new Error("No autenticado")
      const data = await res.json()
      return { ...data.user, emailVerified: data.user?.emailVerified ?? true }
    }

    // En cliente, apiFetch envía la cookie httpOnly
    const data = await apiFetch("/auth/me", { credentials: "include" })
    return { ...data.user, emailVerified: data.user?.emailVerified ?? true }
  } catch {
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    throw new Error("No autenticado")
  }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    if (typeof window !== "undefined") {
      window.location.href = "/unauthorized"
    }
    throw new Error("Acceso denegado")
  }

  return user
}


