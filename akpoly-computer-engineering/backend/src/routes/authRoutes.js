const express = require('express');
const { v4: uuid } = require('uuid');
const rateLimit = require('express-rate-limit');

const AuthController = require('../controllers/authController');
const { uploadReceipt } = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth');
const db = require('../config/db');

const router = express.Router();

// Slow down brute-force attempts on login/OTP endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Registration: receipt upload only applies when role=student, multer ignores
// the field for other roles since none is sent by the client in that case.
router.post(
  '/register',
  uploadReceipt.single('receipt'),
  (req, res, next) => {
    // Record the uploaded file's metadata before hitting the controller.
    if (req.file) {
      const fileId = uuid();
      db.prepare(
        `INSERT INTO files (id, owner_id, original_name, stored_name, mime_type, size_bytes, category)
         VALUES (?, NULL, ?, ?, ?, ?, 'receipt')`
      ).run(fileId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size);
      req.uploadedFileId = fileId;
    }
    next();
  },
  AuthController.register
);

router.post('/verify-registration-otp', authLimiter, AuthController.verifyRegistrationOtp);
router.post('/login', authLimiter, AuthController.login);
router.post('/verify-login-otp', authLimiter, AuthController.verifyLoginOtp);
router.post('/logout', requireAuth, AuthController.logout);

module.exports = router;
