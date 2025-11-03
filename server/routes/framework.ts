import pg from "pg";
import type { RequestHandler } from 'express';
import ExcelJS from 'exceljs';
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

const DEPARTMENTS = ["Finance", "Operations", "HR", "IT", "Procurement", "Sales", "Legal", "Compliance", "Internal Audit", "Others"];
const RISK_CATEGORIES = ["Operational", "Financial", "Compliance", "Strategic"];
const CONTROL_TYPES = ["Preventive", "Detective", "Corrective", "Compensating"];

export const getFrameworkTree: RequestHandler = async (_req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const q = await pool.query("SELECT id, type, name, parent_id, details FROM framework_nodes ORDER BY created_at, id");
    const nodes = q.rows.map((r: any) => ({ id: r.id, type: r.type, name: r.name, parentId: r.parent_id || undefined }));
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

function normalizeString(v: any): string { return (v != null ? String(v) : '').trim(); }
function toArray(v: any): string[] { if (!v) return []; if (Array.isArray(v)) return v.map(x=>String(x)); const s = String(v).trim(); if (!s) return []; return s.split(/,|;|\|\//).map(x=>x.trim()).filter(Boolean); }

export const downloadFrameworkTemplate: RequestHandler = async (_req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Framework Module';

    const listWs = wb.addWorksheet('Lists');
    listWs.state = 'hidden';
    listWs.getColumn(1).values = ["Departments", ...DEPARTMENTS];
    listWs.getColumn(2).values = ["Risk Categories", ...RISK_CATEGORIES];
    listWs.getColumn(3).values = ["Control Types", ...CONTROL_TYPES];
    wb.definedNames.add('Departments', 'Lists!$A$2:$A$' + (DEPARTMENTS.length + 1));
    wb.definedNames.add('RiskCategories', 'Lists!$B$2:$B$' + (RISK_CATEGORIES.length + 1));
    wb.definedNames.add('ControlTypes', 'Lists!$C$2:$C$' + (CONTROL_TYPES.length + 1));

    const headers = [
      'Process','Process Description','Departments Involved (Process level)',
      'Subprocess','Subprocess Description','Departments Involved (Subprocess level)',
      'Activity','Activity Description','Departments Involved (Activity level)',
      'Risk','Risk Description','Risk Category','Control','Control Type','Reference'
    ];
    const ws = wb.addWorksheet('Framework', { views:[{ state:'frozen', ySplit:1 }] });
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.columns = headers.map(h => ({ header: h, width: Math.max(18, Math.min(40, h.length + 6)) }));

    for (let r = 2; r <= 1000; r++) {
      const listOpts:any = { type: 'list', allowBlank: true, showErrorMessage: false };
      ws.getCell(`C${r}`).dataValidation = { ...listOpts, formulae: ['=Departments'] } as any;
      ws.getCell(`F${r}`).dataValidation = { ...listOpts, formulae: ['=Departments'] } as any;
      ws.getCell(`I${r}`).dataValidation = { ...listOpts, formulae: ['=Departments'] } as any;
      ws.getCell(`L${r}`).dataValidation = { ...listOpts, formulae: ['=RiskCategories'] } as any;
      ws.getCell(`N${r}`).dataValidation = { ...listOpts, formulae: ['=ControlTypes'] } as any;
    }

    const inst = wb.addWorksheet('Instructions');
    const lines = [
      'Instructions',
      '',
      'Use the Framework sheet to enter data. The hierarchy is Process → Subprocess → Activity → Risk → Control.',
      'Columns:',
      'Process (required) – Name of the business process',
      'Process Description (optional) – Description for the process',
      'Departments Involved (Process level) – select from dropdown; multi-select by typing comma-separated values',
      'Subprocess (optional) – Name of subprocess under the process',
      'Subprocess Description (optional)',
      'Departments Involved (Subprocess level) – dropdown (comma-separated allowed)',
      'Activity (optional) – Activity under the subprocess',
      'Activity Description (optional)',
      'Departments Involved (Activity level) – dropdown (comma-separated allowed)',
      'Risk (optional) – Risk under activity',
      'Risk Description (optional)',
      'Risk Category – dropdown',
      'Control (optional) – Control under risk',
      'Control Type – dropdown',
      'Reference – free text reference or owner',
      '',
      'Only the Framework sheet is read on import. The Instructions sheet is ignored.'
    ];
    lines.forEach((t, i) => { const row = inst.addRow([t]); if (i===0) row.font = { bold: true, size: 14 }; });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="framework-template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'template_error' });
  }
};

export const importFrameworkRows: RequestHandler = async (req, res) => {
  if (!connectionString) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const body = (req as any).body || {};
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'no_rows' });

  const required = ['Process'];
  const missingCols: string[] = [];
  const sample = rows[0] || {};
  for (const key of required) if (!(key in sample) && !Object.keys(sample).some(k => k.toLowerCase().includes(key.toLowerCase()))) missingCols.push(key);
  if (missingCols.length) return res.status(400).json({ error: 'missing_columns', columns: missingCols });

  try {
    const q = await pool.query('SELECT id, type, name, parent_id, details FROM framework_nodes');
    const nodes: { id:string; type:string; name:string; parent_id:string|null; details:any }[] = q.rows.map((r:any)=>({ id:r.id, type:r.type, name:r.name, parent_id:r.parent_id||null, details:r.details||{} }));

    const byKey = new Map<string, any>();
    const childrenByParent = new Map<string, any[]>();
    for (const n of nodes) {
      const key = `${n.type}|${n.parent_id||''}|${n.name.toLowerCase()}`;
      byKey.set(key, n);
      const arr = childrenByParent.get(n.parent_id||'') || [];
      arr.push(n);
      childrenByParent.set(n.parent_id||'', arr);
    }

    const nextProcessId = (): string => {
      const procs = (childrenByParent.get('') || []).filter(n => n.type === 'process');
      let max = 0;
      for (const p of procs) { const m = String(p.id).match(/^P(\d+)$/); const n = m ? parseInt(m[1], 10) : 0; max = Math.max(max, n); }
      return `P${max + 1}`;
    };
    const nextSubId = (procId: string): string => {
      const subs = (childrenByParent.get(procId) || []).filter(n => n.type === 'subprocess');
      let max = 0; for (const s of subs) { const m = String(s.id).match(/^P\d+\.(\d+)$/); const n = m ? parseInt(m[1], 10) : 0; max = Math.max(max, n); }
      return `${procId}.${max + 1}`;
    };
    const nextActId = (subId: string): string => {
      const acts = (childrenByParent.get(subId) || []).filter(n => n.type === 'activity');
      let max = 0; for (const a of acts) { const m = String(a.id).match(/^P\d+\.\d+\.(\d+)$/); const n = m ? parseInt(m[1], 10) : 0; max = Math.max(max, n); }
      return `${subId}.${max + 1}`;
    };
    const nextRiskId = (actId: string): string => {
      const risks = (childrenByParent.get(actId) || []).filter(n => n.type === 'risk');
      let max = 0; for (const r of risks) { const m = String(r.id).match(/\/R(\d+)$/); const n = m ? parseInt(m[1], 10) : 0; max = Math.max(max, n); }
      return `${actId}/R${max + 1}`;
    };
    const nextCtrlId = (riskId: string): string => {
      const ctrls = (childrenByParent.get(riskId) || []).filter(n => n.type === 'control');
      let max = 0; for (const c of ctrls) { const m = String(c.id).match(/\/C(\d+)$/); const n = m ? parseInt(m[1], 10) : 0; max = Math.max(max, n); }
      return `${riskId}/C${max + 1}`;
    };

    const createDefaultDetails = (node: { id:string; type:string; name:string; parentId?:string|null; }) => {
      if (node.type === 'process') return { type:'process', process_id: node.id, process_name: node.name, process_description: '', departments_involved: [] };
      if (node.type === 'subprocess') return { type:'subprocess', sub_process_id: node.id, sub_process_name: node.name, sub_process_description: '', linked_process_id: node.parentId || '', departments_involved: [] };
      if (node.type === 'activity') return { type:'activity', activity_id: node.id, activity_name: node.name, activity_description: '', linked_process_id: '', linked_sub_process_id: node.parentId || '', departments_involved: [] };
      if (node.type === 'risk') return { type:'risk', risk_id: node.id, risk_name: node.name, risk_description: '', risk_category: 'Operational', inherent_risk_score: 0, departments_involved: [] };
      return { type:'control', control_id: node.id, control_description: node.name, control_type: 'Preventive', control_frequency: 'Monthly', control_owner: '', control_effectiveness_score: 0, departments_involved: [] };
    };

    const ensureNode = async (type: string, name: string, parentId: string | null) => {
      const key = `${type}|${parentId||''}|${name.toLowerCase()}`;
      let cur = byKey.get(key);
      if (cur) return cur;
      let id = '';
      if (type === 'process') id = nextProcessId();
      else if (type === 'subprocess') id = nextSubId(parentId!);
      else if (type === 'activity') id = nextActId(parentId!);
      else if (type === 'risk') id = nextRiskId(parentId!);
      else id = nextCtrlId(parentId!);
      const details = createDefaultDetails({ id, type, name, parentId });
      await pool.query('INSERT INTO framework_nodes(id, type, name, parent_id, details, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,now(),now())', [id, type, name, parentId, details]);
      cur = { id, type, name, parent_id: parentId, details };
      byKey.set(key, cur);
      const arr = childrenByParent.get(parentId||'') || []; arr.push(cur); childrenByParent.set(parentId||'', arr);
      return cur;
    };

    const mergeDetails = (existing: any, patch: any) => {
      const out = { ...(existing || {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (Array.isArray(v)) {
          const next = Array.from(new Set([...(Array.isArray((out as any)[k]) ? (out as any)[k] as any[] : []), ...v]));
          (out as any)[k] = next;
        } else if (v != null && String(v).trim() !== '') {
          (out as any)[k] = v;
        }
      }
      return out;
    };

    const getVal = (row:any, keys:string[]): string => {
      for (const k of keys) { const v = row[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); }
      const lc = Object.keys(row).reduce((m:any, k)=>{ m[k.toLowerCase()] = row[k]; return m; }, {} as any);
      for (const k of keys) { const v = lc[k.toLowerCase()]; if (v != null && String(v).trim() !== '') return String(v).trim(); }
      return '';
    };

    let rowNum = 1;
    const result: { created:number; updated:number; errors:{row:number; error:string}[] } = { created: 0, updated: 0, errors: [] };

    for (const row of rows) {
      rowNum++;
      try {
        const processName = normalizeString(getVal(row, ['Process']));
        const processDesc = normalizeString(getVal(row, ['Process Description']));
        const procDeps = toArray(getVal(row, ['Departments Involved (Process level)','Departments Involved']));
        const subName = normalizeString(getVal(row, ['Subprocess','Sub process','Sub Process']));
        const subDesc = normalizeString(getVal(row, ['Subprocess Description','Sub process Description']));
        const subDeps = toArray(getVal(row, ['Departments Involved (Subprocess level)']));
        const actName = normalizeString(getVal(row, ['Activity']));
        const actDesc = normalizeString(getVal(row, ['Activity Description']));
        const actDeps = toArray(getVal(row, ['Departments Involved (Activity level)']));
        const riskName = normalizeString(getVal(row, ['Risk']));
        const riskDesc = normalizeString(getVal(row, ['Risk Description']));
        const riskCat = normalizeString(getVal(row, ['Risk Category','Category']));
        const ctrlName = normalizeString(getVal(row, ['Control']));
        const ctrlType = normalizeString(getVal(row, ['Control Type']));
        const reference = normalizeString(getVal(row, ['Reference']));

        if (!processName) continue;

        const proc = await ensureNode('process', processName, null);
        if (processDesc || procDeps.length) {
          const patch = { process_name: processName, process_description: processDesc, departments_involved: procDeps.filter(Boolean) };
          const next = mergeDetails(proc.details, patch);
          if (JSON.stringify(next) !== JSON.stringify(proc.details)) {
            await pool.query('UPDATE framework_nodes SET details=$2, updated_at=now() WHERE id=$1', [proc.id, next]);
            proc.details = next;
          }
        }

        let sub: any = null;
        if (subName) {
          sub = await ensureNode('subprocess', subName, proc.id);
          const patch = { sub_process_name: subName, sub_process_description: subDesc, linked_process_id: proc.id, departments_involved: subDeps.filter(Boolean) };
          const next = mergeDetails(sub.details, patch);
          if (JSON.stringify(next) !== JSON.stringify(sub.details)) {
            await pool.query('UPDATE framework_nodes SET details=$2, updated_at=now() WHERE id=$1', [sub.id, next]);
            sub.details = next;
          }
        }

        let act: any = null;
        if (actName) {
          if (!sub) {
            sub = await ensureNode('subprocess', 'General', proc.id);
          }
          act = await ensureNode('activity', actName, sub.id);
          const patch = { activity_name: actName, activity_description: actDesc, linked_process_id: proc.id, linked_sub_process_id: sub.id, departments_involved: actDeps.filter(Boolean) };
          const next = mergeDetails(act.details, patch);
          if (JSON.stringify(next) !== JSON.stringify(act.details)) {
            await pool.query('UPDATE framework_nodes SET details=$2, updated_at=now() WHERE id=$1', [act.id, next]);
            act.details = next;
          }
        }

        let risk: any = null;
        if (riskName) {
          if (!act) {
            if (!sub) sub = await ensureNode('subprocess', 'General', proc.id);
            act = await ensureNode('activity', 'General', sub.id);
          }
          risk = await ensureNode('risk', riskName, act.id);
          const rcat = RISK_CATEGORIES.includes(riskCat) ? riskCat : (riskCat || 'Operational');
          const patch = { risk_name: riskName, risk_description: riskDesc, risk_category: rcat };
          const next = mergeDetails(risk.details, patch);
          if (JSON.stringify(next) !== JSON.stringify(risk.details)) {
            await pool.query('UPDATE framework_nodes SET details=$2, updated_at=now() WHERE id=$1', [risk.id, next]);
            risk.details = next;
          }
        }

        if (ctrlName || ctrlType || reference) {
          if (!risk) {
            if (!act) {
              if (!sub) sub = await ensureNode('subprocess', 'General', proc.id);
              act = await ensureNode('activity', 'General', sub.id);
            }
            risk = await ensureNode('risk', 'General', act.id);
          }
          const ctrl = await ensureNode('control', ctrlName || 'Control', risk.id);
          const ctype = CONTROL_TYPES.includes(ctrlType) ? ctrlType : (ctrlType || 'Preventive');
          const patch = { control_description: ctrlName || 'Control', control_type: ctype, control_owner: reference };
          const next = mergeDetails(ctrl.details, patch);
          if (JSON.stringify(next) !== JSON.stringify(ctrl.details)) {
            await pool.query('UPDATE framework_nodes SET details=$2, updated_at=now() WHERE id=$1', [ctrl.id, next]);
            ctrl.details = next;
          }
        }
      } catch (e:any) {
        result.errors.push({ row: rowNum, error: e?.message || 'row_error' });
      }
    }

    res.json(result);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'import_error' });
  }
};
