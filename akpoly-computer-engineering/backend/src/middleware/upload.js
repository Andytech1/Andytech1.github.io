const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || '../storage/receipts');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Only PDF, JPG, PNG or WEBP files are allowed for receipts.'));
  }
  cb(null, true);
}

const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES },
});

module.exports = { uploadReceipt, UPLOAD_DIR };
