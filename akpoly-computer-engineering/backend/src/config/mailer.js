const nodemailer = require('nodemailer');

const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

/**
 * Sends an email if SMTP is configured; otherwise logs to the console so
 * OTP codes are still visible during local development.
 */
async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`\n[DEV MAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { devMode: true };
  }

  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@aicp-computerengineering.site',
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };
