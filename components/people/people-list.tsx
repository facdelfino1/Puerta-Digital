"use client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { UserRole } from "@/lib/auth"
import { Search, Edit, Trash2, QrCode } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/utils/api"
import { resolveMediaUrl } from "@/utils/media"

interface PeopleListProps {
  userRole: UserRole
}

const BRANCH_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "PHQ Cordoba", label: "PHQ C\u00F3rdoba" },
  { value: "Buenos Aires", label: "Buenos Aires" },
  { value: "Rosario", label: "Rosario" },
  { value: "Santa Fe", label: "Santa Fe" },
  { value: "Buenos Aires Dds", label: "Buenos Aires Dds" },
]

export function PeopleList({ userRole }: PeopleListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const loadPeople = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await apiFetch("/people", { authRedirect: true })
      setPeople(Array.isArray(data) ? data : (data?.results || []))
    } catch (e: any) {
      setError(e.message || "Error cargando personas")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDownloadQr = useCallback(async (person: any) => {
    try {
      setError("")
      setDownloadingId(person.id)
      const response = await apiFetch(`/people/${person.id}/qr`, {
        authRedirect: true,
        rawResponse: true,
      })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `qr-dni-${person.dni}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || "No se pudo generar el QR del DNI")
    } finally {
      setDownloadingId(null)
    }
  }, [])

  useEffect(() => { loadPeople() }, [loadPeople])

  const filteredPeople = people.filter(person => {
    const matchesSearch =
      person.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.dni?.includes(searchTerm) ||
      person.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || person.type === typeFilter
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? person.isActive : !person.isActive)
    const matchesBranch = branchFilter === "all" || person.branch === branchFilter
    return matchesSearch && matchesType && matchesStatus && matchesBranch
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Personas</CardTitle>
        <CardDescription>Personas registradas en el sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, DNI o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="empleado">Empleados</SelectItem>
              <SelectItem value="proveedor">Proveedores</SelectItem>
              <SelectItem value="guardia">Guardias</SelectItem>
              <SelectItem value="supervisor">Supervisores</SelectItem>
              <SelectItem value="administrador">Administradores</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              {BRANCH_FILTERS.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

        </div>

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeople.map((person) => {
                  const areaLabel = person.areaName ?? person.area ?? "-";
                  return (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={resolveMediaUrl(person.photoUrl) || ""} />
                            <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{person.name}</p>
                            <p className="text-sm text-muted-foreground">{person.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{person.dni}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {getTypeLabel(person.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{areaLabel}</TableCell>
                      <TableCell>{person.branch || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={person.isActive ? "default" : "destructive"}>
                          {person.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={downloadingId === person.id}
                            onClick={() => handleDownloadQr(person)}
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            {downloadingId === person.id ? "Generando..." : "QR"}
                          </Button>
                          <Link href={`/dashboard/people/${person.id}`}>
                            <Button size="sm" variant="outline">
                              <Edit className="mr-2 h-4 w-4" />
                              Modificar
                            </Button>
                          </Link>
                          {userRole === "administrador" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deletingId === person.id}
                              onClick={async () => {
                                if (!confirm("Eliminar esta persona?")) return;
                                setDeletingId(person.id);
                                const previous = people;
                                setPeople((list) => list.filter((p) => p.id !== person.id));
                                try {
                                  await apiFetch(`/people/${person.id}`, { method: "DELETE", authRedirect: true });
                                } catch (e: any) {
                                  setError(e.message || "Error eliminando persona");
                                  setPeople(previous);
                                } finally {
                                  setDeletingId(null);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingId === person.id ? "Eliminando..." : "Eliminar"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredPeople.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No se encontraron personas con los filtros aplicados</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}




function getTypeLabel(type?: string) {
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
      return type || "Desconocido"
  }
}




