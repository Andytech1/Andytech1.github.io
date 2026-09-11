const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Verifies the session JWT (from cookie or Authorization header),
 * confirms the session hasn't been revoked, and attaches req.user.
 */
function requireAuth(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.akpoly_session || bearer;

    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const session = db
      .prepare(`SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL`)
      .get(payload.jti);

    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Session expired or revoked. Please log in again.' });
    }

    req.user = { id: payload.sub, role: payload.role, sessionId: payload.jti };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

/** Restricts a route to one or more roles, e.g. requireRole('hod', 'technician') */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
