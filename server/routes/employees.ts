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

// Create table on module load (best-effort)
ensureTable().catch((err) => {
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
  if (!name || !email) return res.status(400).json({ error: 'name_and_email_required' });
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
