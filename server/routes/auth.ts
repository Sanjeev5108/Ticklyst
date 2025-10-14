import { RequestHandler } from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

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
