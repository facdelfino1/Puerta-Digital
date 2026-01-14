import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldX } from "lucide-react"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Acceso Denegado</CardTitle>
          <CardDescription>No tienes permisos para acceder a esta página</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Tu rol actual no tiene los permisos necesarios para ver este contenido. Contacta al administrador si
            necesitas acceso.
          </p>
          <Link href="/dashboard">
            <Button className="w-full">Volver al Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
