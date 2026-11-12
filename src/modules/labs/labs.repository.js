import { db } from '../../db.js';

export const labsRepository = {
  // Consulta parametrizada: el término viaja como dato, nunca se concatena al SQL.
  search(term = '') {
    const pattern = `%${String(term).slice(0, 100)}%`;
    return db
      .prepare(
        `SELECT id, name, building, capacity, description FROM labs
         WHERE name LIKE ? OR building LIKE ?
         ORDER BY name`,
      )
      .all(pattern, pattern);
  },

  findById(id) {
    return db.prepare('SELECT id, name, building, capacity, description FROM labs WHERE id = ?').get(id);
  },

  findComments(labId) {
    return db
      .prepare(
        `SELECT c.id, c.body, c.created_at, u.name AS author
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.lab_id = ? ORDER BY c.created_at`,
      )
      .all(labId);
  },

  addComment(labId, userId, body) {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO comments (lab_id, user_id, body) VALUES (?, ?, ?)')
      .run(labId, userId, body);
    return db.prepare('SELECT id, body, created_at FROM comments WHERE id = ?').get(lastInsertRowid);
  },

  create({ name, building, capacity, description }) {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO labs (name, building, capacity, description) VALUES (?, ?, ?, ?)')
      .run(name, building, capacity, description ?? null);
    return this.findById(lastInsertRowid);
  },
};
