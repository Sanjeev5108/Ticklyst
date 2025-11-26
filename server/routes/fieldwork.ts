import { RequestHandler } from "express";
import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function ensure() {
  if (!connectionString) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fieldwork_records (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}
ensure().catch((e)=>console.error('ensure fieldwork_records failed', e));

export const getAllFieldwork: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const q = await pool.query('SELECT id, data, updated_at FROM fieldwork_records');
    const out: Record<string, any> = {};
    for (const r of q.rows) out[r.id] = r.data;
    res.json(out);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const getFieldworkById: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { id } = req.params;
  try {
    const q = await pool.query('SELECT id, data, updated_at FROM fieldwork_records WHERE id=$1', [id]);
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(q.rows[0].data);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const upsertFieldwork: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { id } = req.params;
  let value: any = req.body;
  try {
    if (!id) return res.status(400).json({ error: 'missing_id' });
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch {
        return res.status(400).json({ error: 'invalid_json_payload' });
      }
    }
    if (value === undefined || value === null || typeof value !== 'object') return res.status(400).json({ error: 'missing_value' });
    await pool.query(
      'INSERT INTO fieldwork_records(id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()',
      [id, value]
    );
    res.status(204).send();
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const bulkUpsertFieldwork: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const payload = req.body;
    const items: [string, any][] = Array.isArray(payload)
      ? payload.map((o:any)=>[String(o?.id||''), o?.data ?? o])
      : (payload && typeof payload === 'object')
        ? Object.entries(payload as Record<string, any>)
        : [];
    const filtered = items.filter(([id, data]) => id && data && typeof data === 'object');
    if (filtered.length === 0) return res.status(400).json({ error: 'empty_payload' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [id, data] of filtered) {
        await client.query('INSERT INTO fieldwork_records(id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()', [id, data]);
      }
      await client.query('COMMIT');
      res.status(204).send();
    } catch (e:any) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message || 'db_error' });
    } finally {
      client.release();
    }
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};
