import { RequestHandler } from "express";
import pg from "pg";
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
  mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure, auth });
  return mailer;
}

async function ensure() {
  if (!connectionString) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS industries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      departments TEXT[] NOT NULL DEFAULT '{}'::text[],
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      client_name TEXT,
      status TEXT,
      start_date DATE,
      end_date DATE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_digest_log (
      project_id TEXT NOT NULL,
      period_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY(project_id, period_key)
    );
  `);
  if (process.env.CLEAR_CLIENTS_ON_BOOT === 'true') {
    try { await pool.query('TRUNCATE TABLE clients'); } catch {}
  }
  if (process.env.CLEAR_PROJECTS_ON_BOOT === 'true') {
    try { await pool.query('TRUNCATE TABLE projects'); } catch {}
  }
}
ensure().catch(e => console.error('ensure clients failed', e));

// Interfaces for the auditing system
export interface Industry {
  id: string;
  name: string;
  description: string;
  departments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  totalQuestions: number;
  createdAt: string;
}

export interface ChecklistQuestion {
  id: string;
  question: string;
  department: string;
  industries: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  assignedTeam: string[];
  status: 'pending' | 'in-progress' | 'completed';
  startDate: string;
  dueDate: string;
  checklist: ChecklistItem[];
  createdBy: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  questionId: string;
  status: 'pending' | 'in-progress' | 'completed';
  comments: Comment[];
  assignedTo?: string;
  completedAt?: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  type: 'note' | 'issue' | 'resolution';
  timestamp: string;
}

// Mock data storage (in production, this would be a database)
let industries: Industry[] = [
  {
    id: "1",
    name: "Manufacturing",
    description: "Manufacturing and production companies",
    departments: ["HR", "Purchase", "Quality", "Finance"],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  },
  {
    id: "2",
    name: "Milk & Dairy",
    description: "Dairy and milk processing industry",
    departments: ["HR", "Purchase", "Quality", "Service"],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  }
];

let departments: Department[] = [
  { id: "1", name: "HR", description: "Human Resources", totalQuestions: 150, createdAt: "2024-01-01" },
  { id: "2", name: "Purchase", description: "Procurement and Purchasing", totalQuestions: 200, createdAt: "2024-01-01" },
  { id: "3", name: "Service", description: "Customer Service", totalQuestions: 120, createdAt: "2024-01-01" },
  { id: "4", name: "Quality", description: "Quality Assurance", totalQuestions: 160, createdAt: "2024-01-01" },
  { id: "5", name: "Finance", description: "Financial Management", totalQuestions: 180, createdAt: "2024-01-01" }
];

let checklistQuestions: ChecklistQuestion[] = [
  {
    id: "1",
    question: "Are employee onboarding processes documented and followed?",
    department: "HR",
    industries: ["Manufacturing", "Milk & Dairy"],
    isActive: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  },
  {
    id: "2",
    question: "Is there a formal purchase order approval process?",
    department: "Purchase",
    industries: ["Manufacturing", "Milk & Dairy"],
    isActive: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  }
];

let clients: Client[] = [];

let projects: Project[] = [];

// API Handlers

// Industries
export const getIndustries: RequestHandler = async (req, res) => {
  if (!connectionString) return res.json(industries);
  try {
    const q = await pool.query(
      "SELECT id, name, description, departments, created_by AS \"createdBy\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM industries ORDER BY name",
    );
    return res.json(q.rows);
  } catch (e) {
    console.error("getIndustries failed", e);
    return res.status(500).json({ error: "server_error" });
  }
};

export const createIndustry: RequestHandler = async (req, res) => {
  const { name, description, departments, createdBy } = req.body || {};
  const normName = typeof name === "string" ? name.trim() : "";
  if (!normName) return res.status(400).json({ error: "missing_name" });

  if (!connectionString) {
    const exists = industries.some(
      (i) => i.name.trim().toLowerCase() === normName.toLowerCase(),
    );
    if (exists) return res.status(400).json({ error: "industry_exists" });
    const newIndustry: Industry = {
      id: Date.now().toString(),
      name: normName,
      description: description || "",
      departments: Array.isArray(departments) ? departments : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    industries.push(newIndustry);
    return res.status(201).json(newIndustry);
  }

  try {
    const dup = await pool.query(
      "SELECT id FROM industries WHERE lower(name) = lower($1) LIMIT 1",
      [normName],
    );
    if (dup.rows.length)
      return res.status(400).json({ error: "industry_exists" });

    const id = `IND-${Date.now()}`;
    const deptArr = Array.isArray(departments) ? departments : [];
    const createdByValue =
      createdBy || (req as any).user?.email || (req as any).user?.id || null;

    const q = await pool.query(
      `INSERT INTO industries (id, name, description, departments, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, departments, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, normName, description || "", deptArr, createdByValue],
    );

    return res.status(201).json(q.rows[0]);
  } catch (e) {
    console.error("createIndustry failed", e);
    return res.status(500).json({ error: "server_error" });
  }
};

export const updateIndustry: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { name, description, departments } = req.body || {};

  if (!connectionString) {
    const industryIndex = industries.findIndex((i) => i.id === id);
    if (industryIndex === -1)
      return res.status(404).json({ error: "Industry not found" });
    const normName =
      typeof name === "string" && name.trim().length
        ? name.trim()
        : industries[industryIndex].name;
    const exists = industries.some(
      (i) =>
        i.id !== id && i.name.trim().toLowerCase() === normName.toLowerCase(),
    );
    if (exists) return res.status(400).json({ error: "industry_exists" });
    industries[industryIndex] = {
      ...industries[industryIndex],
      name: normName,
      description:
        typeof description === "string"
          ? description
          : industries[industryIndex].description,
      departments: Array.isArray(departments)
        ? departments
        : industries[industryIndex].departments,
      updatedAt: new Date().toISOString(),
    };
    return res.json(industries[industryIndex]);
  }

  try {
    const normName = typeof name === "string" ? name.trim() : undefined;
    if (normName && normName.length) {
      const dup = await pool.query(
        "SELECT id FROM industries WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1",
        [normName, id],
      );
      if (dup.rows.length)
        return res.status(400).json({ error: "industry_exists" });
    }

    const deptArr = Array.isArray(departments) ? departments : undefined;

    const q = await pool.query(
      `UPDATE industries
       SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         departments = COALESCE($4, departments),
         updated_at = now()
       WHERE id = $1
       RETURNING id, name, description, departments, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        normName && normName.length ? normName : null,
        typeof description === "string" ? description : null,
        deptArr || null,
      ],
    );
    if (!q.rows.length)
      return res.status(404).json({ error: "Industry not found" });
    return res.json(q.rows[0]);
  } catch (e) {
    console.error("updateIndustry failed", e);
    return res.status(500).json({ error: "server_error" });
  }
};

export const deleteIndustry: RequestHandler = async (req, res) => {
  const { id } = req.params;
  if (!connectionString) {
    industries = industries.filter((i) => i.id !== id);
    return res.status(204).send();
  }
  try {
    await pool.query("DELETE FROM industries WHERE id = $1", [id]);
    return res.status(204).send();
  } catch (e) {
    console.error("deleteIndustry failed", e);
    return res.status(500).json({ error: "server_error" });
  }
};

// Departments
export const getDepartments: RequestHandler = (req, res) => {
  res.json(departments);
};

export const createDepartment: RequestHandler = (req, res) => {
  const { name, description } = req.body;
  const newDepartment: Department = {
    id: Date.now().toString(),
    name,
    description,
    totalQuestions: 0,
    createdAt: new Date().toISOString()
  };
  departments.push(newDepartment);
  res.status(201).json(newDepartment);
};

// Checklist Questions
export const getChecklistQuestions: RequestHandler = (req, res) => {
  const { department, industry } = req.query;
  let filtered = checklistQuestions;
  
  if (department) {
    filtered = filtered.filter(q => q.department === department);
  }
  
  if (industry) {
    filtered = filtered.filter(q => q.industries.includes(industry as string));
  }
  
  res.json(filtered);
};

export const createChecklistQuestion: RequestHandler = (req, res) => {
  const { question, department, industries } = req.body;
  const newQuestion: ChecklistQuestion = {
    id: Date.now().toString(),
    question,
    department,
    industries: industries || [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  checklistQuestions.push(newQuestion);
  res.status(201).json(newQuestion);
};

// Clients
export const getClients: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    // Aggregate project counts per client_name
    let counts: Record<string, { total: number; inProgress: number }> = {};
    try {
      const pq = await pool.query(
        `SELECT COALESCE(client_name,'') AS client_name,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'in-progress')::int AS in_progress
         FROM projects
         GROUP BY COALESCE(client_name,'')`
      );
      for (const r of pq.rows) counts[r.client_name] = { total: r.total || 0, inProgress: r.in_progress || 0 };
    } catch {}

    const q = await pool.query('SELECT id, name, industry, details, created_at FROM clients ORDER BY created_at DESC');
    const rows = q.rows.map(r => {
      const base = typeof r.details === 'object' && r.details ? { ...r.details } : {};
      const key = r.name || '';
      const agg = counts[key] || { total: 0, inProgress: 0 };
      const stats = {
        projects: agg.total,
        ongoing: agg.inProgress,
        revenue: base?.stats?.revenue ?? '$0',
        rating: base?.stats?.rating ?? 0,
        progressPercentage: base?.stats?.progressPercentage ?? 0,
      };
      const isPurged = !!(base as any).isPurged;
      return { id: r.id, name: r.name, industry: r.industry, isPurged, ...base, stats, createdAt: r.created_at };
    });
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const createClient: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const { name, industry, details } = req.body || {};
  if (!name || !industry) return res.status(400).json({ error: 'missing_fields', required: ['name','industry'] });
  const id = `CLT-${Date.now()}`;
  const det = typeof details === 'object' && details ? details : (() => {
    const copy = { ...(req.body || {}) } as any;
    delete copy.name; delete copy.industry; delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    return copy;
  })();
  try {
    await pool.query('INSERT INTO clients(id, name, industry, details, created_at, updated_at) VALUES ($1,$2,$3,$4,now(),now())', [id, name, industry, det]);
    res.status(201).json({ id, name, industry, ...det, createdAt: new Date().toISOString() });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const updateClient: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing_id' });
  const { name, industry, details } = req.body || {};
  const det = typeof details === 'object' && details ? details : (() => {
    const copy = { ...(req.body || {}) } as any;
    delete copy.name; delete copy.industry; delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    return copy;
  })();
  try {
    const q = await pool.query('UPDATE clients SET name=$1, industry=$2, details=$3, updated_at=now() WHERE id=$4 RETURNING id, name, industry, details, created_at', [name, industry, det, id]);
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    const r = q.rows[0];
    res.json({ id: r.id, name: r.name, industry: r.industry, ...(r.details || {}), createdAt: r.created_at });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const setClientPurgeStatus: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing_id' });
  const { isPurged } = req.body || {};
  try {
    const q = await pool.query('SELECT id, name, industry, details, created_at FROM clients WHERE id=$1', [id]);
    if (!q.rows.length) return res.status(404).json({ error: 'not_found' });
    const row = q.rows[0];
    const base = typeof row.details === 'object' && row.details ? { ...row.details } : {};
    (base as any).isPurged = !!isPurged;

    await pool.query('UPDATE clients SET details=$1, updated_at=now() WHERE id=$2', [base, id]);

    let stats = { projects: 0, ongoing: 0, revenue: '$0', rating: 0, progressPercentage: 0 };
    try {
      const pq = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'in-progress')::int AS in_progress
         FROM projects
         WHERE COALESCE(client_name,'') = $1`,
        [row.name || ''],
      );
      if (pq.rows.length) {
        const r2 = pq.rows[0];
        stats = {
          projects: r2.total || 0,
          ongoing: r2.in_progress || 0,
          revenue: (base as any)?.stats?.revenue ?? '$0',
          rating: (base as any)?.stats?.rating ?? 0,
          progressPercentage: (base as any)?.stats?.progressPercentage ?? 0,
        };
      }
    } catch {}

    const response = {
      id: row.id,
      name: row.name,
      industry: row.industry,
      isPurged: !!(base as any).isPurged,
      ...base,
      stats,
      createdAt: row.created_at,
    };

    res.json(response);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const deleteAllClients: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    await pool.query('TRUNCATE TABLE clients');
    res.status(204).send();
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

// Projects (persisted to Postgres)
export const getProjects: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const q = await pool.query('SELECT id, code, name, client_name, status, start_date, end_date, data, created_by, created_at FROM projects ORDER BY created_at DESC');
    const rows = q.rows.map(r => ({ id: r.id, code: r.code, name: r.name, clientName: r.client_name, status: r.status, startDate: r.start_date, endDate: r.end_date, data: r.data || {}, createdBy: r.created_by, createdAt: r.created_at }));
    res.json(rows);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

export const createProject: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const body = req.body || {};

  // shallow-merge for primitives, deep-merge for objects (arrays are replaced)
  const deepMerge = (target: any, source: any): any => {
    if (source === null || source === undefined) return target;
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || Array.isArray(source)) return Array.isArray(source) ? (source.slice()) : source;
    const out: any = { ...target };
    for (const [k, v] of Object.entries(source)) {
      const tv = (out as any)[k];
      (out as any)[k] = deepMerge(tv, v as any);
    }
    return out;
  };

  try {
    const id = body.id || `PRJ-${Date.now()}`;

    // Load existing row to support merge semantics
    let existing: any = null;
    try {
      const q = await pool.query('SELECT code, name, client_name, status, start_date, end_date, data, created_by FROM projects WHERE id=$1 LIMIT 1', [id]);
      existing = q.rows[0] || null;
    } catch {}

    const incomingCode = body.projectCode || body.code || null;
    const incomingName = body.projectName || body.name || (existing?.name ?? 'Untitled Project');
    const incomingClientName = body.clientName || body.client || (existing?.client_name ?? null);
    const incomingStatus = body.status || existing?.status || 'todo';
    const incomingStart = body.startDate ? new Date(body.startDate) : (existing?.start_date ?? null);
    const incomingEnd = body.endDate ? new Date(body.endDate) : (existing?.end_date ?? null);
    const createdBy = body.createdBy || existing?.created_by || 'system';

    // If body.data is provided, treat it as the data payload; otherwise use full body
    const incomingDataPatch = (body && typeof body.data === 'object' && body.data) ? body.data : body;
    const existingData = (existing && typeof existing.data === 'object' && existing.data) ? existing.data : {};

    // Determine current global risk module toggle
    let riskModuleEnabled = true;
    try {
      const s = await pool.query('SELECT value FROM app_settings WHERE key=$1 LIMIT 1', ['riskModuleEnabled']);
      if (s.rows.length) {
        const val = s.rows[0].value;
        if (typeof val === 'boolean') riskModuleEnabled = val;
        else if (val && typeof val === 'object' && typeof val.enabled === 'boolean') riskModuleEnabled = !!val.enabled;
      }
    } catch {}

    let data = deepMerge(existingData, incomingDataPatch);
    // For complex nested selections, replace entire structure to reflect exact saved applicability
    if (incomingDataPatch && Object.prototype.hasOwnProperty.call(incomingDataPatch, 'selectedChecklistTree')) {
      (data as any).selectedChecklistTree = (incomingDataPatch as any).selectedChecklistTree ?? null;
    }
    if (!existing) {
      if (data.riskModuleEnabled === undefined) {
        data.riskModuleEnabled = riskModuleEnabled;
      }
    }

    // Compute/assign project code following fiscal year and sequential numbering
    let code: string | null = incomingCode ?? existing?.code ?? null;
    const name = incomingName;
    const clientName = incomingClientName;
    const status = incomingStatus;
    const startDate = incomingStart;
    const endDate = incomingEnd;

    // Generate code when not provided, based on start date (or today) using FY starting April 1
    if (!code) {
      const refDate = startDate ? new Date(startDate) : new Date();
      const month = refDate.getMonth(); // 0-based; 3 => April
      const year = refDate.getFullYear();
      const fyStart = month >= 3 ? year : year - 1;
      const fyString = `${fyStart}-${fyStart + 1}`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Find the current max sequence for this FY
        const maxRes = await client.query(
          `SELECT COALESCE(MAX(CAST(regexp_replace(code, '.* (\\d+)$', '\\1') AS INT)), 0) AS max_seq
           FROM projects
           WHERE code LIKE $1`,
          [`${fyString} %`]
        );
        let nextSeq = (maxRes.rows[0]?.max_seq as number) + 1;
        let nextCode = `${fyString} ${String(nextSeq).padStart(3, '0')}`;
        // Minimal collision avoidance: bump until unique within txn
        // (No unique index exists on code)
        // Ensure not used already in this transaction snapshot
        // Check existence and increment if needed
        // Limit attempts to avoid infinite loop
        for (let i = 0; i < 5; i++) {
          const existsRes = await client.query('SELECT 1 FROM projects WHERE code=$1 LIMIT 1', [nextCode]);
          if (existsRes.rowCount === 0) break;
          nextSeq += 1;
          nextCode = `${fyString} ${String(nextSeq).padStart(3, '0')}`;
        }
        code = nextCode;
        await client.query('COMMIT');
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch {}
        throw err;
      } finally {
        client.release();
      }
    }

    await pool.query(
      'INSERT INTO projects(id, code, name, client_name, status, start_date, end_date, data, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now()) ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name, client_name=EXCLUDED.client_name, status=EXCLUDED.status, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, data=EXCLUDED.data, created_by=EXCLUDED.created_by, updated_at=now()',
      [id, code, name, clientName, status, startDate, endDate, data, createdBy]
    );

    // Send notifications on create or status change
    try {
      const transporter = getTransporter();
      if (transporter) {
        const d: any = data || {};
        const teamLists = [
          { role: 'Division Head', names: Array.isArray(d.divisionHeads) ? d.divisionHeads : [] },
          { role: 'Partner', names: Array.isArray(d.partners) ? d.partners : [] },
          { role: 'Team Leader', names: Array.isArray(d.teamLeaders) ? d.teamLeaders : [] },
          { role: 'Team Member', names: Array.isArray(d.teamMembers) ? d.teamMembers : [] },
        ];
        const allNames = Array.from(new Set(teamLists.flatMap(t => t.names).filter(Boolean)));
        let recipients: { name: string; email: string; role?: string }[] = [];
        if (allNames.length) {
          const uq = await pool.query('SELECT name, email, role FROM employees WHERE name = ANY($1) AND (is_active IS TRUE OR is_active IS NULL)', [allNames]);
          const byName: Record<string, { email: string; role?: string }> = {};
          for (const r of uq.rows) byName[r.name] = { email: r.email, role: r.role };
          recipients = allNames.map(n => {
            const f = byName[n];
            if (!f || !f.email) return null as any;
            const explicitRole = (teamLists as any[]).find(t => (t.names||[]).includes(n))?.role;
            return { name: n, email: f.email, role: explicitRole || f.role };
          }).filter(Boolean) as any[];
        }
        const emails = recipients.map(r => r.email);
        const to = emails[0];
        const bcc = emails.slice(1);
        const statusLabel = String(status || '').replace(/-/g,' ').replace(/\b\w/g, (c)=>c.toUpperCase());
        const isNew = !existing;
        const statusChanged = !!(existing && existing.status !== status && ['in-progress','completed','hold'].includes(String(status||'')));
        if ((isNew || statusChanged) && to) {
          const subject = isNew ? `🆕 New Project Created: ${name}` : `📢 Project Status Updated: ${name} – ${statusLabel}`;
          const heading = isNew ? 'New Project Created' : `Project Status Updated: ${statusLabel}`;
          const assignmentHtml = teamLists.filter((t:any)=> (t.names||[]).length).map((t:any)=>`<li><strong>${t.role}:</strong> ${(t.names||[]).join(', ')}</li>`).join('');
          const base = (process.env.BASE_URL || '').replace(/\/$/, '');
          const projectInfo = `<ul>
            <li><strong>Project Code:</strong> ${code}</li>
            <li><strong>Project Name:</strong> ${name}</li>
            <li><strong>Client Name:</strong> ${clientName || '-'}</li>
            <li><strong>${isNew ? 'Status' : 'Updated Status'}:</strong> ${isNew ? 'New Project Created' : statusLabel}</li>
          </ul>`;
          const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>${heading}</h2>${projectInfo}${assignmentHtml ? `<h3>Team Assignment</h3><ul>${assignmentHtml}</ul>` : ''}${base ? `<p><a href='${base}'>Open Application</a></p>` : ''}</div>`;
          const text = `${heading}\n\nProject Code: ${code}\nProject Name: ${name}\nClient Name: ${clientName || '-'}\n${isNew ? 'Status: New Project Created' : 'Updated Status: ' + statusLabel}\n\nTeam Assignment:\n${teamLists.map((t:any)=>`${t.role}: ${(t.names||[]).join(', ')}`).join('\n')}`;
          await transporter.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, bcc, subject, text, html });
        }
      }
    } catch (err) {
      console.error('project notification failed', err);
    }

    res.status(201).json({ id, code, name, clientName, status, startDate, endDate, createdBy });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

function countTotalControlsFromTree(tree: any): number {
  if (!tree || typeof tree !== 'object') return 0;
  let total = 0;
  try {
    for (const proc of Object.values<any>(tree)) {
      const subs = (proc && proc.subprocesses) || {};
      for (const sub of Object.values<any>(subs)) {
        const acts = (sub && sub.activities) || {};
        for (const act of Object.values<any>(acts)) {
          const risks = (act && act.risks) || {};
          for (const r of Object.values<any>(risks)) {
            const ctrls = Array.isArray((r as any).controls) ? (r as any).controls : [];
            total += ctrls.length;
          }
        }
      }
    }
  } catch {}
  return total;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function computePeriodKey(freq: string, now: Date): { key: string; due: boolean } {
  const f = (freq || '').toLowerCase();
  const day = now.getDay(); // 0=Sun..6=Sat
  const month = now.getMonth(); // 0=Jan
  const year = now.getFullYear();
  if (f === 'weekly') {
    if (day !== 1) return { key: '', due: false }; // Monday only
    const { year: wy, week } = getISOWeek(now);
    return { key: `W${wy}-${String(week).padStart(2,'0')}`, due: true };
  }
  if (f === 'fortnightly') {
    if (day !== 1) return { key: '', due: false };
    const { year: wy, week } = getISOWeek(now);
    const bi = Math.ceil(week / 2);
    return { key: `F${wy}-${String(bi).padStart(2,'0')}`, due: (week % 2) === 1 };
  }
  if (f === 'monthly') {
    if (now.getDate() !== 1) return { key: '', due: false };
    return { key: `M${year}-${String(month+1).padStart(2,'0')}`, due: true };
  }
  if (f === 'quarterly') {
    if (now.getDate() !== 1) return { key: '', due: false };
    const q = Math.floor(month / 3) + 1;
    if (![1,4,7,10].includes(month+1)) return { key: '', due: false };
    return { key: `Q${year}-Q${q}` , due: true };
  }
  return { key: '', due: false };
}

async function sendProgressDigestForProject(row: any) {
  const transporter = getTransporter();
  if (!transporter) return;
  const id = row.id;
  const code = row.code;
  const name = row.name;
  const clientName = row.client_name;
  const status = row.status;
  const data = row.data || {};
  const d: any = data;
  const teamLists = [
    { role: 'Division Head', names: Array.isArray(d.divisionHeads) ? d.divisionHeads : [] },
    { role: 'Partner', names: Array.isArray(d.partners) ? d.partners : [] },
    { role: 'Team Leader', names: Array.isArray(d.teamLeaders) ? d.teamLeaders : [] },
    { role: 'Team Member', names: Array.isArray(d.teamMembers) ? d.teamMembers : [] },
  ];
  const allNames = Array.from(new Set(teamLists.flatMap(t => t.names).filter(Boolean)));
  let recipients: { name: string; email: string; role?: string }[] = [];
  if (allNames.length) {
    try {
      const uq = await pool.query('SELECT name, email, role FROM employees WHERE name = ANY($1) AND (is_active IS TRUE OR is_active IS NULL)', [allNames]);
      const byName: Record<string, { email: string; role?: string }> = {};
      for (const r of uq.rows) byName[r.name] = { email: r.email, role: r.role };
      recipients = allNames.map(n => {
        const f = byName[n];
        if (!f || !f.email) return null as any;
        const explicitRole = (teamLists as any[]).find(t => (t.names||[]).includes(n))?.role;
        return { name: n, email: f.email, role: explicitRole || f.role };
      }).filter(Boolean) as any[];
    } catch {}
  }
  if (!recipients.length) return;
  const emails = recipients.map(r => r.email);
  const to = emails[0];
  const bcc = emails.slice(1);

  // compute progress
  let totalControls = 0;
  try { totalControls = countTotalControlsFromTree(d.selectedChecklistTree); } catch {}
  let approved = 0;
  try {
    const like = `${id}|%`;
    const aq = await pool.query(`SELECT COUNT(*)::int AS approved FROM fieldwork_records WHERE id LIKE $1 AND data->>'status' = 'approved'`, [like]);
    approved = aq.rows[0]?.approved || 0;
  } catch {}
  const progress = totalControls > 0 ? Math.round((approved / totalControls) * 100) : 0;

  const frequency = String(d.reportingFrequency || '').trim();
  const statusLabel = String(status || '').replace(/-/g,' ').replace(/\b\w/g, (c)=>c.toUpperCase());
  const subject = `${frequency || 'Progress'} Project Progress: ${name} – ${progress}%`;
  const base = (process.env.BASE_URL || '').replace(/\/$/, '');
  const projectInfo = `<ul>
    <li><strong>Project Code:</strong> ${code || '-'}</li>
    <li><strong>Project Name:</strong> ${name || '-'}</li>
    <li><strong>Client Name:</strong> ${clientName || '-'}</li>
    <li><strong>Project Status:</strong> ${statusLabel || '-'}</li>
    <li><strong>Progress Percentage:</strong> ${progress}% (${approved}/${totalControls} controls)</li>
  </ul>`;
  const assignmentHtml = teamLists.filter(t => (t.names||[]).length).map(t => `<li><strong>${t.role}:</strong> ${(t.names||[]).join(', ')}</li>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Project Progress Update</h2>${projectInfo}${assignmentHtml ? `<h3>Team Assignment</h3><ul>${assignmentHtml}</ul>` : ''}${base ? `<p><a href='${base}'>Open Application</a></p>` : ''}</div>`;
  const text = `Project Progress Update\n\nProject Code: ${code || '-'}\nProject Name: ${name || '-'}\nClient Name: ${clientName || '-'}\nProject Status: ${statusLabel || '-'}\nProgress Percentage: ${progress}% (${approved}/${totalControls})\n\nTeam Assignment:\n${teamLists.map(t=>`${t.role}: ${(t.names||[]).join(', ')}`).join('\n')}`;

  await transporter.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, bcc, subject, text, html });
}

async function processProgressDigestTick(now: Date) {
  if (!connectionString) return;
  try {
    const q = await pool.query(`SELECT id, code, name, client_name, status, data, created_at FROM projects WHERE COALESCE((data->>'emailNotifications')::boolean, false) = true`);
    for (const row of q.rows) {
      const data = row.data || {};
      const frequency = String(data.reportingFrequency || '').trim();
      const { key, due } = computePeriodKey(frequency, now);
      if (!due || !key) continue;
      try {
        const iq = await pool.query(`INSERT INTO project_digest_log(project_id, period_key, sent_at) VALUES ($1,$2,now()) ON CONFLICT (project_id, period_key) DO NOTHING`, [row.id, key]);
        if (iq.rowCount && iq.rowCount > 0) {
          await sendProgressDigestForProject(row);
        }
      } catch (e) {
        // ignore duplicate errors
      }
    }
  } catch (e) {
    console.error('progress digest failed', e);
  }
}

let digestTimer: NodeJS.Timeout | null = null;
export function initProjectProgressScheduler() {
  try {
    // Run on startup and then every 15 minutes
    const tick = () => processProgressDigestTick(new Date());
    tick();
    if (digestTimer) clearInterval(digestTimer);
    digestTimer = setInterval(tick, 15 * 60 * 1000);
  } catch (e) {
    console.error('initProjectProgressScheduler failed', e);
  }
}

export const deleteAllProjects: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    await pool.query('TRUNCATE TABLE projects');
    res.status(204).send();
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'db_error' });
  }
};

// Comments
export const addComment: RequestHandler = (req, res) => {
  const { projectId, checklistItemId } = req.params;
  const { content, type, author } = req.body;
  
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  const checklistItem = project.checklist.find(item => item.id === checklistItemId);
  if (!checklistItem) {
    return res.status(404).json({ error: "Checklist item not found" });
  }
  
  const newComment: Comment = {
    id: Date.now().toString(),
    author,
    content,
    type: type || 'note',
    timestamp: new Date().toISOString()
  };
  
  checklistItem.comments.push(newComment);
  res.status(201).json(newComment);
};
