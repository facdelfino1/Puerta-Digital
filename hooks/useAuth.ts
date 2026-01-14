"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/utils/api"
import type { User } from "@/lib/auth"

export type AuthStatus = "loading" | "authenticated" | "unauthenticated"

export function useAuth({
  redirectTo,
  redirectIfFound = false,
  autoRedirect = true,
  hydrateFromWindow = true,
}: {
  redirectTo?: string
  redirectIfFound?: boolean
  autoRedirect?: boolean
  hydrateFromWindow?: boolean
} = {}) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let aborted = false
    let hydratedFromWindow = false

    // Evita refetch en /login sin cookie
    if (typeof window !== "undefined") {
      const path = window.location.pathname
      const hasTokenCookie = document.cookie.includes("token=")
      if (path === "/login" && !hasTokenCookie) {
        setUser(null)
        setStatus("unauthenticated")
        setLoading(false)
        return () => {
          aborted = true
        }
      }
    }

    // Hidratación inicial desde window.__INITIAL_USER__
    if (hydrateFromWindow && typeof window !== "undefined") {
      const initialUser = (window as any).__INITIAL_USER__
      if (initialUser) {
        hydratedFromWindow = true
        setUser(initialUser as User)
        setStatus("authenticated")
        setLoading(false)
      }
    }

    const fetchUser = async () => {
      try {
        if (!hydratedFromWindow) {
          setLoading(true)
        }
        const data = await apiFetch("/auth/me", { credentials: "include" })
        if (aborted) return
        if (data?.user) {
          setUser(data.user as User)
          setStatus("authenticated")
        } else {
          setUser(null)
          setStatus("unauthenticated")
        }
      } catch {
        if (aborted) return
        setUser(null)
        setStatus("unauthenticated")
      } finally {
        if (!aborted) setLoading(false)
      }
    }

    fetchUser()
    return () => {
      aborted = true
    }
  }, [hydrateFromWindow])

  useEffect(() => {
    if (!autoRedirect) return
    if (status === "loading") return

    if (redirectTo) {
      if (status === "authenticated" && redirectIfFound) {
        router.replace(redirectTo)
      } else if (status === "unauthenticated" && !redirectIfFound) {
        router.replace(redirectTo)
      }
    }
  }, [status, redirectTo, redirectIfFound, autoRedirect, router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<User | null>).detail
      if (detail) {
        setUser(detail)
        setStatus("authenticated")
        setLoading(false)
        ;(window as any).__INITIAL_USER__ = detail
      } else {
        setUser(null)
        setStatus("unauthenticated")
        setLoading(false)
        ;(window as any).__INITIAL_USER__ = null
      }
    }
    window.addEventListener("auth:updated", handler as EventListener)
    return () => {
      window.removeEventListener("auth:updated", handler as EventListener)
    }
  }, [])

  return { user, loading, status }
}
