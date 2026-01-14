"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, FileCheck, FileWarning, FileX } from "lucide-react";
import type { UserRole } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/utils/api";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  userRole: UserRole;
}

type ProviderSummary = {
  total_vencidos: number | null;
  total_por_vencer: number | null;
  total_vigentes: number | null;
};

interface Summary {
  totalPeople: number;
  currentlyInside: number;
  todayEntries: number;
  todayExits: number;
}

type DetailType = "people" | "inside" | "entriesToday" | "exitsToday" | "providers" | "providersExpiring" | "providersExpired" | null;

interface DetailState {
  open: boolean;
  title: string;
  type: DetailType;
  loading: boolean;
  error: string;
  records: any[];
  search: string;
}

export function DashboardStats({ userRole }: DashboardStatsProps) {
  const [provSummary, setProvSummary] = useState<ProviderSummary>({
    total_vencidos: 0,
    total_por_vencer: 0,
    total_vigentes: 0,
  });
  const [loadingProv, setLoadingProv] = useState<boolean>(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);
  const [detail, setDetail] = useState<DetailState>({
    open: false,
    title: "",
    type: null,
    loading: true,
    error: "",
    records: [],
    search: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch("/providers/summary", { authRedirect: true });
        if (!alive) return;
        setProvSummary({
          total_vencidos: data?.total_vencidos ?? 0,
          total_por_vencer: data?.total_por_vencer ?? 0,
          total_vigentes: data?.total_vigentes ?? 0,
        });
      } catch {
        if (alive) setProvSummary({ total_vencidos: 0, total_por_vencer: 0, total_vigentes: 0 });
      } finally {
        if (alive) setLoadingProv(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setSummaryLoading(true);
      try {
        const data = await apiFetch("/dashboard/summary", { authRedirect: true });
        if (alive)
          setSummary({
            totalPeople: data?.totalPeople ?? 0,
            currentlyInside: data?.currentlyInside ?? 0,
            todayEntries: data?.todayEntries ?? 0,
            todayExits: data?.todayExits ?? 0,
          });
      } catch {
        if (alive) setSummary(null);
      } finally {
        if (alive) setSummaryLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const baseStats = [
    {
      title: "Personas Registradas",
      value: summaryLoading ? "-" : summary?.totalPeople ?? 0,
      icon: Users,
      description: "Total en el sistema",
      roles: ["supervisor", "administrador"],
      detailType: "people" as DetailType,
      className: "bg-sky-500/10 border border-sky-500/30 text-sky-900 hover:bg-sky-500/15 dark:text-sky-50",
      textClassName: "font-semibold text-sky-900 dark:text-sky-100",
      descriptionClassName: "text-sky-700 dark:text-sky-100/80",
      iconClassName: "text-sky-700 dark:text-sky-100",
    },
    {
      title: "Actualmente Dentro",
      value: summaryLoading ? "-" : summary?.currentlyInside ?? 0,
      icon: UserCheck,
      description: "En instalaciones",
      roles: ["guardia", "supervisor", "administrador"],
      detailType: "inside" as DetailType,
      className: "bg-sky-500/10 border border-sky-500/30 text-sky-900 hover:bg-sky-500/15 dark:text-sky-50",
      textClassName: "font-semibold text-sky-900 dark:text-sky-100",
      descriptionClassName: "text-sky-700 dark:text-sky-100/80",
      iconClassName: "text-sky-700 dark:text-sky-100",
    },
    {
      title: "Ingresos Hoy",
      value: summaryLoading ? "-" : summary?.todayEntries ?? 0,
      icon: UserCheck,
      description: "Entradas registradas",
      roles: ["guardia", "supervisor", "administrador"],
      detailType: "entriesToday" as DetailType,
      className: "bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 hover:bg-emerald-500/15 dark:text-emerald-50",
      textClassName: "font-semibold text-emerald-900 dark:text-emerald-100",
      descriptionClassName: "text-emerald-700 dark:text-emerald-100/80",
      iconClassName: "text-emerald-700 dark:text-emerald-100",
    },
    {
      title: "Egresos Hoy",
      value: summaryLoading ? "-" : summary?.todayExits ?? 0,
      icon: UserX,
      description: "Salidas registradas",
      roles: ["guardia", "supervisor", "administrador"],
      detailType: "exitsToday" as DetailType,
      className: "bg-rose-500/10 border border-rose-500/30 text-rose-900 hover:bg-rose-500/15 dark:text-rose-50",
      textClassName: "font-semibold text-rose-900 dark:text-rose-100",
      descriptionClassName: "text-rose-700 dark:text-rose-100/80",
      iconClassName: "text-rose-700 dark:text-rose-100",
    },
  ];

  const totalProvidersVigentes =
    (provSummary.total_vigentes ?? 0) + (provSummary.total_por_vencer ?? 0);

  const providerStats = [
    {
      title: "Proveedores vigentes",
      value: loadingProv ? "-" : totalProvidersVigentes,
      icon: FileCheck,
      description: "Documentacion vigente o proxima a vencer",
      roles: ["guardia", "supervisor", "administrador"],
      detailType: "providers" as DetailType,
      className: "bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 hover:bg-emerald-500/15 dark:text-emerald-50",
      textClassName: "font-semibold text-emerald-900 dark:text-emerald-100",
      descriptionClassName: "text-emerald-700 dark:text-emerald-100/80",
      iconClassName: "text-emerald-700 dark:text-emerald-100",
    },
    {
      title: "Proveedores a vencer",
      value: loadingProv ? "-" : provSummary.total_por_vencer ?? 0,
      icon: FileWarning,
      description: "Requieren renovacion",
      roles: ["guardia", "supervisor", "administrador"],
      detailType: "providersExpiring" as DetailType,
      className: "bg-amber-500/10 border border-amber-500/30 text-amber-900 hover:bg-amber-500/15 dark:text-amber-50",
      textClassName: "font-semibold text-amber-900 dark:text-amber-100",
      descriptionClassName: "text-amber-700 dark:text-amber-100/80",
      iconClassName: "text-amber-700 dark:text-amber-100",
    },
    {
      title: "Proveedores vencidos",
      value: loadingProv ? "-" : provSummary.total_vencidos ?? 0,
      icon: FileX,
      description: "Sin habilitacion",
      roles: ["guardia", "supervisor", "administrador"],
      detailType: "providersExpired" as DetailType,
      className: "bg-rose-500/10 border border-rose-500/30 text-rose-900 hover:bg-rose-500/15 dark:text-rose-50",
      textClassName: "font-semibold text-rose-900 dark:text-rose-100",
      descriptionClassName: "text-rose-700 dark:text-rose-100/80",
      iconClassName: "text-rose-700 dark:text-rose-100",
    },
  ];

  const filteredStats = [...baseStats, ...providerStats].filter((stat) => stat.roles.includes(userRole));

  const fetchDetail = async (type: Exclude<DetailType, null>, search: string) => {
    setDetail((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const query = search ? `&q=${encodeURIComponent(search)}` : "";
      const data = await apiFetch(`/dashboard/details?type=${type}${query}`, { authRedirect: true });
      const recordsRaw = Array.isArray(data.records) ? data.records : [];
      const processedRecords =
        type === "providers" ? recordsRaw.filter((row: any) => row.status !== "vencido") : recordsRaw;
      setDetail((prev) => ({
        ...prev,
        loading: false, // <-- CORREGIDO
        error: "",
        records: processedRecords,
      }));
    } catch (err: any) {
      setDetail((prev) => ({
        ...prev,
        loading: false, // <-- CORREGIDO
        error: err.message || "Error cargando detalle",
        records: [],
      }));
    }
  };

  const openDetail = (title: string, type: DetailType) => {
    if (!type) return;
    const cleanType = type;
    setDetail({
      open: true,
      title,
      type: cleanType,
      loading: true,
      error: "",
      records: [],
      search: "",
    });
    fetchDetail(cleanType, "");
  };

  const closeDetail = () => {
    setDetail((prev) => ({ ...prev, open: false }));
  };

  const handleDetailSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail.type) return;
    fetchDetail(detail.type, detail.search);
  };

  const renderDetailContent = () => {
    if (!detail.type) return null;
    if (detail.loading) {
      return <p className="text-sm text-muted-foreground">Cargando...</p>;
    }
    if (detail.error) {
      return <p className="text-sm text-destructive">{detail.error}</p>;
    }
    if (!detail.records.length) {
      return <p className="text-sm text-muted-foreground">Sin registros para mostrar.</p>;
    }

    if (detail.type === "people") {
      return (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Registrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.records.map((person: any) => (
                <TableRow key={person.id}>
                  <TableCell>{person.name}</TableCell>
                  <TableCell>{person.dni}</TableCell>
                  <TableCell className="capitalize">{person.type}</TableCell>
                  <TableCell>{person.area || "-"}</TableCell>
                  <TableCell>{person.email || "-"}</TableCell>
                  <TableCell>
                    {person.createdAt ? new Date(person.createdAt).toLocaleString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    if (detail.type === "inside" || detail.type === "entriesToday" || detail.type === "exitsToday") {
      const showEntry = detail.type !== "exitsToday";
      const accentClasses =
        detail.type === "entriesToday"
          ? "bg-emerald-500/10 border-emerald-500/30"
          : detail.type === "exitsToday"
            ? "bg-rose-500/10 border-rose-500/30"
            : undefined;
      return (
        <div className={cn("rounded-md border overflow-hidden", accentClasses)}>
          <Table className="bg-transparent">
            <TableHeader className="bg-transparent">
              <TableRow className="bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>{showEntry ? "Ingreso" : "Egreso"}</TableHead>
                <TableHead>Guardia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.records.map((row: any) => (
                <TableRow key={row.logId} className="bg-transparent">
                  <TableCell>{row.personName}</TableCell>
                  <TableCell>{row.dni}</TableCell>
                  <TableCell className="capitalize">{row.type}</TableCell>
                  <TableCell>{row.area || "-"}</TableCell>
                  <TableCell>
                    {showEntry
                      ? row.entryTime ? new Date(row.entryTime).toLocaleString() : "-"
                      : row.exitTime ? new Date(row.exitTime).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>{row.guardName || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    if (detail.type === "providers" || detail.type === "providersExpiring" || detail.type === "providersExpired") {
      const providerAccent =
        detail.type === "providers"
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900"
          : detail.type === "providersExpiring"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-900"
            : "bg-rose-500/10 border-rose-500/30 text-rose-900";
      return (
        <div className={cn("rounded-md border overflow-hidden", providerAccent)}>
          <Table className="bg-transparent">
            <TableHeader className="bg-transparent">
              <TableRow className="bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Permiso vehicular</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.records.map((row: any) => {
                const statusBadge =
                  row.status === "vencido"
                    ? <Badge variant="destructive">Vencido</Badge>
                    : row.status === "por_vencer"
                      ? <Badge variant="secondary">Por vencer</Badge>
                      : <Badge variant="outline">Vigente</Badge>;

                const rowHighlight =
                  row.status === "vencido"
                    ? "bg-rose-500/10 dark:bg-rose-900/20"
                    : row.status === "por_vencer"
                      ? "bg-amber-500/10 dark:bg-amber-900/20"
                      : "bg-transparent";

                return (
                  <TableRow key={row.id} className={cn("bg-transparent", rowHighlight)}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.dni}</TableCell>
                    <TableCell>{row.area || "-"}</TableCell>
                    <TableCell>{row.vehicleAccess ? "Si" : "No"}</TableCell>
                    <TableCell>
                      {row.expirationDate ? new Date(row.expirationDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>{statusBadge}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    }

    return null; // Fallback por si no coincide ningún tipo
  };

  return (
    <>
      {filteredStats.map((stat) => {
        const Icon = stat.icon;
        const clickable = Boolean(stat.detailType);
        return (
          <Card
            key={stat.title}
            onClick={() => stat.detailType && openDetail(stat.title, stat.detailType)}
            className={cn(
              "transition",
              clickable && "cursor-pointer hover:shadow-md",
              stat.className
            )}
            tabIndex={clickable ? 0 : -1}
            role={clickable ? "button" : undefined}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn("text-sm font-medium", stat.textClassName)}>{stat.title}</CardTitle>
              <Icon className={cn("h-4 w-4 text-muted-foreground", stat.iconClassName)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", stat.textClassName)}>{stat.value}</div>
              <p className={cn("text-xs text-muted-foreground", stat.descriptionClassName)}>{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}

      {userRole === "guardia" &&
        !loadingProv &&
        ((provSummary.total_por_vencer ?? 0) > 0 || (provSummary.total_vencidos ?? 0) > 0) && (
          <div className="md:col-span-2 lg:col-span-4">
            <div className="mt-2 rounded-md border p-3 bg-yellow-50 dark:bg-yellow-900/20 text-sm">
              {provSummary.total_vencidos ? (
                <span>{provSummary.total_vencidos} proveedor(es) con documentacion vencida. </span>
              ) : null}
              {provSummary.total_por_vencer ? (
                <span>{provSummary.total_por_vencer} proveedor(es) por vencer en breve.</span>
              ) : null}
            </div>
          </div>
        )}

      <Dialog open={detail.open} onOpenChange={closeDetail}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{detail.title}</DialogTitle>
            <DialogDescription>
              {detail.type === "people" && "Listado de personas registradas en el sistema."}
              {detail.type === "inside" && "Personas actualmente dentro de la planta."}
              {detail.type === "providers" && "Proveedores vigentes. Se resaltan los proximos a vencer."}
            </DialogDescription>
          </DialogHeader>
          {detail.type && (
            <form onSubmit={handleDetailSearch} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Buscar por nombre o DNI..."
                value={detail.search}
                onChange={(event) => setDetail((prev) => ({ ...prev, search: event.target.value }))}
              />
              <Button type="submit" className="sm:w-auto">
                Buscar
              </Button>
            </form>
          )}
          {renderDetailContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}
