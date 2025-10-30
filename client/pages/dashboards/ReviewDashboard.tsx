import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, CheckCircle2, XCircle, Search, Save, Rows3, Columns2, Download, Filter as FilterIcon } from 'lucide-react';
import { FieldworkRecord } from '@shared/fieldwork';
import { FieldworkStore } from '@/contexts/FieldworkStore';
import { RiskConfigStore } from '@/contexts/RiskConfigStore';
import { useAuth } from '@/contexts/AuthContext';
import { AssignmentTypeStore } from '@/contexts/AssignmentTypeStore';
import * as XLSX from 'xlsx';
import { computeResidual, computeRiskScore } from '@shared/risk';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ControlRow {
  id: string;
  name: string;
  process?: string;
  subprocess?: string;
  activity?: string;
  risk?: string;
}

const FRAMEWORK_DATA_URL = 'https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c';

export default function ReviewDashboard() {
  const { user } = useAuth();
  const { user } = useAuth();
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, FieldworkRecord>>({});
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Approved' | 'Rejected'>('Submitted');
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('0');
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({});
  const [ackOpen, setAckOpen] = useState(false);
  const [riskConfigVersion, setRiskConfigVersion] = useState(0);
  const [assignmentTypes, setAssignmentTypes] = useState<{id:string;name:string}[]>([]);
  const [ackMsg, setAckMsg] = useState('');
  const [projects, setProjects] = useState<{ id: string; title: string; raw?: any }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projDetailsOpen, setProjDetailsOpen] = useState(false);

  // Export toolbar state
  const rvAllFields = [
    'Project No','Project Name','Client',
    'Activity','Risk','Control','Likelihood','Consequence','Risk Score','Control Score','Residual Risk','Risk Level','Color','Test of Control','Substantive Procedure','Sampling Applicable?','Sampling Methodology','Control Effective','Attachments','Audit Remarks','Red flag','Reportable','Observation Ranking','Audit Observation','Effect','Recommendation','Annexure','Review Status'
  ] as const;
  const [rvSelectedFields, setRvSelectedFields] = useState<string[]>([...rvAllFields]);
  const [rvGroupBy, setRvGroupBy] = useState<'none'|'Review Status'>('none');
  const [rvFilters, setRvFilters] = useState<{ projCode: string; projName: string; client: string; reviewStatus: ''|'submitted'|'approved'|'rejected' }>({ projCode: '', projName: '', client: '', reviewStatus: '' });
  const [rvFilterOpen, setRvFilterOpen] = useState(false);

  const getRecKey = (controlId: string): string => {
    if (selectedProject) return `${selectedProject}|${controlId}`;
    const entry = Object.entries(records).find(([_, r]) => (r as any)?.controlId === controlId && (r as any)?.status === 'submitted');
    if (entry) return entry[0];
    const anyEntry = Object.entries(records).find(([_, r]) => (r as any)?.controlId === controlId);
    return anyEntry ? anyEntry[0] : controlId;
  };

  const submittedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of Object.values(records)) {
      if (r.status === 'submitted' && r.projectId) {
        counts[r.projectId] = (counts[r.projectId] || 0) + 1;
      }
    }
    return counts;
  }, [records]);

  const projectsForReview = useMemo(() => {
    return projects.filter(p => (submittedCounts[p.id] || 0) > 0);
  }, [projects, submittedCounts]);

  useEffect(() => {
    if (selectedProject && !projectsForReview.some(p => p.id === selectedProject)) {
      setSelectedProject(null);
    }
  }, [projectsForReview, selectedProject]);

  const riskDisabled = React.useMemo(() => {
    if (!selectedProject) return false;
    const proj = projects.find(p => p.id === selectedProject);
    return proj?.raw?.data?.riskModuleEnabled === false;
  }, [selectedProject, projects]);

  const activeCfg = React.useMemo(() => {
    if (!selectedProject) return RiskConfigStore.getGlobal();
    const proj = projects.find(p => p.id === selectedProject) as any;
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

  useEffect(() => {
    const unsub = FieldworkStore.subscribe(() => setRecords(FieldworkStore.getAll()));
    const unsubRisk = RiskConfigStore.subscribe(() => setRiskConfigVersion(v=>v+1));
    const unsubAssn = AssignmentTypeStore.subscribe(() => setAssignmentTypes(AssignmentTypeStore.getAll()));
    setRecords(FieldworkStore.getAll());
    setAssignmentTypes(AssignmentTypeStore.getAll());
    return () => { unsub(); unsubRisk(); unsubAssn(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) return;
        const rows = await res.json();
        const mapped = (rows || []).map((r: any) => ({ id: r.id, title: r.name || r.data?.projectName || r.code || 'Untitled Project', raw: r }));

        const roleScopeMap = (() => { try { return JSON.parse(localStorage.getItem('roleProjectScope') || '{}'); } catch { return {}; } })();
        const userScopeMap = (() => { try { return JSON.parse(localStorage.getItem('userProjectScope') || '{}'); } catch { return {}; } })();
        const scope = (user?.id && userScopeMap[user.id]) ? userScopeMap[user.id] : (user?.role ? roleScopeMap[user.role] : 'all');
        const normalizedRole = (user?.role || '').toLowerCase();
        const isTargetRole = ['division partner','partner','division head','team leader','team member'].includes(normalizedRole);
        const userName = user?.username || '';
        const initials = userName.split(' ').map((s:string)=>s[0]).join('');
        const isOnProject = (prj: any) => {
          const d = prj?.raw?.data || {};
          const lists: string[][] = [d.divisionHeads||[], d.partners||[], d.teamLeaders||[], d.teamMembers||[]];
          const flat = lists.flat().map((s:string)=>String(s||''));
          return flat.includes(userName) || flat.includes(initials);
        };
        const filtered = (scope === 'own' && isTargetRole && user) ? mapped.filter(isOnProject) : mapped;
        setProjects(filtered);
      } catch {}
    })();
  }, [user]);

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
      try {
        const res = await fetch(FRAMEWORK_DATA_URL);
        const json = await res.json();
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
      } catch {}
    })();
  }, [controls.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = controls.filter(c => {
      const key = selectedProject ? `${selectedProject}|${c.id}` : c.id;
      const status = records[key]?.status || 'draft';
      if (statusFilter === 'All') return status !== 'draft';
      if (statusFilter === 'Submitted') return status === 'submitted';
      if (statusFilter === 'Approved') return status === 'approved';
      if (statusFilter === 'Rejected') return status === 'rejected';
      return false;
    });
    if (!q) return list;
    return list.filter(c => [c.id, c.name, c.process, c.subprocess, c.activity, c.risk]
      .filter(Boolean)
      .map(s => String(s).toLowerCase())
      .some(s => s.includes(q))
    );
  }, [controls, search, records, statusFilter]);

  const record = selectedControlId ? records[selectedControlId] : undefined;

  const arcRows = useMemo(() => {
    const all = Object.values(records).filter(r => r.status === 'submitted' && (!selectedProject || r.projectId === selectedProject));
    return all.map(r => {
      const ctrl = controls.find(c => c.id === r.controlId);
      const a: any = (r as any).arc || {};
      const samplingApplicable = a.samplingApplicable || (r.methodology.verification ? (r.methodology.verification === 'Sampling' ? 'Yes' : 'No') : '');
      const controlEffective = a.controlEffective || (r.effectiveness.effectiveness === 'Effective' ? 'Yes' : r.effectiveness.effectiveness === 'Ineffective' ? 'No' : '');
      return {
        id: r.controlId,
        activity: a.activity || ctrl?.activity || '',
        risk: a.risk || ctrl?.risk || '',
        control: a.control || ctrl?.name || '',
        testOfControl: a.testOfControl || (r.methodology.methodType === 'Test of Control' ? r.methodology.procedure : ''),
        substantiveProcedure: a.substantiveProcedure || (r.methodology.methodType === 'Substantive Procedure' ? r.methodology.procedure : ''),
        samplingApplicable,
        samplingMethodology: a.samplingMethodology || r.methodology.samplingMethod || '',
        controlEffective,
        attachments: a.attachments || '',
        auditRemarks: a.auditRemarks || r.remarks.auditRemarks || '',
        redFlag: a.redFlag || '',
        reportable: a.reportable || '',
        observationRanking: a.observationRanking || r.report.observationRanking || '',
        auditObservation: a.auditObservation || r.report.observation || '',
        effect: a.effect || r.report.riskEffect || '',
        recommendation: a.recommendation || r.report.recommendation || '',
        annexure: a.annexure || r.report.annexure || '',
        status: r.status as string,
      };
    });
  }, [records, controls]);

  const openReviewFor = (id: string) => {
    const key = selectedProject ? `${selectedProject}|${id}` : id;
    const rec = FieldworkStore.get(key);
    if (!rec) return; // Only open if exists
    setSelectedControlId(id);
    setActiveTab('0');
  };

  const approve = () => {
    if (!selectedControlId || !user) return;
    FieldworkStore.addReview(selectedControlId, user.username, newComment, 'Approved');
    setNewComment('');
    setAckMsg('Approved successfully');
    setAckOpen(true);
  };
  const reject = () => {
    if (!selectedControlId || !user) return;
    FieldworkStore.addReview(selectedControlId, user.username, newComment, 'Rejected');
    setNewComment('');
    setAckMsg('Rejected with comment');
    setAckOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-7 w-7 text-blue-600" />
          Review Module
        </h1>
        <Badge className="bg-blue-100 text-blue-800">Review</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <Label>Project</Label>
          <Select value={selectedProject || ''} onValueChange={(v)=> setSelectedProject(v === '__CLEAR__' ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projectsForReview.length === 0 && (
                <SelectItem value="__NONE__" disabled>No projects with submissions</SelectItem>
              )}
              {projectsForReview.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title} ({submittedCounts[p.id] || 0})</SelectItem>
              ))}
              <SelectItem value="__CLEAR__">Clear</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex justify-end items-center gap-2">
          {/* Filters */}
          <Popover open={rvFilterOpen} onOpenChange={setRvFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><FilterIcon className="h-4 w-4"/> Filter</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3">
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Project No</Label>
                    <Input value={rvFilters.projCode} onChange={(e)=>setRvFilters(prev=>({...prev, projCode:e.target.value}))} placeholder="Search code" />
                  </div>
                  <div>
                    <Label className="text-xs">Project Name</Label>
                    <Input value={rvFilters.projName} onChange={(e)=>setRvFilters(prev=>({...prev, projName:e.target.value}))} placeholder="Search name" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Client</Label>
                    <Input value={rvFilters.client} onChange={(e)=>setRvFilters(prev=>({...prev, client:e.target.value}))} placeholder="Search client" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Review Status</Label>
                    <Select value={rvFilters.reviewStatus} onValueChange={(v: any)=> setRvFilters(prev=>({...prev, reviewStatus: v }))}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Group */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Rows3 className="h-4 w-4"/> Group</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="grid gap-2">
                {(['none','Review Status'] as const).map(opt => (
                  <Button key={opt} variant={rvGroupBy===opt?'default':'outline'} size="sm" className="justify-start" onClick={()=>setRvGroupBy(opt)}>
                    {opt}
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
                {rvAllFields.map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rvSelectedFields.includes(f)} onChange={(e)=> setRvSelectedFields(prev => e.target.checked ? [...prev, f as string] : prev.filter(x=>x!==f))} />
                    <span>{f}</span>
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={()=>setRvSelectedFields([...rvAllFields])}>All</Button>
                  <Button size="sm" variant="outline" onClick={()=>setRvSelectedFields([...rvAllFields])}>Default</Button>
                  <Button size="sm" variant="outline" onClick={()=>setRvSelectedFields([])}>None</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export */}
          <Button size="sm" className="flex items-center gap-2" onClick={()=>{
            const wb = XLSX.utils.book_new();
            const safe = (s:string)=> s.replace(/[\\/?*\[\]]/g, '').slice(0,31) || 'Sheet';
            const usedNames = new Set<string>();
            const unique = (base:string) => {
              let name = safe(base);
              if (!usedNames.has(name)) { usedNames.add(name); return name; }
              let i = 2;
              while (true) {
                const suffix = ` (${i})`;
                const max = 31 - suffix.length;
                const candidate = safe(base).slice(0, Math.max(1,max)) + suffix;
                if (!usedNames.has(candidate)) { usedNames.add(candidate); return candidate; }
                i++;
              }
            };
            const includeProject = (p:any) => {
              const code = p?.code || p?.data?.projectCode || '';
              const name = p?.name || p?.data?.projectName || '';
              const client = p?.clientName || p?.data?.clientName || '';
              if (rvFilters.projCode && !String(code).toLowerCase().includes(rvFilters.projCode.toLowerCase())) return false;
              if (rvFilters.projName && !String(name).toLowerCase().includes(rvFilters.projName.toLowerCase())) return false;
              if (rvFilters.client && !String(client).toLowerCase().includes(rvFilters.client.toLowerCase())) return false;
              return true;
            };
            const resolveCfg = (raw:any) => {
              const data = raw?.data || {};
              const auditTypeName = data.auditType;
              const assn = assignmentTypes.find(a => a.name === auditTypeName);
              const central = RiskConfigStore.get('assignment') || RiskConfigStore.getGlobal();
              const map = (central.scope as any)?.assignmentMap || {};
              const mode = assn ? map[assn.id]?.mode : undefined;
              if (mode === 'project' && data.riskConfig) return data.riskConfig;
              if (mode === 'assignment' && assn) return RiskConfigStore.get(`assignment|${assn.id}`) || RiskConfigStore.getGlobal();
              return RiskConfigStore.getGlobal();
            };
            const buildRow = (p:any, rec:any, ctrl:any, a:any) => {
              const row: Record<string, any> = {};
              const code = p?.code || p?.data?.projectCode || '';
              const name = p?.name || p?.data?.projectName || '';
              const client = p?.clientName || p?.data?.clientName || '';
              const cfg = resolveCfg(p);
              const riskVal = computeRiskScore(cfg.riskScore.mode, rec?.risk?.likelihood, rec?.risk?.consequence, rec?.risk?.riskScore);
              const resid = computeResidual(cfg.residualRisk.formula, Number(riskVal||0), Number(rec?.risk?.controlScore||0), cfg.controlScore.scale);
              if (rvSelectedFields.includes('Project No')) row['Project No'] = code;
              if (rvSelectedFields.includes('Project Name')) row['Project Name'] = name;
              if (rvSelectedFields.includes('Client')) row['Client'] = client;
              if (rvSelectedFields.includes('Activity')) row['Activity'] = a.activity || ctrl?.activity || '';
              if (rvSelectedFields.includes('Risk')) row['Risk'] = a.risk || ctrl?.risk || '';
              if (rvSelectedFields.includes('Control')) row['Control'] = a.control || ctrl?.name || '';
              if (rvSelectedFields.includes('Likelihood')) row['Likelihood'] = rec?.risk?.likelihood ?? '';
              if (rvSelectedFields.includes('Consequence')) row['Consequence'] = rec?.risk?.consequence ?? '';
              if (rvSelectedFields.includes('Risk Score')) row['Risk Score'] = riskVal ?? '';
              if (rvSelectedFields.includes('Control Score')) row['Control Score'] = rec?.risk?.controlScore ?? '';
              if (rvSelectedFields.includes('Residual Risk')) row['Residual Risk'] = Math.round((Number(resid||0) + Number.EPSILON) * 100) / 100;
              if (rvSelectedFields.includes('Risk Level')) row['Risk Level'] = rec?.risk?.residualLevel || '';
              if (rvSelectedFields.includes('Color')) row['Color'] = '';
              if (rvSelectedFields.includes('Test of Control')) row['Test of Control'] = a.testOfControl || (rec?.methodology?.methodType === 'Test of Control' ? rec?.methodology?.procedure : '');
              if (rvSelectedFields.includes('Substantive Procedure')) row['Substantive Procedure'] = a.substantiveProcedure || (rec?.methodology?.methodType === 'Substantive Procedure' ? rec?.methodology?.procedure : '');
              if (rvSelectedFields.includes('Sampling Applicable?')) row['Sampling Applicable?'] = a.samplingApplicable || (rec?.methodology?.verification ? (rec?.methodology?.verification === 'Sampling' ? 'Yes' : 'No') : '');
              if (rvSelectedFields.includes('Sampling Methodology')) row['Sampling Methodology'] = a.samplingMethodology || rec?.methodology?.samplingMethod || '';
              if (rvSelectedFields.includes('Control Effective')) row['Control Effective'] = a.controlEffective || (rec?.effectiveness?.effectiveness === 'Effective' ? 'Yes' : rec?.effectiveness?.effectiveness === 'Ineffective' ? 'No' : '');
              if (rvSelectedFields.includes('Attachments')) row['Attachments'] = a.attachments || '';
              if (rvSelectedFields.includes('Audit Remarks')) row['Audit Remarks'] = a.auditRemarks || rec?.remarks?.auditRemarks || '';
              if (rvSelectedFields.includes('Red flag')) row['Red flag'] = a.redFlag || '';
              if (rvSelectedFields.includes('Reportable')) row['Reportable'] = a.reportable || '';
              if (rvSelectedFields.includes('Observation Ranking')) row['Observation Ranking'] = a.observationRanking || rec?.report?.observationRanking || '';
              if (rvSelectedFields.includes('Audit Observation')) row['Audit Observation'] = a.auditObservation || rec?.report?.observation || '';
              if (rvSelectedFields.includes('Effect')) row['Effect'] = a.effect || rec?.report?.riskEffect || '';
              if (rvSelectedFields.includes('Recommendation')) row['Recommendation'] = a.recommendation || rec?.report?.recommendation || '';
              if (rvSelectedFields.includes('Annexure')) row['Annexure'] = a.annexure || rec?.report?.annexure || '';
              if (rvSelectedFields.includes('Review Status')) row['Review Status'] = rec?.status || '';
              return row;
            };
            const exportProject = (proj:any) => {
              const pid = proj?.id;
              const recs = Object.values(records).filter(r => r.projectId === pid && r.status && r.status !== 'draft');
              const list = recs.map(r => {
                const ctrl = controls.find(c => c.id === r.controlId);
                const a:any = (r as any).arc || {};
                return { rec: r, ctrl, arc: a };
              });
              const rows = [] as any[];
              if (rvGroupBy === 'none') {
                list.forEach(({rec, ctrl, arc}) => rows.push(buildRow(proj?.raw, rec, ctrl, arc)));
              } else {
                const grouped: Record<string, any[]> = {};
                list.forEach(({rec, ctrl, arc}) => {
                  const key = rec.status || 'submitted';
                  const row = buildRow(proj?.raw, rec, ctrl, arc);
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(row);
                });
                const labels = Object.keys(grouped).sort((a,b)=>a.localeCompare(b));
                for (const lab of labels) { rows.push({ Group: lab }); grouped[lab].forEach(r => rows.push(r)); rows.push({}); }
              }
              const ws = XLSX.utils.json_to_sheet(rows);
              const label = proj?.raw?.code || proj?.raw?.name || proj?.id || '';
              XLSX.utils.book_append_sheet(wb, ws, unique(`Review ${label}`));
            };

            if (selectedProject) {
              const proj = projects.find(p=>p.id===selectedProject);
              if (proj && includeProject(proj.raw)) exportProject(proj);
            } else {
              projects.forEach(p => { if (includeProject(p.raw)) exportProject(p); });
            }
            XLSX.writeFile(wb, 'review.xlsx');
          }}><Download className="h-4 w-4"/> Export XLSX</Button>
          <Button variant="outline" onClick={() => setProjDetailsOpen(true)} disabled={!selectedProject}>View details</Button>
        </div>
      </div>

      <Card className="h-[560px] overflow-hidden">
        <CardHeader>
          <CardTitle>Submitted Rows (Read-only)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 h-full">
          <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  {(
                    riskDisabled
                      ? ['Activity','Risk','Control','Test of Control','Substantive Procedure','Sampling Applicable?','Sampling Methodology','Control Effective','Attachments','Audit Remarks','Red flag','Reportable','Observation Ranking','Audit Observation','Effect','Recommendation','Annexure','Review Comments','Approve','Reject']
                      : ['Activity','Risk','Control','Likelihood','Consequence','Risk Score','Control Score','Residual Risk','Risk Level','Color','Test of Control','Substantive Procedure','Sampling Applicable?','Sampling Methodology','Control Effective','Attachments','Audit Remarks','Red flag','Reportable','Observation Ranking','Audit Observation','Effect','Recommendation','Annexure','Review Comments','Approve','Reject']
                  ).map(h => (
                    <th key={h} className="text-left p-3 w-64">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arcRows.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 align-top w-64 break-words">{row.activity || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.risk || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.control || '-'}</td>
                    {(() => {
                      const key = getRecKey(row.id);
                      const rec = records[key];
                      const cfg = activeCfg;
                      if (riskDisabled) return null;
                      const l = rec?.risk?.likelihood ?? '-';
                      const c = rec?.risk?.consequence ?? '-';
                      let rs: any = rec?.risk?.riskScore;
                      if (typeof rs !== 'number') {
                        rs = computeRiskScore(cfg.riskScore.mode, rec?.risk?.likelihood, rec?.risk?.consequence, rec?.risk?.riskScore);
                      }
                      const pickRiskColor = (val: number) => {
                        const ranges = cfg.residualRisk?.thresholds?.ranges || [];
                        if (ranges.length > 0) {
                          for (let i=0;i<ranges.length;i++) { const r = ranges[i]; if (val >= r.from && val <= r.to) { return r.color || cfg.residualRisk.thresholds?.heatmapColors?.[r.label]; } }
                        }
                        const labels = Array.isArray(cfg.riskScore.labels) ? [...cfg.riskScore.labels] : [];
                        labels.sort((a,b)=>a.value-b.value);
                        let chosen = labels[0];
                        for (const ln of labels) { if (val >= ln.value) chosen = ln; }
                        return chosen?.color;
                      };
                      const cs: any = rec?.risk?.controlScore ?? '-';
                      const rr = computeResidual(cfg.residualRisk.formula, Number(rs||0), Number(cs||0), cfg.controlScore.scale);
                      const lvl = getResidualLevel(rr, cfg.residualRisk.thresholds);
                      const riskColor = typeof rs === 'number' ? pickRiskColor(rs) : undefined;
                      const controlColor = (() => {
                        const labels = Array.isArray(cfg.controlScore.labels) ? [...cfg.controlScore.labels] : [];
                        labels.sort((a,b)=>a.value-b.value);
                        let chosen = labels[0];
                        for (const ln of labels) { if ((cs as number) >= ln.value) chosen = ln; }
                        return chosen?.color;
                      })();
                      return (
                        <>
                          <td className="p-3 align-top w-40 break-words"><span>{l}</span></td>
                          <td className="p-3 align-top w-40 break-words"><span>{c}</span></td>
                          <td className="p-3 align-top w-40 break-words"><span className="inline-flex items-center gap-2"><span>{rs ?? '-'}</span>{riskColor ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: riskColor }} /> : null}</span></td>
                          <td className="p-3 align-top w-40 break-words"><span className="inline-flex items-center gap-2"><span>{cs ?? '-'}</span>{controlColor ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: controlColor }} /> : null}</span></td>
                          <td className="p-3 align-top w-40 break-words"><span className="inline-flex items-center gap-2"><span>{Number.isFinite(rr) ? Math.round((rr + Number.EPSILON) * 100) / 100 : 0}</span>{lvl?.color ? <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: lvl.color }} /> : null}</span></td>
                          <td className="p-3 align-top w-40 break-words"><span>{lvl?.level || 'Low'}</span></td>
                          <td className="p-3 align-top w-24 break-words">{lvl?.color ? <span className="inline-block w-5 h-5 rounded" title={lvl?.level} style={{ backgroundColor: lvl.color }} /> : <span className="inline-block w-5 h-5 rounded bg-emerald-500" title="Low" />}</td>
                        </>
                      );
                    })()}
                    <td className="p-3 align-top w-64 break-words">{row.testOfControl || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.substantiveProcedure || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.samplingApplicable || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.samplingMethodology || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.controlEffective || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.attachments || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">
                      <div>{row.auditRemarks || '-'}</div>
                      {(() => {
                        const key = getRecKey(row.id);
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
                                          <div className="mt-1 text-[10px] text-slate-600">— {h.author}, {new Date(h.timestamp).toLocaleString()}</div>
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
                    <td className="p-3 align-top w-64 break-words">{row.redFlag || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.reportable || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.observationRanking || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.auditObservation || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.effect || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.recommendation || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.annexure || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">
                      <Input value={reviewDraft[row.id] || ''} onChange={(e)=> setReviewDraft(prev => ({ ...prev, [row.id]: e.target.value }))} placeholder="Add review comments" />
                      {(() => {
                        const hist = records[getRecKey(row.id)]?.reviewHistory || [];
                        if (hist.length === 0) return null;
                        const last = hist[hist.length - 1];
                        const rejCount = hist.filter(h => (h.content || '').startsWith('Rejected')).length;
                        return (
                          <div className="mt-2">
                            <div className="inline-block max-w-xs px-3 py-2 rounded-lg shadow-sm bg-slate-50 border border-slate-200 text-slate-800">
                              <div className="flex items-start justify-between gap-2">
                                <div className="break-words">{last.content}</div>
                                {rejCount > 0 ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="ml-2 inline-flex items-center justify-center rounded-full text-xs px-2 py-0.5 border border-red-300 text-red-700" title="Times rejected">×{rejCount}</button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-2">
                                      <div className="text-xs font-medium mb-1">Past rejection comments</div>
                                      <div className="space-y-2 max-h-64 overflow-auto">
                                        {hist.filter(h => (h.content || '').startsWith('Rejected')).map((h, i) => (
                                          <div key={i} className="p-2 border rounded bg-red-50 text-red-800">
                                            <div className="break-words">{h.content}</div>
                                            <div className="mt-1 text-[10px] text-red-700">— {h.author}, {new Date(h.timestamp).toLocaleString()}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs text-slate-600 opacity-80">— {last.author}, {new Date(last.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3 align-top w-64 break-words">
                      <Button variant="default" size="sm" className="bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] shadow-md focus-visible:ring-2 focus-visible:ring-green-400 transition" onClick={()=>{ if (!user) return; FieldworkStore.addReview(getRecKey(row.id), user.username, reviewDraft[row.id] || '', 'Approved'); setAckMsg('Approved successfully'); setAckOpen(true); }}>
                        Approve
                      </Button>
                    </td>
                    <td className="p-3 align-top w-64 break-words">
                      <Button variant="destructive" size="sm" onClick={()=>{ if (!user) return; FieldworkStore.addReview(getRecKey(row.id), user.username, reviewDraft[row.id] || '', 'Rejected'); setAckMsg('Rejected'); setAckOpen(true); }}>
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
                {arcRows.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-slate-500" colSpan={20}>No submitted rows</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={ackOpen} onOpenChange={setAckOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ackMsg}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={()=>setAckOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={projDetailsOpen} onOpenChange={setProjDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
          </DialogHeader>
          {(() => { const proj = projects.find(p => p.id === (selectedProject||''))?.raw; if (!proj) return null; const formatDate = (d: any) => { try { if (!d) return '-'; const dt = new Date(d); return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString(); } catch { return '-'; } }; return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Project Code</div>
                  <div className="font-medium">{proj.code || proj.data?.projectCode || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Client</div>
                  <div className="font-medium">{proj.clientName || proj.data?.clientName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Project Name</div>
                  <div className="font-medium">{proj.name || proj.data?.projectName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Division</div>
                  <div className="font-medium">{proj.data?.division || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Nature of Assignment</div>
                  <div className="font-medium">{proj.data?.auditType || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Reporting Frequency</div>
                  <div className="font-medium">{proj.data?.reportingFrequency || '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Project Description</div>
                <div className="font-medium whitespace-pre-wrap">{proj.data?.description || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Start Date</div>
                  <div className="font-medium">{formatDate(proj.startDate || proj.data?.startDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">End Date</div>
                  <div className="font-medium">{formatDate(proj.endDate || proj.data?.endDate)}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Progress</div>
                <div className="text-sm">{proj.data?.progress != null ? `${proj.data?.progress}%` : '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Division Heads</div>
                  <div className="text-sm">{Array.isArray(proj.data?.divisionHeads) && proj.data?.divisionHeads.length ? proj.data?.divisionHeads.join(', ') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Partners</div>
                  <div className="text-sm">{Array.isArray(proj.data?.partners) && proj.data?.partners.length ? proj.data?.partners.join(', ') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Team Leaders</div>
                  <div className="text-sm">{Array.isArray(proj.data?.teamLeaders) && proj.data?.teamLeaders.length ? proj.data?.teamLeaders.join(', ') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Team Members</div>
                  <div className="text-sm">{Array.isArray(proj.data?.teamMembers) && proj.data?.teamMembers.length ? proj.data?.teamMembers.join(', ') : '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Audit Universe</div>
                <div className="text-sm">{Array.isArray(proj.data?.auditUniverse) && proj.data?.auditUniverse.length ? proj.data?.auditUniverse.join(', ') : '-'}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Scope Notes</div>
                <div className="text-sm whitespace-pre-wrap">{proj.data?.scopeNotes || '-'}</div>
              </div>
            </div>
          ); })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
