"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { apiFetch } from "@/utils/api"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const lastProcessedToken = useRef<string | null>(null)
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("Verificando correo...")

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error")
        setMessage("Token de verificaci\u00f3n faltante")
        return
      }

      if (lastProcessedToken.current === token) {
        return
      }

      lastProcessedToken.current = token

      try {
        await apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: "GET",
        })
        setStatus("success")
        setMessage("Correo validado correctamente.")
      } catch (err: any) {
        setStatus("error")
        setMessage(err?.message || "No se pudo verificar el correo. El enlace puede haber expirado.")
      }
    }

    verify()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{status === "success" ? "Correo validado" : "Verificacion de correo"}</CardTitle>
          <CardDescription>
            {status === "success"
              ? "Tu correo quedó verificado correctamente. Ya puedes iniciar sesión."
              : "Completa este paso para acceder al sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            <p>{message}</p>
          </div>
          {status === "success" && (
            <Button className="w-full" onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          )}
          {status === "error" && (
            <Button className="w-full" variant="outline" onClick={() => router.push("/login")}>
              Volver al login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
