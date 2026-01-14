// Archivo eliminado por reversión de cambios
// /lib/supervisorReports.ts
export interface SupervisorReport {
  id: string;
  supervisorId: string;
  providerId: string;
  pdfUrl: string;
  createdAt: Date;
  expiresAt: Date;
  notified: boolean;
}

// ⚠️ Este módulo ya no implementa lógica en el frontend.
// Toda la gestión de reportes se maneja desde el backend Express.
// Mantengo las interfaces para tipado en llamadas API si es necesario.
// Si no se usan, considerar borrar este archivo.