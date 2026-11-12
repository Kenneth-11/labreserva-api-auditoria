import { HttpError } from './http-error.js';

// Los ids de la URL son entrada no confiable: solo enteros positivos.
export function parseId(value) {
  if (!/^\d{1,9}$/.test(String(value)) || Number(value) < 1) throw new HttpError(400, 'Id inválido');
  return Number(value);
}
