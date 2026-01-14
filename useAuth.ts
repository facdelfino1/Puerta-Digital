// frontend/hooks/useAuth.ts
"use client"

import { useState, useEffect } from "react"
import type { User } from "@/lib/auth"
import { apiFetch } from "@/utils/api"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiFetch("/auth/me", { credentials: "include" })
        setUser(data?.user ? { ...data.user, emailVerified: data.user.emailVerified ?? true } : null)
      } catch (err) {
        console.warn("Sesión no válida o expirada")
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  return { user, loading }
}


