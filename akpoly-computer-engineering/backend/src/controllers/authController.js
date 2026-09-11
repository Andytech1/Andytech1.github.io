const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserModel = require('../models/userModel');
const OtpModel = require('../models/otpModel');
const AuditModel = require('../models/auditModel');
const db = require('../config/db');
const { sendMail } = require('../config/mailer');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function issueSessionCookie(res, user, deviceFingerprint, recognized) {
  const jti = uuid();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, device_fingerprint, is_recognized_device, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(jti, user.id, deviceFingerprint, recognized ? 1 : 0, expiresAt);

  const token = jwt.sign({ sub: user.id, role: user.role, jti }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  res.cookie('akpoly_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  return token;
}

const ROLE_DASHBOARD = {
  student: '/student/dashboard.html',
  lecturer: '/lecturer/dashboard.html',
  hod: '/hod/dashboard.html',
  technician: '/admin/maintenance.html',
};

const AuthController = {
  /**
   * POST /api/auth/register
   * Body varies by role. File upload (receipt) handled by multer upstream for students.
   */
  async register(req, res, next) {
    try {
      const { role, first_name, last_name, middle_name, email, phone, password } = req.body;

      if (!role || !first_name || !last_name || !email || !phone || !password) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      if (!['student', 'lecturer', 'hod'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role selection.' });
      }
      if (UserModel.findByEmail(email)) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      const passwordHash = bcrypt.hashSync(password, 12);
      const userId = uuid();

      // HOD self-registration requires the admin passcode; grants instant activation.
      let initialStatus = 'pending';
      let hodActivatedViaKey = 0;
      if (role === 'hod') {
        const { admin_passcode } = req.body;
        if (!admin_passcode || admin_passcode !== process.env.HOD_ADMIN_PASSCODE) {
          return res.status(403).json({ error: 'Invalid admin security passcode for HOD registration.' });
        }
        initialStatus = 'active';
        hodActivatedViaKey = 1;
      }

      const user = UserModel.createUser({
        id: userId,
        role,
        first_name,
        last_name,
        middle_name: middle_name || null,
        email: email.toLowerCase(),
        phone,
        password_hash: passwordHash,
        status: initialStatus,
      });

      if (role === 'student') {
        const { registration_number, admission_year, date_of_birth, level } = req.body;
        if (!registration_number || !admission_year || !date_of_birth) {
          return res.status(400).json({ error: 'Registration number, admission year and date of birth are required for students.' });
        }
        UserModel.createStudentProfile({
          user_id: userId,
          registration_number,
          admission_year: Number(admission_year),
          date_of_birth,
          level: level || null,
          receipt_file_id: req.uploadedFileId || null,
        });
      } else if (role === 'lecturer') {
        const { staff_id, title } = req.body;
        if (!staff_id) {
          return res.status(400).json({ error: 'Staff ID is required for lecturers.' });
        }
        UserModel.createLecturerProfile({
          user_id: userId,
          staff_id,
          domain_validated: /@(akwaibompoly\.edu\.ng|akpoly\.edu\.ng)$/i.test(email) ? 1 : 0,
          title: title || null,
        });
      } else if (role === 'hod') {
        UserModel.createHodProfile({
          user_id: userId,
          activated_via_key: hodActivatedViaKey,
          ownership_holder: 0,
        });
      }

      AuditModel.log({ actorId: userId, action: 'registration_submitted', targetType: 'user', targetId: userId, req, metadata: { role } });

      // Dispatch a verification OTP regardless of role (email confirmation on first registration).
      const code = OtpModel.issue(userId, 'registration');
      await sendMail({
        to: email,
        subject: 'Verify your Akpoly Computer Engineering account',
        text: `Your verification code is ${code}. It expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes.`,
      });

      return res.status(201).json({
        message:
          role === 'hod'
            ? 'HOD account created and activated.'
            : 'Registration received. Check your email for a verification code, then wait for approval.',
        status: initialStatus,
        user_id: userId,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/verify-registration-otp
   * Confirms the email-verification code sent at registration time.
   */
  async verifyRegistrationOtp(req, res, next) {
    try {
      const { user_id, code } = req.body;
      if (!user_id || !code) return res.status(400).json({ error: 'user_id and code are required.' });

      const result = OtpModel.verify(user_id, 'registration', code);
      if (!result.ok) return res.status(400).json({ error: `OTP verification failed: ${result.reason}` });

      UserModel.markEmailVerified(user_id);
      AuditModel.log({ actorId: user_id, action: 'email_verified', targetType: 'user', targetId: user_id, req });

      return res.json({ message: 'Email verified. Your account is now pending approval.' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/login
   * Students authenticate with registration number; staff with email.
   * Body: { identifier, password, device_fingerprint }
   */
  async login(req, res, next) {
    try {
      const { identifier, password, device_fingerprint } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Identifier and password are required.' });
      }

      const isEmail = identifier.includes('@');
      const user = isEmail ? UserModel.findByEmail(identifier) : UserModel.findByRegistrationNumber(identifier);

      if (!user) {
        AuditModel.log({ action: 'login_failed', req, metadata: { identifier, reason: 'not_found' } });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const passwordOk = bcrypt.compareSync(password, user.password_hash);
      if (!passwordOk) {
        AuditModel.log({ actorId: user.id, action: 'login_failed', req, metadata: { reason: 'bad_password' } });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: `Account is ${user.status}. Contact department administration.` });
      }

      // Device recognition: has this fingerprint logged in successfully before?
      const recognized = device_fingerprint
        ? !!db
            .prepare(`SELECT 1 FROM sessions WHERE user_id = ? AND device_fingerprint = ? AND revoked_at IS NULL LIMIT 1`)
            .get(user.id, device_fingerprint)
        : false;

      if (!recognized) {
        const code = OtpModel.issue(user.id, 'login');
        await sendMail({
          to: user.email,
          subject: 'Akpoly Computer Engineering - Login verification code',
          text: `New device detected. Your login code is ${code}. It expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes.`,
        });
        return res.json({
          otp_required: true,
          user_id: user.id,
          message: 'Unrecognized device. A verification code has been sent to your email.',
        });
      }

      const token = issueSessionCookie(res, user, device_fingerprint, true);
      AuditModel.log({ actorId: user.id, action: 'login_success', req });

      return res.json({
        message: 'Login successful.',
        token,
        role: user.role,
        redirect: ROLE_DASHBOARD[user.role],
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/verify-login-otp
   * Completes login for an unrecognized device.
   */
  async verifyLoginOtp(req, res, next) {
    try {
      const { user_id, code, device_fingerprint } = req.body;
      if (!user_id || !code) return res.status(400).json({ error: 'user_id and code are required.' });

      const result = OtpModel.verify(user_id, 'login', code);
      if (!result.ok) {
        AuditModel.log({ actorId: user_id, action: 'login_otp_failed', req, metadata: { reason: result.reason } });
        return res.status(400).json({ error: `OTP verification failed: ${result.reason}` });
      }

      const user = UserModel.findById(user_id);
      const token = issueSessionCookie(res, user, device_fingerprint || 'unknown-device', true);
      AuditModel.log({ actorId: user.id, action: 'login_success', req, metadata: { via: 'otp' } });

      return res.json({
        message: 'Login successful.',
        token,
        role: user.role,
        redirect: ROLE_DASHBOARD[user.role],
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res) {
    res.clearCookie('akpoly_session');
    return res.json({ message: 'Logged out.' });
  },
};

module.exports = AuthController;
