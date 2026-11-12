# ADR-001 · Token en el header Authorization, guardado en memoria

**Estado:** aceptada · **Fecha:** 2026-11-12 · **Decide:** equipo de seguridad (auditoría Semana 14)

## Contexto
LabReserva se consume desde un frontend web y desde clientes como Postman. El frontend guardaba el JWT y
el usuario en `localStorage`, donde cualquier script inyectado (XSS) puede leerlos. Ya se encontró un XSS
almacenado en los comentarios (F10), así que había una cadena XSS → robo de token.

## Decisión
- El token viaja en `Authorization: Bearer ...` y el frontend lo guarda **solo en memoria** (variable JS).
- El access token expira a los **15 minutos** (F02) y el rol se lee de la BD en cada request (F22).
- Se escapa todo texto de la API antes de insertarlo como HTML y se activa una CSP con helmet (F17).

## Alternativas
- **Cookie `httpOnly` + `Secure` + `SameSite`:** JavaScript no la lee, pero exige defensa contra CSRF.
- **`localStorage`:** cómodo, pero expuesto a XSS. Descartada.
- **Memoria + refresh token:** la mejor opción a futuro (el refresh token sí se puede revocar).

## Consecuencias
- Sin CSRF (la API no usa cookies).
- El usuario debe volver a iniciar sesión al recargar la página y al pasar 15 minutos, hasta que exista un refresh token.
- **Riesgo aceptado:** sin refresh token, un token robado vale hasta 15 minutos y no se puede revocar antes.
  Dueño: dirección de TI. Revisar cuando se implemente el refresh token.
