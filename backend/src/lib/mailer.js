import nodemailer from "nodemailer";

// Email is optional, exactly like the Gemini integration: without SMTP
// credentials configured in .env, the app keeps working normally and simply
// skips sending emails (class reminders still show up as in-app/browser
// pop-ups on the student dashboard either way).
let cachedTransporter = null;
let loggedMissingConfig = false;

export function isMailerConfigured() {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: String(process.env.EMAIL_SECURE || "false") === "true",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return cachedTransporter;
}

/**
 * Sends an email to a student's login address. Silently no-ops (and logs once)
 * when SMTP isn't configured, so local/dev setups without email credentials
 * are unaffected.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!isMailerConfigured()) {
    if (!loggedMissingConfig) {
      console.log("Email notifications skipped: EMAIL_HOST/EMAIL_USER/EMAIL_PASS not set in backend/.env.");
      loggedMissingConfig = true;
    }
    return { skipped: true };
  }
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  await transporter.sendMail({ from, to, subject, text, html });
  return { skipped: false };
}
