const AuditModel = require('../models/auditModel');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  try {
    AuditModel.log({
      actorId: req.user?.id || null,
      action: 'server_error',
      req,
      metadata: { message: err.message, path: req.path },
    });
  } catch (_) {
    // avoid a logging failure masking the original error response
  }

  const status = err.statusCode || (err.message?.includes('Only PDF') ? 400 : 500);
  res.status(status).json({
    error: status === 500 ? 'Something went wrong on our end. Please try again.' : err.message,
  });
}

module.exports = errorHandler;
