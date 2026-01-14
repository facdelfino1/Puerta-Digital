"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/auth";
import { Search, UserCheck, UserX, Car, Clock, CheckCircle } from "lucide-react";

import { apiFetch } from "@/utils/api"; // centraliza el fetch con token
import { resolveMediaUrl } from "@/utils/media";

interface AccessControlProps {
  user: User;
  defaultAction?: string;
}

export function AccessControl({ user, defaultAction }: AccessControlProps) {
  const [action, setAction] = useState(defaultAction || "entry");
  const [dni, setDni] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState("0");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isShellyProcessing, setIsShellyProcessing] = useState(false);

  const [peopleCatalog, setPeopleCatalog] = useState<any[]>([]);
  const [vehiclesCatalog, setVehiclesCatalog] = useState<any[]>([]);

  const [nameQuery, setNameQuery] = useState("");
  const [nameMatches, setNameMatches] = useState<any[]>([]);
  const [nameSelectValue, setNameSelectValue] = useState("");

  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleMatches, setVehicleMatches] = useState<any[]>([]);
  const [vehicleSelectValue, setVehicleSelectValue] = useState("");
  const scanBufferRef = useRef("");
  const statusCacheRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (defaultAction) setAction(defaultAction);
  }, [defaultAction]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [peopleRes, vehiclesRes] = await Promise.allSettled([
          apiFetch("/people"),
          apiFetch("/vehicles"),
        ]);

        if (!mounted) return;

        if (peopleRes.status === "fulfilled") {
          const value = peopleRes.value as any;
          const list = Array.isArray(value)
            ? value
            : Array.isArray(value?.people)
              ? value.people
              : [];
          if (list.length > 0) {
            setPeopleCatalog(list);
          }
        }

        if (vehiclesRes.status === "fulfilled") {
          const value = vehiclesRes.value as any;
          const list = Array.isArray(value)
            ? value
            : Array.isArray(value?.vehicles)
              ? value.vehicles
              : [];
          if (list.length > 0) {
            setVehiclesCatalog(list);
          }
        }
      } catch (catalogErr) {
        console.warn("No se pudieron cargar catalogos de personas/vehiculos", catalogErr);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // 🔍 Buscar persona en el backend
  const loadPersonStatus = useCallback(
    async (dniValue: string, options: { preselectVehicleId?: number } = {}) => {
      const normalized = dniValue.trim();
      if (!normalized) return null;
      setError("");
      setSuccess("");
      setSelectedPerson(null);
      setIsSearching(true);

      try {
        const res = await apiFetch(`/providers/status?dni=${normalized}`);
        if (res.exists) {
          const vehiclesList = Array.isArray(res.vehicles) ? res.vehicles : [];
          const vehicleToSelect = options.preselectVehicleId
            ? vehiclesList.find((v: any) => String(v.id) === String(options.preselectVehicleId))
            : null;

          const isInside = Boolean(res.isInside);

          setSelectedPerson({
            dni: normalized,
            name: res.name || "Persona registrada",
            type: res.type || "empleado",
            area: res.area || "Desconocida",
            isInside,
            vehicles: vehiclesList,
          });
          setDni(normalized);
          setSelectedVehicle(vehicleToSelect ? String(vehicleToSelect.id) : "0");
          setNameMatches([]);
          setVehicleMatches([]);
          setNameSelectValue("");
          setVehicleSelectValue(vehicleToSelect ? String(vehicleToSelect.id) : "");

          statusCacheRef.current.set(normalized, isInside);
          setAction(isInside ? "exit" : "entry");
          return { exists: true, isInside, raw: res };
        }

        setError("Persona no encontrada en el sistema");
        statusCacheRef.current.delete(normalized);
        return { exists: false };
      } catch (err: any) {
        setError("Error consultando DNI");
        statusCacheRef.current.delete(normalized);
        return null;
      } finally {
        setIsSearching(false);
      }
    },
    [apiFetch],
  );

  // ✅ Registrar entrada/salida
  const triggerShellyScan = useCallback(async (dniValue: string, actionType: "entry" | "exit") => {
    const normalized = dniValue.trim();
    if (!normalized) return null;

    try {
      setIsShellyProcessing(true);
      const result = await apiFetch("/api/scan/log-access", {
        method: "POST",
        body: JSON.stringify({ dni: normalized, action: actionType }),
        authRedirect: true,
      });

      if (result?.allowed) {
        setSuccess(result.message || "Acceso permitido");
        setError("");
      } else {
        setError(result?.message || "Acceso denegado");
        setSuccess("");
      }

      return result;
    } catch (err: any) {
      setError(err?.message || "Error procesando acceso");
      setSuccess("");
      return null;
    } finally {
      setIsShellyProcessing(false);
    }
  }, [apiFetch]);

  const handleDniSearch = useCallback(
    async (overrideDni?: string) => {
      if (isShellyProcessing) return;
      const value = (overrideDni ?? dni).trim();
      if (!value) return;
      setDni(value);

      const currentState = await loadPersonStatus(value);
      if (!currentState?.exists) {
        return;
      }

      const desiredAction = currentState.isInside ? "exit" : "entry";
      if (desiredAction !== action) {
        setAction(desiredAction);
      }

      await triggerShellyScan(value, desiredAction);

      const updated = await loadPersonStatus(value);
      if (updated?.exists) {
        statusCacheRef.current.set(value, updated.isInside);
        setAction(updated.isInside ? "exit" : "entry");
      }
    },
    [dni, action, triggerShellyScan, loadPersonStatus, isShellyProcessing],
  );

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) {
          return;
        }
      }

      if (event.key === "Enter") {
        const buffered = scanBufferRef.current.trim();
        scanBufferRef.current = "";
        if (buffered.length > 0) {
          event.preventDefault();
          handleDniSearch(buffered);
        }
        return;
      }

      if (event.key === "Escape") {
        scanBufferRef.current = "";
        return;
      }

      if (event.key.length === 1 && /\d/.test(event.key)) {
        scanBufferRef.current += event.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [handleDniSearch]);

  const handleNameSearch = () => {
    const term = nameQuery.trim().toLowerCase();
    if (!term) return;

    if (peopleCatalog.length === 0) {
      setError("No hay datos de personas disponibles para búsqueda");
      return;
    }

    const matches = peopleCatalog.filter((person) => person.name?.toLowerCase().includes(term));
    if (matches.length === 0) {
      setError("Persona no encontrada por nombre");
      setNameMatches([]);
      return;
    }

    if (matches.length === 1) {
      setNameQuery(matches[0].name);
      loadPersonStatus(matches[0].dni);
      return;
    }

    setError("");
    setNameSelectValue("");
    setNameMatches(matches.slice(0, 10));
  };

  const handleSelectPersonFromName = async (dniValue: string) => {
    const match = peopleCatalog.find((p) => String(p.dni) === String(dniValue));
    if (match) {
      setNameQuery(match.name);
    }
    await loadPersonStatus(dniValue);
  };

  const handleVehicleSearch = () => {
    const term = vehicleQuery.trim().toLowerCase();
    if (!term) return;

    if (vehiclesCatalog.length === 0) {
      setError("No hay datos de vehículos disponibles para búsqueda");
      return;
    }

    const matches = vehiclesCatalog.filter((vehicle) =>
      vehicle.licensePlate?.toLowerCase().includes(term)
    );

    if (matches.length === 0) {
      setError("Vehículo no encontrado");
      setVehicleMatches([]);
      return;
    }

    if (matches.length === 1) {
      setVehicleQuery(matches[0].licensePlate);
      loadPersonStatus(matches[0].ownerDni, { preselectVehicleId: matches[0].id });
      return;
    }

    setError("");
    setVehicleSelectValue("");
    setVehicleMatches(matches.slice(0, 10));
  };

  const handleSelectFromVehicle = async (vehicleId: string) => {
    const match = vehiclesCatalog.find((v) => String(v.id) === String(vehicleId));
    if (!match) return;
    setVehicleQuery(match.licensePlate);
    await loadPersonStatus(match.ownerDni, { preselectVehicleId: match.id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const body: any = { dni, action, notes };
      if (selectedVehicle !== "0") body.vehicle_id = Number(selectedVehicle);

      await apiFetch("/access_logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const actionText = action === "entry" ? "ingreso" : "egreso";
      setSuccess(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)} registrado correctamente`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("access:logs-updated"))
      }

      // Reset fields
      setDni("");
      setNameQuery("");
      setNameMatches([]);
      setNameSelectValue("");
      setSelectedPerson(null);
      setSelectedVehicle("0");
      setVehicleQuery("");
      setVehicleMatches([]);
      setVehicleSelectValue("");
      setNotes("");
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar el movimiento");
    } finally {
      setIsLoading(false);
    }
  };

  const canPerformAction = () => {
    if (!selectedPerson) return false;
    if (action === "entry" && selectedPerson.isInside) return false;
    if (action === "exit" && !selectedPerson.isInside) return false;
    return true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {action === "entry" ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
          <span>{action === "entry" ? "Registrar Ingreso" : "Registrar Egreso"}</span>
        </CardTitle>
        <CardDescription>
          {action === "entry" ? "Registra el ingreso de una persona" : "Registra el egreso de una persona"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle Ingreso/Egreso */}
          <div className="flex space-x-2">
            <Button type="button" variant={action === "entry" ? "default" : "outline"} onClick={() => setAction("entry")} className="flex-1">
              <UserCheck className="mr-2 h-4 w-4" /> Ingreso
            </Button>
            <Button type="button" variant={action === "exit" ? "default" : "outline"} onClick={() => setAction("exit")} className="flex-1">
              <UserX className="mr-2 h-4 w-4" /> Egreso
            </Button>
          </div>

          {/* Buscar por DNI */}
          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <div className="flex space-x-2">
              <Input
                id="dni"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleDniSearch();
                  }
                }}
                placeholder="Ingrese el DNI"
              />
              <Button
                type="button"
                onClick={handleDniSearch}
                variant="outline"
                disabled={isSearching || isShellyProcessing}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Buscar por nombre y apellido */}
          <div className="space-y-2">
            <Label htmlFor="name-search">Nombre y apellido</Label>
            <div className="flex space-x-2">
              <Input
                id="name-search"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Ingrese nombre y apellido"
              />
              <Button type="button" onClick={handleNameSearch} variant="outline" disabled={isSearching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {nameMatches.length > 0 && (
              <Select
                value={nameSelectValue}
                onValueChange={(value) => {
                  setNameSelectValue(value);
                  handleSelectPersonFromName(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar persona" />
                </SelectTrigger>
                <SelectContent>
                  {nameMatches.map((person) => (
                    <SelectItem key={person.id} value={person.dni}>
                      {person.name} - DNI {person.dni}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Buscar por vehiculo (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-search">Vehiculo (opcional)</Label>
            <div className="flex space-x-2">
              <Input
                id="vehicle-search"
                value={vehicleQuery}
                onChange={(e) => setVehicleQuery(e.target.value)}
                placeholder="Ingrese patente/placa"
              />
              <Button type="button" onClick={handleVehicleSearch} variant="outline" disabled={isSearching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {vehicleMatches.length > 0 && (
              <Select
                value={vehicleSelectValue}
                onValueChange={(value) => {
                  setVehicleSelectValue(value);
                  handleSelectFromVehicle(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleMatches.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                      {vehicle.licensePlate} - {vehicle.brand} {vehicle.model} - {vehicle.ownerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Datos de la persona */}
          {selectedPerson && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center space-x-3 mb-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={resolveMediaUrl(selectedPerson.photoUrl) || ""} />
                  <AvatarFallback>{selectedPerson.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-medium">{selectedPerson.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getPersonTypeDisplay(selectedPerson.type)}
                    {selectedPerson.area ? ` - ${selectedPerson.area}` : ""}
                  </p>
                </div>
                <Badge variant={selectedPerson.isInside ? "default" : "secondary"}>
                  {selectedPerson.isInside ? "Dentro" : "Fuera"}
                </Badge>
              </div>

              {/* Vehículos */}
              {selectedPerson.type === "proveedor" && selectedPerson.vehicles.length > 0 && (
                <div className="space-y-2">
                  <Label>Vehículo (opcional)</Label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vehículo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sin vehículo</SelectItem>
                      {selectedPerson.vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id.toString()}>
                          <Car className="h-4 w-4" /> {v.licensePlate} - {v.brand} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agregar observaciones..." rows={3} />
          </div>

          {/* Mensajes */}
          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Botón */}
          <Button type="submit" className="w-full" disabled={!canPerformAction() || isLoading}>
            <Clock className="mr-2 h-4 w-4" />
            {isLoading ? "Registrando..." : `Registrar ${action === "entry" ? "Ingreso" : "Egreso"}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function getPersonTypeDisplay(type?: string) {
  switch ((type || "").toLowerCase()) {
    case "empleado":
      return "Empleado"
    case "proveedor":
      return "Proveedor"
    case "guardia":
      return "Guardia"
    case "supervisor":
      return "Supervisor"
    case "administrador":
      return "Administrador"
    default:
      return "Registrado"
  }
}
