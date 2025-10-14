import { RequestHandler } from "express";
import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function ensure() {
  if (!connectionString) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);
}
ensure().catch((e)=>console.error('ensure app_settings failed', e));

export const getSetting: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { key } = req.params;
  try {
    const q = await pool.query('SELECT value FROM app_settings WHERE key=$1', [key]);
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(q.rows[0].value);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const setSetting: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { key } = req.params;
  const value = req.body;
  try {
    await pool.query('INSERT INTO app_settings(key, value, updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()', [key, value]);
    res.status(204).send();
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};
