// Archivo eliminado por reversión de cambios
import React, { useRef } from 'react';
import html2pdf from 'html2pdf.js';

export default function SupervisorReportForm() {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = () => {
    if (reportRef.current) {
      html2pdf().from(reportRef.current).save('informe-supervisor.pdf');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Informe de Supervisor</h2>
      <div ref={reportRef} className="border p-4 mb-4 bg-white">
        {/* Aquí va el contenido del informe */}
        <p>Ejemplo de informe. Puedes personalizar este contenido.</p>
      </div>
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleDownloadPDF}
      >
        Descargar PDF
      </button>
    </div>
  );
}
