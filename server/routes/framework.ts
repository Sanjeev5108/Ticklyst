import { RequestHandler } from "express";
import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function ensure() {
  if (!connectionString) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS framework_nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('process','subprocess','activity','risk','control')),
      name TEXT NOT NULL,
      parent_id TEXT NULL REFERENCES framework_nodes(id) ON DELETE CASCADE,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_framework_parent ON framework_nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_framework_type ON framework_nodes(type);
  `);
}
ensure().catch(e=>console.error('ensure framework_nodes failed', e));

export const getFrameworkTree: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const q = await pool.query("SELECT id, type, name, parent_id, details FROM framework_nodes ORDER BY created_at, id");
    const nodes = q.rows.map(r => ({ id: r.id, type: r.type, name: r.name, parentId: r.parent_id || undefined }));
    const detailsById: Record<string, any> = {};
    for (const r of q.rows) detailsById[r.id] = r.details || {};
    res.json({ nodes, detailsById });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const createFrameworkNode: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { id, type, name, parentId, details } = req.body || {};
  if (!id || !type || !name) return res.status(400).json({ error: 'missing_fields' });
  try {
    await pool.query(
      'INSERT INTO framework_nodes(id, type, name, parent_id, details, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,now(),now())',
      [id, type, name, parentId || null, details || {}]
    );
    res.status(201).json({ ok: true });
  } catch (e:any) {
    console.error(e);
    if (e && e.code === '23505') return res.status(409).json({ error: 'id_exists' });
    if (e && e.code === '23503') return res.status(400).json({ error: 'invalid_parent' });
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const updateFrameworkNode: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const rawId = (req.params as any).id ?? (req.params as any)[0];
  const id = String(rawId || '').trim();
  const { name, details } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing_id' });
  if (!name && !details) return res.status(400).json({ error: 'nothing_to_update' });
  try {
    const q = await pool.query(
      'UPDATE framework_nodes SET name=COALESCE($2, name), details=COALESCE($3, details), updated_at=now() WHERE id=$1 RETURNING id',
      [id, name ?? null, details ?? null]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const deleteFrameworkNode: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const rawId = (req.params as any).id ?? (req.params as any)[0];
  const id = String(rawId || '').trim();
  if (!id) return res.status(400).json({ error: 'missing_id' });
  try {
    const q = await pool.query('DELETE FROM framework_nodes WHERE id=$1 RETURNING id', [id]);
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    res.status(204).send();
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};
