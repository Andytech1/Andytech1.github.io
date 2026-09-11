const db = require('../config/db');

const UserModel = {
  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByRegistrationNumber(regNo) {
    return db
      .prepare(
        `SELECT u.*, s.registration_number, s.admission_year, s.date_of_birth, s.level
         FROM users u
         JOIN students s ON s.user_id = u.id
         WHERE s.registration_number = ?`
      )
      .get(regNo);
  },

  createUser(user) {
    db.prepare(
      `INSERT INTO users (id, role, first_name, last_name, middle_name, email, phone, password_hash, status)
       VALUES (@id, @role, @first_name, @last_name, @middle_name, @email, @phone, @password_hash, @status)`
    ).run(user);
    return user;
  },

  createStudentProfile(profile) {
    db.prepare(
      `INSERT INTO students (user_id, registration_number, admission_year, date_of_birth, level, receipt_file_id)
       VALUES (@user_id, @registration_number, @admission_year, @date_of_birth, @level, @receipt_file_id)`
    ).run(profile);
  },

  createLecturerProfile(profile) {
    db.prepare(
      `INSERT INTO lecturers (user_id, staff_id, domain_validated, title)
       VALUES (@user_id, @staff_id, @domain_validated, @title)`
    ).run(profile);
  },

  createHodProfile(profile) {
    db.prepare(
      `INSERT INTO hods (user_id, activated_via_key, ownership_holder)
       VALUES (@user_id, @activated_via_key, @ownership_holder)`
    ).run(profile);
  },

  setStatus(userId, status, approvedBy = null) {
    db.prepare(
      `UPDATE users SET status = ?, approved_by = ?, approved_at = CASE WHEN ? = 'active' THEN datetime('now') ELSE approved_at END, updated_at = datetime('now')
       WHERE id = ?`
    ).run(status, approvedBy, status, userId);
  },

  markEmailVerified(userId) {
    db.prepare(`UPDATE users SET email_verified_at = datetime('now') WHERE id = ?`).run(userId);
  },
};

module.exports = UserModel;
