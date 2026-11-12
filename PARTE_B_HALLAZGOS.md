# Parte B — Hallazgos de la auditoría

> Cada ficha incluye pasos de reproducción, evidencia (request y respuesta), causa raíz con archivo y línea en la versión vulnerable (`84975dc`), corrección propuesta y capa. La verificación final está en `INFORME_AUDITORIA.md`.

## Resumen y puntaje

**Puntaje estimado según la regla de la actividad:** 75 puntos por hallazgos + 9 por 3 cadenas = **84**.

- **Críticas (5 puntos):** F01, F02, F03, F05, F06, F20, F22.
- **Altas (3 puntos):** F04, F07, F08, F09, F10, F12, F13, F16, F18, F19.
- **Medias (2 puntos):** F11, F14, F15, F17, F21.
- **Cadenas (+3 cada una):** F01 → F02, F06 → F09, F10 → robo de token.

## F01 · Configuración y secreto expuestos en `/api/debug/config`

- **Severidad / puntaje:** Crítica (5) · **Capa:** configuración/operación
- **Pasos y evidencia (versión vulnerable):**
  1. `GET /api/debug/config`
  2. Respuesta `200` con `{"config":{"port":3000,"jwtSecret":"supersecreto",...}}`.
- **Causa raíz:** `src/modules/debug/debug.routes.js:7` expone `config` completo; se monta en `src/routes.js:8,20`.
- **Corrección:** eliminar el módulo `debug` y su montaje. El secreto se mueve a `.env`, se exige al arrancar y se rota.
- **Commit:** `7662f7d`
- **Verificación corregida:** `GET /api/debug/config` → `404`; prueba F01 bloqueada.

## F02 · JWT con secreto débil y sin expiración

- **Severidad / puntaje:** Crítica (5) · **Capa:** identidad/sesión
- **Pasos y evidencia (versión vulnerable):**
  1. El token real de Ana no contiene `exp`.
  2. Con el secreto por defecto `supersecreto` se firma `{"sub":"999","role":"admin"}`.
  3. `GET /api/admin/reservations` con ese token → `200`.
- **Causa raíz:** `src/config.js:6` usa `process.env.JWT_SECRET ?? 'supersecreto'`; `src/lib/jwt.js:5` firma sin `expiresIn` y `:9` verifica sin fijar el algoritmo.
- **Corrección:** `JWT_SECRET` obligatorio de al menos 32 caracteres, HS256 fijo, expiración de 15 minutos y rotación del secreto anterior.
- **Commit:** `bec3d10`
- **Verificación corregida:** token forjado con `supersecreto` → `401`; el token real incluye `exp`.

## F03 · Un estudiante puede eliminar usuarios desde `/admin`

- **Severidad / puntaje:** Crítica (5) · **Capa:** autorización
- **Pasos y evidencia (versión vulnerable):**
  1. Login como `ana@labreserva.test`.
  2. `DELETE /api/admin/users/4` con el token de Ana.
  3. Respuesta `204 No Content`.
- **Causa raíz:** `src/modules/admin/admin.routes.js:22` define el borrado sin `requireAdmin`; el router solo aplica `requireAuth` en `:10`.
- **Corrección:** `adminRouter.use(requireAuth, requireAdmin)` para todo `/admin/*`.
- **Commit:** `cd8e9ce`
- **Verificación corregida:** el mismo intento → `403`; prueba F03 bloqueada.

## F04 · IDOR: lectura y cancelación de reservas ajenas

- **Severidad / puntaje:** Alta (3) · **Capa:** datos/autorización
- **Pasos y evidencia (versión vulnerable):**
  1. Login como Ana y `GET /api/reservations/1`.
  2. Respuesta `200` con la reserva de Beto (`"user":"Beto Quesada"`).
  3. `DELETE /api/reservations/3` con el token de Ana → `204`.
- **Causa raíz:** `src/modules/reservations/reservations.repository.js:16-18` busca por `id` sin `user_id` y `:37-39` borra solo por `id`; las rutas usan el id de la URL en `reservations.routes.js:17,45`.
- **Corrección:** el repositorio exige `userId` en `findById` y `remove`; las rutas usan `req.user.id` del token.
- **Commit:** `bc7cfe3`
- **Verificación corregida:** lectura y borrado ajenos → `404`; prueba F04 bloqueada.

## F05 · Mass assignment: escalada a admin desde el perfil

- **Severidad / puntaje:** Crítica (5) · **Capa:** entrada/datos
- **Pasos y evidencia (versión vulnerable):**
  1. `PATCH /api/users/me` con `{"role":"admin"}` y el token de Ana.
  2. Respuesta `200` con `"role":"admin"`.
  3. Nuevo login y `GET /api/admin/reservations` → `200`.
- **Causa raíz:** `src/modules/users/users.routes.js:24` hace `_.merge(user, req.body)` y `src/modules/users/users.repository.js:24-31` actualiza `role` y `email`.
- **Corrección:** schema estricto con zod y lista blanca en `updateProfile`; solo `name`, `phone` y `carnet`.
- **Commit:** `b91a1f7`
- **Verificación corregida:** `PATCH` con `role` → `400`; nuevo login y `GET /admin/reservations` → `403`.

## F06 · SQL injection en la búsqueda de laboratorios

- **Severidad / puntaje:** Crítica (5) · **Capa:** datos
- **Pasos y evidencia (versión vulnerable):**
  1. `GET /api/labs?search=x' UNION SELECT id,email,password_hash,0,role FROM users--`
  2. Respuesta `200` con filas como `{"name":"admin@labreserva.test","building":"0192023a...","description":"admin"}`.
- **Causa raíz:** `src/modules/labs/labs.repository.js:8` interpola `term` dentro del SQL con `LIKE '%${term}%'`.
- **Corrección:** consulta parametrizada con `?`; el término viaja como dato.
- **Commit:** `3d84928`
- **Verificación corregida:** el mismo payload → `200` sin datos filtrados; prueba F06 bloqueada.

## F07 · Path traversal en la descarga de manuales

- **Severidad / puntaje:** Alta (3) · **Capa:** archivos
- **Pasos y evidencia (versión vulnerable):**
  1. `GET /api/files?name=../../.env`
  2. Respuesta `200` con `PORT=3000`, `NODE_ENV=development` y `JWT_SECRET=supersecreto`.
- **Causa raíz:** `src/modules/files/files.routes.js:16` usa `path.join(config.manualsDir, name)` sin validar el nombre.
- **Corrección:** lista blanca `^[A-Za-z0-9_-]+\.txt$` y verificación de que la ruta resuelta queda dentro de `files/manuales`.
- **Commit:** `aa84778`
- **Verificación corregida:** `../../.env` → `400`; prueba F07 bloqueada.

## F08 · El directorio de usuarios filtra `password_hash`

- **Severidad / puntaje:** Alta (3) · **Capa:** autorización/datos
- **Pasos y evidencia (versión vulnerable):**
  1. Login como Ana.
  2. `GET /api/users` → `200` con todos los usuarios, incluido `password_hash`.
- **Causa raíz:** `src/modules/users/users.routes.js:13` no exige rol y `src/modules/users/users.repository.js:4-6` usa `SELECT *`.
- **Corrección:** solo profesor/admin (`requireRole('profesor','admin')`) y columnas públicas sin `password_hash`.
- **Commit:** `810b08e`
- **Verificación corregida:** Ana → `403`; prueba F08 bloqueada.

## F09 · Contraseñas con MD5 sin sal

- **Severidad / puntaje:** Alta (3) · **Capa:** criptografía
- **Pasos y evidencia (versión vulnerable):**
  1. `src/lib/password.js:5` calcula `createHash('md5').update(password).digest('hex')`.
  2. El hash de `qwerty` es `d8578edf8458ce06fbc5bb76a58c5ca4`, crackeable con diccionario.
- **Causa raíz:** `src/lib/password.js:5` y `:8` usan MD5 sin sal y comparación directa.
- **Corrección:** scrypt con sal aleatoria por usuario y `timingSafeEqual`.
- **Commit:** `953896c`
- **Verificación corregida:** `src/lib/password.js` ya no usa MD5; prueba F09 bloqueada.

## F10 · XSS almacenado y token en `localStorage`

- **Severidad / puntaje:** Alta (3) · **Capa:** frontend/sesión
- **Pasos y evidencia (versión vulnerable):**
  1. `POST /api/labs/1/comments` con `{"body":"<img src=x onerror=alert('xss')>"}` → `201`.
  2. Al abrir el laboratorio 1, el frontend inserta `c.body` con `innerHTML` (`public/app.js:48`) y ejecuta el script.
  3. El token y el usuario están en `localStorage` (`public/app.js:5,68-69`), por lo que el XSS puede robarlos.
- **Causa raíz:** `public/app.js:48` interpola `c.author` y `c.body` sin escapar; `:5` y `:68-69` guardan la sesión en `localStorage`.
- **Corrección:** función `esc()` para todo texto de la API, CSP con helmet y token solo en memoria (ADR-001).
- **Commit:** `99edfa3`
- **Verificación corregida:** el comentario se muestra escapado; el token no está en `localStorage`; prueba F10 bloqueada.

## F11 · Enumeración de usuarios en el login

- **Severidad / puntaje:** Media (2) · **Capa:** autenticación
- **Pasos y evidencia (versión vulnerable):**
  1. Login con `nadie@labreserva.test` → `404 {"error":"No existe un usuario con ese email"}`.
  2. Login con `ana@labreserva.test` y contraseña mala → `401 {"error":"Contraseña incorrecta"}`.
- **Causa raíz:** `src/modules/auth/auth.routes.js:29-30` diferencia el email inexistente del password incorrecto.
- **Corrección:** mismo `401 "Credenciales inválidas"` y verificación contra un hash falso cuando el usuario no existe.
- **Commit:** `7ec204f`
- **Verificación corregida:** ambos casos → `401 "Credenciales inválidas"`; prueba F11 bloqueada.

## F12 · Credenciales en texto plano en los logs

- **Severidad / puntaje:** Alta (3) · **Capa:** operación/logs
- **Pasos y evidencia (versión vulnerable):**
  1. `POST /api/auth/login` con `{"email":"ana@labreserva.test","password":"ana12345"}`.
  2. El log del servidor muestra `Intento de login: { email: 'ana@labreserva.test', password: 'ana12345' }`.
- **Causa raíz:** `src/modules/auth/auth.routes.js:25` registra `req.body` completo.
- **Corrección:** eliminar el log del body; el log de auditoría registra solo evento, usuario e IP, nunca contraseñas ni tokens.
- **Commit:** `b3ea7d7`
- **Verificación corregida:** no se registra el body del login; prueba F12 bloqueada.

## F13 · Sin límite de intentos de login

- **Severidad / puntaje:** Alta (3) · **Capa:** operación
- **Pasos y evidencia (versión vulnerable):**
  1. 25 `POST /api/auth/login` con contraseña incorrecta.
  2. Todas las respuestas son `401`; no aparece `429`.
- **Causa raíz:** `src/app.js:11-14` no aplica rate limiting y `src/modules/auth/auth.routes.js:24-35` no limita el login.
- **Corrección:** `loginLimiter` (5 fallos/15 min por IP+email), `authIpLimiter` (60/15 min por IP) y `apiLimiter` general.
- **Commit:** `4b5309f`
- **Verificación corregida:** 25 intentos → `401` y `429`; prueba F13 bloqueada.

## F14 · Stack traces y detalles internos en errores

- **Severidad / puntaje:** Media (2) · **Capa:** operación/errores
- **Pasos y evidencia (versión vulnerable):**
  1. `GET /api/no-existe`
  2. Respuesta `404` con `error`, `path` y `stack` completo.
- **Causa raíz:** `src/middlewares/error-handler.js:4-8` devuelve `err.message`, `req.originalUrl` y `err.stack`.
- **Corrección:** manejador central que devuelve mensajes genéricos; el detalle queda solo en el log del servidor.
- **Commit:** `4d559c8`
- **Verificación corregida:** `GET /api/no-existe` → `404 {"error":"Ruta no encontrada"}` sin stack; prueba F14 bloqueada.

## F15 · Body de hasta 50 MB

- **Severidad / puntaje:** Media (2) · **Capa:** configuración
- **Pasos y evidencia (versión vulnerable):**
  1. `POST /api/auth/login` con un body de 200 KB.
  2. El servidor lo acepta y responde `401`, no `413`.
- **Causa raíz:** `src/app.js:12` configura `express.json({ limit: '50mb' })`.
- **Corrección:** límite de `10kb`; un body mayor responde `413`.
- **Commit:** `73edaae`
- **Verificación corregida:** body de 200 KB → `413`; prueba F15 bloqueada.

## F16 · CORS abierto con credenciales

- **Severidad / puntaje:** Alta (3) · **Capa:** configuración
- **Pasos y evidencia (versión vulnerable):**
  1. `GET /api/health` con `Origin: https://evil.example`.
  2. Respuesta con `Access-Control-Allow-Origin: https://evil.example` y `Access-Control-Allow-Credentials: true`.
- **Causa raíz:** `src/app.js:11` usa `cors({ origin: true, credentials: true })`.
- **Corrección:** CORS restringido a los orígenes de `CORS_ORIGINS`; sin origen permitido no se envía la cabecera.
- **Commit:** `a7ff224`
- **Verificación corregida:** origen malicioso → sin `Access-Control-Allow-Origin` ni credenciales; prueba F16 bloqueada.

## F17 · Faltan cabeceras de seguridad

- **Severidad / puntaje:** Media (2) · **Capa:** configuración
- **Pasos y evidencia (versión vulnerable):**
  1. `GET /api/health`
  2. Respuesta con `X-Powered-By: Express` y sin CSP, HSTS ni `X-Content-Type-Options`.
- **Causa raíz:** `src/app.js:11-14` no usa helmet ni oculta `X-Powered-By`.
- **Corrección:** helmet con CSP, HSTS, `nosniff`, anti-clickjacking y sin `X-Powered-By`.
- **Commit:** `45f1047`
- **Verificación corregida:** cabeceras presentes y sin `X-Powered-By`; prueba F17 bloqueada.

## F18 · Validación de entrada débil en reservas

- **Severidad / puntaje:** Alta (3) · **Capa:** entrada
- **Pasos y evidencia (versión vulnerable):**
  1. `POST /api/reservations` con `{"labId":3,"date":"cualquier-cosa","startHour":-5,"endHour":99,"purpose":"x"}`.
  2. Respuesta `201`: se acepta una fecha inexistente y horas fuera de rango.
- **Causa raíz:** `src/modules/reservations/reservations.routes.js:23-30` solo verifica presencia y `startHour < endHour`; no valida tipos, formato de fecha ni rangos.
- **Corrección:** schema estricto con zod para reservas, comentarios, registro y laboratorios.
- **Commit:** `2885ba2`
- **Verificación corregida:** la misma reserva → `400`; prueba F18 bloqueada.

## F19 · Dependencia `lodash 4.17.20` con CVEs conocidos

- **Severidad / puntaje:** Alta (3) · **Capa:** cadena de suministro
- **Pasos y evidencia (versión vulnerable):**
  1. `package.json:19` declara `"lodash": "4.17.20"`.
  2. Esa versión tiene CVEs conocidos de prototype pollution y command injection.
- **Causa raíz:** `package.json:19`; `lodash` se usaba para el `_.merge` del perfil (F05).
- **Corrección:** eliminar `lodash` y usar schemas/actualizaciones explícitas; `package-lock.json` fija el resto.
- **Commit:** `f9cda0d`
- **Verificación corregida:** `lodash` ya no es dependencia; `npm audit` sin vulnerabilidades; prueba F19 bloqueada.

## F20 · `.env` versionado en git

- **Severidad / puntaje:** Crítica (5) · **Capa:** secretos/operación
- **Pasos y evidencia (versión vulnerable):**
  1. `git show 84975dc:.env` muestra `JWT_SECRET=supersecreto`.
  2. `.gitignore:1-2` solo ignora `node_modules/` y `*.log`; no ignora `.env`.
- **Causa raíz:** `.env` se agregó al repositorio y `.gitignore:1-2` no lo excluía.
- **Corrección:** `.env` fuera de git, `.env.example` sin valores y rotación del secreto anterior. El secreto viejo queda en el historial y se considera comprometido.
- **Commit:** `2c671cd`
- **Verificación corregida:** `.env` ignorado; el `.env` actual no se versiona; prueba F20 bloqueada.

## F21 · Sin registro de auditoría de seguridad

- **Severidad / puntaje:** Media (2) · **Capa:** operación/logs
- **Pasos y evidencia (versión vulnerable):**
  1. No existe `src/lib/audit.js` en `84975dc`.
  2. Los logins fallidos, accesos denegados, cancelaciones y borrados no dejan registro.
  3. El único log relacionado es `console.log('Intento de login:', req.body)` en `auth.routes.js:25`, que además filtra credenciales.
- **Causa raíz:** ausencia de un módulo de auditoría y de llamadas en autenticación, autorización y operaciones sensibles.
- **Corrección:** `src/lib/audit.js` con eventos JSON; se registran login, accesos denegados, reservas ajenas, cancelaciones y borrados, sin secretos.
- **Commit:** `fa3d656`
- **Verificación corregida:** `src/lib/audit.js` presente y usado; prueba F21 bloqueada.

## F22 · El rol y la identidad se confiaban desde el token

- **Severidad / puntaje:** Crítica (5) · **Capa:** identidad/autorización
- **Pasos y evidencia (versión vulnerable):**
  1. Token firmado con el secreto real y payload `{"sub":"999","role":"admin"}`.
  2. `GET /api/admin/reservations` → `200`, aunque el usuario 999 no existe.
  3. Token de Ana con `"role":"admin"` → `GET /api/admin/reservations` → `200`.
- **Causa raíz:** `src/lib/jwt.js:5` incluye `role` en el token y `src/middlewares/auth.js:10` hace `req.user = { ..., role: payload.role }`; `requireAdmin` confía en ese valor.
- **Corrección:** el token solo lleva `sub`; `requireAuth` carga el usuario real y su rol desde la base de datos en cada request.
- **Commit:** `4356e36`
- **Verificación corregida:** usuario inexistente → `401`; Ana con rol admin en el token → `403`; prueba F22 bloqueada.
