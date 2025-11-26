import { RequestHandler } from "express";
import pg from "pg";
const { Pool } = pg;
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("DATABASE_URL not set - employees routes will not function until it's provided");
}

const pool = new Pool({ connectionString });

async function ensureTable() {
  if (!connectionString) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT,
      division TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      last_login TIMESTAMPTZ,
      password_hash TEXT
    );
  `);
  await pool.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT');
}

async function seedDefaultAdmin() {
  if (!connectionString) return;
  try {
    const countRes = await pool.query('SELECT COUNT(1) AS c FROM employees');
    const c = Number(countRes.rows[0]?.c || 0);
    if (c > 0) return;
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'sanjeev.v@astralbusinessconsulting.in';
    const name = process.env.DEFAULT_ADMIN_NAME || 'Admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || '123456789';
    const hash = await bcrypt.hash(password, 10);
    const id = (globalThis as any).crypto?.randomUUID?.() || Date.now().toString();
    await pool.query(
      'INSERT INTO employees (id, name, email, role, division, is_active, created_at, password_hash) VALUES ($1,$2,$3,$4,$5,$6,now(),$7) ON CONFLICT (email) DO NOTHING',
      [id, name, email, 'Admin', null, true, hash]
    );
    console.log(`[seed] Default admin ensured for ${email}`);
  } catch (err:any) {
    console.error('Failed to seed default admin:', err?.message || err);
  }
}

// Create table and seed on module load (best-effort)
ensureTable()
  .then(() => seedDefaultAdmin())
  .catch((err) => {
    console.error("Failed to ensure employees table:", err.message || err);
  });

export const getEmployees: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: "DATABASE_URL not configured" });
  try {
    const { rows } = await pool.query("SELECT id, name, email, role, division, is_active, created_at, last_login FROM employees ORDER BY created_at DESC");
    const mapped = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      division: r.division,
      isActive: r.is_active,
      createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null,
      lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null
    }));
    res.json(mapped);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'db_error' });
  }
};

export const createEmployee: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: "DATABASE_URL not configured" });
  const { name, email, role, division, password } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'missing_fields' });
  try {
    const id = (globalThis as any).crypto?.randomUUID?.() || Date.now().toString();
    const createdAt = new Date().toISOString();
    let passwordHash: string | null = null;
    if (password && typeof password === 'string') {
      if (password.length < 8) {
        return res.status(400).json({ error: 'password_too_short' });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }
    const q = await pool.query(
      'INSERT INTO employees (id, name, email, role, division, is_active, created_at, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, email, role, division, is_active, created_at, last_login',
      [id, name, email, role || null, division || null, true, createdAt, passwordHash]
    );
    const r = q.rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      division: r.division,
      isActive: r.is_active,
      createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null,
      lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null
    });
  } catch (err: any) {
    console.error(err);
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'email_exists' });
    }
    res.status(500).json({ error: err.message || 'db_error' });
  }
};

export const deleteAllEmployees: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: "DATABASE_URL not configured" });
  try {
    await pool.query('DELETE FROM employees');
    res.status(204).send();
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'db_error' });
  }
};

export const updateEmployee: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: "DATABASE_URL not configured" });
  const { id } = req.params;
  const { name, email, role, division, password } = req.body || {};
  if (!name || !email || !role || !password) return res.status(400).json({ error: 'missing_fields' });
  const sets: string[] = [];
  const values: any[] = [];
  let idx = 1;
  try {
    if (typeof name === 'string' && name.trim()) { sets.push(`name=$${idx++}`); values.push(name.trim()); }
    if (typeof email === 'string' && email.trim()) { sets.push(`email=$${idx++}`); values.push(email.trim()); }
    if (typeof role === 'string' && role.trim()) { sets.push(`role=$${idx++}`); values.push(role.trim()); }
    if (typeof division === 'string' && division.trim()) { sets.push(`division=$${idx++}`); values.push(division.trim()); }
    if (typeof password === 'string' && password.length) {
      if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password_hash=$${idx++}`);
      values.push(hash);
    }
    if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });
    values.push(id);
    const q = await pool.query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id=$${idx} RETURNING id, name, email, role, division, is_active, created_at, last_login`,
      values
    );
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    const r = q.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      division: r.division,
      isActive: r.is_active,
      createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null,
      lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null
    });
  } catch (err: any) {
    console.error(err);
    if (err && err.code === '23505') return res.status(409).json({ error: 'email_exists' });
    res.status(500).json({ error: err.message || 'db_error' });
  }
};

export const setEmployeeStatus: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: "DATABASE_URL not configured" });
  const { id } = req.params;
  const { isActive } = req.body || {};
  if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'missing_or_invalid_isActive' });
  try {
    const q = await pool.query(
      `UPDATE employees SET is_active=$1 WHERE id=$2 RETURNING id, name, email, role, division, is_active, created_at, last_login`,
      [isActive, id]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    const r = q.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      division: r.division,
      isActive: r.is_active,
      createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null,
      lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'db_error' });
  }
};
