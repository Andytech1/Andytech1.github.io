const { v4: uuid } = require('uuid');
const db = require('../config/db');

const AuditModel = {
  log({ actorId = null, action, targetType = null, targetId = null, req = null, metadata = null }) {
    db.prepare(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, ip_address, user_agent, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      actorId,
      action,
      targetType,
      targetId,
      req ? req.ip : null,
      req ? req.get('user-agent') : null,
      metadata ? JSON.stringify(metadata) : null
    );
  },
};

module.exports = AuditModel;
