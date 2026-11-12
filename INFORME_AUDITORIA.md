# Informe de auditoría de seguridad — LabReserva API

- **Fecha:** 2026-11-12
- **Proyecto:** LabReserva API (reservas de laboratorios)
- **Versión auditada:** commit `84975dc` (versión recibida del equipo externo)
- **Versión corregida:** árbol de trabajo sobre `faffca9`, versión `1.0.0`
- **Modalidad:** auditoría de código y verificación dinámica en localhost

## 1. Resumen ejecutivo

Se identificaron y corrigieron **22 hallazgos** de seguridad (F01–F22). La versión recibida permitía, entre otras cosas, filtrar el `JWT_SECRET`, falsificar tokens de administrador, escalar privilegios por mass assignment, leer y cancelar reservas ajenas, inyectar SQL, salir del directorio de manuales, obtener hashes de contraseñas, ejecutar XSS almacenado y atacar el login sin límite de intentos.

La versión corregida aplica defensas en configuración, autenticación, autorización, validación de entrada, acceso a datos, manejo de errores, cabeceras HTTP, frontend y operación. La verificación automatizada con `npm run attacks` reporta **0 ataques exitosos**.

## 2. Alcance

- API HTTP de LabReserva (`/api/*`) y frontend estático servido desde `public/`.
- Autenticación, autorización, sesiones JWT, reservas, usuarios, laboratorios, comentarios, manuales y rutas administrativas.
- Configuración, secretos, dependencias, validación de entrada, consultas SQL, manejo de archivos, errores, CORS, cabeceras de seguridad, rate limiting y registro de auditoría.
- Fuera de alcance: infraestructura de red, sistema operativo, navegadores de los usuarios y despliegue en producción.

## 3. Metodología

1. Revisión estática del código y del historial de git.
2. Pruebas manuales con `requests.http` (extensión REST Client).
3. Pruebas automatizadas con `scripts/attacks.mjs` (`npm run attacks`).
4. Verificación de sintaxis de todos los archivos JavaScript (`node --check`).
5. Revisión de dependencias (`npm audit`) y de secretos versionados.
6. Confirmación de un commit por hallazgo en el historial.

## 4. Resultado de la verificación

| Elemento | Resultado |
|---|---|
| Comando | `npm run attacks` |
| Entorno | Node.js v25.9.0; el proyecto declara Node.js >= 22.13 |
| Pruebas ejecutadas | 24 comprobaciones que cubren los 22 hallazgos |
| Ataques exitosos | **0** |
| Ataques bloqueados | **24 de 24** |
| Dependencias | `npm install` reportó **0 vulnerabilidades** |
| Sintaxis | `node --check` sin errores en archivos `.js` y `.mjs` |

> El script tiene 24 comprobaciones porque algunos hallazgos se verifican con más de un caso (por ejemplo, F01+F02 y F06+F09 como cadenas de explotación).

## 5. Hallazgos y correcciones

| ID | Hallazgo | Severidad | Evidencia / verificación | Corrección | Commit |
|---|---|---|---|---|---|
| F01 | `GET /api/debug/config` exponía `JWT_SECRET` y toda la configuración | Crítica | La ruta ahora responde `404`; no hay secreto que filtrar | Se eliminó el módulo `debug` y su montaje en `src/routes.js` | `7662f7d` |
| F02 | `JWT_SECRET` adivinable (`supersecreto`) y tokens sin expiración | Crítica | Token forjado con `supersecreto` → `401`; el token real incluye `exp` | `JWT_SECRET` obligatorio de al menos 32 caracteres, HS256 fijo y expiración de 15 minutos | `bec3d10` |
| F03 | `DELETE /api/admin/users/:id` no exigía rol admin | Crítica | Un estudiante intenta borrar al usuario 4 → `403` | `adminRouter.use(requireAuth, requireAdmin)` para todo `/admin/*` | `cd8e9ce` |
| F04 | IDOR: lectura y cancelación de reservas ajenas | Alta | Ana lee la reserva 1 (de Beto) → `404`; intenta cancelar la 3 → `404` | Filtro por `user_id` en el repositorio; las rutas usan `req.user.id` | `bc7cfe3` |
| F05 | Mass assignment en `PATCH /api/users/me` permitía `role: "admin"` | Crítica | `PATCH` con `role` → `400`; nuevo login y `GET /admin/reservations` → `403` | Schema estricto con zod y lista blanca en `updateProfile` | `b91a1f7` |
| F06 | Inyección SQL en `GET /api/labs?search=` | Crítica | Payload `UNION SELECT` → `200` sin datos filtrados | Consultas parametrizadas en `labs.repository.js` | `3d84928` |
| F07 | Path traversal en `GET /api/files?name=../../.env` | Alta | Intento de leer `.env` → `400` | Lista blanca de nombres y verificación de la ruta resuelta | `aa84778` |
| F08 | `GET /api/users` entregaba `password_hash` a estudiantes | Alta | Ana consulta el directorio → `403` | Solo profesor/admin; columnas públicas sin `password_hash` | `810b08e` |
| F09 | Contraseñas con MD5 sin sal | Alta | `src/lib/password.js` ya no usa MD5 | scrypt con sal aleatoria y comparación en tiempo constante | `953896c` |
| F10 | XSS almacenado en comentarios y token en `localStorage` | Alta | El frontend escapa los valores y el token no está en `localStorage` | `esc()` para todo texto de la API; token solo en memoria (ADR-001) | `99edfa3` |
| F11 | Enumeración de usuarios por diferencia de respuestas en login | Media | Email inexistente y contraseña mala → `401 "Credenciales inválidas"` | Mismo mensaje y código; hash falso para igualar tiempos | `7ec204f` |
| F12 | Credenciales en texto plano en los logs | Alta | No se registra el body del login | Se eliminó el log del body; auditoría sin secretos | `b3ea7d7` |
| F13 | Sin límite de intentos de login (fuerza bruta) | Alta | 25 intentos fallidos → `401` y `429` | Rate limit por IP+email, tope por IP y límite general de API | `4b5309f` |
| F14 | Stack traces y detalles internos en errores | Media | `GET /api/no-existe` → `404` sin stack | Manejador de errores genérico; detalle solo en logs del servidor | `4d559c8` |
| F15 | Cuerpo de solicitud de hasta 50 MB | Media | Body de 200 KB → `413 Payload Too Large` | `express.json({ limit: '10kb' })` | `73edaae` |
| F16 | CORS abierto con credenciales para cualquier origen | Alta | Origen malicioso → sin `Access-Control-Allow-Origin` ni credenciales | CORS restringido a `CORS_ORIGINS` | `a7ff224` |
| F17 | Faltaban cabeceras de seguridad | Media | Sin `X-Powered-By`; CSP, `nosniff` y HSTS presentes | helmet con CSP, `nosniff`, anti-clickjacking y HSTS | `45f1047` |
| F18 | Validación de entrada inexistente en reservas y otros endpoints | Alta | Reserva con fecha inválida y horas fuera de rango → `400` | Schemas estrictos con zod en cada endpoint que recibe datos | `2885ba2` |
| F19 | Dependencia `lodash 4.17.20` con CVE conocidos | Alta | `lodash` ya no está en `package.json` | Se eliminó la dependencia | `f9cda0d` |
| F20 | `.env` versionado en git | Crítica | `.gitignore` incluye `.env`; existe `.env.example` sin valores | `.env` fuera de git y rotación del secreto anterior | `2c671cd` |
| F21 | Sin registro de auditoría de seguridad | Media | `src/lib/audit.js` presente y usado en eventos clave | Log JSON de login, accesos denegados, reservas y borrados | `fa3d656` |
| F22 | El rol y la identidad se confiaban desde el token | Crítica | Usuario inexistente con rol admin → `401`; Ana con rol admin en el token → `403` | `requireAuth` carga usuario y rol desde la base de datos; el token solo lleva `sub` | `4356e36` |

## 6. Cadenas de explotación verificadas

- **F01 → F02:** filtrado del `JWT_SECRET` → falsificación de un token de administrador. Bloqueada al eliminar `/debug/config`, exigir un secreto fuerte y rotarlo.
- **F06 → F09:** inyección SQL → extracción de hashes → crackeo → login como admin. Bloqueada con consultas parametrizadas y scrypt con sal.
- **F10 → robo de token:** XSS almacenado → lectura del token en `localStorage` → suplantación. Bloqueada escapando la salida y manteniendo el token solo en memoria.
- **F11 + F13:** enumeración de cuentas + fuerza bruta. Bloqueada con respuestas uniformes y rate limiting.

## 7. Controles implementados

- Secretos fuera del repositorio y obligatorios al arrancar (`src/config.js`).
- JWT HS256 con algoritmo fijo, expiración de 15 minutos y rol leído de la base de datos (`src/lib/jwt.js`, `src/middlewares/auth.js`).
- Contraseñas con scrypt, sal aleatoria y comparación en tiempo constante (`src/lib/password.js`).
- helmet, CORS restringido, límite de body y rate limiting (`src/app.js`, `src/middlewares/rate-limit.js`).
- Validación estricta con zod en endpoints que reciben datos (`*.routes.js`).
- Filtro por dueño en la capa de datos para reservas (anti-IDOR) (`reservations.repository.js`).
- Consultas SQL parametrizadas (`*.repository.js`).
- Lista blanca y verificación de ruta para descarga de manuales (`files.routes.js`).
- Errores genéricos al cliente y log de auditoría sin secretos (`src/middlewares/error-handler.js`, `src/lib/audit.js`).
- Integridad referencial activa con `PRAGMA foreign_keys = ON` (`src/db.js`).
- Frontend sin `innerHTML` con datos crudos y token en memoria (ADR-001).

## 8. Riesgos residuales y recomendaciones

1. **Token en memoria sin refresh token.** El usuario debe iniciar sesión de nuevo al recargar la página y cada 15 minutos. Un token robado sigue siendo válido hasta su expiración. Riesgo aceptado en ADR-001; se recomienda implementar refresh tokens revocables.
2. **Rate limiting en memoria.** Los contadores se reinician al reiniciar el servidor y no se comparten entre instancias. Para producción, usar un almacén compartido (por ejemplo, Redis).
3. **Base de datos SQLite en memoria.** Los datos se pierden al reiniciar. Es adecuada para la actividad del curso, no para producción.
4. **Secreto anterior en el historial de git.** El `.env` original con `supersecreto` permanece en commits antiguos. Se considera comprometido y fue rotado; si el repositorio se publica, reescribir el historial o asumir que ese valor es público.
5. **Cuentas de prueba con contraseñas conocidas.** `src/db.js` crea usuarios de ejemplo. No usarlos en producción; sembrar credenciales desde variables de entorno o un gestor de secretos.
6. **Proxy inverso.** Si se despliega detrás de un proxy, configurar `trust proxy` para que las IPs y los rate limits sean correctos.
7. **Revocación de sesiones.** No existe lista de tokens revocados; el logout es del lado del cliente. El margen máximo es la expiración de 15 minutos.
8. **CORS en producción.** Definir `CORS_ORIGINS` con los orígenes reales; vacío significa que no se habilita ningún origen cruzado.
9. **Dependencias.** `npm audit` reportó 0 vulnerabilidades en la fecha del informe; repetir la revisión periódicamente.
10. **Frontend de demostración.** La interfaz cubre login, búsqueda, comentarios y listado de reservas; la API expone además registro, creación/cancelación de reservas, perfil y administración. No es un problema de seguridad, pero debe considerarse si se espera una interfaz completa.

## 9. Cómo reproducir la verificación

```bash
npm install
cp .env.example .env
# Completar JWT_SECRET con un valor aleatorio de al menos 32 caracteres:
# node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
npm run dev
```

En otra terminal, con el servidor corriendo:

```bash
npm run attacks
```

Resultado esperado: `Resumen: 0 ataques exitosos, 24 bloqueados (de 24).`

En Windows PowerShell, el copiado del archivo puede hacerse con:

```powershell
Copy-Item .env.example .env
```

## 10. Conclusión

Los 22 hallazgos identificados en la versión recibida están corregidos y cuentan con evidencia de verificación. La batería automatizada no logra explotar ninguno de los casos y `npm audit` no reporta vulnerabilidades conocidas en las dependencias instaladas. El proyecto queda apto para la actividad del curso; antes de un despliegue real deben atenderse los riesgos residuales de la sección 8.

## 11. Documentos complementarios de la entrega

- `PARTE_A_MODELADO.md`: DFD, hipótesis STRIDE, priorización del riesgo y respuestas a las tres preguntas de diseño.
- `PARTE_B_HALLAZGOS.md`: fichas de los 22 hallazgos con pasos de reproducción, evidencia (request y respuesta), causa raíz con archivo y línea, corrección y capa.
- `requests.http`: ejemplos listos, incluidos los ataques de la Parte C.
- `scripts/attacks.mjs`: verificación automatizada de los 22 hallazgos y sus cadenas.
