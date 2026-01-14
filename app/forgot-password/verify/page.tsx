"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ShieldCheck } from "lucide-react"
import { apiFetch } from "@/utils/api"

export default function ForgotPasswordVerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const emailParam = searchParams.get("email") || ""
  const [email, setEmail] = useState(emailParam)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setEmail(emailParam)
  }, [emailParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setError("")
    try {
      const result = await apiFetch("/auth/password-reset/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      })
      const token = result?.resetToken
      if (!token) {
        throw new Error("No se pudo validar el codigo")
      }
      router.push(
        `/forgot-password/reset?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
      )
    } catch (err: any) {
      setError(err?.message || "No se pudo validar el codigo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Validar codigo</CardTitle>
          <CardDescription>Ingresa el codigo que enviamos a tu correo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Correo electronico
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                disabled={isLoading}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="code" className="text-sm font-medium text-foreground">
                Codigo de verificacion
              </Label>
              <Input
                id="code"
                type="text"
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                required
                disabled={isLoading}
                className="h-12 text-base tracking-widest"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Validando..." : "Validar codigo"}
            </Button>
          </form>

          <Button type="button" variant="link" className="w-full" onClick={() => router.push("/login")}>
            Volver al login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
