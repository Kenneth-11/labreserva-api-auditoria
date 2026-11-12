import { db } from '../../db.js';

const COLUMNS = `r.id, r.lab_id, l.name AS lab, r.user_id, u.name AS user, u.email,
  r.date, r.start_hour, r.end_hour, r.purpose, r.created_at`;
const FROM = 'FROM reservations r JOIN labs l ON l.id = r.lab_id JOIN users u ON u.id = r.user_id';

export const reservationsRepository = {
  findAll() {
    return db.prepare(`SELECT ${COLUMNS} ${FROM} ORDER BY r.date, r.start_hour`).all();
  },

  findByUser(userId) {
    return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE r.user_id = ? ORDER BY r.date, r.start_hour`).all(userId);
  },

  // Sin userId no existe forma de leer una reserva: el filtro por dueño vive aquí, en la capa de datos,
  // para que ninguna ruta nueva pueda olvidarlo. `create` relee la fila recién insertada con su propia consulta.
  findById(id, userId) {
    return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE r.id = ? AND r.user_id = ?`).get(id, userId);
  },

  findOverlapping(labId, date, startHour, endHour) {
    return db
      .prepare(
        'SELECT id FROM reservations WHERE lab_id = ? AND date = ? AND start_hour < ? AND end_hour > ?',
      )
      .get(labId, date, endHour, startHour);
  },

  create({ labId, userId, date, startHour, endHour, purpose }) {
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO reservations (lab_id, user_id, date, start_hour, end_hour, purpose) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(labId, userId, date, startHour, endHour, purpose);
    return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE r.id = ?`).get(lastInsertRowid);
  },

  remove(id, userId) {
    return db.prepare('DELETE FROM reservations WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};
