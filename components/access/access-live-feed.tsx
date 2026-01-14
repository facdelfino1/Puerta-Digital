"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    __ACCESS_WS_URL__?: string
  }
}

interface AccessEventPayload {
  type?: string
  allowed?: boolean
  color?: string
  status?: string
  reasonCode?: string
  message?: string
  timestamp?: string
  person?: {
    id?: number
    name?: string
    dni?: string
    type?: string
    area?: string | null
    photoUrl?: string | null
  }
  provider?: {
    id?: number
    docStatus?: string
    expirationDate?: string | null
    daysRemaining?: number | null
  } | null
}

const DEFAULT_EVENT: AccessEventPayload = {
  message: "Esperando escaneos de codigos QR...",
  color: "neutral",
  status: "idle",
}

const COLOR_STYLES: Record<string, string> = {
  green: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/10 dark:text-green-100",
  red: "border-red-500 bg-red-50 text-red-900 dark:bg-red-900/10 dark:text-red-100",
  yellow: "border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/10 dark:text-yellow-100",
  neutral: "border-muted bg-muted/10 text-muted-foreground",
}

function resolveWsUrl() {
  if (typeof window !== "undefined" && window.__ACCESS_WS_URL__) {
    return window.__ACCESS_WS_URL__ as string
  }
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"
  const normalized = backendUrl.replace(/\/$/, "")
  const wsUrl = normalized.replace(/^http/i, (match) => (match === "https" ? "wss" : "ws"))
  return `${wsUrl}/ws/access`
}

export function AccessLiveFeed() {
  const [latestEvent, setLatestEvent] = useState<AccessEventPayload>(DEFAULT_EVENT)
  const [history, setHistory] = useState<AccessEventPayload[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)

  const connect = () => {
    const url = resolveWsUrl()
    try {
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        clearReconnect()
      }

      socket.onclose = () => {
        scheduleReconnect()
      }

      socket.onerror = () => {
        socket.close()
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AccessEventPayload
          if (data.type === "connected") return
          if (data.type && data.type !== "access_event") return
          setLatestEvent(data)
          setHistory((prev) => {
            const next = [data, ...prev]
            return next.slice(0, 5)
          })
        } catch (err) {
          console.error("Error parsing WebSocket message", err)
        }
      }
    } catch (err) {
      console.error("WebSocket connection error", err)
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimer.current) return
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      connect()
    }, 3000)
  }

  const clearReconnect = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }

  useEffect(() => {
    connect()
    return () => {
      clearReconnect()
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cardStyle = useMemo(() => COLOR_STYLES[latestEvent.color || "neutral"] ?? COLOR_STYLES.neutral, [latestEvent.color])

  const statusLabel = useMemo(() => {
    if (!latestEvent) return ""
    if (latestEvent.allowed === true) return "Acceso permitido"
    if (latestEvent.allowed === false) return "Acceso denegado"
    return ""
  }, [latestEvent])

  return (
    <div className="space-y-4">
      <Card className={cn("border-2 shadow-sm transition-colors", cardStyle)}>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold">Escaneo de QR en tiempo real</h3>
              {statusLabel && (
                <Badge variant={latestEvent.allowed ? "default" : "destructive"}>
                  {statusLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm opacity-80">
              {latestEvent.message || "Esperando el resultado del escaneo..."}
            </p>
          </div>

          {latestEvent.person?.name && (
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-70">Nombre</p>
                <p className="font-medium">{latestEvent.person.name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide opacity-70">DNI</p>
                <p className="font-medium">{latestEvent.person.dni}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide opacity-70">Tipo</p>
                <p className="font-medium capitalize">{latestEvent.person.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide opacity-70">Area</p>
                <p className="font-medium">{latestEvent.person.area || "No especificada"}</p>
              </div>
            </div>
          )}

          {latestEvent.provider && (
            <div className="rounded-md border border-white/40 bg-white/20 p-3 text-sm dark:border-white/10 dark:bg-white/5">
              <p className="font-semibold">Estado de documentacion</p>
              <p className="capitalize">
                {latestEvent.provider.docStatus?.replace(/_/g, " ") || "sin informacion"}
              </p>
              {latestEvent.provider.expirationDate && (
                <p>
                  Vence: {new Date(latestEvent.provider.expirationDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {latestEvent.timestamp && (
            <p className="text-xs opacity-70">
              Ultima actualizacion: {new Date(latestEvent.timestamp).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {history.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Historial reciente</p>
          <div className="space-y-1">
            {history.slice(1).map((event, idx) => (
              <div
                key={`${event.timestamp}-${idx}`}
                className="flex items-center justify-between rounded-md border bg-card p-2 text-sm"
              >
                <span className="font-medium">
                  {event.person?.name || "Sin nombre"} ({event.person?.dni || "?"})
                </span>
                <span className={cn("font-semibold", event.allowed ? "text-green-600" : "text-red-600")}>
                  {event.allowed ? "Permitido" : "Denegado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
