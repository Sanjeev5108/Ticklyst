import { RequestHandler } from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// SMTP transporter (lazy init)
let mailer: any = null;
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (mailer) return mailer;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const auth = user ? { user, pass } : undefined;
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth
  });
  return mailer;
}

// Ensure password_resets table exists
(async function ensurePasswordResets() {
  if (!connectionString) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
  } catch (err) {
    console.error('failed to ensure password_resets table', err);
  }
})();

export const login: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
  try {
    const q = await pool.query('SELECT id, name, email, role, division, is_active, password_hash FROM employees WHERE email=$1 LIMIT 1', [email]);
    if (!q.rows.length) return res.status(401).json({ error: 'invalid_credentials' });
    const u = q.rows[0];
    if (!u.is_active) return res.status(403).json({ error: 'inactive_user' });
    const ok = u.password_hash ? await bcrypt.compare(password, u.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    // fetch role/user module access from settings
    let allowedModules: string[] = [];
    try {
      const roleMapRes = await pool.query("SELECT value FROM app_settings WHERE key='roleModuleMap'");
      const userMapRes = await pool.query("SELECT value FROM app_settings WHERE key='userModuleMap'");
      const roleMap = roleMapRes.rows[0]?.value || {};
      const userMap = userMapRes.rows[0]?.value || {};
      if (userMap && userMap[u.id] && Array.isArray(userMap[u.id])) allowedModules = userMap[u.id];
      else if (roleMap && roleMap[u.role] && Array.isArray(roleMap[u.role])) allowedModules = roleMap[u.role];
    } catch {}

    const user = {
      id: u.id,
      username: u.name,
      role: u.role,
      email: u.email,
      department: u.division,
      isActive: u.is_active,
      allowedModules
    };
    res.json(user);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

// POST /api/auth/forgot
export const forgotPassword: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email_required' });
  try {
    const q = await pool.query('SELECT id, email, name FROM employees WHERE email=$1 LIMIT 1', [email]);
    if (!q.rows.length) {
      // don't reveal whether email exists
      console.log('[forgot] request for unknown email', email);
      return res.json({ ok: true });
    }
    const u = q.rows[0];
    const token = (globalThis as any).crypto?.randomUUID?.() || require('crypto').randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const id = (globalThis as any).crypto?.randomUUID?.() || Date.now().toString();
    await pool.query('INSERT INTO password_resets(id, user_id, token, expires_at, used) VALUES ($1,$2,$3,$4,$5)', [id, u.id, token, expires.toISOString(), false]);

    // Build reset URL
    const proto = (req.headers['x-forwarded-proto'] as string) || (req.protocol || 'https');
    const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || '';
    const origin = host ? `${proto}://${host}` : '';
    const isLocalHost = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host || '');
    const preferEnv = (process.env.BASE_URL && process.env.BASE_URL.trim().length > 0);
    const base = preferEnv ? process.env.BASE_URL! : (isLocalHost ? (process.env.BASE_URL || origin || '') : (origin || process.env.BASE_URL || ''));
    const resetUrl = base ? `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}` : `/reset-password?token=${encodeURIComponent(token)}`;

    // Attempt to send email via SMTP if configured; otherwise log token/url
    const transporter = getTransporter();
    if (transporter) {
      try {
        const from = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com';
        await transporter.sendMail({
          from,
          to: u.email,
          subject: 'Reset your password',
          text: `Hello ${u.name || ''},\n\nWe received a request to reset your password. Click the link below to set a new password. This link will expire in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
          html: `<p>Hello ${u.name || ''},</p><p>We received a request to reset your password. Click the button below to set a new password. This link will expire in 1 hour.</p><p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p><p>Or copy and paste this URL into your browser:<br/><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`
        });
      } catch (err) {
        console.error('[forgot] failed to send reset email to', u.email, err);
      }
    } else {
      console.log('[forgot] password reset token for', u.email, '->', resetUrl);
    }

    res.json({ ok: true });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

// POST /api/auth/reset
export const resetPassword: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token_and_password_required' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'password_too_short' });
  try {
    const q = await pool.query('SELECT id, user_id, expires_at, used FROM password_resets WHERE token=$1 LIMIT 1', [token]);
    if (!q.rows.length) return res.status(400).json({ error: 'invalid_token' });
    const rec = q.rows[0];
    if (rec.used) return res.status(400).json({ error: 'token_used' });
    const exp = new Date(rec.expires_at);
    if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) return res.status(400).json({ error: 'token_expired' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE employees SET password_hash=$1 WHERE id=$2', [hash, rec.user_id]);
    await pool.query('UPDATE password_resets SET used=true WHERE id=$1', [rec.id]);
    res.json({ ok: true });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};
