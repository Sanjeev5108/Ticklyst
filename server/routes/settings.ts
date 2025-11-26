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
    if (!q.rows.length) return res.json({});
    res.json(q.rows[0].value);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const setSetting: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { key } = req.params;
  let value: any = req.body;
  try {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch {
        return res.status(400).json({ error: 'invalid_json_payload' });
      }
    }
    if (value === undefined) return res.status(400).json({ error: 'missing_value' });

    // Ensure we persist a valid JSONB value. Convert to JSON text and use explicit cast to jsonb.
    let dbVal: string;
    if (typeof value === 'string') {
      try { JSON.parse(value); dbVal = value; } catch { return res.status(400).json({ error: 'invalid_json_payload' }); }
    } else {
      dbVal = JSON.stringify(value);
    }

    await pool.query(
      'INSERT INTO app_settings(key, value, updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()',
      [key, dbVal]
    );
    res.status(204).send();
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};
