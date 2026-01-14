import { API_BASE_URL } from "./api"

/**
 * Normaliza una URL de medio proveniente del backend.
 * Mantiene URLs absolutas (http, https, blob, data, etc.) y
 * convierte rutas relativas en URLs completas contra el backend.
 */
export function resolveMediaUrl(input?: string | null): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[a-zA-Z]+:/.test(trimmed)) {
    return trimmed
  }
  const base = API_BASE_URL.replace(/\/+$/, "")
  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`
  }
  return `${base}/${trimmed.replace(/^\/+/, "")}`
}
