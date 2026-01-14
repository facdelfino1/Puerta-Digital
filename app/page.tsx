"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/api";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 🔑 Consulta al backend
        const data = await apiFetch("/auth/me", { credentials: "include" }); // ✅ usa cookie httpOnly

        if (!data?.user) {
          router.push("/login");
          return;
        }


        // 👉 Todos los roles van a /dashboard
        router.push("/dashboard");
      } catch (err) {
        console.warn("Sesión inválida o expirada:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [router]);

  if (loading) return <div>⏳ Verificando sesión...</div>;

  return null;
}
// No renderiza nada, solo redirige--