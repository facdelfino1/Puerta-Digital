"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/utils/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "../ui/use-toast";

interface Provider {
  id: number;
  name: string;
  contact?: string;
  email?: string;
  status?: "ok" | "expired" | "warning";
}

export default function ProvidersList() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState<number[]>([]);
  const [toNotify, setToNotify] = useState<number[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const listData = await apiFetch("/providers", { authRedirect: true });
      const list: Provider[] = Array.isArray(listData) ? listData : listData?.results || [];
      const statusData = await apiFetch("/providers/summary", { authRedirect: true });
      const expiredList = statusData?.expired?.map((x: any) => Number(x.providerId)) || [];
      const notifyList = statusData?.toNotify?.map((x: any) => Number(x.providerId)) || [];
      setExpired(expiredList);
      setToNotify(notifyList);
      setProviders(
        list.map(p => ({
          ...p,
          status:
            expiredList.includes(p.id)
              ? "expired"
              : notifyList.includes(p.id)
              ? "warning"
              : "ok",
        }))
      );
      if (notifyList.length > 0) {
        toast({
          title: "Aviso de vencimiento",
          description: `${notifyList.length} proveedor(es) próximos a vencer.`,
        });
      }
    } catch (e: any) {
      setError(e.message || "Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Lista de Proveedores</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Contacto</th>
                <th className="px-4 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">{p.contact || p.email || "—"}</td>
                  <td className="px-4 py-2">
                    {p.status === "ok" && <Badge variant="default">Al día</Badge>}
                    {p.status === "warning" && <Badge variant="secondary">Por vencer</Badge>}
                    {p.status === "expired" && <Badge variant="destructive">Vencido</Badge>}
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No hay proveedores registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
