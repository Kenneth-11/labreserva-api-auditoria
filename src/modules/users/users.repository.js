import { db } from '../../db.js';

export const usersRepository = {
  findAll() {
    return db.prepare('SELECT * FROM users ORDER BY name').all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  create({ name, email, passwordHash, role, carnet }) {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, email, password_hash, role, carnet) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, passwordHash, role, carnet ?? null);
    return db.prepare('SELECT id, name, email, role, carnet FROM users WHERE id = ?').get(lastInsertRowid);
  },

  // Solo los campos que el usuario puede editar de su propio perfil. role, email e id no están aquí.
  updateProfile(id, { name, phone, carnet }) {
    db.prepare('UPDATE users SET name = ?, phone = ?, carnet = ? WHERE id = ?').run(name, phone, carnet, id);
    return this.findById(id);
  },

  remove(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  },
};
