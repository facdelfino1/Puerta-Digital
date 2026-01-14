"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { apiFetch } from "@/utils/api"
import { Loader2, Upload, FileText, RefreshCw, Search, Trash2 } from "lucide-react"

interface ProviderSummary {
  id: number
  name: string
  dni: string
  area: string | null
  vehicleAccess: boolean
  isActive: boolean
  latestVehicleDoc?: ProviderDocSummary | null
  latestGeneralDoc?: ProviderDocSummary | null
}

interface ProviderDocSummary {
  id: number
  pdfPath: string
  uploadDate: string
  expirationDate: string | null
  allowsVehicle?: boolean
  docType?: "vehicle" | "general"
}

interface ProviderDocument extends ProviderDocSummary {
  docType: "vehicle" | "general"
  estado?: string | null
  diasRestantes?: number | null
}

function openPdf(path: string) {
  if (!path) return
  const url = path.startsWith("http") ? path : `${path.startsWith("/") ? "" : "/"}${path}`
  window.open(url, "_blank", "noopener,noreferrer")
}

interface SectionUploaderProps {
  title: string
  description?: string
  providerId: number
  docType: "vehicle" | "general"
  latest?: ProviderDocSummary | null
  showVehicleToggle?: boolean
  onUploadSuccess: () => void
}

function SectionUploader({
  title,
  description,
  providerId,
  docType,
  latest,
  showVehicleToggle = true,
  onUploadSuccess,
}: SectionUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [expirationDate, setExpirationDate] = useState("")
  const [allowsVehicle, setAllowsVehicle] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setFile(null)
    setExpirationDate("")
    setAllowsVehicle(true)
  }

  const handleFileChange = (nextFile: File | null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setFile(nextFile)
  }

  const handlePreview = () => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    openPdf(url)
  }

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "Archivo requerido", description: "Selecciona un PDF antes de subirlo.", variant: "destructive" })
      return
    }

    const formData = new FormData()
    formData.append("pdf", file)
    formData.append("docType", docType)
    if (docType === "vehicle") {
      formData.append("allowsVehicle", String(allowsVehicle))
    }
    if (expirationDate) {
      formData.append("expirationDate", expirationDate)
    }

    setUploading(true)
    try {
      await apiFetch(`/providers/${providerId}/docs`, { method: "POST", body: formData })
      toast({ title: "Documento cargado", description: "El PDF se registro correctamente." })
      resetState()
      onUploadSuccess()
    } catch (err: any) {
      toast({ title: "Error al subir documento", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`${title}-file`}>Archivo PDF</Label>
            <Input
              id={`${title}-file`}
              type="file"
              accept="application/pdf"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${title}-expiration`}>Vence</Label>
            <Input
              id={`${title}-expiration`}
              type="date"
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
            />
          </div>
        </div>

        {showVehicleToggle && (
          <div className="flex items-center gap-2">
            <Switch id={`${title}-allows`} checked={allowsVehicle} onCheckedChange={setAllowsVehicle} />
            <Label htmlFor={`${title}-allows`}>Permite ingreso vehicular</Label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={!file} onClick={handlePreview}>
            <FileText className="mr-2 h-4 w-4" /> Previsualizar
          </Button>
          <Button type="button" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading ? "Subiendo..." : "Subir PDF"}
          </Button>
          {file && (
            <Button type="button" variant="ghost" onClick={resetState}>
              Limpiar
            </Button>
          )}
        </div>

        {previewUrl && (
          <p className="text-xs text-muted-foreground">La vista previa se abrio en una nueva pestana.</p>
        )}

        {latest && (
          <div className="rounded border bg-muted/30 p-3 text-xs">
            <div className="font-semibold">Ultimo documento</div>
            <div>Subido: {new Date(latest.uploadDate).toLocaleString()}</div>
            <div>Vence: {latest.expirationDate ? new Date(latest.expirationDate).toLocaleDateString() : "-"}</div>
            <Button variant="link" className="px-0" onClick={() => openPdf(latest.pdfPath)}>
              Ver archivo actual
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProvidersManager() {
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [docs, setDocs] = useState<ProviderDocument[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null)

  const loadProviders = async (term: string, selectFirst: boolean) => {
    setIsLoadingProviders(true)
    try {
      const res = await apiFetch(`/providers${term ? `?search=${encodeURIComponent(term)}` : ""}`)
      const list: ProviderSummary[] = res.providers || res.data || res.results || []
      setProviders(list)
      if (selectFirst && list.length > 0) {
        setSelectedId(list[0].id)
      } else if (list.length === 0) {
        setSelectedId(null)
      }
    } catch (err: any) {
      toast({ title: "Error", description: "No se pudieron cargar los proveedores.", variant: "destructive" })
    } finally {
      setIsLoadingProviders(false)
    }
  }

  const loadProviderDocs = async (providerId: number) => {
    try {
      const res = await apiFetch(`/providers/${providerId}/docs`)
      setDocs(res.documents || [])
    } catch (err: any) {
      toast({ title: "Error", description: "No se pudo cargar el historial de documentos.", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadProviders("", true)
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadProviderDocs(selectedId)
    } else {
      setDocs([])
    }
  }, [selectedId])

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    loadProviders(searchTerm, true)
  }

  const handleUploadSuccess = () => {
    if (selectedId) {
      loadProviderDocs(selectedId)
    }
    loadProviders(searchTerm, false)
  }

  const handleDeleteDoc = async (doc: ProviderDocument) => {
    if (!selectedId) return
    const confirmed = window.confirm("Eliminar este documento?")
    if (!confirmed) return

    setDeletingDocId(doc.id)
    try {
      await apiFetch(`/providers/${selectedId}/docs/${doc.id}`, { method: "DELETE" })
      toast({ title: "Documento eliminado", description: "El documento fue eliminado correctamente." })
      await loadProviderDocs(selectedId)
      await loadProviders(searchTerm, false)
    } catch (err: any) {
      toast({ title: "Error al eliminar documento", description: err.message, variant: "destructive" })
    } finally {
      setDeletingDocId(null)
    }
  }

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedId) || null,
    [providers, selectedId]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>Selecciona un proveedor para gestionar su documentacion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              placeholder="Buscar por nombre, DNI o area..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <Button size="icon" variant="outline" type="submit" disabled={isLoadingProviders}>
              <Search className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              type="button"
              onClick={() => loadProviders("", true)}
              disabled={isLoadingProviders}
            >
              {isLoadingProviders ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </form>

          <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedId(provider.id)}
                className={`w-full rounded border px-3 py-2 text-left transition hover:bg-muted ${
                  selectedId === provider.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{provider.name}</span>
                  {provider.vehicleAccess && <Badge variant="outline">Vehiculos</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">DNI {provider.dni}</div>
                <div className="text-xs text-muted-foreground">{provider.area || "Sin area"}</div>
              </button>
            ))}

          </div>
          {!isLoadingProviders && providers.length === 0 && (
            <p className="text-sm text-muted-foreground">No se encontraron proveedores.</p>
          )}
          {isLoadingProviders && providers.length === 0 && (
            <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestion de Documentos</CardTitle>
            {selectedProvider && (
              <CardDescription>
                Documentacion para: <strong>{selectedProvider.name}</strong>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedProvider ? (
              <div className="space-y-4">
                <SectionUploader
                  title="Autorizacion vehicular"
                  description="Documentacion que habilita el ingreso de vehiculos."
                  providerId={selectedProvider.id}
                  docType="vehicle"
                  latest={selectedProvider.latestVehicleDoc || undefined}
                  onUploadSuccess={handleUploadSuccess}
                />
                <SectionUploader
                  title="Documentacion general"
                  description="Carga otros acuerdos o certificaciones requeridas."
                  providerId={selectedProvider.id}
                  docType="general"
                  latest={selectedProvider.latestGeneralDoc || undefined}
                  showVehicleToggle={false}
                  onUploadSuccess={handleUploadSuccess}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un proveedor para gestionar su documentacion.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de documentos</CardTitle>
            <CardDescription>Registros subidos para el proveedor seleccionado.</CardDescription>
          </CardHeader>
          <CardContent>
            {docs.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Subido</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Permite vehiculos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="capitalize">{doc.docType}</TableCell>
                        <TableCell>{new Date(doc.uploadDate).toLocaleString()}</TableCell>
                        <TableCell>{doc.expirationDate ? new Date(doc.expirationDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>{doc.docType === "vehicle" ? (doc.allowsVehicle ? "Si" : "No") : "-"}</TableCell>
                        <TableCell>{doc.estado || "-"}</TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openPdf(doc.pdfPath)}>
                            <FileText className="mr-2 h-4 w-4" /> Ver PDF
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDoc(doc)}
                            disabled={deletingDocId === doc.id}
                          >
                            {deletingDocId === doc.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            {deletingDocId === doc.id ? "Eliminando..." : "Eliminar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin documentos cargados aun.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
