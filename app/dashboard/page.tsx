// en: app/dashboard/page.tsx
// (Asegúrate de borrar la línea "use client" de arriba si la tienes)

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";

// Esta función se ejecuta en el servidor para obtener los datos del usuario.
async function getUserData() {
  const tokenCookie = cookies().get("token")?.value;

  // Si no hay cookie, redirigimos al login inmediatamente.
  if (!tokenCookie) {
    redirect("/login");
  }

  // Hacemos la llamada a nuestro backend para verificar la sesión.
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
    headers: {
      // ¡Clave! Reenviamos la cookie manualmente para que el backend nos autentique.
      Cookie: `token=${tokenCookie}`,
    },
    // 'no-store' asegura que siempre se pidan los datos más recientes.
    cache: 'no-store',
  });

  // Si la cookie es inválida o expiró, el backend dará un error. Redirigimos al login.
  if (!response.ok) {
    redirect("/login");
  }

  return response.json();
}

// La página ahora es una función 'async'
export default async function DashboardPage() {
  const { user } = await getUserData()

  return (
    <>
      {/* Inyección para evitar fetch duplicado en el cliente */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__INITIAL_USER__=${JSON.stringify(user)};`,
        }}
      />
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <DashboardHeader user={user} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardStats userRole={user.role} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
            <RecentActivity userRole={user.role} />
          </div>
          <div className="col-span-3">
            <QuickActions userRole={user.role} />
          </div>
        </div>
      </div>
    </>
  )
}
