"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react"
import { apiFetch, logout } from "@/utils/api"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notVerified, setNotVerified] = useState(false)
  const [resending, setResending] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get("from") || "/dashboard"
  const force = searchParams.get("force") === "1"
  const requestLogout = searchParams.get("logout") === "1"
  const { setTheme } = useTheme()
  const logoutTriggeredRef = useRef(false)

  useEffect(() => {
    setTheme("light")
  }, [setTheme])

  useEffect(() => {
    if (!(force || requestLogout)) {
      logoutTriggeredRef.current = false
      return
    }
    if (logoutTriggeredRef.current) {
      return
    }
    logoutTriggeredRef.current = true
    ;(async () => {
      try {
        setLoggingOut(true)
        await logout(false)
      } finally {
        setLoggingOut(false)
      }
    })()
  }, [force, requestLogout])

  async function ensureSessionEstablished() {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const me = await apiFetch("/auth/me")
        if (me?.user) {
          ;(window as any).__INITIAL_USER__ = me.user
          return true
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 120))
    }
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setError("")
    setInfo("")
    setNotVerified(false)
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      await ensureSessionEstablished()
      window.location.replace(from.startsWith("/") ? from : "/dashboard")
    } catch (err: any) {
      const message = err?.message || "Error al iniciar sesión"
      if (err?.requiresVerification || message === "EMAIL_NOT_VERIFIED") {
        setNotVerified(true)
        setError("Tu correo aún no está verificado. Revisa tu bandeja de entrada o solicita un nuevo correo.")
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-xl shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Shield className="h-14 w-14 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Puerta Digital</CardTitle>
          <CardDescription className="text-base">
            {loggingOut ? "Cerrando sesión anterior..." : "Ingrese sus credenciales para acceder al sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                disabled={loggingOut}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  disabled={loggingOut}
                  className="h-12 pr-12 text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  disabled={loggingOut}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-sm"
                onClick={() => router.push("/forgot-password")}
                disabled={loggingOut}
              >
                Olvidaste tu contrasena?
              </Button>
            </div>

            {error && !loggingOut && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {info && (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}

            {notVerified && !loggingOut && (
              <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3 text-sm">
                <p>Revisa tu bandeja de entrada para encontrar el correo de verificacion. Si no lo recibiste, puedes reenviarlo.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setResending(true)
                    setError("")
                    setInfo("")
                    try {
                      await apiFetch("/auth/resend-verification-email", {
                        method: "POST",
                        body: JSON.stringify({ email }),
                      })
                      setInfo("Reenviamos un correo de verificación. Revisa tu bandeja de entrada.")
                    } catch (err: any) {
                      setError(err?.message || "No se pudo reenviar el correo")
                    } finally {
                      setResending(false)
                    }
                  }}
                  disabled={resending || !email}
                >
                  {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {resending ? "Enviando..." : "Reenviar correo"}
                </Button>
              </div>
            )}

            <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading || loggingOut}>
              {loggingOut ? "Preparando..." : isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
