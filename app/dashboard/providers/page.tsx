"use client"

import { ProvidersManager } from "@/components/providers/providers-manager"

export default function ProvidersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestion de Proveedores</h1>
        <p className="text-muted-foreground">
          Administra la documentacion y permisos de ingreso de tus proveedores habituales.
        </p>
      </div>
      <ProvidersManager />
    </div>
  )
}
