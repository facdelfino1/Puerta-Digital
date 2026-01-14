import { apiFetch } from "./api";

export async function uploadProviderPdf(
  file: File,
  form: { name: string; dni: string; area: string; supervisor_id: number }
) {
  const fd = new FormData();
  fd.append("pdf", file);
  fd.append("name", form.name);
  fd.append("dni", form.dni);
  fd.append("area", form.area);
  fd.append("supervisor_id", String(form.supervisor_id));

  // Enviar al backend real (usa cookie httpOnly)
  return apiFetch("/providers/status", {
    method: "POST",
    body: fd,
    authRedirect: true,
  });
}
// --- IGNORE ---