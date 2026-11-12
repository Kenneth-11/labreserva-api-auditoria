// Registro de auditoría: quién, qué, cuándo, desde dónde. Una línea JSON por evento (fácil de filtrar/alertar).
// Regla: NUNCA registrar contraseñas, tokens, llaves ni el body completo de una request.
export function audit(event, req, details = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      audit: event,
      userId: req.user?.id ?? null,
      ip: req.ip,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      ...details,
    }),
  );
}
