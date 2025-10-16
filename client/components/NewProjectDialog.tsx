import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Upload,
  Link,
  Users,
  FileText,
  Settings,
  CheckCircle2,
  AlertCircle,
  Plus,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { AssignmentTypeStore } from '@/contexts/AssignmentTypeStore';
import { RiskConfigStore } from '@/contexts/RiskConfigStore';
import ProjectRiskAssessmentForm from './ProjectRiskAssessmentForm';
import { RiskAssessmentConfig } from '@shared/risk';

interface Employee {
  id: string;
  name: string;
  role: string;
  division: string;
  email?: string;
  isActive?: boolean;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectFormData {
  // Section 1: Basic Project Information
  projectName: string;
  projectCode: string;
  clientName: string;
  division: string;
  auditType: string;
  projectDescription: string;

  // Section 2: Timeline & Scheduling
  startDate: Date | null;
  endDate: Date | null;

  // Section 3: Assignment & Access Control
  divisionHeads: string[];
  partners: string[];
  teamLeaders: string[];
  teamMembers: string[];

  // Section 4: Scope & Checklist Selection
  checklistTemplate: string[];
  // free-form legacy items (kept for compatibility)
  customChecklistItems: string;
  // structured checklist copied from framework when a template is selected
  selectedChecklistTree?: Record<string, any> | null;
  auditUniverse: string[];
  scopeNotes: string;

  // Section 5: Document & Reference Management
  documents: File[];
  references: string;

  // Section 6: Notifications & Reporting
  emailNotifications: boolean;
  reportingFrequency: string;

  // Section 7: System & Workflow Integration
  auditCommentsModule: boolean;
  workflowStatus: string;
  changeLogsEnabled: boolean;
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreate?: (project: ProjectFormData) => void;
  onProjectEdit?: (project: ProjectFormData) => void;
  mode?: 'new' | 'edit';
  initialData?: Partial<ProjectFormData> | null;
}


const mockEmployees: Employee[] = [
  { id: '1', name: 'Sanjeev V', role: 'Team Member', division: 'Audit & Assurance' },
  { id: '2', name: 'Rajesh Kumar', role: 'Division Head', division: 'Risk Advisory' },
  { id: '3', name: 'Sudhakar', role: 'Team Member', division: 'Consulting' },
  { id: '4', name: 'Manikandan', role: 'Division Partner', division: 'Fixed Asset Management' },
  { id: '5', name: 'Priya Sharma', role: 'Team Leader', division: 'Continuous Assurance Services' },
  { id: '6', name: 'Amit Das', role: 'Team Leader', division: 'Cycle Count' }
];

const divisions = ['Audit & Assurance', 'Risk Advisory', 'Continuous Assurance Services', 'Cycle Count', 'Fixed Asset Management', 'Consulting', 'Best Accountant'];
const auditTypes = ['Internal Audit', 'Process Audit', 'Compliance', 'Special Audit', 'Risk Assessment', 'Operational Audit'];
const checklistTemplates = ['Standard Internal Audit', 'Financial Audit', 'Operational Review', 'Compliance Check', 'Risk Assessment', 'Custom Template'];
const auditUniverseOptions = ['Factory 1', 'Factory 2', 'Head Office', 'Branch Office', 'Warehouse', 'Distribution Center', 'Finance Department', 'HR Department', 'IT Department', 'Production Unit'];
const reportingFrequencies = ['Weekly', 'Fortnightly', 'Monthly', 'Quarterly'];

export default function NewProjectDialog({ open, onOpenChange, onProjectCreate, onProjectEdit, mode = 'new', initialData = null }: NewProjectDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const apiEnabled = React.useMemo(() => {
    try {
      const forced = localStorage.getItem('api:enabled');
      if (forced === 'true') return true;
      if (forced === 'false') return false;
    } catch {}
    const h = typeof window !== 'undefined' ? window.location.hostname : '';
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (h.endsWith('.netlify.app')) return true;
    if (h.endsWith('.fly.dev')) return true;
    return true;
  }, []);
  const generateProjectCode = (date: Date | null) => {
    const d = date || new Date();
    const month = d.getMonth();
    const year = d.getFullYear();
    const fyStart = month >= 3 ? year : year - 1; // fiscal year starts April
    const fyString = `${fyStart}-${fyStart + 1}`;
    return `${fyString} 001`;
  };

  const [formData, setFormData] = useState<ProjectFormData>({
    projectName: '',
    projectCode: generateProjectCode(null),
    clientName: '',
    division: '',
    auditType: '',
    projectDescription: '',
    startDate: null,
    endDate: null,
    divisionHeads: [],
    partners: [],
    teamLeaders: [],
    teamMembers: [],
    checklistTemplate: [],
    customChecklistItems: '',
    // selectedChecklistTree will be populated when checklistTemplate is chosen
    selectedChecklistTree: null,
    auditUniverse: [],
    scopeNotes: '',
    documents: [],
    references: '',
    emailNotifications: false,
    reportingFrequency: '',
    auditCommentsModule: true,
    workflowStatus: 'Draft',
    changeLogsEnabled: true,
    riskConfig: null
  });

  useEffect(() => {
    // update projectCode when startDate changes (only for new projects)
    if (mode === 'new') setFormData(prev => ({ ...prev, projectCode: generateProjectCode(prev.startDate) }));
  }, [formData.startDate, mode]);

  // Seed clients from cache for instant dropdown, then refresh from API
  useEffect(() => {
    try {
      const cached = localStorage.getItem('clients');
      if (cached) {
        const parsed = JSON.parse(cached) as any[];
        const mapped = (parsed || []).map(r => ({ id: String((r as any).id), name: String((r as any).name) })) as ClientOption[];
        if (mapped.length) setClientOptions(mapped);
      }
    } catch {}
    if (!apiEnabled) return;
    (async () => {
      try {
        const res = await fetch('/api/clients');
        if (!res.ok) return;
        const data = await res.json();
        const mapped: ClientOption[] = (data || []).map((r: any) => ({ id: String(r.id), name: String(r.name) }));
        setClientOptions(mapped);
        try { localStorage.setItem('clients', JSON.stringify(data)); } catch {}
      } catch {}
    })();
  }, [apiEnabled]);

  const [divisionOptions, setDivisionOptions] = useState<string[]>(divisions);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const selectedClientId = React.useMemo(() => {
    const found = clientOptions.find(c => c.name === formData.clientName);
    return found?.id || '';
  }, [clientOptions, formData.clientName]);
  useEffect(() => {
    // Seed from cache for instant UX
    try {
      const raw = localStorage.getItem('employees');
      if (raw) {
        const parsed = JSON.parse(raw) as any[];
        const active = (parsed || []).filter(e => e && (e.isActive ?? true));
        const mapped: Employee[] = active.map(e => ({ id: String(e.id), name: e.name, role: e.role, division: e.division, email: e.email, isActive: e.isActive }));
        if (mapped.length) setEmployees(mapped);
      }
    } catch {}
    if (!apiEnabled) return;
    // Refresh from API
    (async () => {
      try {
        const res = await fetch('/api/employees');
        if (!res.ok) return;
        const data = await res.json();
        const active = (data || []).filter((e:any) => e && (e.isActive ?? true));
        const mapped: Employee[] = active.map((e:any) => ({ id: String(e.id), name: e.name, role: e.role, division: e.division, email: e.email, isActive: e.isActive }));
        setEmployees(mapped);
        try { localStorage.setItem('employees', JSON.stringify(mapped)); } catch {}
      } catch {}
    })();
  }, [apiEnabled]);

  // Prefill on edit
  useEffect(() => {
    if (open && initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        startDate: initialData.startDate ? new Date(initialData.startDate as any) : prev.startDate,
        endDate: initialData.endDate ? new Date(initialData.endDate as any) : prev.endDate,
      }));
    }
  }, [open, initialData]);
  const [natureOptions, setNatureOptions] = useState<string[]>(auditTypes);
  const [newDivision, setNewDivision] = useState('');

  const [assignmentTypes, setAssignmentTypes] = useState<{id:string;name:string}[]>([]);
  useEffect(() => {
    const sync = () => {
      const all = AssignmentTypeStore.getAll();
      setAssignmentTypes(all.map(a => ({ id: (a as any).id, name: (a as any).name })));
      setNatureOptions(all.map((a:any)=>a.name));
    };
    const unsub = AssignmentTypeStore.subscribe(sync);
    sync();
    return () => unsub();
  }, []);

  const [processesForClient, setProcessesForClient] = useState<string[]>([]);
  const [newSubprocess, setNewSubprocess] = useState('');
  const [processIdToName, setProcessIdToName] = useState<Record<string, string>>({});
  const [nodeIdToLocalId, setNodeIdToLocalId] = useState<Record<string, string>>({});
  const [frameworkNodesFlat, setFrameworkNodesFlat] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState('');
  const [newRisk, setNewRisk] = useState('');
  const [newControl, setNewControl] = useState('');
  const [frameworkTree, setFrameworkTree] = useState<Record<string, any>>({});
  const [addInputs, setAddInputs] = useState<Record<string, string>>({});

  const frameworkProcessNames = React.useMemo(() => {
    const names = Object.keys(frameworkTree || {});
    return names.sort((a, b) => a.localeCompare(b));
  }, [frameworkTree]);

  const effectiveChecklistProcesses = React.useMemo(() => {
    const selected = Array.isArray(formData.checklistTemplate) ? formData.checklistTemplate.filter(Boolean) : [];
    if (selected.length) return Array.from(new Set(selected));
    if (processesForClient.length) return Array.from(new Set(processesForClient.filter(Boolean)));
    return [] as string[];
  }, [formData.checklistTemplate, processesForClient]);

  const findMatchingKey = React.useCallback((collection: Record<string, any>, name: string) => {
    if (!collection || !name) return null;
    if (collection[name]) return name;
    const normalized = name.trim().toLowerCase();
    const match = Object.keys(collection).find(key => key.trim().toLowerCase() === normalized);
    return match || null;
  }, []);

  type NodeType = 'process' | 'subprocess' | 'activity' | 'risk' | 'control';
  interface SoaNode { id: string; type: NodeType; name: string; parentId?: string; isExpanded?: boolean; }

  const [soaNodes, setSoaNodes] = useState<SoaNode[]>([]);
  const [soaApplicable, setSoaApplicable] = useState<Record<string, boolean | null>>({});

  const parseHierId = React.useCallback((id: string) => {
    const parts = id.split('/');
    const path = parts[0] || '';
    const tail1 = parts[1] || '';
    const tail2 = parts[2] || '';
    const dot = path.split('.');
    const procStr = dot[0] || 'P0';
    const proc = parseInt(procStr.replace(/^P/i, ''), 10) || 0;
    const sub = dot[1] ? parseInt(dot[1], 10) || 0 : 0;
    const act = dot[2] ? parseInt(dot[2], 10) || 0 : 0;
    const risk = tail1 ? (parseInt(tail1.replace(/^R/i, ''), 10) || 0) : 0;
    const ctrl = tail2 ? (parseInt(tail2.replace(/^C/i, ''), 10) || 0) : 0;
    return { proc, sub, act, risk, ctrl };
  }, []);
  const compareHier = React.useCallback((a: string, b: string) => {
    const A = parseHierId(a); const B = parseHierId(b);
    if (A.proc !== B.proc) return A.proc - B.proc;
    if (A.sub !== B.sub) return A.sub - B.sub;
    if (A.act !== B.act) return A.act - B.act;
    if (A.risk !== B.risk) return A.risk - B.risk;
    if (A.ctrl !== B.ctrl) return A.ctrl - B.ctrl;
    return a.localeCompare(b);
  }, [parseHierId]);

  const buildSoaNodes = React.useCallback((procs: string[]): SoaNode[] => {
    const out: SoaNode[] = [];
    if (!frameworkNodesFlat.length) return out;
    const byId: Record<string, any> = {};
    frameworkNodesFlat.forEach((n:any)=>{ byId[n.id] = n; });
    const climb = (id: string) => {
      const chain: any[] = [];
      let cur = byId[id];
      while (cur) { chain.push(cur); cur = cur.parentId ? byId[cur.parentId] : undefined; }
      return chain;
    };
    const sorted = [...frameworkNodesFlat].sort((a:any,b:any)=>compareHier(a.id,b.id));

    for (const proc of procs) {
      const procKey = findMatchingKey(frameworkTree, proc);
      if (!procKey) continue;
      const procId = `proc|${procKey}`;
      out.push({ id: procId, type: 'process', name: frameworkTree[procKey]?.name || procKey, isExpanded: true });

      const isInProc = (n:any) => {
        const chain = climb(n.id);
        const rootProc = chain.find(x => x.type === 'process');
        return !!rootProc && rootProc.name === (frameworkTree[procKey]?.name || procKey);
      };

      const subs = sorted.filter(n => n.type === 'subprocess' && isInProc(n));
      for (const sp of subs) {
        const spId = `sub|${procKey}|${sp.name}`;
        out.push({ id: spId, type: 'subprocess', name: sp.name, parentId: procId, isExpanded: true });

        const acts = sorted.filter(n => n.type === 'activity' && isInProc(n) && (()=>{ const ch=climb(n.id); const p=ch.find(x=>x.type==='subprocess'); return p && p.name===sp.name; })());
        for (const ac of acts) {
          const acId = `act|${procKey}|${sp.name}|${ac.name}`;
          out.push({ id: acId, type: 'activity', name: ac.name, parentId: spId, isExpanded: true });

          const risks = sorted.filter(n => n.type === 'risk' && isInProc(n) && (()=>{ const ch=climb(n.id); const s=ch.find(x=>x.type==='subprocess'); const a=ch.find(x=>x.type==='activity'); return s && a && s.name===sp.name && a.name===ac.name; })());
          for (const rk of risks) {
            const rkId = `risk|${procKey}|${sp.name}|${ac.name}|${rk.name}`;
            out.push({ id: rkId, type: 'risk', name: rk.name, parentId: acId, isExpanded: true });

            const ctrls = sorted.filter(n => n.type === 'control' && isInProc(n) && (()=>{ const ch=climb(n.id); const s=ch.find(x=>x.type==='subprocess'); const a=ch.find(x=>x.type==='activity'); const r=ch.find(x=>x.type==='risk'); return s && a && r && s.name===sp.name && a.name===ac.name && r.name===rk.name; })());
            ctrls.forEach((cNode, idx) => {
              const ctrlId = `ctrl|${procKey}|${sp.name}|${ac.name}|${rk.name}|${idx}`;
              out.push({ id: ctrlId, type: 'control', name: cNode.name, parentId: rkId });
            });
          }
        }
      }
    }
    return out;
  }, [frameworkNodesFlat, frameworkTree, findMatchingKey, compareHier]);

  const getSoaLevel = (node: SoaNode) => {
    let level = 0;
    let current: SoaNode | undefined = node;
    while (current && current.parentId) {
      const parent = soaNodes.find(n => n.id === current!.parentId);
      if (!parent) break;
      level += 1;
      current = parent;
    }
    return level;
  };

  const isParentExpandedSoa = (node: SoaNode): boolean => {
    if (!node.parentId) return true;
    const parent = soaNodes.find(n => n.id === node.parentId);
    if (!parent) return true;
    return !!parent.isExpanded && isParentExpandedSoa(parent);
  };

  const collectDescendantIdsSoa = (id: string, acc: string[] = []) => {
    const children = soaNodes.filter(n => n.parentId === id);
    for (const c of children) { acc.push(c.id); collectDescendantIdsSoa(c.id, acc); }
    return acc;
  };

  const toggleExpandSoa = (id: string) => {
    setSoaNodes(prev => prev.map(n => n.id === id ? { ...n, isExpanded: !n.isExpanded } : n));
  };

  const toggleApplicableSoa = (node: SoaNode) => {
    const current = soaApplicable[node.id] ?? null;
    const next = current === null ? true : (current === true ? false : null);
    const ids = [node.id, ...collectDescendantIdsSoa(node.id)];
    setSoaApplicable(prev => {
      const copy = { ...prev } as Record<string, boolean | null>;
      for (const id of ids) copy[id] = next;
      return copy;
    });
  };

  useEffect(() => {
    const procs = effectiveChecklistProcesses;
    if (!Array.isArray(procs) || procs.length === 0) { setSoaNodes([]); setSoaApplicable({}); return; }
    const nodes = buildSoaNodes(procs);
    setSoaNodes(nodes);
    setSoaApplicable(prev => {
      const next: Record<string, boolean | null> = {};
      nodes.forEach(n => { if (prev[n.id] !== undefined) next[n.id] = prev[n.id]!; });
      return next;
    });
  }, [effectiveChecklistProcesses, buildSoaNodes]);

  // Month view state for the two calendars in Timeline & Scheduling
  const [startViewMonth, setStartViewMonth] = useState<Date>(formData.startDate || new Date());
  const [endViewMonth, setEndViewMonth] = useState<Date>(formData.endDate || new Date());

  // Track expanded/collapsed state for subprocess nodes (keyed by `${process}||${subprocess}`)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const toggleExpanded = (key: string) => setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));

  const fetchAndBuildFramework = async () => {
    const buildFromNodes = (nodes: any[]) => {
      const byId: Record<string, any> = {};
      nodes.forEach((n:any) => { byId[n.id] = n; });
      const processes = new Set<string>();
      const tree: Record<string, any> = {};
      const climb = (id: string) => {
        const chain: any[] = [];
        let cur = byId[id];
        while (cur) { chain.push(cur); cur = cur.parentId ? byId[cur.parentId] : undefined; }
        return chain;
      };
      for (const n of nodes) {
        if (n.type === 'process') {
          processes.add(n.name);
          if (!tree[n.name]) tree[n.name] = { name: n.name, subprocesses: {} };
          continue;
        }
        if (n.type === 'subprocess' || n.type === 'activity' || n.type === 'risk' || n.type === 'control') {
          const chain = climb(n.id);
          const p = chain.find(x => x.type === 'process');
          if (!p) continue;
          processes.add(p.name);
          if (!tree[p.name]) tree[p.name] = { name: p.name, subprocesses: {} };
          const sp = chain.find(x => x.type === 'subprocess');
          const ac = chain.find(x => x.type === 'activity');
          const rk = chain.find(x => x.type === 'risk');
          if (sp) {
            if (!tree[p.name].subprocesses[sp.name]) tree[p.name].subprocesses[sp.name] = { name: sp.name, activities: {} };
            if (ac) {
              if (!tree[p.name].subprocesses[sp.name].activities[ac.name]) tree[p.name].subprocesses[sp.name].activities[ac.name] = { name: ac.name, risks: {} };
              if (rk) {
                if (!tree[p.name].subprocesses[sp.name].activities[ac.name].risks[rk.name]) tree[p.name].subprocesses[sp.name].activities[ac.name].risks[rk.name] = { name: rk.name, controls: [] };
                if (n.type === 'control') tree[p.name].subprocesses[sp.name].activities[ac.name].risks[rk.name].controls.push(n.name);
              }
            }
          }
        }
      }

      setFrameworkTree(tree);
      try { localStorage.setItem('framework:tree', JSON.stringify(tree)); localStorage.setItem('framework:processes', JSON.stringify(Array.from(processes))); } catch {}
      return tree;
    };

    const buildFromCdn = async () => {
      const URL = 'https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c';
      const normalizeRows = (data: any): any[] => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if ((data as any).Sheet1 && Array.isArray((data as any).Sheet1)) return (data as any).Sheet1;
        if ((data as any).sheets && typeof (data as any).sheets === 'object') {
          const first = Object.values((data as any).sheets)[0] as any[];
          if (Array.isArray(first)) return first;
        }
        const keys = Object.keys(data || {});
        if (keys.length === 1 && Array.isArray((data as any)[keys[0]])) return (data as any)[keys[0]];
        return [];
      };
      try {
        const res = await fetch(URL);
        const json = await res.json();
        const rows = normalizeRows(json);
        const processes = new Set<string>();
        const tree: Record<string, any> = {};
        for (const row of rows) {
          const process = String(row['Process'] ?? row['process'] ?? row['PROCESS'] ?? '').trim();
          if (!process) continue;
          processes.add(process);
          let subprocess = String(row['Sub Process'] ?? row['SubProcess'] ?? row['subprocess'] ?? '').trim();
          let activity = String(row['Activity'] ?? row['activity'] ?? row['ACTIVITY'] ?? '').trim();
          const risk = String(row['Identification of Risk of Material Misstatement (What could go wrong?) Risk Description'] ?? row['Risk Description'] ?? row['Risk'] ?? row['risk'] ?? '').trim();
          const control = String(row['Controls in Place'] ?? row['Control'] ?? row['Control Description'] ?? row['controls'] ?? '').trim();
          if (!subprocess && activity) subprocess = 'General';
          if (!activity && (risk || control)) activity = 'General';
          if (!tree[process]) tree[process] = { name: process, subprocesses: {} };
          if (!subprocess) continue;
          if (!tree[process].subprocesses[subprocess]) tree[process].subprocesses[subprocess] = { name: subprocess, activities: {} };
          if (activity) {
            if (!tree[process].subprocesses[subprocess].activities[activity]) tree[process].subprocesses[subprocess].activities[activity] = { name: activity, risks: {} };
            const activityNode = tree[process].subprocesses[subprocess].activities[activity];
            if (risk) {
              if (!activityNode.risks[risk]) activityNode.risks[risk] = { name: risk, controls: [] };
              if (control) activityNode.risks[risk].controls.push(control);
            } else if (control) {
              const defaultRisk = 'General';
              if (!activityNode.risks[defaultRisk]) activityNode.risks[defaultRisk] = { name: defaultRisk, controls: [] };
              activityNode.risks[defaultRisk].controls.push(control);
            }
          }
        }
  
        setFrameworkTree(tree);
        try { localStorage.setItem('framework:tree', JSON.stringify(tree)); localStorage.setItem('framework:processes', JSON.stringify(Array.from(processes))); } catch {}
        return tree;
      } catch {
        try {
          const cached = localStorage.getItem('framework:tree');
          if (cached) setFrameworkTree(JSON.parse(cached));
        } catch {}
        return {};
      }
    };

    try {
      if (apiEnabled) {
        const res = await fetch('/api/framework/tree');
        if (res.ok) {
          const data = await res.json();
          const nodes = Array.isArray(data?.nodes) ? (data.nodes as any[]) : [];
          return buildFromNodes(nodes);
        }
      }
      return await buildFromCdn();
    } catch {
      return await buildFromCdn();
    }
  };

  useEffect(() => {
    // fetch once if not present
    if (!Object.keys(frameworkTree).length) fetchAndBuildFramework();
  }, []);

  // Load framework process ID->name map from server SoA framework
  useEffect(() => {
    (async () => {
      try {
        if (apiEnabled) {
          const res = await fetch('/api/framework/tree');
          if (res.ok) {
            const data = await res.json();
            const nodes = Array.isArray(data?.nodes) ? (data.nodes as any[]) : [];
            const map: Record<string,string> = {};
            nodes.filter((n:any) => n.type === 'process').forEach((n:any) => { map[n.id] = n.name; });
            setProcessIdToName(map);
            setFrameworkNodesFlat(nodes);
            try { localStorage.setItem('framework:processIdToName', JSON.stringify(map)); } catch {}
            try { localStorage.setItem('framework:nodesFlat', JSON.stringify(nodes)); } catch {}

            // Build nodeId -> localId mapping (by names) for applicability hydration
            const byId: Record<string, any> = {};
            nodes.forEach((n:any) => { byId[n.id] = n; });
            const localMap: Record<string,string> = {};
            const climb = (id: string) => {
              const chain: any[] = [];
              let cur = byId[id];
              while (cur) { chain.push(cur); cur = cur.parentId ? byId[cur.parentId] : undefined; }
              return chain;
            };
            for (const n of nodes) {
              const chain = climb(n.id);
              const proc = chain.find((x:any) => x.type === 'process');
              if (!proc) continue;
              const sp = chain.find((x:any) => x.type === 'subprocess');
              const ac = chain.find((x:any) => x.type === 'activity');
              const rk = chain.find((x:any) => x.type === 'risk');
              const procKey = proc.name;
              let localId: string | null = null;
              if (n.type === 'process') localId = `proc|${procKey}`;
              else if (n.type === 'subprocess' && sp) localId = `sub|${procKey}|${sp.name}`;
              else if (n.type === 'activity' && sp && ac) localId = `act|${procKey}|${sp.name}|${ac.name}`;
              else if (n.type === 'risk' && sp && ac && rk) localId = `risk|${procKey}|${sp.name}|${ac.name}|${rk.name}`;
              // controls omitted: local control IDs are index-based
              if (localId) localMap[n.id] = localId;
            }
            setNodeIdToLocalId(localMap);
            try { localStorage.setItem('framework:nodeIdToLocalId', JSON.stringify(localMap)); } catch {}
            return;
          }
        }
      } catch {}
      try {
        const cached = localStorage.getItem('framework:processIdToName');
        if (cached) setProcessIdToName(JSON.parse(cached));
      } catch {}
      try {
        const cached2 = localStorage.getItem('framework:nodeIdToLocalId');
        if (cached2) setNodeIdToLocalId(JSON.parse(cached2));
      } catch {}
      try {
        const cached3 = localStorage.getItem('framework:nodesFlat');
        if (cached3) setFrameworkNodesFlat(JSON.parse(cached3));
      } catch {}
    })();
  }, [apiEnabled]);

  // Compute control mapping to local IDs when framework is ready
  useEffect(() => {
    if (!frameworkNodesFlat.length || !Object.keys(frameworkTree).length) return;
    const byId: Record<string, any> = {};
    frameworkNodesFlat.forEach((n:any) => { byId[n.id] = n; });
    const climb = (id: string) => {
      const chain: any[] = [];
      let cur = byId[id];
      while (cur) { chain.push(cur); cur = cur.parentId ? byId[cur.parentId] : undefined; }
      return chain;
    };
    const next: Record<string,string> = { ...nodeIdToLocalId };
    for (const n of frameworkNodesFlat) {
      if (n.type !== 'control') continue;
      const chain = climb(n.id);
      const proc = chain.find((x:any) => x.type === 'process');
      const sp = chain.find((x:any) => x.type === 'subprocess');
      const ac = chain.find((x:any) => x.type === 'activity');
      const rk = chain.find((x:any) => x.type === 'risk');
      if (!(proc && sp && ac && rk)) continue;
      const procKey = proc.name;
      const idx = frameworkTree?.[procKey]?.subprocesses?.[sp.name]?.activities?.[ac.name]?.risks?.[rk.name]?.controls?.findIndex((c:string)=>c===n.name) ?? -1;
      if (idx >= 0) next[n.id] = `ctrl|${procKey}|${sp.name}|${ac.name}|${rk.name}|${idx}`;
    }
    setNodeIdToLocalId(next);
    try { localStorage.setItem('framework:nodeIdToLocalId', JSON.stringify(next)); } catch {}
  }, [frameworkNodesFlat, frameworkTree]);

  useEffect(() => {
    const clientName = formData.clientName;
    const clientId = selectedClientId;
    if (!clientName && !clientId) { setProcessesForClient([]); return; }

    const toNames = (ids: string[]): string[] => {
      if (!Array.isArray(ids)) return [];
      const names = ids.map(id => processIdToName[id]).filter(Boolean);
      return names as string[];
    };

    const readLocal = () => {
      try {
        if (!clientId) return [] as string[];
        const raw = localStorage.getItem(`soa:client:${clientId}`);
        if (!raw) return [] as string[];
        const json = JSON.parse(raw);
        if (Array.isArray(json?.processes)) return toNames(json.processes as string[]);
        return [] as string[];
      } catch { return [] as string[]; }
    };

    const localNames = readLocal();
    if (localNames.length) setProcessesForClient(localNames);

    (async () => {
      try {
        if (apiEnabled && clientId) {
          const key = encodeURIComponent(`soa:client:${clientId}`);
          const res = await fetch(`/api/settings/${key}`);
          if (res.ok) {
            const data = await res.json();
            try { localStorage.setItem(`soa:client:${clientId}`, JSON.stringify(data)); } catch {}
            const names = Array.isArray(data?.processes) ? toNames(data.processes as string[]) : [];
            if (names.length) setProcessesForClient(names);
            // Hydrate applicability from saved client mapping
            if (data && data.nodeApplicability && typeof data.nodeApplicability === 'object') {
              const updates: Record<string, boolean | null> = {};
              for (const [nodeId, val] of Object.entries<any>(data.nodeApplicability)) {
                const localId = (nodeIdToLocalId as any)[nodeId];
                if (localId) updates[localId] = (val as any) as boolean | null;
              }
              if (Object.keys(updates).length) setSoaApplicable(prev => ({ ...prev, ...updates }));
            }
            return;
          }
        }
      } catch {}
      // Fallback: name->processes map
      try {
        const key = 'soa-client-mapping';
        let map: Record<string, string[]> | null = null;
        if (apiEnabled) { try { const res = await fetch(`/api/settings/${key}`); if (res.ok) map = await res.json(); } catch {} }
        if (!map) {
          try { map = JSON.parse(localStorage.getItem(key) || 'null'); } catch { map = null; }
        }
        if (map && formData.clientName && Array.isArray(map[formData.clientName]) && map[formData.clientName].length) {
          setProcessesForClient(map[formData.clientName]);
        }
      } catch {}
    })();
  }, [formData.clientName, selectedClientId, processIdToName]);

  // Auto-select mapped processes when available so the Checklist Tree becomes visible immediately
  useEffect(() => {
    if (Array.isArray(processesForClient) && processesForClient.length) {
      if (!Array.isArray(formData.checklistTemplate) || formData.checklistTemplate.length === 0) {
        updateFormData('checklistTemplate', processesForClient);
      }
    } else {
      if (Array.isArray(formData.checklistTemplate) && formData.checklistTemplate.length) return;
      updateFormData('checklistTemplate', []);
    }
  }, [processesForClient]);

  // Keep selectedChecklistTree in sync with selections. If no explicit selections, include full subtree for selected processes.
  useEffect(() => {
    const procs = effectiveChecklistProcesses;
    if (!Array.isArray(procs) || procs.length === 0) { updateFormData('selectedChecklistTree', null); return; }

    const hasSelections = Object.values(soaApplicable).some(v => v === true);
    const filterBySelections = (tree: Record<string, any>) => {
      const result: Record<string, any> = {};
      for (const proc of procs) {
        const procKey = findMatchingKey(tree, proc);
        if (!procKey) continue;
        const procNode = tree[procKey];
        if (!procNode) continue;
        const procId = `proc|${procKey}`;
        const includeProcDirect = soaApplicable[procId] === true;
        const subOut: Record<string, any> = {};
        const subs = procNode.subprocesses || {};
        for (const [spName, spNode] of Object.entries<any>(subs)) {
          const spId = `sub|${procKey}|${spName}`;
          const includeSubDirect = soaApplicable[spId] === true;
          const actOut: Record<string, any> = {};
          const acts = spNode.activities || {};
          for (const [acName, acNode] of Object.entries<any>(acts)) {
            const acId = `act|${procKey}|${spName}|${acName}`;
            const includeActDirect = soaApplicable[acId] === true;
            const riskOut: Record<string, any> = {};
            const risks = acNode.risks || {};
            for (const [rkName, rkNode] of Object.entries<any>(risks)) {
              const rkId = `risk|${procKey}|${spName}|${acName}|${rkName}`;
              const includeRiskDirect = soaApplicable[rkId] === true;
              const ctrls = Array.isArray(rkNode.controls) ? rkNode.controls : [];
              const selectedCtrls: string[] = [];
              ctrls.forEach((c: string, idx: number) => {
                const ctrlId = `ctrl|${procKey}|${spName}|${acName}|${rkName}|${idx}`;
                if (soaApplicable[ctrlId] === true) selectedCtrls.push(c);
              });
              const includeRisk = includeRiskDirect || selectedCtrls.length > 0;
              if (includeRisk) {
                riskOut[rkName] = { name: rkName, controls: selectedCtrls.length ? selectedCtrls : ctrls };
              }
            }
            const includeAct = includeActDirect || Object.keys(riskOut).length > 0;
            if (includeAct) {
              actOut[acName] = { name: acName, risks: riskOut };
            }
          }
          const includeSub = includeSubDirect || Object.keys(actOut).length > 0;
          if (includeSub) {
            subOut[spName] = { name: spName, activities: actOut };
          }
        }
        const includeProc = includeProcDirect || Object.keys(subOut).length > 0;
        if (includeProc) {
          result[procKey] = { name: procNode?.name || procKey, subprocesses: subOut };
        }
      }
      return result;
    };

    if (hasSelections) {
      updateFormData('selectedChecklistTree', filterBySelections(frameworkTree));
    } else {
      // default: copy full subtree for selected processes
      const clone: Record<string, any> = {};
      for (const proc of procs) {
        const procKey = findMatchingKey(frameworkTree, proc);
        if (!procKey) continue;
        const node = frameworkTree[procKey];
        if (!node) continue;
        try { clone[procKey] = JSON.parse(JSON.stringify(node)); } catch { clone[procKey] = node; }
      }
      updateFormData('selectedChecklistTree', clone);
    }
  }, [effectiveChecklistProcesses, frameworkTree, soaApplicable, findMatchingKey]);

  // Auto-expand subprocesses for the selected process so activities are visible
  useEffect(() => {
    const procs = formData.checklistTemplate;
    if (!Array.isArray(procs) || procs.length === 0) { setExpandedItems({}); return; }
    const map: Record<string, boolean> = {};
    for (const proc of procs) {
      const procKey = findMatchingKey(frameworkTree, proc);
      if (!procKey) continue;
      const node = frameworkTree[procKey];
      if (!node || !node.subprocesses) continue;
      Object.keys(node.subprocesses).forEach(sp => { map[`${procKey}||${sp}`] = true; });
    }
    setExpandedItems(map);
  }, [formData.checklistTemplate, frameworkTree, findMatchingKey]);

  const [showRiskStep, setShowRiskStep] = useState(false);

  // Determine whether to show Risk Assessment step based on selected auditType
  useEffect(() => {
    const compute = () => {
      if (!formData.auditType) { setShowRiskStep(false); return; }
      const found = assignmentTypes.find(a => a.name === formData.auditType);
      if (!found) { setShowRiskStep(false); return; }
      const overall = RiskConfigStore.get('assignment') || RiskConfigStore.getGlobal();
      const map = (overall.scope as any)?.assignmentMap || {};
      const entry = map[found.id];
      setShowRiskStep(!!(entry && entry.mode === 'project'));
    };
    compute();
    const unsub = RiskConfigStore.subscribe(() => compute());
    return () => unsub();
  }, [formData.auditType, assignmentTypes]);

  const stepsBase = [
    { number: 1, title: 'Basic Project Information', icon: FileText },
    { number: 2, title: 'Project Period', icon: CalendarIcon },
    { number: 3, title: 'Team Assignment', icon: Users },
    { number: 4, title: 'Scope & Checklist Selection', icon: CheckCircle2 },
    { number: 5, title: 'Document & Reference Management', icon: Upload }
  ];

  const steps = showRiskStep
    ? [...stepsBase, { number: 6, title: 'Risk Assessment', icon: CheckCircle2 }, { number: 7, title: 'Notifications & Reporting', icon: AlertCircle }]
    : [...stepsBase, { number: 6, title: 'Notifications & Reporting', icon: AlertCircle }];

  const TeamMembersMultiSelect = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
    const [open, setOpen] = useState(false);
    const display = value && value.length ? (value.length <= 2 ? value.join(', ') : `${value.slice(0,2).join(', ')} (+${value.length-2})`) : 'Select Members for this project';
    const toggle = (name: string) => {
      let next = Array.isArray(value) ? [...value] : [];
      const has = next.includes(name);
      if (has) next = next.filter(n => n !== name); else next.push(name);
      onChange(next);
      setOpen(true);
    };
    const stop = (e:any) => { e.preventDefault(); e.stopPropagation(); };
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{display}</span>
            <span className="ml-2 text-xs text-muted-foreground">Select</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] p-0 w-[var(--radix-popper-anchor-width)]" style={{ width: 'var(--radix-popper-anchor-width)' }} onWheel={(e)=>e.stopPropagation()}>
          <Command>
            <CommandInput placeholder="Search members..." />
            <CommandEmpty>No member found.</CommandEmpty>
            <CommandList className="max-h-72 overflow-y-auto" onWheel={(e)=>e.stopPropagation()}>
              <CommandGroup heading="Team Members">
                {employees.map(emp => (
                  <CommandItem
                    key={emp.id}
                    value={emp.name}
                    onPointerDown={(e)=>{ e.preventDefault(); e.stopPropagation(); toggle(emp.name); }}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox className="mt-0.5" checked={value?.includes(emp.name)} onPointerDown={(e)=>{e.preventDefault(); e.stopPropagation();}} onMouseDown={(e)=>{e.preventDefault(); e.stopPropagation();}} onCheckedChange={() => toggle(emp.name)} />
                      <div className="min-w-0">
                        <div>{emp.name} - {emp.role}</div>
                        {emp.email && <div className="text-[11px] text-slate-500 italic truncate">{emp.email}</div>}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const ChecklistTemplatesMultiSelect = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
    const [open, setOpen] = useState(false);
    const display = value && value.length ? (value.length <= 2 ? value.join(', ') : `${value.slice(0,2).join(', ')} (+${value.length-2})`) : 'Select processes';
    const options = React.useMemo(() => {
      const unique = Array.from(new Set((processesForClient || []).filter(Boolean)));
      return unique.sort((a, b) => a.localeCompare(b));
    }, [processesForClient]);
    const toggle = (id: string) => {
      let next = Array.isArray(value) ? [...value] : [];
      const has = next.includes(id);
      if (has) next = next.filter(x => x !== id); else next.push(id);
      onChange(next);
      setOpen(true);
    };
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{display}</span>
            <span className="ml-2 text-xs text-muted-foreground">Select</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] p-0 w-[var(--radix-popper-anchor-width)]" style={{ width: 'var(--radix-popper-anchor-width)' }} onWheel={(e) => e.stopPropagation()}>
          <Command>
            <CommandInput placeholder="Search processes..." />
            <CommandEmpty>No process found.</CommandEmpty>
            <CommandList className="max-h-72 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
              <CommandGroup heading="Processes">
                {options.map(proc => (
                  <CommandItem
                    key={proc}
                    value={proc}
                    onPointerDown={(e)=>{ e.preventDefault(); e.stopPropagation(); toggle(proc); }}
                  >
                    <Checkbox className="mr-2" checked={value?.includes(proc)} onPointerDown={(e)=>{e.preventDefault(); e.stopPropagation();}} onMouseDown={(e)=>{e.preventDefault(); e.stopPropagation();}} onCheckedChange={() => toggle(proc)} /> {proc}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const EmployeesMultiSelect = ({ roleFilter, value, onChange, placeholder }: { roleFilter: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => {
    const [open, setOpen] = useState(false);
    const display = value && value.length ? (value.length <= 2 ? value.join(', ') : `${value.slice(0,2).join(', ')} (+${value.length-2})`) : (placeholder || 'Select');
    const toggle = (name: string) => {
      let next = Array.isArray(value) ? [...value] : [];
      const has = next.includes(name);
      if (has) next = next.filter(x => x !== name); else next.push(name);
      onChange(next);
      setOpen(true);
    };
    const stop = (e:any) => { e.preventDefault(); e.stopPropagation(); };
    const options = employees;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{display}</span>
            <span className="ml-2 text-xs text-muted-foreground">Select</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] p-0 w-[var(--radix-popper-anchor-width)]" style={{ width: 'var(--radix-popper-anchor-width)' }} onWheel={(e)=>e.stopPropagation()}>
          <Command>
            <CommandInput placeholder={`Search ${roleFilter}...`} />
            <CommandEmpty>No match.</CommandEmpty>
            <CommandList className="max-h-72 overflow-y-auto" onWheel={(e)=>e.stopPropagation()}>
              <CommandGroup heading={roleFilter}>
                {options.map(opt => (
                  <CommandItem
                    key={opt.id}
                    value={opt.name}
                    onPointerDown={(e)=>{ e.preventDefault(); e.stopPropagation(); toggle(opt.name); }}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox className="mt-0.5" checked={value?.includes(opt.name)} onPointerDown={(e)=>{e.preventDefault(); e.stopPropagation();}} onMouseDown={(e)=>{e.preventDefault(); e.stopPropagation();}} onCheckedChange={() => toggle(opt.name)} />
                      <div className="min-w-0">
                        <div>{opt.name} - {opt.role}</div>
                        {opt.email && <div className="text-[11px] text-slate-500 italic truncate">{opt.email}</div>}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const updateFormData = (field: keyof ProjectFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const mutateTree = (mutator: (tree: Record<string, any>) => void) => {
    setFrameworkTree(prev => {
      const copy: Record<string, any> = JSON.parse(JSON.stringify(prev));
      mutator(copy);
      return copy;
    });
  };

  const ensureNodes = (tree: Record<string, any>, process: string, sub?: string, act?: string, risk?: string) => {
    if (!tree[process]) tree[process] = { name: process, subprocesses: {} };
    if (sub) {
      if (!tree[process].subprocesses[sub]) tree[process].subprocesses[sub] = { name: sub, activities: {} };
    }
    if (sub && act) {
      const sp = tree[process].subprocesses[sub];
      if (!sp.activities[act]) sp.activities[act] = { name: act, risks: {} };
    }
    if (sub && act && risk) {
      const ac = tree[process].subprocesses[sub].activities[act];
      if (!ac.risks[risk]) ac.risks[risk] = { name: risk, controls: [] };
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (mode === 'edit' && onProjectEdit) onProjectEdit(formData); else if (onProjectCreate) onProjectCreate(formData);
    onOpenChange(false);
    setCurrentStep(1);
    if (mode === 'edit') return;
    // Reset form data
    setFormData({
      projectName: '',
      projectCode: `PRJ-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      clientName: '',
      division: '',
      auditType: '',
      projectDescription: '',
      startDate: null,
      endDate: null,
      divisionHeads: [],
      partners: [],
      teamLeaders: [],
      teamMembers: [],
      checklistTemplate: [],
      customChecklistItems: '',
      selectedChecklistTree: null,
      auditUniverse: [],
      scopeNotes: '',
      documents: [],
      references: '',
      emailNotifications: false,
      reportingFrequency: '',
      auditCommentsModule: true,
      workflowStatus: 'Draft',
      changeLogsEnabled: true,
      riskConfig: null
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Project Information</h3>
            
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) => updateFormData('projectName', e.target.value)}
                placeholder="Unique name of the audit project"
              />
            </div>

            <div>
              <Label htmlFor="projectCode">Project Code</Label>
              <Input
                id="projectCode"
                value={formData.projectCode}
                disabled
                className="bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">Auto-generated</p>
            </div>

            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Select value={formData.clientName} onValueChange={(value) => updateFormData('clientName', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Dropdown list of existing clients" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map(client => (
                    <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="division">Division</Label>
              <Select value={formData.division} onValueChange={(value) => updateFormData('division', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Division under which the project belongs" />
                </SelectTrigger>
                <SelectContent>
                  {divisionOptions.map(division => (
                    <SelectItem key={division} value={division}>{division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex gap-2">
                <Input placeholder="Add new division" value={newDivision} onChange={(e)=>setNewDivision(e.target.value)} />
                <Button type="button" onClick={()=>{ const v = newDivision.trim(); if (!v) return; if (!divisionOptions.includes(v)) setDivisionOptions([...divisionOptions, v]); updateFormData('division', v); setNewDivision(''); }}>Add</Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Option to create / select from list already created</p>
            </div>

            <div>
              <Label htmlFor="auditType">Nature of Assignment</Label>
              <Select value={formData.auditType} onValueChange={(value) => updateFormData('auditType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select nature of assignment" />
                </SelectTrigger>
                <SelectContent>
                  {natureOptions.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="projectDescription">Project Description</Label>
              <Textarea
                id="projectDescription"
                value={formData.projectDescription}
                onChange={(e) => updateFormData('projectDescription', e.target.value)}
                placeholder="Brief details about the project"
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Project Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="mb-2 block">From</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Select value={String(startViewMonth.getMonth())} onValueChange={(m) => { const mi = Number(m); const updated = new Date(startViewMonth.getFullYear(), mi, 1); setStartViewMonth(updated); }}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((nm, idx) => (
                        <SelectItem key={nm} value={String(idx)}>{nm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(startViewMonth.getFullYear())} onValueChange={(y) => { const yy = Number(y); const updated = new Date(yy, startViewMonth.getMonth(), 1); setStartViewMonth(updated); }}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 overflow-y-auto">
                      {Array.from({length: 30}).map((_,i)=>{
                        const y = new Date().getFullYear() - 20 + i;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Calendar
                  mode="single"
                  hideCaption
                  month={startViewMonth}
                  selected={formData.startDate}
                  onSelect={(date) => { updateFormData('startDate', date); if (date) setStartViewMonth(new Date(date)); }}
                />
              </div>

              <div>
                <Label className="mb-2 block">To</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Select value={String(endViewMonth.getMonth())} onValueChange={(m) => { const mi = Number(m); const updated = new Date(endViewMonth.getFullYear(), mi, 1); setEndViewMonth(updated); }}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((nm, idx) => (
                        <SelectItem key={nm} value={String(idx)}>{nm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(endViewMonth.getFullYear())} onValueChange={(y) => { const yy = Number(y); const updated = new Date(yy, endViewMonth.getMonth(), 1); setEndViewMonth(updated); }}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 overflow-y-auto">
                      {Array.from({length: 30}).map((_,i)=>{
                        const y = new Date().getFullYear() - 20 + i;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Calendar
                  mode="single"
                  hideCaption
                  month={endViewMonth}
                  selected={formData.endDate}
                  onSelect={(date) => { updateFormData('endDate', date); if (date) setEndViewMonth(new Date(date)); }}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Team Assignment</h3>
            
            <div>
              <Label>Assign Partner(s)</Label>
              <EmployeesMultiSelect roleFilter="Division Partner" value={formData.partners} onChange={(v) => updateFormData('partners', v)} placeholder="Select Partner(s) responsible" />
            </div>

            <div>
              <Label>Assign Division Head (DH)</Label>
              <EmployeesMultiSelect roleFilter="Division Head" value={formData.divisionHeads} onChange={(v) => updateFormData('divisionHeads', v)} placeholder="Select DH(s) responsible" />
            </div>

            <div>
              <Label>Assign Team Leader(s)</Label>
              <EmployeesMultiSelect roleFilter="Team Leader" value={formData.teamLeaders} onChange={(v) => updateFormData('teamLeaders', v)} placeholder="Select TL(s) for this project" />
            </div>

            <div>
              <Label>Assign Team Member(s)</Label>
              <TeamMembersMultiSelect value={formData.teamMembers} onChange={(val) => updateFormData('teamMembers', val)} />
            </div>

          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Scope & Checklist Selection</h3>

            <div>
              <Label>Scope Notes</Label>
              <Textarea
                value={formData.scopeNotes}
                onChange={(e) => updateFormData('scopeNotes', e.target.value)}
                placeholder="Define what's in-scope and out-of-scope"
                rows={3}
              />
            </div>

            <div>
              <Label>Audit Universe</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {auditUniverseOptions.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={formData.auditUniverse.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateFormData('auditUniverse', [...formData.auditUniverse, option]);
                        } else {
                          updateFormData('auditUniverse', formData.auditUniverse.filter(item => item !== option));
                        }
                      }}
                    />
                    <Label htmlFor={option} className="text-sm">{option}</Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Select relevant units, factories, or departments from the client's audit universe
              </p>
            </div>

            <div>
              <Label>Select Checklist Template(s)</Label>
              <ChecklistTemplatesMultiSelect value={formData.checklistTemplate} onChange={(v) => updateFormData('checklistTemplate', v)} />
              <p className="text-xs text-gray-500 mt-1">Driven by Statement of Applicability mappings for the selected client</p>


              <div className="mt-4 rounded border bg-white">
                <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-white z-[1]">
                  <div className="font-medium">Checklist Tree</div>
                  <div className="text-xs text-slate-500">Select applicable items (selection cascades)</div>
                </div>
                <div className="max-h-[360px] overflow-y-auto overflow-x-hidden divide-y">
                  {soaNodes.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">
                      No mapped processes for this client. Select a client with mappings or update mappings in Settings.
                    </div>
                  ) : (
                    soaNodes.filter(n => isParentExpandedSoa(n)).map((node) => {
                      const level = getSoaLevel(node);
                      const hasChildren = soaNodes.some(n => n.parentId === node.id);
                      const applicable = soaApplicable[node.id];
                      const typeColor = node.type === 'process' ? 'text-blue-700' : node.type === 'subprocess' ? 'text-emerald-700' : node.type === 'activity' ? 'text-amber-700' : node.type === 'risk' ? 'text-red-700' : 'text-purple-700';
                      return (
                        <div key={node.id} className="flex items-center py-2 px-1">
                          <div className="flex items-center w-full" style={{ paddingLeft: `${level * 16 + (node.type === 'control' ? 8 : 0)}px` }}>
                            {hasChildren ? (
                              <button onClick={() => toggleExpandSoa(node.id)} className="mr-2 rounded p-1 hover:bg-slate-100" aria-label={node.isExpanded ? 'Collapse' : 'Expand'}>
                                {node.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            ) : (
                              <span className="w-6" />
                            )}
                            <button
                              type="button"
                              aria-checked={applicable === null ? 'mixed' : applicable ? 'true' : 'false'}
                              onClick={() => toggleApplicableSoa(node)}
                              className="mr-3 inline-flex h-4 w-4 items-center justify-center rounded-sm border border-primary text-current text-xs"
                            >
                              {applicable === true && <Check className="h-3 w-3" />}
                              {applicable === false && <X className="h-3 w-3" />}
                            </button>
                            <div className="text-left min-w-0 w-full">
                              <div className="text-sm font-medium whitespace-normal break-words pr-2">{node.name}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className={`text-xs capitalize ${typeColor}`}>{node.type}</div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${applicable === true ? 'bg-green-100 text-green-700' : applicable === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {applicable === true ? 'Applicable' : applicable === false ? 'Not Applicable' : 'Undecided'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Document & Reference Management</h3>

              <div className="space-y-4 mt-4">
                <div>
                  <Label>Upload Documents</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Supporting files (e.g., client policy, last audit report)</p>
                    <Input type="file" multiple className="mt-2" />
                  </div>
                </div>

                <div>
                  <Label>Link References</Label>
                  <Input
                    value={formData.references}
                    onChange={(e) => updateFormData('references', e.target.value)}
                    placeholder="Link to external systems or folders"
                  />
                </div>
              </div>
            </div>

          </div>
        );

      case 6:
        // If showRiskStep is true, render Risk Assessment UI, otherwise this case maps to Notifications
        if (showRiskStep) {
          const assn = assignmentTypes.find(a => a.name === formData.auditType);
          const baseCfg: RiskAssessmentConfig = assn ? (RiskConfigStore.get(`assignment|${assn.id}`) || RiskConfigStore.getGlobal()) : RiskConfigStore.getGlobal();
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Risk Assessment</h3>
              <ProjectRiskAssessmentForm value={formData.riskConfig || baseCfg} onChange={(next) => updateFormData('riskConfig', next)} />
            </div>
          );
        }

        // otherwise fallthrough to Notifications
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notifications & Reporting</h3>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailNotifications"
                checked={formData.emailNotifications}
                onCheckedChange={(checked) => updateFormData('emailNotifications', checked)}
              />
              <Label htmlFor="emailNotifications">Email Notifications</Label>
            </div>
            <p className="text-sm text-gray-600 ml-6">Notify assigned users when project is created</p>

            <div>
              <Label>Reporting Frequency</Label>
              <Select value={formData.reportingFrequency} onValueChange={(value) => updateFormData('reportingFrequency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Weekly, Fortnightly, Monthly" />
                </SelectTrigger>
                <SelectContent>
                  {reportingFrequencies.map(freq => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notifications & Reporting</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailNotifications"
                checked={formData.emailNotifications}
                onCheckedChange={(checked) => updateFormData('emailNotifications', checked)}
              />
              <Label htmlFor="emailNotifications">Email Notifications</Label>
            </div>
            <p className="text-sm text-gray-600 ml-6">Notify assigned users when project is created</p>

            <div>
              <Label>Reporting Frequency</Label>
              <Select value={formData.reportingFrequency} onValueChange={(value) => updateFormData('reportingFrequency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Weekly, Fortnightly, Monthly" />
                </SelectTrigger>
                <SelectContent>
                  {reportingFrequencies.map(freq => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );


      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{mode === 'edit' ? 'Project - Edit' : 'Project - New'}</DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="mb-0">
          <div className="flex items-center mb-0">
            <span className="text-sm text-gray-600">Step {currentStep} of {steps.length}</span>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <button
                type="button"
                onClick={() => setCurrentStep(step.number)}
                key={step.number}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs cursor-pointer ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : isCompleted
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.number}</span>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex space-x-2">
            {currentStep < steps.length ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                Create Project
                <CheckCircle2 className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
