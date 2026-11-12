import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const ALGORITHM = 'HS256';

// El token solo identifica al usuario (sub). El rol NO viaja como fuente de verdad: se lee de la BD.
export function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwtExpiresIn,
  });
}

// Algoritmo fijado: evita alg:"none" y confusión de algoritmos. Rechaza tokens vencidos.
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
}
