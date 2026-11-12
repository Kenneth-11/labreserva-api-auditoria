import { HttpError } from './http-error.js';

// Valida SIEMPRE del lado del servidor (la validación del frontend es UX, no seguridad).
// Devuelve solo los datos que el schema permite: lo demás nunca llega al dominio.
export function validate(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new HttpError(400, `Datos inválidos: ${detail}`);
  }
  return result.data;
}
