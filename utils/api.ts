const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
export const API_BASE_URL = API_URL;

// Extensión de opciones propias
interface ExtraApiOptions {
  authRedirect?: boolean; // default true: redirigir solo si no hay cookie
  rawResponse?: boolean; // devuelve Response crudo
}

/**
 * apiFetch centraliza las llamadas al backend:
 * - Agrega credentials: "include" para que viaje la cookie httpOnly.
 * - Redirige a /login si la sesión expiró (401/403).
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit & ExtraApiOptions = {}
): Promise<any> {
  const {
    authRedirect = true,
    rawResponse = false,
    ...fetchOpts
  } = options;

  const isFormDataBody = typeof FormData !== "undefined" && fetchOpts.body instanceof FormData;
  const mergedHeaders = {
    ...(!isFormDataBody ? { "Content-Type": "application/json" } : {}),
    ...((fetchOpts.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOpts,
    headers: mergedHeaders,
    credentials: "include", // manda la cookie automaticamente
  });

  // 401 (no autenticado)
  if (res.status === 401) {
    // Verificamos si todavía está la cookie (token=) → si existe, NO redirigimos (posible inconsistencia backend)
    const hasToken =
      typeof document !== "undefined" && document.cookie.includes("token=");
    if (
      authRedirect &&
      !hasToken &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      console.warn("[apiFetch] 401 sin cookie → redirigiendo a /login");
      window.location.href = "/login";
    } else {
      console.warn(
        "[apiFetch] 401 recibido pero cookie presente; no redirijo (lanzo error)."
      );
    }
    throw new Error("No autenticado");
  }

  // 403 (permiso insuficiente) -> nunca redirigir
  if (res.status === 403) {
    let errMsg = "Acceso denegado";
    let payload: any = {};
    try {
      payload = await res.json();
      errMsg = payload.message || payload.error || errMsg;
    } catch {}
    const error: any = new Error(errMsg);
    Object.assign(error, payload);
    throw error;
  }

  if (!res.ok) {
    let errMsg = "Error en la API";
    let payload: any = {};
    try {
      payload = await res.json();
      errMsg = payload.message || payload.error || errMsg;
    } catch {}
    const error: any = new Error(errMsg);
    Object.assign(error, payload);
    throw error;
  }

  if (rawResponse) return res;
  if (res.status === 204) return null;
  return res.json();
}

// Reemplazo: asegura limpieza local y redirección
export async function logout(redirect: boolean = true): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST", authRedirect: false });
  } catch {
    // ignorar error de logout
  } finally {
    // Forzar tema claro tras logout
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("theme", "light");
      } catch {
        // ignore storage errors (modo incógnito, etc.)
      }
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      (window as any).__INITIAL_USER__ = null;
      if (redirect) {
        window.location.replace("/login?logout=1");
      }
    }
  }
}
