"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Loader2, RefreshCw, Trash2, UserCog, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { apiFetch } from "@/utils/api"
import { resolveMediaUrl } from "@/utils/media"

type UserRole = "guardia" | "supervisor" | "administrador"

interface UserRecord {
  id: number
  name: string
  dni: string
  type: string
  email: string
  role: UserRole
  isActive: boolean
  areaName?: string | null
  branch?: string | null
  photoUrl?: string | null
  emailVerified?: boolean
}

const ROLE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "administrador", label: "Administradores" },
  { value: "supervisor", label: "Supervisores" },
  { value: "guardia", label: "Guardias" },
]

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
]

const VERIFY_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "verified", label: "Verificados" },
  { value: "pending", label: "Pendientes" },
]

const BRANCH_OPTIONS = [
  { value: "all", label: "Todas las sucursales" },
  { value: "PHQ Cordoba", label: "PHQ C\u00F3rdoba" },
  { value: "Buenos Aires", label: "Buenos Aires" },
  { value: "Rosario", label: "Rosario" },
  { value: "Santa Fe", label: "Santa Fe" },
  { value: "Buenos Aires Dds", label: "Buenos Aires Dds" },
]

const DEFAULT_BRANCH = BRANCH_OPTIONS[1]?.value ?? "PHQ Cordoba"

export function UsersList() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [verifyFilter, setVerifyFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch("/users", { authRedirect: true })
      const list = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : []
      setUsers(list as UserRecord[])
    } catch (err: any) {
      setError(err?.message || "Error cargando usuarios")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const needle = search.trim().toLowerCase()
      const matchesSearch =
        needle.length === 0 ||
        user.name?.toLowerCase().includes(needle) ||
        user.email?.toLowerCase().includes(needle) ||
        user.dni?.includes(search.trim())

      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive)
      const matchesVerify =
        verifyFilter === "all" ||
        (verifyFilter === "verified" ? Boolean(user.emailVerified) : !user.emailVerified)
      const matchesBranch =
        branchFilter === "all" || (user.branch ?? DEFAULT_BRANCH) === branchFilter

      return matchesSearch && matchesRole && matchesStatus && matchesVerify && matchesBranch
    })
  }, [users, search, roleFilter, statusFilter, verifyFilter, branchFilter])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Usuarios</CardTitle>
        <CardDescription>Usuarios con acceso al sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Input
              placeholder="Buscar por nombre, DNI o correo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
            />
            <span className="absolute left-2 top-2.5 text-sm text-muted-foreground">
              <UserCog className="h-4 w-4" />
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={verifyFilter} onValueChange={setVerifyFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Verificacion" />
              </SelectTrigger>
              <SelectContent>
                {VERIFY_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                {BRANCH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={loadUsers} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {info && (
          <Alert className="mb-4">
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando usuarios...
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay usuarios que coincidan con los filtros aplicados.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Tipo / Area</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Verificacion</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const photoSrc = resolveMediaUrl(user.photoUrl)
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="relative h-8 w-8 overflow-hidden rounded-full border">
                            {photoSrc ? (
                              <Image src={photoSrc} alt={user.name} fill className="object-cover" sizes="32px" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold uppercase">
                                {user.name?.charAt(0) || "U"}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.dni}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span className="capitalize">Tipo: {user.type}</span>
                          <span>Area: {user.areaName || "Sin area"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.emailVerified ? "default" : "secondary"}>
                          {user.emailVerified ? "Verificado" : "Pendiente"}
                        </Badge>
                        {!user.emailVerified && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="px-0 text-blue-600"
                            disabled={resendingId === user.id}
                            onClick={async () => {
                              setResendingId(user.id)
                              setError(null)
                              setInfo(null)
                              try {
                                await apiFetch(`/users/${user.id}/resend-verification`, {
                                  method: "POST",
                                  authRedirect: true,
                                })
                                setInfo("Correo de verificacion reenviado.")
                              } catch (err: any) {
                                setError(err?.message || "No se pudo reenviar la verificacion.")
                              } finally {
                                setResendingId(null)
                              }
                            }}
                          >
                            {resendingId === user.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enviando...
                              </>
                            ) : (
                              <>
                                <MailCheck className="mr-1 h-3 w-3" /> Reenviar
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/users/${user.id}`}>
                            <Button size="sm" variant="outline">
                              Modificar
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === user.id}
                            onClick={async () => {
                              if (!confirm("Eliminar este usuario?")) return
                              setDeletingId(user.id)
                              setError(null)
                              setInfo(null)
                              const previous = users
                              setUsers((list) => list.filter((item) => item.id !== user.id))
                              try {
                                await apiFetch(`/users/${user.id}`, {
                                  method: "DELETE",
                                  authRedirect: true,
                                })
                                setInfo("Usuario eliminado correctamente.")
                              } catch (err: any) {
                                setError(err?.message || "No se pudo eliminar el usuario.")
                                setUsers(previous)
                              } finally {
                                setDeletingId(null)
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingId === user.id ? "Eliminando..." : "Eliminar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
