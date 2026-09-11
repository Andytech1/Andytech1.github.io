const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 10);
const MAX_ATTEMPTS = 5;

const OtpModel = {
  /**
   * Generates a random 6-digit code, stores only its hash, and returns the
   * plaintext code so it can be sent to the user via email/SMS.
   */
  issue(userId, purpose) {
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = bcrypt.hashSync(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO otp_codes (id, user_id, code_hash, purpose, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(uuid(), userId, codeHash, purpose, expiresAt);

    return code;
  },

  /**
   * Verifies a submitted code against the most recent unconsumed OTP for
   * that user/purpose. Enforces expiry and a max attempt count.
   */
  verify(userId, purpose, submittedCode) {
    const otp = db
      .prepare(
        `SELECT * FROM otp_codes
         WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(userId, purpose);

    if (!otp) return { ok: false, reason: 'no_active_code' };
    if (otp.attempt_count >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
    if (new Date(otp.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };

    const matches = bcrypt.compareSync(submittedCode, otp.code_hash);

    db.prepare(`UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = ?`).run(otp.id);

    if (!matches) return { ok: false, reason: 'incorrect' };

    db.prepare(`UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?`).run(otp.id);
    return { ok: true };
  },
};

module.exports = OtpModel;
