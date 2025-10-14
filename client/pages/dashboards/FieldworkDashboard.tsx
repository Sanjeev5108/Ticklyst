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
import { FileText, Save, CheckCircle2, XCircle, Share2, Search } from 'lucide-react';
import { FieldworkRecord } from '@shared/fieldwork';
import { FieldworkStore } from '@/contexts/FieldworkStore';
import { RiskConfigStore } from '@/contexts/RiskConfigStore';
import { computeResidual, computeRiskScore, resolveLevel } from '@shared/risk';
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
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [selectedSubprocess, setSelectedSubprocess] = useState<string | null>(null);
  const [matrixRows, setMatrixRows] = useState<{ id: string; activity: string; risk: string; control: string; controlOwner: string; likelihood: number; consequence: number; riskScore: number; controlScore: number; residualRisk: number; riskLevel: string; residualLevel: string; testOfControl: string; substantiveProcedure: string; samplingApplicable: string; samplingMethodology: string; controlEffectiveness: string; attachments: string; auditRemarks: string; observationRanking: string; auditObservation: string; effect: string; recommendation: string; annexure: string; redFlag: string; reportable: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, FieldworkRecord>>({});
  const [statusFilter, setStatusFilter] = useState<'All' | 'In progress' | 'Approved' | 'Rejected'>('All');
  const [openFW, setOpenFW] = useState(false);
  const [submitAckOpen, setSubmitAckOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const [riskConfigVersion, setRiskConfigVersion] = useState(0);
  useEffect(() => {
    const unsub = FieldworkStore.subscribe(() => setRecords(FieldworkStore.getAll()));
    const unsubRisk = RiskConfigStore.subscribe(() => setRiskConfigVersion(v=>v+1));
    setRecords(FieldworkStore.getAll());
    return () => { unsub(); unsubRisk(); };
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
  const getSubprocesses = useCallback((proc: string | null) => {
    if (!proc) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc).map(c => c.subprocess || 'General'))).sort();
  }, [controls]);
  const getActivities = useCallback((proc: string | null, sub: string | null) => {
    if (!proc || !sub) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc && (c.subprocess || 'General') === sub).map(c => c.activity || 'General'))).sort();
  }, [controls]);
  const getRisks = useCallback((proc: string | null, sub: string | null, act: string) => {
    if (!proc || !sub || !act) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc && (c.subprocess || 'General') === sub && (c.activity || 'General') === act).map(c => c.risk || ''))).filter(Boolean).sort();
  }, [controls]);
  const getControls = useCallback((proc: string | null, sub: string | null, act: string, risk: string) => {
    if (!proc || !sub || !act || !risk) return [] as string[];
    return Array.from(new Set(controls.filter(c => c.process === proc && (c.subprocess || 'General') === sub && (c.activity || 'General') === act && (c.risk || '') === risk).map(c => c.name))).sort();
  }, [controls]);

  useEffect(() => {
    if (!selectedProcess) { setSelectedSubprocess(null); setMatrixRows([]); return; }
    const subs = getSubprocesses(selectedProcess);
    if (subs.length && !selectedSubprocess) setSelectedSubprocess(subs[0]);
  }, [selectedProcess, selectedSubprocess, getSubprocesses]);

  useEffect(() => {
    if (!selectedProcess || !selectedSubprocess) { setMatrixRows([]); return; }
    const rcfg = RiskConfigStore.getGlobal();
    const rows = controls
      .filter(c => c.process === selectedProcess && (c.subprocess || 'General') === selectedSubprocess)
      .map(c => ({ id: c.id, activity: c.activity || '', risk: c.risk || '', control: c.name, controlOwner: '', likelihood: rcfg.riskScore.likelihood?.scale.min || 1, consequence: rcfg.riskScore.consequence?.scale.min || 1, riskScore: 0, controlScore: rcfg.controlScore.scale.min, residualRisk: 0, riskLevel: '', residualLevel: '', testOfControl: '', substantiveProcedure: '', samplingApplicable: '', samplingMethodology: '', controlEffectiveness: '', attachments: '', auditRemarks: '', observationRanking: '', auditObservation: '', effect: '', recommendation: '', annexure: '', redFlag: '', reportable: '' }))
      .sort((a,b)=>{
        return (a.activity.localeCompare(b.activity) || a.risk.localeCompare(b.risk) || a.control.localeCompare(b.control));
      });
    setMatrixRows(rows);
  }, [selectedProcess, selectedSubprocess, controls, riskConfigVersion]);

  // Projects (sourced from ProjectManagement mock list)
  const projects = [
    { id: '1', title: 'SQ/25-26/0135 - Customisation T...' },
    { id: '2', title: 'SQ/25-26/0150 - Customisation T...' },
    { id: '3', title: 'CA Articles Training' },
    { id: '4', title: 'Reshmi - Customisation' },
    { id: '5', title: 'Artika VII - Customisation' },
    { id: '6', title: 'SQ/25-26/0086 - Prashanthi Cust...' },
    { id: '7', title: 'SQ/25-26/0168 - RMCL CCA June...' },
    { id: '8', title: 'KSS Event ABC' },
    { id: '9', title: 'SQ/25-26/0059 - MMD IA April 2...' }
  ];

  const testOfControlOptions = ['Observation','Inquiry','Re performance','Walkthrough','Inspection of documents'];
  const substantiveProcedureOptions = ['Vouching','Verification','Physical Verification','Recalculation','Confirmation','Analytical Procedures','Test Checking / Sampling','Cut-off Testing','Tracing','Casting & Cross-Casting','Documentary','Review'];
  const samplingMethodologyOptions = ['Random Sampling','Systematic Sampling','Stratified Sampling','Cluster Sampling','Monetary Unit Sampling (MUS)','Judgmental Sampling'];
  const controlEffectivenessOptions = ['Yes','No'];

  const getStatus = useCallback((id: string) => records[id]?.status || 'draft', [records]);

  const rejectedCount = useMemo(() => Object.values(records).filter(r => r.status === 'rejected').length, [records]);

  const rejectedRows = useMemo(() => {
    const all = Object.values(records).filter(r => r.status === 'rejected');
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
    const all = Object.values(records).filter(r => r.status === 'approved');
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
      const rec = records[c.id];
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
    setSelectedControlId(id);
    FieldworkStore.ensure(id, () => ({
      controlId: id,
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
  const submitForReview = () => { if (record && selectedControlId) { FieldworkStore.submitForReview(selectedControlId); setRecords(FieldworkStore.getAll()); setSubmitAckOpen(true); } };
  const canOpenTab = (idx: number) => !record ? false : idx <= record.progress + 1;

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
          <Select value={selectedProject || ''} onValueChange={(v)=>{ const nv = v === '__CLEAR__' ? null : v; setSelectedProject(nv); setSelectedProcess(null); setSelectedSubprocess(null); }}>
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
        <div>
          <Label>Process</Label>
          <Typeahead items={processes} value={selectedProcess} onSelect={(v)=>{ setSelectedProcess(v); }} placeholder="Select or search process..." disabled={!selectedProject} />
        </div>
        <div>
          <Label>Subprocess</Label>
          <Typeahead items={getSubprocesses(selectedProcess)} value={selectedSubprocess} onSelect={(v)=> setSelectedSubprocess(v)} placeholder="Select or search subprocess..." disabled={!selectedProcess} />
        </div>
      </div>

      <div className="flex justify-end">
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <span>Filter{statusFilter !== 'All' ? `: ${statusFilter}` : ''}</span>
              {rejectedCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs h-5 px-2">!</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="flex flex-col gap-1">
              <Button variant={statusFilter==='In progress'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('In progress'); setFilterOpen(false); }}>In progress</Button>
              <Button variant={statusFilter==='Approved'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('Approved'); setFilterOpen(false); }}>Approved</Button>
              <Button variant={statusFilter==='Rejected'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('Rejected'); setFilterOpen(false); }} className="justify-between">
                <span>Rejected</span>
                {rejectedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-700"><span className="font-bold">!</span><span className="text-xs">{rejectedCount}</span></span>
                )}
              </Button>
              <div className="h-px bg-slate-200 my-1" />
              <Button variant={statusFilter==='All'?'secondary':'ghost'} size="sm" onClick={()=>{ setStatusFilter('All'); setFilterOpen(false); }}>Show all</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {(selectedProcess && selectedSubprocess) || statusFilter === 'Rejected' || statusFilter === 'Approved' ? (
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
                    <th className="text-left p-3 w-64">Control Owner</th>
                    <th className="text-left p-3 w-40">Likelihood</th>
                    <th className="text-left p-3 w-40">Consequence</th>
                    <th className="text-left p-3 w-40">Risk Score</th>
                    <th className="text-left p-3 w-40">Control Score</th>
                    <th className="text-left p-3 w-40">Residual Risk</th>
                    <th className="text-left p-3 w-40">Risk Level</th>
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
                  {displayedRows.map((row) => (
                    <tr key={row.id} className={`border-t ${records[row.id]?.status === 'rejected' ? 'bg-red-50' : ''}`}>
                      <td className="p-3 align-top w-64 break-words">{row.activity || '-'}</td>
                      <td className="p-3 align-top w-64 break-words">{row.risk || '-'}</td>
                      <td className="p-3 align-top w-64 break-words">{row.control || '-'}</td>
                      <td className="p-3 align-top w-64 break-words">
                        <Input value={row.controlOwner ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, controlOwner: e.target.value } : r))} placeholder="Control owner" />
                      </td>
                      {/* Likelihood */}
                      <td className="p-3 align-top w-40 break-words">
                        {RiskConfigStore.getGlobal().riskScore.mode === 'likelihood_consequence' ? (
                          records[row.id]?.status && records[row.id]?.status !== 'draft' && records[row.id]?.status !== 'submitted' ? (
                            <span>{records[row.id]?.risk?.likelihood ?? '-'}</span>
                          ) : (
                            <Input type="number" value={row.likelihood}
                              onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, likelihood: Number(e.target.value) } : r))}
                            />
                          )
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      {/* Consequence */}
                      <td className="p-3 align-top w-40 break-words">
                        {RiskConfigStore.getGlobal().riskScore.mode === 'likelihood_consequence' ? (
                          records[row.id]?.status && records[row.id]?.status !== 'draft' && records[row.id]?.status !== 'submitted' ? (
                            <span>{records[row.id]?.risk?.consequence ?? '-'}</span>
                          ) : (
                            <Input type="number" value={row.consequence}
                              onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, consequence: Number(e.target.value) } : r))}
                            />
                          )
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      {/* Risk Score */}
                      <td className="p-3 align-top w-40 break-words">
                        {(() => {
                          const cfg = RiskConfigStore.getGlobal();
                          const status = records[row.id]?.status || 'draft';
                          // Allow editing risk score for draft/submitted rows
                          if (status === 'draft' || status === 'submitted') {
                            return (
                              <Input type="number" value={row.riskScore}
                                onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, riskScore: Number(e.target.value) } : r))}
                              />
                            );
                          }
                          // Read-only display for finalized rows
                          if (cfg.riskScore.mode === 'single') {
                            return <span>{records[row.id]?.risk?.riskScore ?? '-'}</span>;
                          }
                          const v = records[row.id]?.risk?.riskScore ?? computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence);
                          return <span>{v || 0}</span>;
                        })()}
                      </td>
                      {/* Control Score */}
                      <td className="p-3 align-top w-40 break-words">
                        {(() => {
                          const status = records[row.id]?.status || 'draft';
                          if (status === 'draft' || status === 'submitted') {
                            return (
                              <Input type="number" value={row.controlScore}
                                onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, controlScore: Number(e.target.value) } : r))}
                              />
                            );
                          }
                          return <span>{records[row.id]?.risk?.controlScore ?? '-'}</span>;
                        })()}
                      </td>
                      {/* Residual Risk */}
                      <td className="p-3 align-top w-40 break-words">
                        {(() => {
                          const cfg = RiskConfigStore.getGlobal();
                          const status = records[row.id]?.status || 'draft';
                          // Allow editing residual risk for draft/submitted rows
                          if (status === 'draft' || status === 'submitted') {
                            return (
                              <Input type="number" value={row.residualRisk}
                                onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, residualRisk: Number(e.target.value) } : r))}
                              />
                            );
                          }
                          const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence);
                          const res = computeResidual(cfg.residualRisk.formula, risk, row.controlScore, cfg.controlScore.scale);
                          return <span>{Math.round((res + Number.EPSILON) * 100) / 100}</span>;
                        })()}
                      </td>
                      {/* Risk Level */}
                      <td className="p-3 align-top w-40 break-words">
                        {(() => {
                          const cfg = RiskConfigStore.getGlobal();
                          const status = records[row.id]?.status || 'draft';
                          if (status !== 'draft' && status !== 'submitted') {
                            return <span>{records[row.id]?.risk?.residualLevel || records[row.id]?.risk?.riskLevel || '-'}</span>;
                          }
                          const risk = (status === 'draft' || status === 'submitted') ? (Number(row.riskScore) || computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence)) : (cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence));
                          const rl = resolveLevel(risk, cfg.residualRisk.thresholds);
                          const rr = (status === 'draft' || status === 'submitted') ? (Number(row.residualRisk) || computeResidual(cfg.residualRisk.formula, risk, row.controlScore, cfg.controlScore.scale)) : computeResidual(cfg.residualRisk.formula, risk, row.controlScore, cfg.controlScore.scale);
                          const rrl = resolveLevel(rr, cfg.residualRisk.thresholds);
                          return <span>{rrl?.level || rl?.level || '-'}</span>;
                        })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.testOfControl} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, testOfControl: v === '__CLEAR__' ? '' : v } : r))}>
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
                        <Select value={row.substantiveProcedure} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, substantiveProcedure: v === '__CLEAR__' ? '' : v } : r))}>
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
                        <Select value={row.samplingApplicable} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => { const nv = v === '__CLEAR__' ? '' : v; return r.id === row.id ? { ...r, samplingApplicable: nv as any, samplingMethodology: nv === 'Yes' ? r.samplingMethodology : '' } : r; }))}>
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
                        <Select value={row.samplingMethodology} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, samplingMethodology: v === '__CLEAR__' ? '' : v } : r))} disabled={row.samplingApplicable !== 'Yes'}>
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
                        <Select value={row.controlEffectiveness} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, controlEffectiveness: v === '__CLEAR__' ? '' : v } : r))}>
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
                        <Input value={row.attachments ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, attachments: e.target.value } : r))} placeholder="Paste link or text" />
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Input value={row.auditRemarks ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, auditRemarks: e.target.value } : r))} placeholder="Type remarks" />
                        {(() => { const cfg = RiskConfigStore.getGlobal(); const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence); const invalid = cfg.controlScore.constraintControlLEQRisk && row.controlScore > risk; return invalid ? <div className="text-xs text-red-600 mt-1">Control Score cannot exceed Risk Score</div> : null; })()}
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Select value={row.redFlag} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, redFlag: v === '__CLEAR__' ? '' : v } : r))}>
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
                        <Select value={row.reportable} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, reportable: v === '__CLEAR__' ? '' : v } : r))}>
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
                        <Select value={row.observationRanking} onValueChange={(v)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, observationRanking: v === '__CLEAR__' ? '' : v } : r))}>
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
                        <Input value={row.auditObservation ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, auditObservation: e.target.value } : r))} placeholder="Type observation" />
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Input value={row.effect ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, effect: e.target.value } : r))} placeholder="Describe effect" />
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Input value={row.recommendation ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, recommendation: e.target.value } : r))} placeholder="Recommendation" />
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        <Input value={row.annexure ?? ''} onChange={(e)=> setMatrixRows(prev => prev.map(r => r.id === row.id ? { ...r, annexure: e.target.value } : r))} placeholder="Annexure ref/link" />
                      </td>
                      <td className="p-3 align-top w-64 break-words">
                        {((records[row.id]?.status === 'submitted') || submittedIds.has(row.id)) ? (
                          <Button size="sm" variant="default" className="bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] shadow-md focus-visible:ring-2 focus-visible:ring-green-400 transition" disabled>
                            <CheckCircle2 className="h-3 w-3 mr-2" /> Submitted for Review
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-gradient-to-b from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 active:scale-[0.98] shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400 transition"
                            disabled={(() => { const cfg = RiskConfigStore.getGlobal(); const risk = cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence); return cfg.controlScore.constraintControlLEQRisk && row.controlScore > risk; })()}
                            onClick={() => {
                              const cfg = RiskConfigStore.getGlobal();
                              FieldworkStore.ensure(row.id, () => ({
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
                              const statusNow = records[row.id]?.status || 'draft';
                              const riskValue = (statusNow === 'draft' || statusNow === 'submitted') ? (Number(row.riskScore) || computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence)) : (cfg.riskScore.mode === 'single' ? row.riskScore : computeRiskScore(cfg.riskScore.mode, row.likelihood, row.consequence));
                              let residual = (statusNow === 'draft' || statusNow === 'submitted') ? (Number(row.residualRisk) || computeResidual(cfg.residualRisk.formula, riskValue, row.controlScore, cfg.controlScore.scale)) : computeResidual(cfg.residualRisk.formula, riskValue, row.controlScore, cfg.controlScore.scale);
                              if (cfg.residualRisk.constraintResidualLEQRisk) {
                                residual = Math.min(residual, riskValue);
                              }
                              const rLevel = resolveLevel(riskValue, cfg.residualRisk.thresholds)?.level || '';
                              const rrLevel = resolveLevel(residual, cfg.residualRisk.thresholds)?.level || '';
                              FieldworkStore.patch(row.id, {
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
                                  auditRemarks: row.auditRemarks,
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
                              FieldworkStore.submitForReview(row.id);
                              setRecords(FieldworkStore.getAll());
                              setSubmittedIds(prev => new Set(prev).add(row.id));
                              setSubmitAckOpen(true);
                            }}
                          >
                            <Share2 className="h-3 w-3 mr-2" /> Submit for review
                          </Button>
                        )}
                        {(records[row.id]?.status === 'rejected' && statusFilter === 'Rejected') || (records[row.id]?.status === 'approved' && statusFilter === 'Approved') ? (
                          <div className="mt-2">
                            {(records[row.id]?.reviewHistory || []).slice(-1).map((c, idx) => (
                              <div key={idx} className={`inline-block max-w-xs px-3 py-2 rounded-lg shadow-sm ${records[row.id]?.status === 'rejected' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                                <div className="break-words">{c.content}</div>
                                <div className={`mt-1 text-xs ${records[row.id]?.status === 'rejected' ? 'text-red-700' : 'text-green-700'} opacity-80`}>— {c.author}, {new Date(c.timestamp).toLocaleString()}</div>
                              </div>
                            ))}
                            {(!records[row.id]?.reviewHistory || (records[row.id]?.reviewHistory?.length || 0) === 0) && <div className="text-sm text-slate-500">No review comments</div>}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {displayedRows.length === 0 && (
                    <tr>
                      <td colSpan={25} className="p-6 text-center text-slate-500">{statusFilter==='Rejected' ? 'No rejected rows' : 'No data for selected process/subprocess'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}


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
