import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/providers",
  "/access_logs",
  "/persons",
  "/vehicles",
];

const ROLE_RESTRICTIONS: Array<{ prefix: string; allowedRoles: string[] }> = [
  { prefix: "/dashboard/users", allowedRoles: ["supervisor", "administrador"] },
];

interface SessionUser {
  id: number;
  role: string;
  name?: string;
  email?: string;
}

async function fetchSessionUser(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    // Reenviar el token explicitamente como Authorization para validar desde middleware
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  const isLogin = pathname === "/login";
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isLogin) return NextResponse.next();

  const doLogout = searchParams.get("logout") === "1";

  if (isLogin && doLogout && token) {
    const res = NextResponse.next();
    res.cookies.set("token", "", { path: "/", expires: new Date(0) });
    return res;
  }

  const sessionUser = await fetchSessionUser(token);
  const isValid = Boolean(sessionUser);

  if (isProtected && !isValid) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    const res = NextResponse.redirect(loginUrl);
    // No borrar la cookie si existe; podria ser un fallo transitorio
    if (!token) {
      res.cookies.set("token", "", { path: "/", expires: new Date(0) });
    }
    return res;
  }

  if (sessionUser) {
    const restricted = ROLE_RESTRICTIONS.find((rule) => pathname.startsWith(rule.prefix));
    if (restricted && !restricted.allowedRoles.includes(sessionUser.role)) {
      const unauthorizedUrl = req.nextUrl.clone();
      unauthorizedUrl.pathname = "/unauthorized";
      unauthorizedUrl.searchParams.delete("from");
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/providers/:path*",
    "/access_logs/:path*",
    "/persons/:path*",
    "/vehicles/:path*",
    "/login",
  ],
};
