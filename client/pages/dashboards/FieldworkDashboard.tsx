import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FileText, Save, CheckCircle2, XCircle, Share2, Search, Rows3, Columns2, Download } from 'lucide-react';
import { FieldworkRecord } from '@shared/fieldwork';
import { FieldworkStore } from '@/contexts/FieldworkStore';
import { RiskConfigStore } from '@/contexts/RiskConfigStore';
import * as XLSX from 'xlsx';
import { AssignmentTypeStore } from '@/contexts/AssignmentTypeStore';
import { computeResidual, computeRiskScore, resolveLevel } from '@shared/risk';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';

interface ControlRow {
  id: string;
  name: string;
  process?: string;
  subprocess?: string;
  activity?: string;
  risk?: string;
}


const FRAMEWORK_DATA_URL = 'https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c';

const lookup = (row: any, keys: string[]) => {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const Typeahead = ({ items, value, onSelect, placeholder, disabled }: { items: string[]; value: string | null; onSelect: (val: string) => void; placeholder?: string; disabled?: boolean }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.toLowerCase().includes(q));
  }, [items, query]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between" disabled={disabled}>
          <span className="truncate">{value || query || (placeholder || 'Select')}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] p-0 w-[var(--radix-popper-anchor-width)]" style={{ width: 'var(--radix-popper-anchor-width)' }}>
        <Command>
          <CommandInput placeholder={placeholder || 'Search...'} value={query} onValueChange={(v)=>setQuery(v || '')} />
          <CommandEmpty>No match.</CommandEmpty>
          <CommandList className="max-h-72 overflow-y-auto">
            <CommandGroup>
              {filtered.map(it => (
                <CommandItem key={it} value={`${it}`} onSelect={() => { onSelect(it); setQuery(''); setOpen(false); }}>
                  {it}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const SelectOrInput = ({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder: string }) => {
  if (options && options.length > 0) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${placeholder}`} />
        </SelectTrigger>
        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return <Input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={`Enter ${placeholder}`} />;
};

export default function FieldworkDashboard() {
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [matrixRows, setMatrixRows] = useState<{ id: string; activity: string; risk: string; control: string; controlOwner: string; likelihood: number; consequence: number; riskScore: number; controlScore: number; residualRisk: number; riskLevel: string; residualLevel: string; testOfControl: string; substantiveProcedure: string; samplingApplicable: string; samplingMethodology: string; controlEffectiveness: string; attachments: string; auditRemarks: string; observationRanking: string; auditObservation: string; effect: string; recommendation: string; annexure: string; redFlag: string; reportable: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, FieldworkRecord>>({});
  const [statusFilter, setStatusFilter] = useState<'All' | 'In progress' | 'Approved' | 'Rejected'>('All');
  const [openFW, setOpenFW] = useState(false);
  const [submitAckOpen, setSubmitAckOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const getResidualLevel = (val: number, thresholds: any): { level: string; color?: string } | undefined => {
    const ranges = Array.isArray(thresholds?.ranges) ? [...thresholds.ranges] : [];
    if (ranges.length === 0) return undefined;
    ranges.sort((a:any,b:any)=> (a.from??0)-(b.from??0));
    if (val <= 0) {
      const first = ranges[0];
      return { level: first?.label || 'Low', color: first?.color || thresholds?.heatmapColors?.[first?.label] || '#10B981' };
    }
    const min = ranges[0].from;
    const max = ranges[ranges.length-1].to;
    const v = Math.min(max, Math.max(min, val));
    for (const r of ranges) {
      if (v >= r.from && v <= r.to) return { level: r.label, color: r.color || thresholds?.heatmapColors?.[r.label] };
    }
    const last = ranges[ranges.length-1];
    return { level: last?.label, color: last?.color || thresholds?.heatmapColors?.[last?.label] };
  };

  const [riskConfigVersion, setRiskConfigVersion] = useState(0);
  const [assignmentTypes, setAssignmentTypes] = useState<{id:string;name:string}[]>([]);
  useEffect(() => {
    const unsub = FieldworkStore.subscribe(() => setRecords(FieldworkStore.getAll()));
    const unsubRisk = RiskConfigStore.subscribe(() => setRiskConfigVersion(v=>v+1));
    const unsubAssn = AssignmentTypeStore.subscribe(() => setAssignmentTypes(AssignmentTypeStore.getAll()));
    setRecords(FieldworkStore.getAll());
    setAssignmentTypes(AssignmentTypeStore.getAll());
    return () => { unsub(); unsubRisk(); unsubAssn(); };
  }, []);

  useEffect(() => {
    if (controls.length) return;
    const normalizeRows = (data: any): any[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if ((data as any).Sheet1 && Array.isArray((data as any).Sheet1)) return (data as any).Sheet1;
      if ((data as any).sheets && typeof (data as any).sheets === 'object') {
        const first = Object.values((data as any).sheets)[0] as any[];
        if (Array.isArray(first)) return first;
      }
      const keys = Object.keys(data);
      if (keys.length === 1 && Array.isArray((data as any)[keys[0]])) return (data as any)[keys[0]];
      return [];
    };
    (async () => {
      const controller = new AbortController();
      const signal = controller.signal;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(FRAMEWORK_DATA_URL, { signal });
        clearTimeout(timeout);
        if (!res.ok) {
          console.error('Failed to fetch framework data', res.status, res.statusText);
          return;
        }
        let json: any;
        try {
          json = await res.json();
        } catch (err) {
          console.error('Failed to parse framework data as JSON', err);
          return;
        }
        const rows = normalizeRows(json);
        if (!rows.length) return;
        const controlsList: ControlRow[] = [];
        const procIndex = new Map<string, string>();
        const subIndex = new Map<string, string>();
        const actIndex = new Map<string, string>();
        const riskCounts = new Map<string, number>();
        const ctrlCounts = new Map<string, number>();
        const get = (row: any, keys: string[]) => { for (const k of keys) { const v = row[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); } return ''; };
        const getNext = {
          proc: () => `P${procIndex.size + 1}`,
          sub: (p: string) => `${p}.${Array.from(subIndex.values()).filter(id=>id.startsWith(p + '.')).length + 1}`,
          act: (s: string) => `${s}.${Array.from(actIndex.values()).filter(id=>id.startsWith(s + '.')).length + 1}`,
          risk: (a: string) => { const c = (riskCounts.get(a) || 0) + 1; riskCounts.set(a, c); return `${a}/R${c}`; },
          ctrl: (r: string) => { const c = (ctrlCounts.get(r) || 0) + 1; ctrlCounts.set(r, c); return `${r}/C${c}`; },
        };
        for (const row of rows) {
          const processName = get(row, ['Process','process','PROCESS']);
          const subName = get(row, ['Sub Process','SubProcess','subprocess']);
          const activityName = get(row, ['Activity','activity']);
          const riskDesc = get(row, ['Identification of Risk of Material Misstatement (What could go wrong?) Risk Description','Risk Description','Risk','risk']);
          const controlDesc = get(row, ['Controls in Place','Control','Control Description']);
          if (!processName) continue;
          let procId = procIndex.get(processName);
          if (!procId) { procId = getNext.proc(); procIndex.set(processName, procId); }
          let subId = '';
          if (subName) { const key = procId + '|' + subName; subId = subIndex.get(key) || ''; if (!subId) { subId = getNext.sub(procId); subIndex.set(key, subId); } }
          let actId = '';
          if (activityName) { const key = (subId || procId) + '|' + activityName; actId = actIndex.get(key) || ''; if (!actId) { const parent = subId || getNext.sub(procId); if (!subId) { subId = parent; } actId = getNext.act(subId); actIndex.set(key, actId); } }
          let riskId = '';
          if (riskDesc) { const parentAct = actId || (()=>{ if (!subId) { subId = getNext.sub(procId); } return getNext.act(subId); })(); riskId = getNext.risk(parentAct); }
          if (riskId && controlDesc) {
            const ctrlId = getNext.ctrl(riskId);
            controlsList.push({ id: ctrlId, name: controlDesc || 'Control', process: processName, subprocess: subName || 'General', activity: activityName || 'General', risk: riskDesc });
          }
        }
        setControls(controlsList);
      } catch (err: any) {
        if (err && err.name === 'AbortError') {
          console.warn('Framework data fetch aborted (timeout)');
        } else {
          console.error('Error fetching framework data', err);
        }
      } finally {
        clearTimeout(timeout);
      }
    })();
  }, [controls.length]);

  const processes = useMemo(() => Array.from(new Set(controls.map(c => c.process).filter(Boolean) as string[])).sort(), [controls]);
  const getActivities = useCallback((proc: string | null) => {
    if (!proc) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc).map(c => c.activity || 'General'))).sort();
  }, [controls]);
  const getRisks = useCallback((proc: string | null, act: string) => {
    if (!proc || !act) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc && (c.activity || 'General') === act).map(c => c.risk || ''))).filter(Boolean).sort();
  }, [controls]);
  const getControls = useCallback((proc: string | null, act: string, risk: string) => {
    if (!proc || !act || !risk) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc && (c.activity || 'General') === act && (c.risk || '') === risk).map(c => c.name))).sort();
  }, [controls]);


  // Projects (loaded from API)
  const [projects, setProjects] = useState<{ id: string; title: string; raw?: any }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('load_failed');
        const rows = await res.json();
        const mapped = (rows || []).map((r: any) => ({
          id: r.id,
          title: r.name || r.data?.projectName || r.data?.project_name || r.code || r.data?.title || 'Untitled Project',
          raw: r
        }));
        setProjects(mapped);
      } catch (e) {
        console.error('Failed to load projects', e);
      }
    })();
  }, []);

  const riskDisabled = useMemo(() => {
    if (!selectedProject) return false;
    const proj = projects.find(p => p.id === selectedProject);
    return proj?.raw?.data?.riskModuleEnabled === false;
  }, [selectedProject, projects]);

  const projectStatus = useMemo(() => {
    if (!selectedProject) return '';
    const proj = projects.find(p => p.id === selectedProject);
    return String(proj?.raw?.status || '').toLowerCase();
  }, [selectedProject, projects]);
  const projectLocked = projectStatus === 'completed' || projectStatus === 'hold';

  const processesForSelectedProject = useMemo(() => {
    if (!selectedProject) return [] as string[];
    const proj = projects.find(p => p.id === selectedProject);
    if (!proj) return [] as string[];
    const data = proj.raw?.data || {};
    let procs: string[] = [];
    if (data && typeof data.selectedChecklistTree === 'object' && Object.keys(data.selectedChecklistTree || {}).length) {
      procs = Object.keys(data.selectedChecklistTree || {});
    } else if (Array.isArray(data.checklistTemplate) && data.checklistTemplate.length) {
      procs = data.checklistTemplate.slice();
    } else if (Array.isArray(data.processes) && data.processes.length) {
      procs = data.processes.slice();
    } else if (Array.isArray(proj.raw?.data?.processes) && proj.raw.data.processes.length) {
      procs = proj.raw.data.processes.slice();
    }
    if (!procs.length) {
      procs = processes;
    }
    return Array.from(new Set(procs.filter(Boolean))).sort();
  }, [selectedProject, projects, processes]);

  const activeCfg = React.useMemo(() => {
    if (!selectedProject) return RiskConfigStore.getGlobal();
    const proj = projects.find(p => p.id === selectedProject);
    const data = proj?.raw?.data || {};
    const auditTypeName = data.auditType;
    const assn = assignmentTypes.find(a => a.name === auditTypeName);
    const central = RiskConfigStore.get('assignment') || RiskConfigStore.getGlobal();
    const map = (central.scope as any)?.assignmentMap || {};
    const mode = assn ? map[assn.id]?.mode : undefined;
    if (mode === 'project' && data.riskConfig) return data.riskConfig;
    if (mode === 'assignment' && assn) return RiskConfigStore.get(`assignment|${assn.id}`) || RiskConfigStore.getGlobal();
    return RiskConfigStore.getGlobal();
  }, [selectedProject, projects, assignmentTypes, riskConfigVersion]);

  useEffect(() => {
    if (!selectedProject) { setMatrixRows([]); return; }
    const proj = projects.find(p => p.id === selectedProject);
    const tree = proj?.raw?.data?.selectedChecklistTree;
    const rcfg = activeCfg;
    const mkId = (parts: string[]) => 'fw|' + parts.map(s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g,'').slice(0,64)).join('|');
    if (tree && typeof tree === 'object' && Object.keys(tree).length) {
      const rows: any[] = [];
      for (const [procName, procNode] of Object.entries<any>(tree)) {
        const subs = procNode?.subprocesses || {};
        for (const [subName, subNode] of Object.entries<any>(subs)) {
          const acts = subNode?.activities || {};
          for (const [actName, actNode] of Object.entries<any>(acts)) {
            const risks = actNode?.risks || {};
            for (const [riskName, riskNode] of Object.entries<any>(risks)) {
              const ctrls: string[] = Array.isArray((riskNode as any).controls) ? (riskNode as any).controls : [];
              ctrls.forEach((ctrl, idx) => {
                const id = mkId([procName, subName, actName, riskName, String(idx+1)]);
                const row: any = { id, activity: actName || '', risk: riskName || '', control: ctrl || '', controlOwner: '', likelihood: rcfg.riskScore.likelihood?.scale.min || 1, consequence: rcfg.riskScore.consequence?.scale.min || 1, riskScore: rcfg.riskScore.mode === 'single' ? rcfg.riskScore.scale.min : 0, controlScore: rcfg.controlScore.scale.min, residualRisk: 0, riskLevel: '', residualLevel: '', testOfControl: '', substantiveProcedure: '', samplingApplicable: '', samplingMethodology: '', controlEffectiveness: '', attachments: '', auditRemarks: '', observationRanking: '', auditObservation: '', effect: '', recommendation: '', annexure: '', redFlag: '', reportable: '' };
                row.department = procName || '';
                row.process = procName || '';
                row.subprocess = subName || '';
                rows.push(row);
              });
            }
          }
        }
      }
      rows.sort((a,b)=> (a.activity||'').localeCompare(b.activity||'') || (a.risk||'').localeCompare(b.risk||'') || (a.control||'').localeCompare(b.control||''));
      const merged = rows.map(r => {
        const rec = records[selectedProject ? `${selectedProject}|${r.id}` : r.id];
        if (!rec) return r;
        if (selectedProject && rec.projectId && rec.projectId !== selectedProject) return r;
        const a: any = (rec as any).arc || {};
        const rr = rec.risk || undefined;
        return {
          ...r,
          controlOwner: a.controlOwner || r.controlOwner,
          testOfControl: a.testOfControl || r.testOfControl,
          substantiveProcedure: a.substantiveProcedure || r.substantiveProcedure,
          samplingApplicable: (a.samplingApplicable as any) || r.samplingApplicable,
          samplingMethodology: a.samplingMethodology || r.samplingMethodology,
          controlEffectiveness: (a.controlEffective as any) || r.controlEffectiveness,
          attachments: a.attachments || r.attachments,
          auditRemarks: a.auditRemarks || r.auditRemarks,
          redFlag: (a.redFlag as any) || r.redFlag,
          reportable: (a.reportable as any) || r.reportable,
          observationRanking: a.observationRanking || r.observationRanking,
          auditObservation: a.auditObservation || r.auditObservation,
          effect: a.effect || r.effect,
          recommendation: a.recommendation || r.recommendation,
          annexure: a.annexure || r.annexure,
          ...(rr ? {
            likelihood: typeof rr.likelihood === 'number' ? rr.likelihood : r.likelihood,
            consequence: typeof rr.consequence === 'number' ? rr.consequence : r.consequence,
            riskScore: typeof rr.riskScore === 'number' ? rr.riskScore : r.riskScore,
            controlScore: typeof rr.controlScore === 'number' ? rr.controlScore : r.controlScore
          } : {})
        };
      });
      setMatrixRows(merged);
      return;
    }
    const allowed = new Set(processesForSelectedProject);
    if (allowed.size === 0) { setMatrixRows([]); return; }
    const rows = controls
      .filter(c => allowed.has(c.process || ''))
      .map(c => { const row: any = { id: c.id, activity: c.activity || '', risk: c.risk || '', control: c.name, controlOwner: '', likelihood: rcfg.riskScore.likelihood?.scale.min || 1, consequence: rcfg.riskScore.consequence?.scale.min || 1, riskScore: rcfg.riskScore.mode === 'single' ? rcfg.riskScore.scale.min : 0, controlScore: rcfg.controlScore.scale.min, residualRisk: 0, riskLevel: '', residualLevel: '', testOfControl: '', substantiveProcedure: '', samplingApplicable: '', samplingMethodology: '', controlEffectiveness: '', attachments: '', auditRemarks: '', observationRanking: '', auditObservation: '', effect: '', recommendation: '', annexure: '', redFlag: '', reportable: '' }; row.department = c.process || ''; row.process = c.process || ''; row.subprocess = c.subprocess || ''; return row; })
      .sort((a,b)=>{
        return (a.activity.localeCompare(b.activity) || a.risk.localeCompare(b.risk) || a.control.localeCompare(b.control));
      });
    const merged = rows.map(r => {
      const rec = records[selectedProject ? `${selectedProject}|${r.id}` : r.id];
      if (!rec) return r;
      if (selectedProject && rec.projectId && rec.projectId !== selectedProject) return r;
      const a: any = (rec as any).arc || {};
      const rr = rec.risk || undefined;
      return {
        ...r,
        controlOwner: a.controlOwner || r.controlOwner,
        testOfControl: a.testOfControl || r.testOfControl,
        substantiveProcedure: a.substantiveProcedure || r.substantiveProcedure,
        samplingApplicable: (a.samplingApplicable as any) || r.samplingApplicable,
        samplingMethodology: a.samplingMethodology || r.samplingMethodology,
        controlEffectiveness: (a.controlEffective as any) || r.controlEffectiveness,
        attachments: a.attachments || r.attachments,
        auditRemarks: a.auditRemarks || r.auditRemarks,
        redFlag: (a.redFlag as any) || r.redFlag,
        reportable: (a.reportable as any) || r.reportable,
        observationRanking: a.observationRanking || r.observationRanking,
        auditObservation: a.auditObservation || r.auditObservation,
        effect: a.effect || r.effect,
        recommendation: a.recommendation || r.recommendation,
        annexure: a.annexure || r.annexure,
        ...(rr ? {
          likelihood: typeof rr.likelihood === 'number' ? rr.likelihood : r.likelihood,
          consequence: typeof rr.consequence === 'number' ? rr.consequence : r.consequence,
          riskScore: typeof rr.riskScore === 'number' ? rr.riskScore : r.riskScore,
          controlScore: typeof rr.controlScore === 'number' ? rr.controlScore : r.controlScore
        } : {})
      };
    });
    setMatrixRows(merged);
  }, [selectedProject, projects, processesForSelectedProject, controls, riskConfigVersion, activeCfg, records]);

  const testOfControlOptions = ['Observation','Inquiry','Re performance','Walkthrough','Inspection of documents'];
  const substantiveProcedureOptions = ['Vouching','Verification','Physical Verification','Recalculation','Confirmation','Analytical Procedures','Test Checking / Sampling','Cut-off Testing','Tracing','Casting & Cross-Casting','Documentary','Review'];
  const samplingMethodologyOptions = ['Random Sampling','Systematic Sampling','Stratified Sampling','Cluster Sampling','Monetary Unit Sampling (MUS)','Judgmental Sampling'];
  const controlEffectivenessOptions = ['Yes','No'];

  const getStatus = useCallback((id: string) => { const key = selectedProject ? `${selectedProject}|${id}` : id; return records[key]?.status || 'draft'; }, [records, selectedProject]);

  const rejectedCount = useMemo(() => Object.values(records).filter(r => r.status === 'rejected' && (!selectedProject || r.projectId === selectedProject)).length, [records, selectedProject]);

  const rejectedRows = useMemo(() => {
    const all = Object.values(records).filter(r => r.status === 'rejected' && (!selectedProject || r.projectId === selectedProject));
    return all.map(r => {
      const ctrl = controls.find(c => c.id === r.controlId);
      const a: any = (r as any).arc || {};
      const samplingApplicable = a.samplingApplicable || (r.methodology?.verification ? (r.methodology.verification === 'Sampling' ? 'Yes' : 'No') : '');
      const controlEffective = a.controlEffective || (r.effectiveness?.effectiveness === 'Effective' ? 'Yes' : r.effectiveness?.effectiveness === 'Ineffective' ? 'No' : '');
      return {
        id: r.controlId,
        activity: a.activity || ctrl?.activity || '',
        risk: a.risk || ctrl?.risk || '',
        control: a.control || ctrl?.name || '',
        testOfControl: a.testOfControl || (r.methodology?.methodType === 'Test of Control' ? r.methodology.procedure : ''),
        substantiveProcedure: a.substantiveProcedure || (r.methodology?.methodType === 'Substantive Procedure' ? r.methodology.procedure : ''),
        samplingApplicable,
        samplingMethodology: a.samplingMethodology || r.methodology?.samplingMethod || '',
        controlEffectiveness: controlEffective,
        attachments: a.attachments || '',
        auditRemarks: a.auditRemarks || r.remarks.auditRemarks || '',
        redFlag: a.redFlag || '',
        reportable: a.reportable || '',
        observationRanking: a.observationRanking || r.report.observationRanking || '',
        auditObservation: a.auditObservation || r.report.observation || '',
        effect: a.effect || r.report.riskEffect || '',
        recommendation: a.recommendation || r.report.recommendation || '',
        controlOwner: a.controlOwner || '',
        annexure: a.annexure || r.report.annexure || '',
      };
    }).sort((a,b) => (a.activity||'').localeCompare(b.activity||'') || (a.risk||'').localeCompare(b.risk||'') || (a.control||'').localeCompare(b.control||''));
  }, [records, controls]);

  const approvedRows = useMemo(() => {
    const all = Object.values(records).filter(r => r.status === 'approved' && (!selectedProject || r.projectId === selectedProject));
    return all.map(r => {
      const ctrl = controls.find(c => c.id === r.controlId);
      const a: any = (r as any).arc || {};
      const samplingApplicable = a.samplingApplicable || (r.methodology?.verification ? (r.methodology.verification === 'Sampling' ? 'Yes' : 'No') : '');
      const controlEffective = a.controlEffective || (r.effectiveness?.effectiveness === 'Effective' ? 'Yes' : r.effectiveness?.effectiveness === 'Ineffective' ? 'No' : '');
      return {
        id: r.controlId,
        activity: a.activity || ctrl?.activity || '',
        risk: a.risk || ctrl?.risk || '',
        control: a.control || ctrl?.name || '',
        testOfControl: a.testOfControl || (r.methodology?.methodType === 'Test of Control' ? r.methodology.procedure : ''),
        substantiveProcedure: a.substantiveProcedure || (r.methodology?.methodType === 'Substantive Procedure' ? r.methodology.procedure : ''),
        samplingApplicable,
        samplingMethodology: a.samplingMethodology || r.methodology?.samplingMethod || '',
        controlEffectiveness: controlEffective,
        attachments: a.attachments || '',
        auditRemarks: a.auditRemarks || r.remarks.auditRemarks || '',
        redFlag: a.redFlag || '',
        reportable: a.reportable || '',
        observationRanking: a.observationRanking || r.report.observationRanking || '',
        auditObservation: a.auditObservation || r.report.observation || '',
        effect: a.effect || r.report.riskEffect || '',
        recommendation: a.recommendation || r.report.recommendation || '',
        controlOwner: a.controlOwner || '',
        annexure: a.annexure || r.report.annexure || '',
      };
    }).sort((a,b) => (a.activity||'').localeCompare(b.activity||'') || (a.risk||'').localeCompare(b.risk||'') || (a.control||'').localeCompare(b.control||''));
  }, [records, controls]);

  const displayedRows = useMemo(() => {
    if (statusFilter === 'Rejected') return rejectedRows;
    if (statusFilter === 'Approved') return approvedRows;
    return matrixRows.filter(r => {
      if (submittedIds.has(r.id)) return true;
      const s = getStatus(r.id);
      if (statusFilter === 'All') return true;
      if (statusFilter === 'In progress') return s !== 'approved' && s !== 'rejected';
      return true;
    });
  }, [matrixRows, statusFilter, getStatus, rejectedRows, approvedRows, submittedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = controls.filter(c => {
      const key = selectedProject ? `${selectedProject}|${c.id}` : c.id;
      const rec = records[key];
      const status = rec?.status || 'draft';
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Draft') return status === 'draft';
      if (statusFilter === 'Submitted') return status === 'submitted';
      if (statusFilter === 'Approved') return status === 'approved';
      if (statusFilter === 'Rejected') return status === 'rejected';
      return true;
    });
    if (!q) return list;
    return list.filter(c => [c.id, c.name, c.process, c.subprocess, c.activity, c.risk]
      .filter(Boolean)
      .map(s => String(s).toLowerCase())
      .some(s => s.includes(q))
    );
  }, [controls, search, records, statusFilter]);

  const openFieldworkFor = (id: string) => {
    const recId = selectedProject ? `${selectedProject}|${id}` : id;
    setSelectedControlId(recId);
    FieldworkStore.ensure(recId, () => ({
      controlId: id,
      projectId: selectedProject || undefined,
      status: 'draft',
      progress: 0,
      activeTab: 0,
      env: { alternativeControl: '', altControlCategory: '', responsibility: '', riskAssociated: '', controlNature: '' },
      methodology: { methodType: '', procedure: '', verification: '', samplingMethod: '', implementationConclusion: '' },
      effectiveness: { effectiveness: '', designConclusion: '', automated: '', rating: '' },
      remarks: { auditRemarks: '', reviewComments: '', revisedAuditRemarks: '', reviewStatus: '' },
      report: { observation: '', observationRanking: '', annexure: '', riskEffect: '', recommendation: '' }
    }));
    setRecords(FieldworkStore.getAll());
    setOpenFW(true);
  };

  const record = selectedControlId ? records[selectedControlId] : undefined;
  const setRecord = (patch: Partial<FieldworkRecord>) => {
    if (!selectedControlId) return;
    const cur = FieldworkStore.get(selectedControlId);
    if (!cur) return;
    FieldworkStore.upsert({ ...cur, ...patch });
    setRecords(FieldworkStore.getAll());
  };
  const updateTab = (tab: keyof FieldworkRecord, patch: any) => {
    if (!selectedControlId || !record) return;
    FieldworkStore.patchTab(selectedControlId, tab, patch);
    setRecords(FieldworkStore.getAll());
  };
  const completeCurrentTab = () => { if (!record) return; const idx = record.activeTab; if (record.progress < idx) setRecord({ progress: idx }); if (idx < 4) setRecord({ activeTab: idx + 1, progress: Math.max(record.progress, idx) }); };
  const submitForReview = () => {
    if (record && selectedControlId) {
      const existing = FieldworkStore.get(selectedControlId);
      const statusNow = existing?.status || 'draft';
      const revised = (existing?.remarks?.revisedAuditRemarks || record.remarks.revisedAuditRemarks || '').trim();
      const baseRemark = (existing?.remarks?.auditRemarks || record.remarks.auditRemarks || '').trim();
      const auditRemarkToSave = revised || baseRemark;
      if (statusNow === 'rejected' && auditRemarkToSave) {
        FieldworkStore.addAuditRemark(selectedControlId, (user?.username || 'User'), auditRemarkToSave);
        FieldworkStore.patchTab(selectedControlId, 'arc', { auditRemarks: auditRemarkToSave });
      }
      FieldworkStore.submitForReview(selectedControlId);
      setRecords(FieldworkStore.getAll());
      setSubmitAckOpen(true);
    }
  };
  const canOpenTab = (idx: number) => !record ? false : idx <= record.progress + 1;

  const [projDetailsOpen, setProjDetailsOpen] = useState(false);

  // Export toolbar state
  const fwAllFields = [
    'Activity','Risk','Control','Control Owner','Likelihood','Impact','Risk Score','Control Score','Residual Risk','Risk Level','Color','Test of control','Substantive procedure','Sampling applicability','Sampling Methodology','Control Effectiveness','Attachments','Audit Remarks','Red flag','Reportable','Observation Ranking','Audit Observation','Effect','Recommendation','Annexure'
  ] as const;
  const [fwSelectedFields, setFwSelectedFields] = useState<string[]>([...fwAllFields]);
  const fwGroupOptions = [
    { key: 'none', label: 'No grouping' },
    { key: 'Activity', label: 'Activity' },
    { key: 'Risk', label: 'Risk' },
    { key: 'Risk Score', label: 'Risk Score' },
    { key: 'Control Score', label: 'Control Score' },
    { key: 'Residual Risk', label: 'Residual Risk' },
    { key: 'Risk Level', label: 'Risk Level' },
    { key: 'Control Owner', label: 'Control Owner' },
    { key: 'Test of control', label: 'Test of control' },
    { key: 'Substantive procedure', label: 'Substantive procedure' },
    { key: 'Sampling applicability', label: 'Sampling applicability' },
    { key: 'Control Effectiveness', label: 'Control Effectiveness' },
    { key: 'Red flag', label: 'Red flag' },
    { key: 'Reportable', label: 'Reportable' },
    { key: 'Observation Ranking', label: 'Observation Ranking' },
  ];
  const [fwGroupBy, setFwGroupBy] = useState<string>('none');
  const [fwFilters, setFwFilters] = useState<{ activity: string; risk: string; controlOwner: string; riskLevel: string; testOfControl: string; substantiveProcedure: string; samplingApplicability: string; controlEffectiveness: string; redFlag: string; reportable: string; observationRanking: string; riskScoreMin?: number; riskScoreMax?: number; controlScoreMin?: number; controlScoreMax?: number; residualMin?: number; residualMax?: number }>({ activity: '', risk: '', controlOwner: '', riskLevel: '', testOfControl: '', substantiveProcedure: '', samplingApplicability: '', controlEffectiveness: '', redFlag: '', reportable: '', observationRanking: '' });

  const selectedProj = useMemo(() => projects.find(p => p.id === (selectedProject||''))?.raw, [projects, selectedProject]);
  const formatDate = (d: any) => { try { if (!d) return '-'; const dt = new Date(d); return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString(); } catch { return '-'; } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-7 w-7 text-orange-600" />
          Fieldwork Module
        </h1>
        <Badge className="bg-orange-100 text-orange-800">Fieldwork</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <Label>Project</Label>
          <Select value={selectedProject || ''} onValueChange={(v)=>{ const nv = v === '__CLEAR__' ? null : v; setSelectedProject(nv); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__CLEAR__">Clear</SelectItem>
              <SelectSeparator />
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button variant="outline" onClick={() => setProjDetailsOpen(true)} disabled={!selectedProject}>View details</Button>
        </div>
      </div>

      <div className="flex justify-between items-center gap-2">
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <span>Filter{statusFilter !== 'All' ? `: ${statusFilter}` : ''}</span>
              {rejectedCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs h-5 px-2">!</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <div className="grid gap-2">
              <div className="text-xs text-slate-500">Status</div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={statusFilter==='In progress'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('In progress'); setFilterOpen(false); }}>In progress</Button>
                <Button variant={statusFilter==='Approved'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('Approved'); setFilterOpen(false); }}>Approved</Button>
                <Button variant={statusFilter==='Rejected'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('Rejected'); setFilterOpen(false); }} className="justify-between">
                  <span>Rejected</span>
                  {rejectedCount > 0 && (<span className="inline-flex items-center gap-1 text-red-700"><span className="font-bold">!</span><span className="text-xs">{rejectedCount}</span></span>)}
                </Button>
                <Button variant={statusFilter==='All'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('All'); setFilterOpen(false); }}>Show all</Button>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              <div className="text-xs text-slate-500">Advanced</div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fwFilters.department} onValueChange={(v)=>setFwFilters(prev=>({...prev, department:v}))}>
                  <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {Array.from(new Set(matrixRows.map((r:any)=> (r as any).department || '').filter(Boolean))).sort().map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.activity} onValueChange={(v)=>setFwFilters(prev=>({...prev, activity:v}))}>
                  <SelectTrigger><SelectValue placeholder="Activity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {Array.from(new Set(matrixRows.map(r=> r.activity || '').filter(Boolean))).sort().map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.risk} onValueChange={(v)=>setFwFilters(prev=>({...prev, risk:v}))}>
                  <SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {Array.from(new Set(matrixRows.map(r=> r.risk || '').filter(Boolean))).sort().map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.controlOwner} onValueChange={(v)=>setFwFilters(prev=>({...prev, controlOwner:v}))}>
                  <SelectTrigger><SelectValue placeholder="Control Owner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {Array.from(new Set(matrixRows.map(r=> r.controlOwner || '').filter(Boolean))).sort().map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.testOfControl} onValueChange={(v)=>setFwFilters(prev=>({...prev, testOfControl:v}))}>
                  <SelectTrigger><SelectValue placeholder="Test of control" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {['Observation','Inquiry','Re performance','Walkthrough','Inspection of documents'].map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.substantiveProcedure} onValueChange={(v)=>setFwFilters(prev=>({...prev, substantiveProcedure:v}))}>
                  <SelectTrigger><SelectValue placeholder="Substantive procedure" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {['Vouching','Verification','Physical Verification','Recalculation','Confirmation','Analytical Procedures','Test Checking / Sampling','Cut-off Testing','Tracing','Casting & Cross-Casting','Documentary','Review'].map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.samplingApplicability} onValueChange={(v)=>setFwFilters(prev=>({...prev, samplingApplicability:v}))}>
                  <SelectTrigger><SelectValue placeholder="Sampling applicability" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fwFilters.controlEffectiveness} onValueChange={(v)=>setFwFilters(prev=>({...prev, controlEffectiveness:v}))}>
                  <SelectTrigger><SelectValue placeholder="Control Effectiveness" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {['Yes','No'].map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.redFlag} onValueChange={(v)=>setFwFilters(prev=>({...prev, redFlag:v}))}>
                  <SelectTrigger><SelectValue placeholder="Red flag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {['Yes','No'].map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.reportable} onValueChange={(v)=>setFwFilters(prev=>({...prev, reportable:v}))}>
                  <SelectTrigger><SelectValue placeholder="Reportable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {['Yes','No'].map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={fwFilters.observationRanking} onValueChange={(v)=>setFwFilters(prev=>({...prev, observationRanking:v}))}>
                  <SelectTrigger><SelectValue placeholder="Observation Ranking" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {['High','Medium','Low'].map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          {/* Group */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Rows3 className="h-4 w-4"/> Group</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="grid gap-2">
                {fwGroupOptions.map(opt => (
                  <Button key={opt.key} variant={fwGroupBy===opt.key?'default':'outline'} size="sm" className="justify-start" onClick={()=>setFwGroupBy(opt.key)}>
                    {opt.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Fields */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Columns2 className="h-4 w-4"/> Fields</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-64 overflow-y-auto p-3">
              <div className="grid gap-2">
                {fwAllFields.map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={fwSelectedFields.includes(f)} onChange={(e)=> setFwSelectedFields(prev => e.target.checked ? [...prev, f as string] : prev.filter(x=>x!==f))} />
                    <span>{f}</span>
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={()=>setFwSelectedFields([...fwAllFields])}>All</Button>
                  <Button size="sm" variant="outline" onClick={()=>setFwSelectedFields([...fwAllFields])}>Default</Button>
                  <Button size="sm" variant="outline" onClick={()=>setFwSelectedFields([])}>None</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export */}
          <Button size="sm" className="flex items-center gap-2" onClick={async ()=>{
            const rowsSrc = displayedRows.slice();
            const passesFilter = (r:any) => {
              const between = (v:number, min?:number, max?:number) => {
                if (typeof v !== 'number' || isNaN(v)) return false;
                if (min!=null && v < min) return false;
                if (max!=null && v > max) return false;
                return true;
              };
              if (fwFilters.activity && String(r.activity||'') !== fwFilters.activity) return false;
              if (fwFilters.risk && String(r.risk||'') !== fwFilters.risk) return false;
              if (fwFilters.department && String((r as any).department||'') !== fwFilters.department) return false;
              if (fwFilters.controlOwner && String(r.controlOwner||'') !== fwFilters.controlOwner) return false;
              if (fwFilters.riskLevel && String(r.riskLevel||'') !== fwFilters.riskLevel) return false;
              if (fwFilters.testOfControl && String(r.testOfControl||'') !== fwFilters.testOfControl) return false;
              if (fwFilters.substantiveProcedure && String(r.substantiveProcedure||'') !== fwFilters.substantiveProcedure) return false;
              if (fwFilters.samplingApplicability && String(r.samplingApplicable||'') !== fwFilters.samplingApplicability) return false;
              if (fwFilters.controlEffectiveness && String(r.controlEffectiveness||'') !== fwFilters.controlEffectiveness) return false;
              if (fwFilters.redFlag && String(r.redFlag||'') !== fwFilters.redFlag) return false;
              if (fwFilters.reportable && String(r.reportable||'') !== fwFilters.reportable) return false;
              if (fwFilters.observationRanking && String(r.observationRanking||'') !== fwFilters.observationRanking) return false;
              if ((fwFilters.riskScoreMin!=null || fwFilters.riskScoreMax!=null) && !between(Number(r.riskScore), fwFilters.riskScoreMin, fwFilters.riskScoreMax)) return false;
              if ((fwFilters.controlScoreMin!=null || fwFilters.controlScoreMax!=null) && !between(Number(r.controlScore), fwFilters.controlScoreMin, fwFilters.controlScoreMax)) return false;
              if ((fwFilters.residualMin!=null || fwFilters.residualMax!=null) && !between(Number(r.residualRisk), fwFilters.residualMin, fwFilters.residualMax)) return false;
              return true;
            };
            const list = rowsSrc.filter(passesFilter);

            const buildRow = (r:any) => {
              const f: Record<string, any> = {};
              const riskVal = (activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence));
              const resid = Math.round((computeResidual(activeCfg.residualRisk.formula, riskVal, r.controlScore, activeCfg.controlScore.scale) + Number.EPSILON) * 100) / 100;
              const riskLevel = resolveLevel(resid, activeCfg.residualRisk.thresholds)?.level || '';
              const color = resolveLevel(resid, activeCfg.residualRisk.thresholds)?.color || '';
              if (fwSelectedFields.includes('Department')) f['Department'] = (r as any).department || '';
              if (fwSelectedFields.includes('Activity')) f['Activity'] = r.activity;
              if (fwSelectedFields.includes('Risk')) f['Risk'] = r.risk;
              if (fwSelectedFields.includes('Control')) f['Control'] = r.control;
              if (fwSelectedFields.includes('Control Owner')) f['Control Owner'] = r.controlOwner;
              if (fwSelectedFields.includes('Likelihood')) f['Likelihood'] = r.likelihood;
              if (fwSelectedFields.includes('Impact')) f['Impact'] = r.consequence;
              if (fwSelectedFields.includes('Risk Score')) f['Risk Score'] = riskVal;
              if (fwSelectedFields.includes('Control Score')) f['Control Score'] = r.controlScore;
              if (fwSelectedFields.includes('Residual Risk')) f['Residual Risk'] = resid;
              if (fwSelectedFields.includes('Risk Level')) f['Risk Level'] = riskLevel;
              if (fwSelectedFields.includes('Color')) f['Color'] = color;
              if (fwSelectedFields.includes('Test of control')) f['Test of control'] = r.testOfControl;
              if (fwSelectedFields.includes('Substantive procedure')) f['Substantive procedure'] = r.substantiveProcedure;
              if (fwSelectedFields.includes('Sampling applicability')) f['Sampling applicability'] = r.samplingApplicable;
              if (fwSelectedFields.includes('Sampling Methodology')) f['Sampling Methodology'] = r.samplingMethodology;
              if (fwSelectedFields.includes('Control Effectiveness')) f['Control Effectiveness'] = r.controlEffectiveness;
              if (fwSelectedFields.includes('Attachments')) f['Attachments'] = r.attachments;
              if (fwSelectedFields.includes('Audit Remarks')) f['Audit Remarks'] = r.auditRemarks;
              if (fwSelectedFields.includes('Red flag')) f['Red flag'] = r.redFlag;
              if (fwSelectedFields.includes('Reportable')) f['Reportable'] = r.reportable;
              if (fwSelectedFields.includes('Observation Ranking')) f['Observation Ranking'] = r.observationRanking;
              if (fwSelectedFields.includes('Audit Observation')) f['Audit Observation'] = r.auditObservation;
              if (fwSelectedFields.includes('Effect')) f['Effect'] = r.effect;
              if (fwSelectedFields.includes('Recommendation')) f['Recommendation'] = r.recommendation;
              if (fwSelectedFields.includes('Annexure')) f['Annexure'] = r.annexure;
              return f;
            };

            const getGroupKeys = (r:any, key:string): string[] => {
              switch (key) {
                case 'none': return [''];
                case 'Department': return [String((r as any).department||'(none)')];
                case 'Activity': return [String(r.activity||'(none)')];
                case 'Risk': return [String(r.risk||'(none)')];
                case 'Risk Score': return [String(activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence))];
                case 'Control Score': return [String(r.controlScore||'')];
                case 'Residual Risk': { const risk = activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence); return [String(Math.round((computeResidual(activeCfg.residualRisk.formula, risk, r.controlScore, activeCfg.controlScore.scale) + Number.EPSILON) * 100) / 100)]; }
                case 'Risk Level': { const risk = activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence); const rr = computeResidual(activeCfg.residualRisk.formula, risk, r.controlScore, activeCfg.controlScore.scale); const lvl = resolveLevel(rr, activeCfg.residualRisk.thresholds)?.level || '(none)'; return [lvl]; }
                case 'Control Owner': return [String(r.controlOwner||'(none)')];
                case 'Test of control': return [String(r.testOfControl||'(none)')];
                case 'Substantive procedure': return [String(r.substantiveProcedure||'(none)')];
                case 'Sampling applicability': return [String(r.samplingApplicable||'(none)')];
                case 'Control Effectiveness': return [String(r.controlEffectiveness||'(none)')];
                case 'Red flag': return [String(r.redFlag||'(none)')];
                case 'Reportable': return [String(r.reportable||'(none)')];
                case 'Observation Ranking': return [String(r.observationRanking||'(none)')];
                default: return [''];
              }
            };

            const rows:any[] = [];
            if (fwGroupBy==='none') {
              list.forEach(r => rows.push(buildRow(r)));
            } else {
              const grouped: Record<string, any[]> = {};
              list.forEach(r => {
                const keys = getGroupKeys(r, fwGroupBy);
                const row = buildRow(r);
                for (const k of keys) { if (!grouped[k]) grouped[k] = []; grouped[k].push(row); }
              });
              const labels = Object.keys(grouped).sort((a,b)=>a.localeCompare(b));
              for (const label of labels) { rows.push({ Group: label }); grouped[label].forEach(rr => rows.push(rr)); rows.push({}); }
            }

            const wb = XLSX.utils.book_new();
            const safeSheet = (name: string) => name.replace(/[\\/?*\[\]]/g, '').slice(0,31) || 'Sheet';

            const exportSingle = (listLocal: any[], label: string) => {
              const rowsOut:any[] = [];
              if (fwGroupBy==='none') {
                listLocal.forEach(r => rowsOut.push(buildRow(r)));
              } else {
                const grouped: Record<string, any[]> = {};
                listLocal.forEach(r => {
                  const keys = getGroupKeys(r, fwGroupBy);
                  const row = buildRow(r);
                  for (const k of keys) { if (!grouped[k]) grouped[k] = []; grouped[k].push(row); }
                });
                const labels = Object.keys(grouped).sort((a,b)=>a.localeCompare(b));
                for (const gl of labels) { rowsOut.push({ Group: gl }); grouped[gl].forEach(rr => rowsOut.push(rr)); rowsOut.push({}); }
              }
              const ws = XLSX.utils.json_to_sheet(rowsOut);
              XLSX.utils.book_append_sheet(wb, ws, safeSheet(`FW ${label}`));

              // Risk Register
              const byRisk: Record<string, { riskId: string; description: string; category: string; likelihood: number; impact: number; controls: Set<string>; controlOwner: string; residual: number }> = {};
              listLocal.forEach(r => {
                const risk = activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence);
                const residual = computeResidual(activeCfg.residualRisk.formula, risk, r.controlScore, activeCfg.controlScore.scale);
                const level = resolveLevel(residual, activeCfg.residualRisk.thresholds)?.level || '';
                const key = r.risk || r.id;
                if (!byRisk[key]) byRisk[key] = { riskId: r.id, description: r.risk, category: level, likelihood: r.likelihood, impact: r.consequence, controls: new Set(), controlOwner: r.controlOwner || '', residual: Math.round((residual + Number.EPSILON) * 100) / 100 };
                byRisk[key].controls.add(r.control);
              });
              const rrRows = Object.values(byRisk).map(v => ({ 'Risk ID': v.riskId, 'Description': v.description, 'Category': v.category, 'Likelihood': v.likelihood, 'Impact': v.impact, 'Controls': Array.from(v.controls).join(', '), 'Control Owner': v.controlOwner, 'Residual Risk': v.residual }));
              const ws2 = XLSX.utils.json_to_sheet(rrRows);
              XLSX.utils.book_append_sheet(wb, ws2, safeSheet(`RR ${label}`));

              // Heat Map Data
              const hmRows = listLocal.map(r => ({ Likelihood: r.likelihood, Impact: r.consequence, 'Risk Score': (activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence)), 'Control Score': r.controlScore, 'Residual Risk': Math.round((computeResidual(activeCfg.residualRisk.formula, (activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence)), r.controlScore, activeCfg.controlScore.scale) + Number.EPSILON) * 100) / 100, 'Risk Level': (()=>{ const risk = activeCfg.riskScore.mode === 'single' ? r.riskScore : computeRiskScore(activeCfg.riskScore.mode, r.likelihood, r.consequence); const rr = computeResidual(activeCfg.residualRisk.formula, risk, r.controlScore, activeCfg.controlScore.scale); return resolveLevel(rr, activeCfg.residualRisk.thresholds)?.level || ''; })() }));
              const wsData = XLSX.utils.json_to_sheet(hmRows);
              XLSX.utils.book_append_sheet(wb, wsData, safeSheet(`HM Data ${label}`));

              // Heat Map matrix with colors
              const Lmin = activeCfg.riskScore.likelihood?.scale.min ?? 1;
              const Lmax = activeCfg.riskScore.likelihood?.scale.max ?? 5;
              const Cmin = activeCfg.riskScore.consequence?.scale.min ?? 1;
              const Cmax = activeCfg.riskScore.consequence?.scale.max ?? 5;
              const counts: Record<string, number> = {};
              listLocal.forEach(r => { const l = Math.round(Number(r.likelihood||0)); const c = Math.round(Number(r.consequence||0)); const k = `${l}|${c}`; counts[k] = (counts[k]||0)+1; });
              const header = ['Likelihood \\ Impact'];
              for (let c=Cmin; c<=Cmax; c++) header.push(String(c));
              const aoa: any[][] = [header];
              for (let l=Lmax; l>=Lmin; l--) {
                const rw: any[] = [String(l)];
                for (let c=Cmin; c<=Cmax; c++) {
                  const k = `${l}|${c}`;
                  rw.push(counts[k] ? counts[k] : '');
                }
                aoa.push(rw);
              }
              const wsHM: any = XLSX.utils.aoa_to_sheet(aoa);
              const hexToARGB = (hex: string) => { const s = (hex||'').replace('#',''); return (s.length===6 ? `FF${s}` : s).toUpperCase(); };
              for (let r=1; r<aoa.length; r++) {
                const l = Lmax - (r-1);
                for (let c=1; c<aoa[0].length; c++) {
                  const impact = Cmin + (c-1);
                  const riskVal = l * impact;
                  const lvl = resolveLevel(riskVal, activeCfg.residualRisk.thresholds);
                  const color = lvl?.color || '';
                  const addr = XLSX.utils.encode_cell({ r, c });
                  const cell = wsHM[addr] || { t: 's', v: aoa[r][c] };
                  wsHM[addr] = cell;
                  (wsHM[addr] as any).s = { alignment: { horizontal: 'center', vertical: 'center' }, fill: color ? { patternType: 'solid', fgColor: { rgb: hexToARGB(color) } } : undefined, font: { bold: true, color: { rgb: 'FF000000' } }, border: { top:{style:'thin',color:{rgb:'FFCCCCCC'}}, left:{style:'thin',color:{rgb:'FFCCCCCC'}}, right:{style:'thin',color:{rgb:'FFCCCCCC'}}, bottom:{style:'thin',color:{rgb:'FFCCCCCC'}} } };
                }
              }
              for (let c=0; c<aoa[0].length; c++) { const addr = XLSX.utils.encode_cell({ r:0, c }); if (wsHM[addr]) (wsHM[addr] as any).s = { font: { bold: true }, alignment: { horizontal: 'center' } }; }
              for (let r=1; r<aoa.length; r++) { const addr = XLSX.utils.encode_cell({ r, c:0 }); if (wsHM[addr]) (wsHM[addr] as any).s = { font: { bold: true }, alignment: { horizontal: 'center' } }; }
              (wsHM as any)['!cols'] = Array.from({ length: aoa[0].length }, (_,i)=> ({ wch: i===0 ? 14 : 6 }));
              (wsHM as any)['!rows'] = Array.from({ length: aoa.length }, () => ({ hpt: 22 }));
              XLSX.utils.book_append_sheet(wb, wsHM, safeSheet(`HM ${label}`));
            };

            if (selectedProject) {
              exportSingle(list, selectedProject);
            } else {
              try {
                const projRes = await fetch('/api/projects');
                const projRows = projRes.ok ? await projRes.json() : [];
                const projMap: Record<string, { code?: string; name?: string }> = {};
                for (const pr of projRows || []) { projMap[pr.id] = { code: pr.code, name: pr.name }; }
                const byPid: Record<string, any[]> = {};
                const allRecs = Object.values(records);
                for (const rec of allRecs) {
                  if (!rec.projectId) continue;
                  const status = rec.status || 'draft';
                  if (statusFilter === 'Approved' && status !== 'approved') continue;
                  if (statusFilter === 'Rejected' && status !== 'rejected') continue;
                  if (statusFilter === 'In progress' && (status === 'approved' || status === 'rejected')) continue;
                  const ctrl = controls.find(c => c.id === rec.controlId);
                  const a: any = (rec as any).arc || {};
                  const samplingApplicable = a.samplingApplicable || (rec.methodology?.verification ? (rec.methodology.verification === 'Sampling' ? 'Yes' : 'No') : '');
                  const controlEffective = a.controlEffective || (rec.effectiveness?.effectiveness === 'Effective' ? 'Yes' : rec.effectiveness?.effectiveness === 'Ineffective' ? 'No' : '');
                  const row = {
                    id: rec.controlId,
                    activity: a.activity || ctrl?.activity || '',
                    risk: a.risk || ctrl?.risk || '',
                    control: a.control || ctrl?.name || '',
                    testOfControl: a.testOfControl || (rec.methodology?.methodType === 'Test of Control' ? rec.methodology.procedure : ''),
                    substantiveProcedure: a.substantiveProcedure || (rec.methodology?.methodType === 'Substantive Procedure' ? rec.methodology.procedure : ''),
                    samplingApplicable,
                    samplingMethodology: a.samplingMethodology || rec.methodology?.samplingMethod || '',
                    controlEffectiveness: controlEffective,
                    attachments: a.attachments || '',
                    auditRemarks: a.auditRemarks || rec.remarks.auditRemarks || '',
                    redFlag: a.redFlag || '',
                    reportable: a.reportable || '',
                    observationRanking: a.observationRanking || rec.report.observationRanking || '',
                    auditObservation: a.auditObservation || rec.report.observation || '',
                    effect: a.effect || rec.report.riskEffect || '',
                    recommendation: a.recommendation || rec.report.recommendation || '',
                    controlOwner: a.controlOwner || '',
                    annexure: a.annexure || rec.report.annexure || '',
                    likelihood: rec.risk?.likelihood ?? 0,
                    consequence: rec.risk?.consequence ?? 0,
                    riskScore: rec.risk?.riskScore ?? 0,
                    controlScore: rec.risk?.controlScore ?? 0,
                  } as any;
                  if (!byPid[rec.projectId]) byPid[rec.projectId] = [];
                  byPid[rec.projectId].push(row);
                }
                const pids = Object.keys(byPid);
                if (pids.length === 0) {
                  exportSingle(list, 'All');
                } else {
                  for (const pid of pids) {
                    const label = projMap[pid]?.code || projMap[pid]?.name || pid;
                    exportSingle(byPid[pid], label);
                  }
                }
              } catch {
                exportSingle(list, 'All');
              }
            }

            XLSX.writeFile(wb, 'fieldwork.xlsx');
          }}><Download className="h-4 w-4"/> Export XLSX</Button>
        </div>
      </div>

      {(selectedProject) || statusFilter === 'Rejected' || statusFilter === 'Approved' ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Activities → Risks → Controls</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 w-64">Activity</th>
                    <th className="text-left p-3 w-64">Risk</th>
                    <th className="text-left p-3 w-64">Control</th>
                    {activeCfg.riskScore.mode === 'likelihood_consequence' && !riskDisabled && (<th className="text-left p-3 w-40">Likelihood</th>)}
                    {activeCfg.riskScore.mode === 'likelihood_consequence' && !riskDisabled && (<th className="text-left p-3 w-40">Consequence</th>)}
                    {!riskDisabled && (<th className="text-left p-3 w-40">Risk Score</th>)}
                    {!riskDisabled && (<th className="text-left p-3 w-40">Control Score</th>)}
                    {!riskDisabled && (<th className="text-left p-3 w-40">Residual Risk</th>)}
                    {!riskDisabled && (<th className="text-left p-3 w-40">Risk Level</th>)}
                    {!riskDisabled && (<th className="text-left p-3 w-24">Color</th>)}
                    <th className="text-left p-3 w-64">Control Owner</th>
                    <th className="text-left p-3 w-64">Test of Control</th>
                    <th className="text-left p-3 w-64">Substantive Procedure</th>
                    <th className="text-left p-3 w-64">Sampling Applicable?</th>
                    <th className="text-left p-3 w-64">Sampling Methodology</th>
                    <th className="text-left p-3 w-64">Control Effectiveness</th>
                    <th className="text-left p-3 w-64">Attachments</th>
                    <th className="text-left p-3 w-64">Audit Remarks</th>
                    <th className="text-left p-3 w-64">Red flag</th>
                    <th className="text-left p-3 w-64">Reportable</th>
                    <th className="text-left p-3 w-64">Observation Ranking</th>
                    <th className="text-left p-3 w-64">Audit Observation</th>
                    <th className="text-left p-3 w-64">Effect</th>
                    <th className="text-left p-3 w-64">Recommendation</th>
                    <th className="text-left p-3 w-64">Annexure</th>
                    <th className="text-left p-3 w-64">Submit for review</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row, idx) => (
                    <tr key={`${selectedProject || 'GLOBAL'}|${row.id}|${idx}`} className={`border-t ${(records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status) === 'rejected' ? 'bg-red-50' : ''}`}>
                      <td className="p-3 align-top w-64 break-words">{row.activity || '-'}</td>
                      <td className="p-3 align-top w-64 break-words">{row.risk || '-'}</td>
                      <td className="p-3 align-top w-64 break-words">{row.control || '-'}</td>
                      {activeCfg.riskScore.mode === 'likelihood_consequence' && !riskDisabled && (
                        <>
                          {/* Likelihood */}
                          <td className="p-3 align-top w-40 break-words">
                            {(() => { const key = selectedProject ? `${selectedProject}|${row.id}` : row.id; const st = records[key]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                              <span>{records[key]?.risk?.likelihood ?? '-'}</span>
                            ); } return (
                              <Input type="number" step={1} min={activeCfg.riskScore.likelihood?.scale.min} max={activeCfg.riskScore.likelihood?.scale.max} value={Number.isFinite(Number(row.likelihood)) ? row.likelihood : (activeCfg.riskScore.likelihood?.scale.min ?? 1)}
                                onChange={(e)=> { const min = activeCfg.riskScore.likelihood?.scale.min ?? 1; const max = activeCfg.riskScore.likelihood?.scale.max ?? 5; const nv = Math.max(min, Math.min(max, Math.round(Number(e.target.value||0)))); setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, likelihood: nv } : r)); }}
                              />
                            ); })()}
                          </td>
                          {/* Consequence */}
                          <td className="p-3 align-top w-40 break-words">
                            {(() => { const key = selectedProject ? `${selectedProject}|${row.id}` : row.id; const st = records[key]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                              <span>{records[key]?.risk?.consequence ?? '-'}</span>
                            ); } return (
                              <Input type="number" step={1} min={activeCfg.riskScore.consequence?.scale.min} max={activeCfg.riskScore.consequence?.scale.max} value={Number.isFinite(Number(row.consequence)) ? row.consequence : (activeCfg.riskScore.consequence?.scale.min ?? 1)}
                                onChange={(e)=> { const min = activeCfg.riskScore.consequence?.scale.min ?? 1; const max = activeCfg.riskScore.consequence?.scale.max ?? 5; const nv = Math.max(min, Math.min(max, Math.round(Number(e.target.value||0)))); setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, consequence: nv } : r)); }}
                              />
                            ); })()}
                          </td>
                        </>
                      )}
                      {/* Risk Score */}
                      {!riskDisabled && (
                      <td className="p-3 align-top w-40 break-words">
                        {(() => {
                          const cfg = activeCfg;
                          const status = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status || 'draft';
                          if (cfg.riskScore.mode === 'single') {
                            const min = cfg.riskScore.scale.min; const max = cfg.riskScore.scale.max;
                            const pickColor = (val: number) => {
                              const ranges = cfg.residualRisk?.thresholds?.ranges || [];
                              if (ranges.length > 0) {
                                for (let i=0;i<ranges.length;i++) {
                                  const r = ranges[i];
                                  if (val >= r.from && val <= r.to) {
                                    return r.color || cfg.residualRisk.thresholds?.heatmapColors?.[r.label];
                                  }
                                }
                              }
                              const labels = Array.isArray(cfg.riskScore.labels) ? [...cfg.riskScore.labels] : [];
                              labels.sort((a,b)=>a.value-b.value);
                              let chosen = labels[0];
                              for (const l of labels) { if (val >= l.value) chosen = l; }
                              return chosen?.color;
                            };
                            if (!projectLocked && status !== 'submitted' && status !== 'approved' && status !== 'finalized') {
                              const c = pickColor(row.riskScore);
                              return (
                                <span className="inline-flex items-center gap-2">
                                  <Input type="number" step={1} min={min} max={max} value={Number.isFinite(Number(row.riskScore)) ? row.riskScore : min}
                                    onChange={(e)=> { const nv = Math.max(min, Math.min(max, Math.round(Number(e.target.value||0)))); setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, riskScore: nv } : r)); }}
                                  />
                                  {c ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: c }} /> : null}
                                </span>
                              );
                            }
                            const v = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.risk?.riskScore ?? '-';
                            const c = typeof v === 'number' ? pickColor(v) : undefined;
                            return <span className="inline-flex items-center gap-2"><span>{v}</span>{c ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: c }} /> : null}</span>;
                          }
                          const v = computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence);
                          const pickRiskColor = (val: number) => {
                            const ranges = activeCfg.residualRisk?.thresholds?.ranges || [];
                            if (ranges.length > 0) {
                              for (let i=0;i<ranges.length;i++) {
                                const r = ranges[i];
                                if (val >= r.from && val <= r.to) {
                                  return r.color || activeCfg.residualRisk.thresholds?.heatmapColors?.[r.label];
                                }
                              }
                            }
                            const labels = Array.isArray(cfg.riskScore.labels) ? [...cfg.riskScore.labels] : [];
                            labels.sort((a,b)=>a.value-b.value);
                            let chosen = labels[0];
                            for (const l of labels) { if (val >= l.value) chosen = l; }
                            return chosen?.color;
                          };
                          const rc = pickRiskColor(v || 0);
                          return <span className="inline-flex items-center gap-2"><span>{v || 0}</span>{rc ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: rc }} /> : null}</span>;
                        })()}
                      </td>
                      )}
                      {/* Control Score */}
                      <td className={`p-3 align-top w-40 break-words ${riskDisabled ? 'hidden' : ''}`}>
                        {(() => {
                          const cfg = activeCfg;
                          const status = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status || 'draft';
                          const pickControlColor = (val: number) => {
                            const labels = Array.isArray(cfg.controlScore.labels) ? [...cfg.controlScore.labels] : [];
                            labels.sort((a,b)=>a.value-b.value);
                            let chosen = labels[0];
                            for (const l of labels) { if (val >= l.value) chosen = l; }
                            return chosen?.color;
                          };
                          if (!projectLocked && status !== 'submitted' && status !== 'approved' && status !== 'finalized') {
                            const min = cfg.controlScore.scale.min; const max = cfg.controlScore.scale.max;
                            const c = pickControlColor(row.controlScore);
                            return (
                              <span className="inline-flex items-center gap-2">
                                <Input type="number" step={1} min={min} max={max} value={Number.isFinite(Number(row.controlScore)) ? row.controlScore : min}
                                  onChange={(e)=> { const nv = Math.max(min, Math.min(max, Math.round(Number(e.target.value||0)))); setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, controlScore: nv } : r)); }}
                                />
                                {c ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: c }} /> : null}
                              </span>
                            );
                          }
                          const v = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.risk?.controlScore ?? '-';
                          const cc = typeof v === 'number' ? pickControlColor(v) : undefined;
                          return <span className="inline-flex items-center gap-2"><span>{v}</span>{cc ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: cc }} /> : null}</span>;
                        })()}
                      </td>
                      {/* Residual Risk */}
                      <td className={`p-3 align-top w-40 break-words ${riskDisabled ? 'hidden' : ''}`}>
                        {(() => {
                          const cfg = activeCfg;
                          const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence);
                          const res = computeResidual(cfg.residualRisk.formula, risk, row.controlScore, cfg.controlScore.scale);
                          const lvl = getResidualLevel(res, cfg.residualRisk.thresholds);
                          const rc = lvl?.color;
                          const resDisplay = Number.isFinite(res) ? Math.round((res + Number.EPSILON) * 100) / 100 : 0;
                          return <span className="inline-flex items-center gap-2"><span>{resDisplay}</span>{rc ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: rc }} /> : null}</span>;
                        })()}
                      </td>
                      {/* Risk Level */}
                      <td className={`p-3 align-top w-40 break-words ${riskDisabled ? 'hidden' : ''}`}>
                        {(() => {
                          const cfg = activeCfg;
                          const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence);
                          const rr = computeResidual(cfg.residualRisk.formula, risk, row.controlScore, cfg.controlScore.scale);
                          const rrl = getResidualLevel(rr, cfg.residualRisk.thresholds);
                          return <span>{rrl?.level || 'Low'}</span>;
                        })()}
                      </td>
                      {/* Color */}
                      <td className={`p-3 align-top w-24 break-words ${riskDisabled ? 'hidden' : ''}`}>
                        {(() => { const cfg = activeCfg; const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence); const rr = computeResidual(cfg.residualRisk.formula, risk, row.controlScore, cfg.controlScore.scale); const rrl = getResidualLevel(rr, cfg.residualRisk.thresholds); return rrl?.color ? <span className="inline-block w-5 h-5 rounded" title={rrl?.level} style={{ backgroundColor: rrl.color }} /> : <span className="inline-block w-5 h-5 rounded bg-emerald-500" title="Low" />; })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.controlOwner || '-'}</span>
                        ); } return (
                          <Input value={row.controlOwner ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, controlOwner: e.target.value } : r))} placeholder="Control owner" />
                        ); })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.testOfControl} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, testOfControl: v === '__CLEAR__' ? '' : v } : r))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            {testOfControlOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.substantiveProcedure} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, substantiveProcedure: v === '__CLEAR__' ? '' : v } : r))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            {substantiveProcedureOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.samplingApplicable} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => { const nv = v === '__CLEAR__' ? '' : v; return r.id === row.id ? { ...r, samplingApplicable: nv as any, samplingMethodology: nv === 'Yes' ? r.samplingMethodology : '' } : r; }))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.samplingMethodology} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, samplingMethodology: v === '__CLEAR__' ? '' : v } : r))} disabled={row.samplingApplicable !== 'Yes' || (() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder={row.samplingApplicable === 'Yes' ? 'Select' : 'Not applicable'} />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            {samplingMethodologyOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.controlEffectiveness} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, controlEffectiveness: v === '__CLEAR__' ? '' : v } : r))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            {controlEffectivenessOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.attachments || '-'}</span>
                        ); } return (
                          <Input value={row.attachments ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, attachments: e.target.value } : r))} placeholder="Paste link or text" />
                        ); })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const key = selectedProject ? `${selectedProject}|${row.id}` : row.id; const st = records[key]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.auditRemarks || '-'}</span>
                        ); } return (
                          <Input value={row.auditRemarks ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, auditRemarks: e.target.value } : r))} placeholder="Type remarks" />
                        ); })()}
                        {(() => { const cfg = RiskConfigStore.getGlobal(); const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence); const invalid = cfg.controlScore.constraintControlLEQRisk && row.controlScore > risk; return invalid ? <div className="text-xs text-red-600 mt-1">Control Score cannot exceed Risk Score</div> : null; })()}
                        {(() => {
                          const key = selectedProject ? `${selectedProject}|${row.id}` : row.id;
                          const hist = records[key]?.auditRemarksHistory || [];
                          if (hist.length === 0) return null;
                          const last = hist[hist.length - 1];
                          return (
                            <div className="mt-2">
                              <div className="inline-block max-w-xs px-3 py-2 rounded-lg shadow-sm bg-slate-50 border border-slate-200 text-slate-800">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="break-words">{last.content}</div>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="ml-2 inline-flex items-center justify-center rounded-full text-xs px-2 py-0.5 border border-slate-300 text-slate-700" title="Audit remark count">×{hist.length}</button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-2">
                                      <div className="text-xs font-medium mb-1">Past audit remarks</div>
                                      <div className="space-y-2 max-h-64 overflow-auto">
                                        {hist.slice().reverse().map((h, i) => (
                                          <div key={i} className="p-2 border rounded bg-slate-50 text-slate-800">
                                            <div className="break-words">{h.content}</div>
                                            <div className="mt-1 text-[10px] text-slate-600">��� {h.author}, {new Date(h.timestamp).toLocaleString()}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="mt-1 text-xs text-slate-600 opacity-80">— {last.author}, {new Date(last.timestamp).toLocaleString()}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.redFlag} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, redFlag: v === '__CLEAR__' ? '' : v } : r))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            {controlEffectivenessOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.reportable} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, reportable: v === '__CLEAR__' ? '' : v } : r))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                            {controlEffectivenessOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.observationRanking} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, observationRanking: v === '__CLEAR__' ? '' : v } : r))} disabled={(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; return projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized'; })()}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__CLEAR__">Clear</SelectItem>
                            <SelectSeparator />
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.auditObservation || '-'}</span>
                        ); } return (
                          <Input value={row.auditObservation ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, auditObservation: e.target.value } : r))} placeholder="Type observation" />
                        ); })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.effect || '-'}</span>
                        ); } return (
                          <Input value={row.effect ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, effect: e.target.value } : r))} placeholder="Describe effect" />
                        ); })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.recommendation || '-'}</span>
                        ); } return (
                          <Input value={row.recommendation ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, recommendation: e.target.value } : r))} placeholder="Recommendation" />
                        ); })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (projectLocked || st === 'submitted' || st === 'approved' || st === 'finalized') { return (
                          <span>{row.annexure || '-'}</span>
                        ); } return (
                          <Input value={row.annexure ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, annexure: e.target.value } : r))} placeholder="Annexure ref/link" />
                        ); })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {(() => { const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status; if (st === 'submitted') { return (
                          <Button size="sm" variant="default" className="bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] shadow-md focus-visible:ring-2 focus-visible:ring-green-400 transition" disabled>
                            <CheckCircle2 className="h-3 w-3 mr-2" /> Submitted for Review
                          </Button>
                        ); } if (st === 'approved') { return (
                          <Button size="sm" variant="outline" className="text-green-700" disabled>
                            <CheckCircle2 className="h-3 w-3 mr-2" /> Approved
                          </Button>
                        ); } if (projectLocked) { return (
                          <Button size="sm" variant="outline" disabled>
                            <CheckCircle2 className="h-3 w-3 mr-2" /> {projectStatus === 'completed' ? 'Completed' : 'On Hold'}
                          </Button>
                        ); } return (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-gradient-to-b from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 active:scale-[0.98] shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400 transition"
                            disabled={(() => { const cfg = activeCfg; const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence); return projectLocked || (cfg.controlScore.constraintControlLEQRisk && row.controlScore > risk); })()}
                            onClick={() => {
                              const cfg = RiskConfigStore.getGlobal();
                              const recKey = selectedProject ? `${selectedProject}|${row.id}` : row.id;
                              FieldworkStore.ensure(recKey, () => ({
                                controlId: row.id,
                                status: 'draft',
                                progress: 0,
                                activeTab: 0,
                                env: { alternativeControl: '', altControlCategory: '', responsibility: '', riskAssociated: '', controlNature: '' },
                                methodology: { methodType: '', procedure: '', verification: '', samplingMethod: '', implementationConclusion: '' },
                                effectiveness: { effectiveness: '', designConclusion: '', automated: '', rating: '' },
                                remarks: { auditRemarks: '', reviewComments: '', revisedAuditRemarks: '', reviewStatus: '' },
                                report: { observation: '', observationRanking: '', annexure: '', riskEffect: '', recommendation: '' }
                              }));
                              const existing = FieldworkStore.get(recKey);
                              const statusNow = existing?.status || 'draft';
                              const riskValue = (statusNow === 'draft' || statusNow === 'submitted') ? (Number(row.riskScore) || computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence)) : (cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence));
                              let residual = (statusNow === 'draft' || statusNow === 'submitted') ? (Number(row.residualRisk) || computeResidual(cfg.residualRisk.formula, riskValue, row.controlScore, cfg.controlScore.scale)) : computeResidual(cfg.residualRisk.formula, riskValue, row.controlScore, cfg.controlScore.scale);
                              if (cfg.residualRisk.constraintResidualLEQRisk) {
                                residual = Math.min(residual, riskValue);
                              }
                              const rLevel = resolveLevel(riskValue, cfg.residualRisk.thresholds)?.level || '';
                              const rrLevel = resolveLevel(residual, cfg.residualRisk.thresholds)?.level || '';
                              const revised = (existing?.remarks?.revisedAuditRemarks || '').trim();
                              const baseRemark = (row.auditRemarks || '').trim();
                              const auditRemarkToSave = revised || baseRemark;
                              if (statusNow === 'rejected' && auditRemarkToSave) {
                                FieldworkStore.addAuditRemark(recKey, (user?.username || 'User'), auditRemarkToSave);
                              }
                              FieldworkStore.patch(recKey, { projectId: selectedProject || undefined,
                                arc: {
                                  activity: row.activity,
                                  risk: row.risk,
                                  control: row.control,
                                  testOfControl: row.testOfControl,
                                  substantiveProcedure: row.substantiveProcedure,
                                  samplingApplicable: (row.samplingApplicable as any) || '',
                                  samplingMethodology: (row.samplingMethodology as any) || '',
                                  controlEffective: (row.controlEffectiveness as any) || '',
                                  controlOwner: row.controlOwner || '',
                                  attachments: row.attachments,
                                  auditRemarks: auditRemarkToSave,
                                  redFlag: (row.redFlag as any) || '',
                                  reportable: (row.reportable as any) || '',
                                  observationRanking: row.observationRanking,
                                  auditObservation: row.auditObservation,
                                  effect: row.effect,
                                  recommendation: row.recommendation,
                                  annexure: row.annexure,
                                },
                                risk: {
                                  mode: cfg.riskScore.mode,
                                  likelihood: row.likelihood,
                                  consequence: row.consequence,
                                  riskScore: riskValue,
                                  controlScore: row.controlScore,
                                  residualRisk: residual,
                                  riskLevel: rLevel,
                                  residualLevel: rrLevel,
                                  overridden: false,
                                  lastCalculatedAt: new Date().toISOString()
                                }
                              });
                              FieldworkStore.submitForReview(recKey);
                              setRecords(FieldworkStore.getAll());
                              setSubmitAckOpen(true);
                            }}
                          >
                            <Share2 className="h-3 w-3 mr-2" /> {(records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status) === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
                          </Button>
                        ); })()}
                        {(() => {
                          const hist = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.reviewHistory || [];
                          if (hist.length === 0) return null;
                          const last = hist[hist.length - 1];
                          const st = records[selectedProject ? `${selectedProject}|${row.id}` : row.id]?.status;
                          const rejCount = hist.filter(h => (h.content || '').startsWith('Rejected')).length;
                          return (
                            <div className="mt-2">
                              <div className={`inline-block max-w-xs px-3 py-2 rounded-lg shadow-sm ${st === 'rejected' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="break-words">{last.content}</div>
                                  {rejCount > 0 ? (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className={`ml-2 inline-flex items-center justify-center rounded-full text-xs px-2 py-0.5 ${st === 'rejected' ? 'border border-red-300 text-red-700' : 'border border-green-300 text-green-700'}`} title="Times rejected">
                                          ×{rejCount}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80 p-2">
                                        <div className="text-xs font-medium mb-1">Past rejection comments</div>
                                        <div className="space-y-2 max-h-64 overflow-auto">
                                          {hist.filter(h => (h.content || '').startsWith('Rejected')).map((h, i) => (
                                            <div key={i} className="p-2 border rounded bg-red-50 text-red-800">
                                              <div className="break-words">{h.content}</div>
                                              <div className="mt-1 text-[10px] text-red-700">�� {h.author}, {new Date(h.timestamp).toLocaleString()}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ) : null}
                                </div>
                                <div className={`mt-1 text-xs ${st === 'rejected' ? 'text-red-700' : 'text-green-700'} opacity-80`}>— {last.author}, {new Date(last.timestamp).toLocaleString()}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                  {displayedRows.length === 0 && (
                    <tr>
                      <td colSpan={25} className="p-6 text-center text-slate-500">{statusFilter==='Rejected' ? 'No rejected rows' : 'No data for selected project'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={projDetailsOpen} onOpenChange={setProjDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
          </DialogHeader>
          {selectedProj ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Project Code</div>
                  <div className="font-medium">{selectedProj.code || selectedProj.data?.projectCode || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-medium">{String(selectedProj.status||'') === 'completed' ? 'Completed' : String(selectedProj.status||'') === 'in-progress' ? 'In Progress' : String(selectedProj.status||'') === 'hold' ? 'Hold' : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Client</div>
                  <div className="font-medium">{selectedProj.clientName || selectedProj.data?.clientName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Project Name</div>
                  <div className="font-medium">{selectedProj.name || selectedProj.data?.projectName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Division</div>
                  <div className="font-medium">{selectedProj.data?.division || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Nature of Assignment</div>
                  <div className="font-medium">{selectedProj.data?.auditType || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Reporting Frequency</div>
                  <div className="font-medium">{selectedProj.data?.reportingFrequency || '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Project Description</div>
                <div className="font-medium whitespace-pre-wrap">{selectedProj.data?.description || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Start Date</div>
                  <div className="font-medium">{formatDate(selectedProj.startDate || selectedProj.data?.startDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">End Date</div>
                  <div className="font-medium">{formatDate(selectedProj.endDate || selectedProj.data?.endDate)}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Progress</div>
                <div className="text-sm">{selectedProj.data?.progress != null ? `${selectedProj.data?.progress}%` : '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Division Heads</div>
                  <div className="text-sm">{Array.isArray(selectedProj.data?.divisionHeads) && selectedProj.data?.divisionHeads.length ? selectedProj.data?.divisionHeads.join(', ') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Partners</div>
                  <div className="text-sm">{Array.isArray(selectedProj.data?.partners) && selectedProj.data?.partners.length ? selectedProj.data?.partners.join(', ') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Team Leaders</div>
                  <div className="text-sm">{Array.isArray(selectedProj.data?.teamLeaders) && selectedProj.data?.teamLeaders.length ? selectedProj.data?.teamLeaders.join(', ') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Team Members</div>
                  <div className="text-sm">{Array.isArray(selectedProj.data?.teamMembers) && selectedProj.data?.teamMembers.length ? selectedProj.data?.teamMembers.join(', ') : '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Audit Universe</div>
                <div className="text-sm">{Array.isArray(selectedProj.data?.auditUniverse) && selectedProj.data?.auditUniverse.length ? selectedProj.data?.auditUniverse.join(', ') : '-'}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Scope Notes</div>
                <div className="text-sm whitespace-pre-wrap">{selectedProj.data?.scopeNotes || '-'}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={openFW && !!record} onOpenChange={setOpenFW}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Fieldwork: {selectedControlId}</DialogTitle>
          </DialogHeader>
          {record && (
            <div className="space-y-4">
              <Tabs value={String(record.activeTab)} onValueChange={(v)=>{ const idx = Number(v); setRecord({ activeTab: idx }); }}>
                <TabsList className="grid grid-cols-5">
                  {[0,1,2,3,4].map(i => (
                    <TabsTrigger key={i} value={String(i)}>{['Control Environment','Audit Methodology','Control Effectiveness','Audit Remarks','Audit Report'][i]}</TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="0" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Alternative Control</Label>
                      <Input value={record.env.alternativeControl} onChange={(e)=>updateTab('env', { alternativeControl: e.target.value })} />
                    </div>
                    <div>
                      <Label>Control Category for Alternate Control</Label>
                      <Select value={record.env.altControlCategory} onValueChange={(v)=>updateTab('env', { altControlCategory: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Preventive">Preventive</SelectItem>
                          <SelectItem value="Detective">Detective</SelectItem>
                          <SelectItem value="Corrective">Corrective</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Responsibility</Label>
                      <Input value={record.env.responsibility} onChange={(e)=>updateTab('env', { responsibility: e.target.value })} />
                    </div>
                    <div>
                      <Label>Risk Associated with Control</Label>
                      <Select value={record.env.riskAssociated} onValueChange={(v)=>updateTab('env', { riskAssociated: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Control Nature</Label>
                      <Select value={record.env.controlNature} onValueChange={(v)=>updateTab('env', { controlNature: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Preventive">Preventive</SelectItem>
                          <SelectItem value="Detective">Detective</SelectItem>
                          <SelectItem value="Corrective">Corrective</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="1" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label>Audit Methodology</Label>
                      <Select value={record.methodology.methodType} onValueChange={(v)=>{ const nv = v === '__CLEAR__' ? '' : v; updateTab('methodology', { methodType: nv, procedure: '', verification: '', samplingMethod: '' }); }}>
                        <SelectTrigger><SelectValue placeholder="Select methodology" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Test of Control">Test of Control</SelectItem>
                          <SelectItem value="Substantive Procedure">Substantive Procedure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Procedure</Label>
                      <Select value={record.methodology.procedure} onValueChange={(v)=>updateTab('methodology', { procedure: v === '__CLEAR__' ? '' : v })} disabled={!record.methodology.methodType}>
                        <SelectTrigger><SelectValue placeholder={record.methodology.methodType ? 'Select procedure' : 'Select methodology first'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          {record.methodology.methodType === 'Test of Control' ? (
                            <>
                              <SelectItem value="Observation">Observation</SelectItem>
                              <SelectItem value="Inquiry">Inquiry</SelectItem>
                              <SelectItem value="Reperformance">Reperformance</SelectItem>
                              <SelectItem value="Walkthroughs">Walkthroughs</SelectItem>
                              <SelectItem value="Inspection of Documents">Inspection of Documents</SelectItem>
                            </>
                          ) : record.methodology.methodType === 'Substantive Procedure' ? (
                            <>
                              <SelectItem value="Vouching">Vouching</SelectItem>
                              <SelectItem value="Verification">Verification</SelectItem>
                              <SelectItem value="Physical Verification">Physical Verification</SelectItem>
                              <SelectItem value="Recalculation">Recalculation</SelectItem>
                              <SelectItem value="Confirmation (external parties)">Confirmation (external parties)</SelectItem>
                              <SelectItem value="Analytical Procedures">Analytical Procedures</SelectItem>
                              <SelectItem value="Test Checking / Sampling">Test Checking / Sampling</SelectItem>
                              <SelectItem value="Cut-off Testing">Cut-off Testing</SelectItem>
                              <SelectItem value="Tracing">Tracing</SelectItem>
                              <SelectItem value="Casting & Cross-Casting">Casting & Cross-Casting</SelectItem>
                              <SelectItem value="Documentary">Documentary</SelectItem>
                              <SelectItem value="Review">Review</SelectItem>
                            </>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>
                    {record.methodology.methodType === 'Substantive Procedure' && (
                      <>
                        <div>
                          <Label>Sampling / 100% Verification</Label>
                          <Select value={record.methodology.verification} onValueChange={(v)=>{ const nv = v === '__CLEAR__' ? '' : v; updateTab('methodology', { verification: nv, samplingMethod: nv==='Sampling'?record.methodology.samplingMethod:'' }); }}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                              <SelectItem value="Sampling">Sampling</SelectItem>
                              <SelectItem value="100% Verification">100% Verification</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {record.methodology.verification === 'Sampling' && (
                          <div>
                            <Label>Sampling Method</Label>
                            <Select value={record.methodology.samplingMethod} onValueChange={(v)=>updateTab('methodology', { samplingMethod: v === '__CLEAR__' ? '' : v })}>
                              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                              <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                                <SelectItem value="Random Sampling">Random Sampling</SelectItem>
                                <SelectItem value="Systematic Sampling">Systematic Sampling</SelectItem>
                                <SelectItem value="Stratified Sampling">Stratified Sampling</SelectItem>
                                <SelectItem value="Cluster Sampling">Cluster Sampling</SelectItem>
                                <SelectItem value="Monetary Unit Sampling (MUS)">Monetary Unit Sampling (MUS)</SelectItem>
                                <SelectItem value="Judgmental Sampling">Judgmental Sampling</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="2" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Control Implementation</Label>
                      <Select value={record.methodology.implementationConclusion} onValueChange={(v)=>updateTab('methodology', { implementationConclusion: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Implemented">Implemented</SelectItem>
                          <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Control Effectiveness</Label>
                      <Select value={record.effectiveness.effectiveness} onValueChange={(v)=>updateTab('effectiveness', { effectiveness: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Effective">Effective</SelectItem>
                          <SelectItem value="Ineffective">Ineffective</SelectItem>
                          <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Control Design</Label>
                      <Select value={record.effectiveness.designConclusion} onValueChange={(v)=>updateTab('effectiveness', { designConclusion: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Effective">Effective</SelectItem>
                          <SelectItem value="Ineffective">Ineffective</SelectItem>
                          <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Control Automated</Label>
                      <Select value={record.effectiveness.automated} onValueChange={(v)=>updateTab('effectiveness', { automated: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Manual">Manual</SelectItem>
                          <SelectItem value="Automated">Automated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Control Rating</Label>
                      <Select value={record.effectiveness.rating} onValueChange={(v)=>updateTab('effectiveness', { rating: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="3" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label>Audit Remarks</Label>
                      <Textarea rows={3} value={record.remarks.auditRemarks} onChange={(e)=>updateTab('remarks', { auditRemarks: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Review Comments</Label>
                      <div className="space-y-2">
                        {(record.reviewHistory||[]).slice().reverse().map((c,idx)=> (
                          <div key={idx} className="p-2 border rounded text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{c.author}</span>
                              <span className="text-xs text-slate-500">{new Date(c.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="mt-1 text-slate-700">{c.content}</div>
                          </div>
                        ))}
                        {(record.reviewHistory||[]).length === 0 && (
                          <div className="text-slate-500 text-sm">No review comments yet</div>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Revised Audit Remarks</Label>
                      <Textarea rows={3} value={record.remarks.revisedAuditRemarks} onChange={(e)=>updateTab('remarks', { revisedAuditRemarks: e.target.value })} />
                    </div>
                    <div>
                      <Label>Review Status</Label>
                      <Select value={record.remarks.reviewStatus} disabled>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Approved">Approved</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="4" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Observation Ranking</Label>
                      <Select value={record.report.observationRanking} onValueChange={(v)=>updateTab('report', { observationRanking: v === '__CLEAR__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__CLEAR__">Clear</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Observation</Label>
                      <Textarea rows={3} value={record.report.observation} onChange={(e)=>updateTab('report', { observation: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Annexure</Label>
                      <Textarea rows={2} value={record.report.annexure} onChange={(e)=>updateTab('report', { annexure: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Risk/Effect</Label>
                      <Textarea rows={3} value={record.report.riskEffect} onChange={(e)=>updateTab('report', { riskEffect: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Recommendation</Label>
                      <Textarea rows={3} value={record.report.recommendation} onChange={(e)=>updateTab('report', { recommendation: e.target.value })} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={completeCurrentTab}><Save className="h-4 w-4 mr-2" />Save Draft</Button>
                <Button variant="outline" onClick={submitForReview}><Share2 className="h-4 w-4 mr-2" />Submit for Review</Button>
                <Button onClick={()=>window.print()}><FileText className="h-4 w-4 mr-2" />Export Report</Button>
              </div>

              <AlertDialog open={submitAckOpen} onOpenChange={setSubmitAckOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submitted for Review</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction onClick={()=>setSubmitAckOpen(false)}>OK</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
