import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import IndustrySelect from '@/components/IndustrySelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const LS = {
  get<T=any>(key:string): T | null { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null; } catch { return null; } },
  set(key:string, val:any) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
};
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Search, Check, ClipboardList, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Filter, Rows3, Columns2, Download } from 'lucide-react';

interface TreeNode {
  id: string;
  type: 'process' | 'subprocess' | 'activity' | 'risk' | 'control';
  name: string;
  parentId?: string;
  isExpanded?: boolean;
  isSelected?: boolean;
}

interface NodeDetails {
  description: string;
  industry: string;
  client: string;
  itemId: string;
  applicable: boolean | null;
}

// Industries are managed globally via IndustrySelect (fetched from API/localStorage)

type SoAClient = { id: string; name: string; industry: string };

const periods = ['FY 2023-24', 'FY 2024-25', 'Q1 2025', 'Q2 2025'];

const itemCatalog = [
  { id: 'POL-001', label: 'Information Security Policy (ISO 27001 A.5)' },
  { id: 'POL-002', label: 'Access Control Policy (ISO 27001 A.9)' },
  { id: 'CTL-101', label: 'Three-way match for purchases' },
  { id: 'CTL-204', label: 'User access review - quarterly' },
  { id: 'ISO-27001-A12', label: 'Operations Security (A.12)' },
  { id: 'SOX-ITGC-01', label: 'SOX ITGC - Change Management' }
];

const ProcessesMultiSelect = ({ options, value, onChange }: { options: {id:string; name:string}[]; value: string[]; onChange: (v:string[])=>void }) => {
  const [open, setOpen] = useState(false);
  const display = value && value.length ? (value.length<=2 ? options.filter(o=>value.includes(o.id)).map(o=>o.name).join(', ') : `${options.filter(o=>value.includes(o.id)).slice(0,2).map(o=>o.name).join(', ')} (+${value.length-2})`) : 'Select processes';
  const toggle = (id: string) => {
    let next = Array.isArray(value) ? [...value] : [];
    const has = next.includes(id);
    if (has) next = next.filter(x=>x!==id); else next.push(id);
    onChange(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{display}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[60]">
        <Command>
          <CommandInput placeholder="Search processes..." />
          <CommandEmpty>No process found.</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandGroup heading="Processes">
              {options.map(opt => (
                <CommandItem key={opt.id} value={opt.name} onSelect={() => toggle(opt.id)}>
                  <Checkbox className="mr-2" checked={value?.includes(opt.id)} /> {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function StatementOfApplicability() {
  const [tab, setTab] = useState<'industry' | 'client'>('industry');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Manufacturing');
  const [clients, setClients] = useState<SoAClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientNeedsIndustryMapping, setClientNeedsIndustryMapping] = useState<string | null>(null);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [processOptions, setProcessOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedProcessesIndustry, setSelectedProcessesIndustry] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProcessesClient, setSelectedProcessesClient] = useState<string[]>([]);
  const [industryProcessMap, setIndustryProcessMap] = useState<Record<string, string[]>>({});
  const [industryNodeMap, setIndustryNodeMap] = useState<Record<string, string[]>>({});
  const [clientNodeMap, setClientNodeMap] = useState<Record<string, string[]>>({});
  const [industrySelections, setIndustrySelections] = useState<Set<string>>(new Set());
  const [clientSelections, setClientSelections] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailsIndustry, setDetailsIndustry] = useState<Record<string, Record<string, NodeDetails>>>({});
  const [detailsClient, setDetailsClient] = useState<Record<string, Record<string, NodeDetails>>>({});
  const [openItemPicker, setOpenItemPicker] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [showOnlyUndecided, setShowOnlyUndecided] = useState(false);
  const [filterApplicability, setFilterApplicability] = useState<'all'|'app'|'na'|'undecided'>('all');
  const allFields = ['Process','Subprocess','Activity','Risk','Control','Risk Related Departments','Controls Related Departments','Risk Category','Control Type','Reference','Applicability','Industry','Client'] as const;
  const [selectedFields, setSelectedFields] = useState<string[]>(['Process','Subprocess','Activity','Risk','Control','Reference','Applicability','Industry']);
  const [groupBy, setGroupBy] = useState<'none'|'applicability'|'industry'|'client'|'process'|'subprocess'|'activity'>('none');

  const selectedClient = clients.find(c => c.id === selectedClientId);

  useEffect(() => {
    (async () => {
      try {
        // Seed from local cache for instant UX and to survive server resets
        try {
          const cached = localStorage.getItem('clients');
          if (cached) {
            const parsed = JSON.parse(cached) as any[];
            const mappedCached: SoAClient[] = Array.isArray(parsed) ? parsed.map(r => ({ id: r.id, name: r.name, industry: r.industry || r.sector || '' })) : [];
            if (mappedCached.length) {
              setClients(mappedCached);
              if (!selectedClientId) setSelectedClientId(mappedCached[0].id);
            }
          }
        } catch {}

        // Fresh data from API
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          const mapped: SoAClient[] = (data || []).map((r: any) => ({ id: r.id, name: r.name, industry: r.industry }));
          if (mapped.length) {
            setClients(mapped);
            try { localStorage.setItem('clients', JSON.stringify(mapped)); } catch {}
            if (!selectedClientId) setSelectedClientId(mapped[0].id);
          }
        }
      } catch {
        // Silent: cache seeding already attempted above
        toast({ title: 'Could not load clients' });
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/settings/${encodeURIComponent('soa:industry:' + selectedIndustry)}`);
        const saved = res.ok ? await res.json() : LS.get(`soa:industry:${selectedIndustry}`);
        if (saved && typeof saved === 'object') {
          if (Array.isArray(saved.processes)) setSelectedProcessesIndustry(saved.processes);
          if (saved.nodeApplicability && typeof saved.nodeApplicability === 'object') {
            const appMap: Record<string, boolean | null> = saved.nodeApplicability;
            setDetailsIndustry(prev => {
              const current = prev[selectedIndustry] || {};
              const next: Record<string, NodeDetails> = { ...current };
              for (const [id, val] of Object.entries(appMap)) {
                const existing = next[id] || { description: '', industry: selectedIndustry, client: '', itemId: '', applicable: null };
                next[id] = { ...existing, industry: selectedIndustry, applicable: val };
              }
              return { ...prev, [selectedIndustry]: next };
            });
            setIndustrySelections(new Set(Object.keys(appMap).filter(id => appMap[id] === true)));
          }
        }
      } catch {
        const saved = LS.get(`soa:industry:${selectedIndustry}`);
        if (saved && typeof saved === 'object' && Array.isArray((saved as any).processes)) {
          setSelectedProcessesIndustry((saved as any).processes);
        }
      }
    })();
  }, [selectedIndustry]);

  useEffect(() => {
    (async () => {
      if (!selectedClient) return;
      const ind = selectedClient.industry;
      try {
        // Load industry mapping for client's industry
        const res = await fetch(`/api/settings/${encodeURIComponent('soa:industry:' + ind)}`);
        const saved = res.ok ? await res.json() : LS.get(`soa:industry:${ind}`);
        if (!saved || !Array.isArray(saved.processes) || !saved.processes.length) {
          setClientNeedsIndustryMapping('Do industry mapping first.');
          setSelectedProcessesClient([]);
          return;
        }
        setClientNeedsIndustryMapping(null);
        setIndustryProcessMap(prev => ({ ...prev, [ind]: saved.processes }));
        setSelectedProcessesClient(saved.processes);

        // Load client-specific mapping if available
        let savedClient: any = null;
        try {
          const rc = await fetch(`/api/settings/${encodeURIComponent('soa:client:' + selectedClientId)}`);
          if (rc.ok) savedClient = await rc.json(); else savedClient = LS.get(`soa:client:${selectedClientId}`);
        } catch {
          savedClient = LS.get(`soa:client:${selectedClientId}`);
        }

        if (savedClient && typeof savedClient === 'object') {
          if (Array.isArray(savedClient.processes) && savedClient.processes.length) setSelectedProcessesClient(savedClient.processes);
          if (savedClient.nodeApplicability && typeof savedClient.nodeApplicability === 'object') {
            const appMapClient: Record<string, boolean | null> = savedClient.nodeApplicability;
            setDetailsClient(prev => {
              const current = prev[selectedClientId] || {};
              const next: Record<string, NodeDetails> = { ...current };
              for (const [id, val] of Object.entries(appMapClient)) {
                const existing = next[id] || { description: '', industry: ind, client: selectedClientId, itemId: '', applicable: null };
                next[id] = { ...existing, client: selectedClientId, industry: ind, applicable: val };
              }
              return { ...prev, [selectedClientId]: next };
            });
            setClientSelections(new Set(Object.keys(appMapClient).filter(id => appMapClient[id] === true)));
            return;
          }
        }

        // Seed client's details from industry defaults if no client mapping exists yet
        if (saved.nodeApplicability && typeof saved.nodeApplicability === 'object') {
          const appMap: Record<string, boolean | null> = saved.nodeApplicability;
          setDetailsClient(prev => {
            const current = prev[selectedClientId] || {};
            const next: Record<string, NodeDetails> = { ...current };
            for (const [id, val] of Object.entries(appMap)) {
              const existing = next[id] || { description: '', industry: ind, client: selectedClientId, itemId: '', applicable: null };
              next[id] = { ...existing, client: selectedClientId, industry: ind, applicable: val };
            }
            return { ...prev, [selectedClientId]: next };
          });
          setClientSelections(new Set(Object.keys(appMap).filter(id => appMap[id] === true)));
        } else {
          setClientSelections(new Set());
        }
      } catch {
        const saved = LS.get(`soa:industry:${ind}`);
        if (!saved || !Array.isArray((saved as any).processes) || !(saved as any).processes.length) {
          setClientNeedsIndustryMapping('Do industry mapping first.');
          setSelectedProcessesClient([]);
        } else {
          setClientNeedsIndustryMapping(null);
          const procs = (saved as any).processes as string[];
          setIndustryProcessMap(prev => ({ ...prev, [ind]: procs }));
          setSelectedProcessesClient(procs);
        }
      }
    })();
  }, [selectedClientId, selectedClient?.industry]);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/framework/tree');
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        const nodes = Array.isArray(data?.nodes) ? data.nodes as any[] : [];
        if (!nodes.length) return;
        const mapped: TreeNode[] = nodes.map((n: any) => ({ id: n.id, type: n.type, name: n.name, parentId: n.parentId, isExpanded: true }));
        const sorted = mapped.slice().sort((a,b)=>compareHier(a.id,b.id));
        setTree(sorted);
        setProcessOptions(sorted.filter(n => n.type === 'process').map(n => ({ id: n.id, name: n.name })));
      } catch {
        toast({ title: 'Could not load framework tree' });
      }
    })();
  }, [compareHier]);

  const getLevel = (node: TreeNode) => {
    let level = 0;
    let current = node;
    while (current.parentId) {
      const parent = tree.find(n => n.id === current.parentId);
      if (!parent) break;
      level += 1;
      current = parent;
    }
    return level;
  };

  const getTypeColorClass = (t: TreeNode['type']) => (
    t === 'process' ? 'text-blue-700' :
    t === 'subprocess' ? 'text-emerald-700' :
    t === 'activity' ? 'text-amber-700' :
    t === 'risk' ? 'text-red-700' : 'text-purple-700'
  );

  const isParentExpanded = (node: TreeNode) => {
    if (!node.parentId) return true;
    const parent = tree.find(n => n.id === node.parentId);
    if (!parent) return true;
    return !!parent.isExpanded && isParentExpanded(parent);
  };

  const visibleNodes = React.useMemo(() => (showOnlyUndecided ? tree : tree.filter(n => isParentExpanded(n))).sort((a,b)=>compareHier(a.id,b.id)), [tree, compareHier, showOnlyUndecided]);
  const collectDescendantIds = (id: string, acc: string[] = []) => {
    const children = tree.filter(n => n.parentId === id);
    for (const c of children) { acc.push(c.id); collectDescendantIds(c.id, acc); }
    return acc;
  };
  const activeDetails: Record<string, NodeDetails> = tab === 'industry' ? (detailsIndustry[selectedIndustry] || {}) : (detailsClient[selectedClientId] || {});
  const renderNodes = useMemo(() => {
    const selectedProcs = tab === 'industry' ? selectedProcessesIndustry : selectedProcessesClient;
    const baseIds = selectedProcs.length ? selectedProcs : [];
    const ids: string[] = [];
    for (const id of baseIds) ids.push(id, ...collectDescendantIds(id));
    if (!ids.length) return [] as TreeNode[];
    return visibleNodes.filter(n => ids.includes(n.id)).filter(n => !showOnlyUndecided || ((activeDetails[n.id]?.applicable ?? null) === null));
  }, [visibleNodes, selectedProcessesIndustry, selectedProcessesClient, tab, tree, showOnlyUndecided, detailsIndustry, detailsClient, selectedIndustry, selectedClientId]);
  const toggleSelectIndustry = (id: string) => { setIndustrySelections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };
  const toggleSelectClient = (id: string) => { setClientSelections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };

  const toggleExpand = (id: string) => {
    setTree(prev => prev.map(n => n.id === id ? { ...n, isExpanded: !n.isExpanded } : n));
  };

  const toggleSelectCascade = (id: string, checked: boolean) => {
    const ids = [id, ...collectDescendantIds(id)];
    const setIds = new Set(ids);
    setTree(prev => prev.map(n => setIds.has(n.id) ? { ...n, isSelected: checked } : n));
    if (tab === 'industry') {
      setDetailsIndustry(prev => {
        const current = prev[selectedIndustry] || {};
        const next: Record<string, NodeDetails> = { ...current };
        if (checked) {
          for (const nid of ids) {
            if (!next[nid]) {
              next[nid] = { description: '', industry: selectedIndustry, client: '', itemId: '', applicable: null };
            }
          }
        }
        return { ...prev, [selectedIndustry]: next };
      });
    } else {
      setDetailsClient(prev => {
        const current = prev[selectedClientId] || {};
        const next: Record<string, NodeDetails> = { ...current };
        if (checked) {
          for (const nid of ids) {
            if (!next[nid]) {
              next[nid] = { description: '', industry: selectedClient?.industry || '', client: selectedClientId, itemId: '', applicable: null };
            }
          }
        }
        return { ...prev, [selectedClientId]: next };
      });
    }
    if (tab === 'industry') {
      setIndustrySelections(prev => {
        const next = new Set(prev);
        for (const nid of ids) { checked ? next.add(nid) : next.delete(nid); }
        return next;
      });
    } else {
      setClientSelections(prev => {
        const next = new Set(prev);
        for (const nid of ids) { checked ? next.add(nid) : next.delete(nid); }
        return next;
      });
    }
  };

  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);
    if (tab === 'industry') {
      const current = detailsIndustry[selectedIndustry] || {};
      if (!current[id]) {
        setDetailsIndustry(prev => ({
          ...prev,
          [selectedIndustry]: { ...current, [id]: { description: '', industry: selectedIndustry, client: '', itemId: '', applicable: null } }
        }));
      }
    } else {
      const current = detailsClient[selectedClientId] || {};
      if (!current[id]) {
        setDetailsClient(prev => ({
          ...prev,
          [selectedClientId]: { ...current, [id]: { description: '', industry: selectedClient?.industry || '', client: selectedClientId, itemId: '', applicable: null } }
        }));
      }
    }
  };

  const selectedNode = selectedNodeId ? tree.find(n => n.id === selectedNodeId) || null : null;
  const nodeDetails: NodeDetails | undefined = selectedNodeId ? (activeDetails as any)[selectedNodeId!] : undefined;

  const updateNodeDetails = (patch: Partial<NodeDetails>) => {
    if (!selectedNodeId) return;
    if (tab === 'industry') {
      setDetailsIndustry(prev => {
        const current = prev[selectedIndustry] || {};
        const base = current[selectedNodeId] || { description: '', industry: selectedIndustry, client: '', itemId: '', applicable: null };
        return { ...prev, [selectedIndustry]: { ...current, [selectedNodeId]: { ...base, ...patch } } };
      });
    } else {
      setDetailsClient(prev => {
        const current = prev[selectedClientId] || {};
        const base = current[selectedNodeId] || { description: '', industry: selectedClient?.industry || '', client: selectedClientId, itemId: '', applicable: null };
        return { ...prev, [selectedClientId]: { ...current, [selectedNodeId]: { ...base, ...patch } } };
      });
    }
  };

  const resetSelectionsToFilter = () => {
    if (tab === 'industry') {
      setDetailsIndustry(prev => {
        const cur = { ...(prev[selectedIndustry] || {}) } as Record<string, NodeDetails>;
        Object.keys(cur).forEach(k => { if (!cur[k].industry) cur[k].industry = selectedIndustry; });
        return { ...prev, [selectedIndustry]: cur };
      });
    } else {
      setDetailsClient(prev => {
        const cur = { ...(prev[selectedClientId] || {}) } as Record<string, NodeDetails>;
        Object.keys(cur).forEach(k => { if (!cur[k].client) cur[k].client = selectedClientId; });
        return { ...prev, [selectedClientId]: cur };
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-blue-600" />
          Statement of Applicability
        </h1>
        <Badge className="bg-blue-100 text-blue-800">SoA</Badge>
      </div>

      <div className="flex items-center py-2 px-1 justify-end">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Filter className="h-4 w-4"/> Filter</Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 z-[60]">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Applicability</Label>
                  <Select value={filterApplicability} onValueChange={(v:any)=>setFilterApplicability(v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="app">Applicable</SelectItem>
                      <SelectItem value="na">Not Applicable</SelectItem>
                      <SelectItem value="undecided">Undecided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={()=>setFilterApplicability('all')}>Reset</Button></div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Rows3 className="h-4 w-4"/> Group</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="grid gap-2">
                {(['none','applicability','industry','client','process','subprocess','activity'] as const).map(opt => (
                  <Button key={opt} variant={groupBy===opt?'default':'outline'} size="sm" className="capitalize justify-start" onClick={()=>setGroupBy(opt)}>
                    {opt === 'none' ? 'None' : opt}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Columns2 className="h-4 w-4"/> Fields</Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <div className="grid gap-2">
                {allFields.map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedFields.includes(f)} onCheckedChange={(v)=> setSelectedFields(prev => v ? [...prev, f] : prev.filter(x=>x!==f))} />
                    <span>{f}</span>
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields([...allFields])}>All</Button>
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields(['Process','Subprocess','Activity','Risk','Control','Reference','Applicability','Industry'])}>Default</Button>
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields([])}>None</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" className="flex items-center gap-2" onClick={()=>{
            const rowsBase = renderNodes
              .filter(n=>{
                const app = activeDetails[n.id]?.applicable;
                return filterApplicability==='all' ? true : filterApplicability==='app' ? app===true : filterApplicability==='na' ? app===false : app===null || app===undefined;
              })
              .map(n=>{
                const path: string[] = [];
                let riskName = '';
                let controlName = '';
                let cur: TreeNode | undefined = n;
                while (cur) {
                  if (cur.type === 'process') path[0] = cur.name;
                  else if (cur.type === 'subprocess') path[1] = cur.name;
                  else if (cur.type === 'activity') path[2] = cur.name;
                  else if (cur.type === 'risk') riskName = riskName || cur.name;
                  else if (cur.type === 'control') controlName = controlName || cur.name;
                  cur = cur.parentId ? tree.find(x=>x.id===cur!.parentId) || undefined : undefined;
                }
                const row: Record<string, any> = {};
                const app = activeDetails[n.id]?.applicable;
                if (selectedFields.includes('Process')) row['Process'] = path[0] || '';
                if (selectedFields.includes('Subprocess')) row['Subprocess'] = path[1] || '';
                if (selectedFields.includes('Activity')) row['Activity'] = path[2] || '';
                if (selectedFields.includes('Risk')) row['Risk'] = riskName || '';
                if (selectedFields.includes('Control')) row['Control'] = controlName || '';
                if (selectedFields.includes('Risk Related Departments')) row['risk related departments'] = '';
                if (selectedFields.includes('Controls Related Departments')) row['controls related departments'] = '';
                if (selectedFields.includes('Risk Category')) row['Risk Category'] = '';
                if (selectedFields.includes('Control Type')) row['Control type'] = '';
                if (selectedFields.includes('Reference')) row['Reference'] = n.id;
                if (selectedFields.includes('Applicability')) row['Applicability'] = app===true ? 'Applicable' : app===false ? 'Not Applicable' : 'Undecided';
                if (selectedFields.includes('Industry')) row['Industry'] = tab==='industry' ? selectedIndustry : (selectedClient?.industry||'');
                if (selectedFields.includes('Client')) row['Client'] = tab==='client' ? (selectedClient?.name||'') : '';
                return row;
              });
            let rows: any[] = [];
            if (groupBy==='none') rows = rowsBase;
            else {
              const groups: Record<string, any[]> = {};
              for (const r of rowsBase) {
                let key = '';
                if (groupBy==='applicability') key = r['Applicability'] || '';
                else if (groupBy==='industry') key = r['Industry'] || '';
                else if (groupBy==='client') key = r['Client'] || '';
                else if (groupBy==='process') key = r['Process'] || '';
                else if (groupBy==='subprocess') key = r['Subprocess'] || '';
                else if (groupBy==='activity') key = r['Activity'] || '';
                if (!groups[key]) groups[key]=[];
                groups[key].push(r);
              }
              const keys = Object.keys(groups).sort();
              for (const k of keys) { rows.push({ Group: k }); rows.push(...groups[k]); rows.push({}); }
            }
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'SoA');
            XLSX.writeFile(wb, 'soa.xlsx');
          }}><Download className="h-4 w-4"/> Export XLSX</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Mapping Mode</span>
            </div>
            <div className="flex gap-2 text-sm">
              <Button variant={tab==='industry'?'default':'outline'} size="sm" onClick={()=>setTab('industry')}>Industry Mapping</Button>
              <Button variant={tab==='client'?'default':'outline'} size="sm" onClick={()=>setTab('client')}>Client Mapping</Button>
            </div>
          </div>

          {tab==='industry' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Industry</Label>
                <div className="mt-1">
                  <IndustrySelect
                    value={selectedIndustry}
                    onChange={(v) => { setSelectedIndustry(v); setSelectedProcessesIndustry(industryProcessMap[v] || []); setIndustrySelections(new Set()); }}
                    placeholder="Select industry"
                  />
                </div>
              </div>
              <div>
                <Label>Processes (Multiple)</Label>
                <ProcessesMultiSelect options={processOptions} value={selectedProcessesIndustry} onChange={setSelectedProcessesIndustry} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setClientSelections(new Set()); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-slate-500 mt-1">Industry: {selectedClient?.industry || '-'}</div>
                {clientNeedsIndustryMapping && (
                  <div className="text-xs mt-1 text-amber-700">{clientNeedsIndustryMapping}</div>
                )}
              </div>
              <div>
                <Label>Processes (Multiple)</Label>
                <ProcessesMultiSelect
                  options={processOptions.filter(p => (industryProcessMap[selectedClient?.industry||'']?.length ? industryProcessMap[selectedClient!.industry]!.includes(p.id) : false))}
                  value={selectedProcessesClient}
                  onChange={setSelectedProcessesClient}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Left: Tree */}
        <Card className="max-h-[80vh] overflow-hidden flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>Checklist Tree</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant={showOnlyUndecided ? 'default' : 'outline'} size="sm" onClick={() => setShowOnlyUndecided(v => !v)}>
                  {showOnlyUndecided ? 'Show All' : 'Show New/Undecided'}
                </Button>
                {tab === 'industry' ? (
                  <Button disabled={isSaving} onClick={async () => {
                    try {
                      setIsSaving(true);
                      setIndustryProcessMap(prev => ({ ...prev, [selectedIndustry]: selectedProcessesIndustry }));
                      setIndustryNodeMap(prev => ({ ...prev, [selectedIndustry]: Array.from(industrySelections) }));
                      const nodeApplicability: Record<string, boolean | null> = {};
                      const mapInd = detailsIndustry[selectedIndustry] || {};
                      for (const [id, det] of Object.entries(mapInd)) {
                        if (det.applicable !== undefined && det.applicable !== null) nodeApplicability[id] = det.applicable;
                      }
                      const payload = {
                        industry: selectedIndustry,
                        processes: selectedProcessesIndustry,
                        nodeApplicability,
                        updatedAt: new Date().toISOString(),
                      };
                      try { await fetch(`/api/settings/${encodeURIComponent('soa:industry:' + selectedIndustry)}` , { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch {}
                      LS.set(`soa:industry:${selectedIndustry}`, payload);
                      toast({ title: 'Saved successfully' });
                    } catch {
                      toast({ title: 'Save failed' });
                    } finally {
                      setIsSaving(false);
                    }
                  }}>Save Industry Mapping</Button>
                ) : (
                  <Button disabled={!selectedClient} onClick={async () => {
                    try {
                      const nodeApplicability: Record<string, boolean | null> = {};
                      for (const [id, det] of Object.entries(details)) {
                        if (det.client === selectedClientId && det.applicable !== undefined && det.applicable !== null) {
                          nodeApplicability[id] = det.applicable;
                        }
                      }
                      const payloadClient = { clientId: selectedClientId, industry: selectedClient?.industry || '', processes: selectedProcessesClient, nodeApplicability, updatedAt: new Date().toISOString() };
                      try { await fetch(`/api/settings/${encodeURIComponent('soa:client:' + selectedClientId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadClient) }); } catch {}
                      LS.set(`soa:client:${selectedClientId}`, payloadClient);

                      // Maintain a simple name->processNames map for consumers that only know client name
                      try {
                        const nameKey = 'soa-client-mapping';
                        let existing: Record<string, string[]> = {};
                        try {
                          const res = await fetch(`/api/settings/${nameKey}`);
                          if (res.ok) existing = await res.json();
                        } catch {}
                        if (!existing || typeof existing !== 'object') existing = {} as any;
                        const idToName: Record<string,string> = Object.fromEntries(processOptions.map(p => [p.id, p.name]));
                        existing[selectedClient?.name || selectedClientId] = (selectedProcessesClient || []).map(id => idToName[id]).filter(Boolean);
                        try { await fetch(`/api/settings/${nameKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(existing) }); } catch {}
                        LS.set(nameKey, existing);
                      } catch {}

                      toast({ title: 'Saved successfully' });
                    } catch {
                      toast({ title: 'Save failed' });
                    }
                  }}>Save Client Mapping</Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0 flex flex-col">

            <ScrollArea className="flex-1 pr-2">
              <div className="divide-y pb-6">
                {renderNodes.map((node) => {
                  const level = getLevel(node);
                  const hasChildren = tree.some(n => n.parentId === node.id);
                  const nd = activeDetails[node.id];
                  return (
                    <div key={node.id} className={`flex items-center py-2 px-1 ${selectedNodeId === node.id ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center w-full" style={{ paddingLeft: `${level * 16 + (node.type === 'control' ? 8 : 0)}px` }}>
                        {hasChildren && (
                          <button
                            onClick={() => toggleExpand(node.id)}
                            className="mr-2 rounded p-1 hover:bg-slate-100"
                            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {node.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                        {!hasChildren && <span className="w-6" />}
                        {/* Tri-state applicable checkbox: null -> true (tick) -> false (cross) -> null */}
                        <button
                          type="button"
                          aria-checked={nd?.applicable === null ? 'mixed' : nd?.applicable ? 'true' : 'false'}
                          onClick={() => {
                            const current = nd?.applicable ?? null;
                            const next = current === null ? true : (current === true ? false : null);

                            // collect this node and all descendants to cascade
                            const ids = [node.id, ...collectDescendantIds(node.id)];

                            // update details for all ids atomically
                            setDetails(prev => {
                              const copy = { ...prev } as Record<string, NodeDetails>;
                              for (const id of ids) {
                                const existing = copy[id] || { description: '', industry: selectedIndustry, client: selectedClientId, itemId: '', applicable: null };
                                copy[id] = { ...existing, applicable: next };
                              }
                              return copy;
                            });

                            // update selection maps so Save buttons continue to work (true => selected)
                            if (tab === 'industry') {
                              setIndustrySelections(prev => {
                                const nextSet = new Set(prev);
                                for (const id of ids) {
                                  if (next === true) nextSet.add(id); else nextSet.delete(id);
                                }
                                return nextSet;
                              });
                            } else {
                              setClientSelections(prev => {
                                const nextSet = new Set(prev);
                                for (const id of ids) {
                                  if (next === true) nextSet.add(id); else nextSet.delete(id);
                                }
                                return nextSet;
                              });
                            }

                          }}
                          className="mr-3 inline-flex h-4 w-4 items-center justify-center rounded-sm border border-primary text-current text-xs"
                        >
                          {nd?.applicable === true && <Check className="h-3 w-3" />}
                          {nd?.applicable === false && <X className="h-3 w-3" />}
                        </button>
                        <button className="text-left min-w-0 w-full" onClick={() => handleSelectNode(node.id)}>
                          <div className="text-sm font-medium truncate">{node.name}</div>
                          <div className="flex items-center gap-2">
                            <div className={`text-xs capitalize ${getTypeColorClass(node.type)} truncate`}>{node.type}</div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${nd?.applicable === true ? 'bg-green-100 text-green-700' : nd?.applicable === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                {nd?.applicable === true ? 'Applicable' : nd?.applicable === false ? 'Not Applicable' : 'Undecided'}
                              </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
