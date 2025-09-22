import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  X,
  MessageSquare,
  Pencil,
  Trash
} from 'lucide-react';


type NodeType = 'process' | 'subprocess' | 'activity' | 'risk' | 'control';

interface FrameworkNode {
  id: string;
  type: NodeType;
  name: string;
  parentId?: string;
  isExpanded?: boolean;
}

interface ProcessDetails {
  process_id: string;
  process_name: string;
  process_description: string;
  process_category?: string;
  departments_involved: string[];
}

interface SubprocessDetails {
  sub_process_id: string;
  sub_process_name: string;
  sub_process_description: string;
  linked_process_id: string;
  departments_involved: string[];
}

interface ActivityDetails {
  activity_id: string;
  activity_name: string;
  activity_description: string;
  linked_process_id: string;
  linked_sub_process_id: string;
  departments_involved: string[];
}

interface RiskDetails {
  risk_id: string;
  risk_name: string;
  risk_description: string;
  risk_category: string;
  inherent_risk_score: number;
  departments_involved: string[];
}

interface ControlDetails {
  control_id: string;
  control_description: string;
  control_type: string;
  control_frequency: string;
  control_owner: string;
  control_effectiveness_score: number;
  departments_involved: string[];
}

type NodeDetails =
  | ({ type: 'process' } & ProcessDetails)
  | ({ type: 'subprocess' } & SubprocessDetails)
  | ({ type: 'activity' } & ActivityDetails)
  | ({ type: 'risk' } & RiskDetails)
  | ({ type: 'control' } & ControlDetails);

interface Client {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress';
  industry: string;
  assignedProjects: number;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: 'note' | 'issue' | 'resolution';
}

const riskCategories = ["Operational", "Financial", "Compliance", "Strategic"];
const controlTypes = ["Preventive", "Detective", "Corrective", "Compensating"];
const controlFrequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "Annually", "Ad-hoc"];
const UNASSIGNED_DEPT = 'UNASSIGNED';
const DEFAULT_DEPT_OPTIONS = ["Finance", "Operations", "HR", "IT", "Procurement", "Sales", "Legal", "Compliance", "Internal Audit", "Other"];

const DepartmentsMultiSelect = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('framework:departments');
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) && arr.every((x: any) => typeof x === 'string') ? arr : DEFAULT_DEPT_OPTIONS;
    } catch {
      return DEFAULT_DEPT_OPTIONS;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem('framework:departments', JSON.stringify(options));
    } catch {}
  }, [options]);
  const [newDept, setNewDept] = React.useState('');
  const addNew = () => {
    const name = newDept.trim();
    if (!name) return;
    if (name.toUpperCase() === UNASSIGNED_DEPT) return;
    const existing = options.find(o => o.toLowerCase() === name.toLowerCase());
    if (existing) {
      toggle(existing);
      setNewDept('');
      return;
    }
    const next = [...options, name];
    setOptions(next);
    toggle(name);
    setNewDept('');
  };
  const display = value && value.length && !(value.length === 1 && value[0] === UNASSIGNED_DEPT)
    ? (value.length <= 2 ? value.join(', ') : `${value.slice(0, 2).join(', ')} (+${value.length - 2})`)
    : 'Unassigned';
  const toggle = (dep: string) => {
    let next = Array.isArray(value) ? [...value] : [];
    const has = next.includes(dep);
    if (dep === UNASSIGNED_DEPT) {
      next = has ? [] : [UNASSIGNED_DEPT];
    } else {
      next = next.filter(d => d !== UNASSIGNED_DEPT);
      if (has) next = next.filter(d => d !== dep); else next.push(dep);
    }
    onChange(next);
  };
  const stop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{display}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-72 p-0">
        <Command>
          <CommandInput placeholder="Search departments..." />
          <CommandEmpty>No department found.</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandGroup heading="Options">
              <CommandItem value={UNASSIGNED_DEPT} onSelect={() => toggle(UNASSIGNED_DEPT)}>
                <Checkbox className="mr-2" checked={value?.includes(UNASSIGNED_DEPT)} onClick={stop} onMouseDown={stop} onCheckedChange={() => toggle(UNASSIGNED_DEPT)} /> Unassigned
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Departments">
              {options.map(dep => (
                <CommandItem key={dep} value={dep} onSelect={() => toggle(dep)}>
                  <Checkbox className="mr-2" checked={value?.includes(dep)} onClick={stop} onMouseDown={stop} onCheckedChange={() => toggle(dep)} /> {dep}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              placeholder="Add new department"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }}
            />
            <Button size="sm" onClick={addNew}>Add</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ProcessSelector = ({ processes, value, onSelect, placeholder }: { processes: FrameworkNode[]; value: string | null; onSelect: (id: string) => void; placeholder?: string }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return processes;
    return processes.filter(p => p.name.toLowerCase().includes(q));
  }, [processes, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{value ? (processes.find(p => p.id === value)?.name || value) : (query || placeholder || 'Select process')}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[80] p-0 w-[var(--radix-popper-anchor-width)] max-w-3xl" style={{ width: 'var(--radix-popper-anchor-width)' }}>
        <Command>
          <CommandInput placeholder="Type to search processes..." value={query} onValueChange={(v) => setQuery(v || '')} />
          <CommandEmpty>No process found.</CommandEmpty>
          <CommandList className="max-h-72 overflow-y-auto">
            <CommandGroup>
              {items.map(p => (
                <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => { onSelect(p.id); setQuery(''); setOpen(false); }}>
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function FrameworkDashboard() {
  const [activeTab, setActiveTab] = useState("completed");
  const [selectedClient, setSelectedClient] = useState<string | null>('CLT-001');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [clients] = useState<Client[]>([
    {
      id: 'CLT-001',
      name: 'Bull Machines India Pvt. LTD',
      description: 'Manufacturing and production company specializing in industrial machinery',
      status: 'in-progress',
      industry: 'Manufacturing',
      assignedProjects: 2
    },
    {
      id: 'CLT-002',
      name: 'Supreme Mobiles',
      description: 'Mobile phone retail and distribution company',
      status: 'in-progress',
      industry: 'Retail',
      assignedProjects: 1
    },
    {
      id: 'CLT-003',
      name: 'Thalapakatti Hospitality Pvt. LTD',
      description: 'Restaurant chain and hospitality services',
      status: 'completed',
      industry: 'Hospitality',
      assignedProjects: 1
    },
    {
      id: 'CLT-004',
      name: 'KTM',
      description: 'Automotive and motorcycle manufacturing',
      status: 'in-progress',
      industry: 'Automotive',
      assignedProjects: 3
    },
    {
      id: 'CLT-005',
      name: 'KMCH',
      description: 'Healthcare and medical services provider',
      status: 'completed',
      industry: 'Healthcare',
      assignedProjects: 1
    }
  ]);

  const [nodes, setNodes] = useState<FrameworkNode[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, NodeDetails>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState('');
  const [universalSearch, setUniversalSearch] = useState('');
  const [controlFilterValue, setControlFilterValue] = useState('ALL');

  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    const SAMPLE_URL = 'https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c';
    if (nodes.length) return; // import once

    const normalizeRows = (data: any): any[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      const keys = Object.keys(data);
      // try common shapes: {Sheet1: [...] } or {sheets:{Sheet1:[...]}}
      if (data.Sheet1 && Array.isArray(data.Sheet1)) return data.Sheet1;
      if (data.sheets && typeof data.sheets === 'object') {
        const first = Object.values(data.sheets)[0];
        if (Array.isArray(first)) return first as any[];
      }
      if (keys.length === 1 && Array.isArray((data as any)[keys[0]])) return (data as any)[keys[0]];
      return [];
    };

    const importData = async () => {
      try {
        const res = await fetch(SAMPLE_URL);
        const json = await res.json();
        const rows = normalizeRows(json);
        if (!rows.length) return;

        const newNodes: FrameworkNode[] = [];
        const newDetails: Record<string, NodeDetails> = {};

        const ensurePush = (node: FrameworkNode) => {
          if (!newNodes.some(n => n.id === node.id)) newNodes.push(node);
        };

        const procIndex = new Map<string, string>();
        const subIndex = new Map<string, string>(); // key: procId|subName
        const actIndex = new Map<string, string>(); // key: subId|actName
        const riskIndex = new Map<string, string>(); // key: actId|riskName

        const getNextProcessId = () => {
          const next = procIndex.size + 1;
          return `P${next}`;
        };
        const getNextSubId = (procId: string) => {
          const count = newNodes.filter(n => n.type === 'subprocess' && n.parentId === procId).length + 1;
          return `${procId}.${count}`;
        };
        const getNextActId = (subId: string) => {
          const count = newNodes.filter(n => n.type === 'activity' && n.parentId === subId).length + 1;
          return `${subId}.${count}`;
        };
        const getNextRiskId = (actId: string) => {
          const count = newNodes.filter(n => n.type === 'risk' && n.parentId === actId).length + 1;
          return `${actId}/R${count}`;
        };
        const getNextCtrlId = (riskId: string) => {
          const count = newNodes.filter(n => n.type === 'control' && n.parentId === riskId).length + 1;
          return `${riskId}/C${count}`;
        };

        const get = (obj: any, keys: string[]) => {
          for (const k of keys) {
            if (obj[k] != null && String(obj[k]).trim() !== '') return String(obj[k]).trim();
          }
          return '';
        };

        for (const row of rows) {
          const processName = get(row, ['Process', 'process', 'PROCESS']);
          const subName = get(row, ['Sub Process', 'SubProcess', 'subprocess']);
          const activityName = get(row, ['Activity', 'activity']);
          const riskDesc = get(row, ['Identification of Risk of Material Misstatement (What could go wrong?) Risk Description', 'Risk Description', 'Risk', 'risk']);
          const riskClass = get(row, ['Classification on of Inherent Risk', 'Inherent Risk', 'Classification of Inherent Risk']);
          const controlDesc = get(row, ['Controls in Place', 'Control', 'Control Description']);
          const controlType = get(row, ['Control Category', 'Control Type']);

          if (!processName) continue;

          // Process
          let procId = procIndex.get(processName);
          if (!procId) {
            procId = getNextProcessId();
            procIndex.set(processName, procId);
            ensurePush({ id: procId, type: 'process', name: processName, isExpanded: true });
            newDetails[procId] = { type: 'process', process_id: procId, process_name: processName, process_description: '', process_category: '', departments_involved: [] };
          }

          // Subprocess
          let subId = '';
          if (subName) {
            const key = procId + '|' + subName;
            subId = subIndex.get(key) || '';
            if (!subId) {
              subId = getNextSubId(procId);
              subIndex.set(key, subId);
              ensurePush({ id: subId, type: 'subprocess', name: subName, parentId: procId, isExpanded: true });
              newDetails[subId] = { type: 'subprocess', sub_process_id: subId, sub_process_name: subName, sub_process_description: '', linked_process_id: procId, departments_involved: [] };
            }
          }

          // Activity
          let actId = '';
          if (activityName) {
            const key = (subId || procId) + '|' + activityName;
            actId = actIndex.get(key) || '';
            if (!actId) {
              const parent = subId || getNextSubId(procId);
              if (!subId) {
                // create placeholder subprocess if missing
                subId = parent;
                ensurePush({ id: subId, type: 'subprocess', name: 'General', parentId: procId, isExpanded: true });
                newDetails[subId] = { type: 'subprocess', sub_process_id: subId, sub_process_name: 'General', sub_process_description: '', linked_process_id: procId, departments_involved: [] };
              }
              actId = getNextActId(subId);
              actIndex.set(key, actId);
              ensurePush({ id: actId, type: 'activity', name: activityName, parentId: subId, isExpanded: true });
              newDetails[actId] = { type: 'activity', activity_id: actId, activity_name: activityName, activity_description: '', linked_process_id: procId, linked_sub_process_id: subId, departments_involved: [] };
            }
          }

          // Risk
          let riskId = '';
          if (riskDesc) {
            const key = (actId || subId || procId) + '|' + riskDesc;
            riskId = riskIndex.get(key) || '';
            if (!riskId) {
              let parentAct = actId;
              if (!parentAct) {
                // create placeholder activity if missing
                const parent = subId || getNextSubId(procId);
                if (!subId) {
                  subId = parent;
                  ensurePush({ id: subId, type: 'subprocess', name: 'General', parentId: procId, isExpanded: true });
                  newDetails[subId] = { type: 'subprocess', sub_process_id: subId, sub_process_name: 'General', sub_process_description: '', linked_process_id: procId, departments_involved: [] };
                }
                parentAct = getNextActId(subId);
                ensurePush({ id: parentAct, type: 'activity', name: 'General', parentId: subId, isExpanded: true });
                newDetails[parentAct] = { type: 'activity', activity_id: parentAct, activity_name: 'General', activity_description: '', linked_process_id: procId, linked_sub_process_id: subId, departments_involved: [] };
              }
              riskId = getNextRiskId(parentAct);
              riskIndex.set(key, riskId);
              ensurePush({ id: riskId, type: 'risk', name: riskDesc, parentId: parentAct });
              newDetails[riskId] = { type: 'risk', risk_id: riskId, risk_name: riskDesc, risk_description: riskDesc, risk_category: riskClass || 'Operational', inherent_risk_score: 0, departments_involved: [] };
            }
          }

          // Control
          if (riskId && (controlDesc || controlType)) {
            const ctrlId = getNextCtrlId(riskId);
            ensurePush({ id: ctrlId, type: 'control', name: controlDesc || 'Control', parentId: riskId });
            newDetails[ctrlId] = { type: 'control', control_id: ctrlId, control_description: controlDesc || 'Control', control_type: controlType || 'Preventive', control_frequency: 'Monthly', control_owner: '', control_effectiveness_score: 0, departments_involved: [] };
          }
        }

        setNodes(newNodes);
        setDetailsById(newDetails);
      } catch (e) {
        // ignore
      }
    };

    importData();
  }, [nodes.length]);


  const getCommentTypeColor = (type: string) => {
    const colors = {
      'note': 'bg-blue-100 text-blue-800',
      'issue': 'bg-red-100 text-red-800',
      'resolution': 'bg-green-100 text-green-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const childType: Record<NodeType, NodeType | null> = {
    process: 'subprocess',
    subprocess: 'activity',
    activity: 'risk',
    risk: 'control',
    control: null,
  };

  const getRowBorderClass = (t: NodeType) => (
    t === 'process' ? 'border-blue-300' :
    t === 'subprocess' ? 'border-emerald-300' :
    t === 'activity' ? 'border-amber-300' :
    t === 'risk' ? 'border-red-300' : 'border-purple-300'
  );
  const getTypeColorClass = (t: NodeType) => (
    t === 'process' ? 'text-blue-700' :
    t === 'subprocess' ? 'text-emerald-700' :
    t === 'activity' ? 'text-amber-700' :
    t === 'risk' ? 'text-red-700' : 'text-purple-700'
  );

  const toggleExpanded = (id: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, isExpanded: !n.isExpanded } : n));
  };

  const createDefaultDetails = (node: FrameworkNode): NodeDetails => {
    if (node.type === 'process') return { type: 'process', process_id: node.id, process_name: node.name, process_description: '', process_category: '', departments_involved: [] };
    if (node.type === 'subprocess') return { type: 'subprocess', sub_process_id: node.id, sub_process_name: node.name, sub_process_description: '', linked_process_id: node.parentId || '', departments_involved: [] };
    if (node.type === 'activity') {
      const sub = nodes.find(n => n.id === node.parentId);
      const procId = sub?.parentId || '';
      return { type: 'activity', activity_id: node.id, activity_name: node.name, activity_description: '', linked_process_id: procId, linked_sub_process_id: node.parentId || '', departments_involved: [] };
    }
    if (node.type === 'risk') return { type: 'risk', risk_id: node.id, risk_name: node.name, risk_description: '', risk_category: 'Operational', inherent_risk_score: 0, departments_involved: [] };
    return { type: 'control', control_id: node.id, control_description: node.name, control_type: 'Preventive', control_frequency: 'Monthly', control_owner: '', control_effectiveness_score: 0, departments_involved: [] };
  };

  const addNode = (parent?: FrameworkNode) => {
    const type: NodeType = parent ? (childType[parent.type] as NodeType) : 'process';
    if (!type) return;

    const getNextProcessId = () => {
      const procs = nodes.filter(n => n.type === 'process');
      const max = procs.reduce((m, p) => {
        const n = parseInt(p.id.replace(/^P/, ''), 10);
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      return `P${max + 1}`;
    };

    const getNextSubprocessId = (processId: string) => {
      const subs = nodes.filter(n => n.type === 'subprocess' && n.parentId === processId);
      const max = subs.reduce((m, s) => {
        const match = s.id.match(/^P\d+\.(\d+)$/);
        const n = match ? parseInt(match[1], 10) : NaN;
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      return `${processId}.${max + 1}`;
    };

    const getNextActivityId = (subprocessId: string) => {
      const acts = nodes.filter(n => n.type === 'activity' && n.parentId === subprocessId);
      const max = acts.reduce((m, a) => {
        const match = a.id.match(/^P\d+\.\d+\.(\d+)$/);
        const n = match ? parseInt(match[1], 10) : NaN;
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      return `${subprocessId}.${max + 1}`;
    };

    const getNextRiskId = (activityId: string) => {
      const risks = nodes.filter(n => n.type === 'risk' && n.parentId === activityId);
      const max = risks.reduce((m, r) => {
        const match = r.id.match(/\/R(\d+)$/);
        const n = match ? parseInt(match[1], 10) : NaN;
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      return `${activityId}/R${max + 1}`;
    };

    const getNextControlId = (riskId: string) => {
      const ctrls = nodes.filter(n => n.type === 'control' && n.parentId === riskId);
      const max = ctrls.reduce((m, c) => {
        const match = c.id.match(/\/C(\d+)$/);
        const n = match ? parseInt(match[1], 10) : NaN;
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      return `${riskId}/C${max + 1}`;
    };

    let id = '';
    if (type === 'process') id = getNextProcessId();
    else if (type === 'subprocess') id = getNextSubprocessId(parent!.id);
    else if (type === 'activity') id = getNextActivityId(parent!.id);
    else if (type === 'risk') id = getNextRiskId(parent!.id);
    else id = getNextControlId(parent!.id);

    const name = type === 'process' ? 'New Process' : type === 'subprocess' ? 'New Subprocess' : type === 'activity' ? 'New Activity' : type === 'risk' ? 'New Risk' : 'New Control';
    const node: FrameworkNode = { id, type, name, parentId: parent?.id, isExpanded: true };
    setNodes(prev => [...prev, node]);
    setDetailsById(prev => ({ ...prev, [id]: createDefaultDetails(node) }));
    if (parent && !parent.isExpanded) toggleExpanded(parent.id);
    setSelectedNodeId(id);
    if (type === 'process') setSelectedProcessId(id);
  };

  const collectDescendantIds = (id: string, acc: string[] = []) => {
    const children = nodes.filter(n => n.parentId === id);
    for (const c of children) {
      acc.push(c.id);
      collectDescendantIds(c.id, acc);
    }
    return acc;
  };

  const deleteNode = (id: string) => {
    const toDelete = new Set([id, ...collectDescendantIds(id)]);
    setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
    setDetailsById(prev => {
      const copy = { ...prev } as Record<string, NodeDetails>;
      for (const k of Array.from(toDelete)) delete copy[k];
      return copy;
    });
    if (selectedNodeId && toDelete.has(selectedNodeId)) setSelectedNodeId(null);
  };

  const getLevel = (node: FrameworkNode) => {
    let level = 0;
    let current = node;
    while (current.parentId) {
      const parent = nodes.find(n => n.id === current.parentId);
      if (!parent) break;
      level += 1;
      current = parent;
    }
    return level;
  };

  const isParentExpanded = (node: FrameworkNode): boolean => {
    if (!node.parentId) return true;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent) return true;
    return !!parent.isExpanded && isParentExpanded(parent);
  };

  const visibleNodes = nodes.filter(n => isParentExpanded(n));

  const getAncestorIds = (id: string) => {
    const out: string[] = [];
    let current = nodes.find(n => n.id === id);
    while (current?.parentId) {
      out.push(current.parentId);
      current = nodes.find(n => n.id === current!.parentId);
    }
    return out;
  };

  const matchesTreeSearch = (n: FrameworkNode) => {
    const q = treeSearch.trim().toLowerCase();
    if (!q) return true;
    const d = detailsById[n.id] as any;
    const hay = [n.name, n.type,
      d?.process_description, d?.process_category,
      d?.sub_process_description,
      d?.activity_description,
      d?.risk_description, d?.risk_category,
      d?.control_description, d?.control_type, d?.control_frequency, d?.control_owner
    ].filter(Boolean).map((s: any) => String(s).toLowerCase());
    return hay.some((s: string) => s.includes(q));
  };

  const passesTypeFilters = (n: FrameworkNode) => {
    if (controlFilterValue !== 'ALL' && n.type === 'control') {
      return (detailsById[n.id] as any)?.control_type === controlFilterValue;
    }
    return true;
  };

  const updateDetails = (id: string, patch: Partial<any>) => {
    setDetailsById(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getFilteredClients = (status: 'completed' | 'in-progress') => {
    return clients
      .filter(client => client.status === status)
      .filter(client => {
        if (!searchTerm) return true;
        const query = searchTerm.toLowerCase();
        return (
          client.name.toLowerCase().includes(query) ||
          client.id.toLowerCase().includes(query) ||
          client.description.toLowerCase().includes(query)
        );
      });
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
  };

  const renderCompletedClients = () => {
    const completedClients = getFilteredClients('completed');

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {completedClients.map((client) => (
            <Card key={client.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <Badge className="bg-green-100 text-green-800">
                    Completed
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">Client ID: {client.id}</span>
                  <span>•</span>
                  <span>{client.industry}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{client.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Framework audit completed
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClientSelect(client.id)}
                    >
                      View Only
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {completedClients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm
                ? `No completed framework audits found matching "${searchTerm}"`
                : 'No completed framework audits'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderInProgressClients = () => {
    const inProgressClients = getFilteredClients('in-progress');

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {inProgressClients.map((client) => (
            <Card key={client.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <Badge className="bg-blue-100 text-blue-800">
                    In Progress
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">Client ID: {client.id}</span>
                  <span>•</span>
                  <span>{client.industry}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{client.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Framework audit in progress
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClientSelect(client.id)}
                    >
                      Edit Framework
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {inProgressClients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm
                ? `No in-progress framework audits found matching "${searchTerm}"`
                : 'No in-progress framework audits assigned'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFrameworkEditor = () => {
    const isReadOnly = false;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Framework Editor</h3>
          <div className="flex gap-2">
            {selectedProcessId && (
              <Button variant="outline" size="sm" onClick={() => { setSelectedProcessId(null); setSelectedNodeId(null); }}>
                ← Back to Processes
              </Button>
            )}
            {!isReadOnly && (
              <Button onClick={() => addNode()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Process
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {selectedProcessId && (
          <div className="grid grid-cols-1 gap-3">
            <Input placeholder="Search in tree..." className="w-full" value={treeSearch} onChange={(e) => setTreeSearch(e.target.value)} />
          </div>
        )}

        {!selectedProcessId && (
          <div className="w-full max-w-3xl">
            <ProcessSelector
              processes={nodes.filter(n => n.type === 'process')}
              value={selectedProcessId}
              onSelect={(id) => { setSelectedProcessId(id); setSelectedNodeId(id); }}
              placeholder="Select or search process..."
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 mt-4">
          {selectedProcessId && (
          <Card className="h-[520px] overflow-hidden">
            <CardHeader>
              <CardTitle>Process &rarr; Subprocess &rarr; Activity &rarr; Risk &rarr; Control</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-full">
              <ScrollArea className="h-[460px]">
                <div className="divide-y pr-2 pb-3">
                  {(() => {
                    const baseIds = !selectedProcessId
                      ? nodes.filter(n => n.type === 'process').map(n => n.id)
                      : [selectedProcessId, ...collectDescendantIds(selectedProcessId)];
                    const allowed = visibleNodes.filter(n => baseIds.includes(n.id) && passesTypeFilters(n));
                    let list = allowed;
                    if (!selectedProcessId && universalSearch.trim()) {
                      const q = universalSearch.trim().toLowerCase();
                      list = allowed.filter(n => n.type === 'process' && (n.name.toLowerCase().includes(q) || String((detailsById[n.id] as any)?.process_description || '').toLowerCase().includes(q)));
                    }
                    if (treeSearch.trim()) {
                      const matchIds = new Set(allowed.filter(matchesTreeSearch).map(n => n.id));
                      const includeIds = new Set<string>(matchIds);
                      for (const id of Array.from(matchIds)) {
                        for (const a of getAncestorIds(id)) includeIds.add(a);
                      }
                      list = allowed.filter(n => includeIds.has(n.id));
                    }
                    if (selectedProcessId && universalSearch.trim()) {
                      const q2 = universalSearch.trim().toLowerCase();
                      const matchIds2 = new Set(list.filter(n => {
                        const d:any = detailsById[n.id];
                        const hay = [n.name, n.type, d?.process_description, d?.sub_process_description, d?.activity_description, d?.risk_description, d?.control_description]
                          .filter(Boolean).map((s:any)=>String(s).toLowerCase());
                        return hay.some((s:string)=>s.includes(q2));
                      }).map(n=>n.id));
                      const include2 = new Set<string>(matchIds2);
                      for (const id of Array.from(matchIds2)) {
                        for (const a of getAncestorIds(id)) include2.add(a);
                      }
                      list = list.filter(n => include2.has(n.id));
                    }
                    return list.map((n) => {
                      const level = getLevel(n);
                      const hasChildren = nodes.some(c => c.parentId === n.id);
                      return (
                        <div key={n.id} className={`flex items-center py-2 px-1 border-l-4 ${getRowBorderClass(n.type)} ${selectedNodeId === n.id ? 'bg-purple-50' : ''}`}>
                          <div className="flex items-center w-full" style={{ paddingLeft: `${level * 16}px` }}>
                            {selectedProcessId && hasChildren && (
                              <button onClick={() => toggleExpanded(n.id)} className="mr-2 rounded p-1 hover:bg-slate-100">
                                {n.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                            {!hasChildren && <span className="w-6" />}
                            <button className="text-left flex-1" onClick={() => { if (!selectedProcessId && n.type === 'process') { setSelectedProcessId(n.id); setSelectedNodeId(n.id); } else { setSelectedNodeId(n.id); setIsDetailsOpen(true); } }}>
                              <div className="text-sm font-medium">{n.name}</div>
                              <div className={`text-xs capitalize ${getTypeColorClass(n.type)}`}>{n.type}</div>
                            </button>
                            {!isReadOnly && (
                              <div className="flex items-center gap-2">
                                {selectedProcessId && childType[n.type] && (
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addNode(n)} title={`Add ${childType[n.type]}`}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setSelectedNodeId(n.id); setIsDetailsOpen(true); }} title="Edit">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-7 w-7 text-red-600" onClick={() => deleteNode(n.id)} title="Delete">
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          )}

        <Dialog open={isDetailsOpen && !!selectedNodeId} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedNodeId && (() => {
                const node = nodes.find(n => n.id === selectedNodeId)!;
                const d = detailsById[selectedNodeId!];
                if (!node || !d) return null;
                if (node.type === 'process') {
                  const det = d as Extract<NodeDetails, {type:'process'}>;
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Process ID</Label>
                          <Input value={det.process_id} readOnly />
                        </div>
                        <div>
                          <Label>Process Name</Label>
                          <Input value={det.process_name} onChange={e => updateDetails(node.id, { process_name: e.target.value })} disabled={isReadOnly} />
                        </div>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea value={det.process_description} onChange={e => updateDetails(node.id, { process_description: e.target.value })} disabled={isReadOnly} rows={4} />
                      </div>
                      <div>
                        <Label>Departments Involved</Label>
                        <DepartmentsMultiSelect value={det.departments_involved} onChange={(v) => updateDetails(node.id, { departments_involved: v })} />
                      </div>
                    </div>
                  );
                }
                if (node.type === 'subprocess') {
                  const det = d as Extract<NodeDetails, {type:'subprocess'}>;
                  const processes = nodes.filter(n => n.type === 'process');
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Subprocess ID</Label>
                          <Input value={det.sub_process_id} readOnly />
                        </div>
                        <div>
                          <Label>Subprocess Name</Label>
                          <Input value={det.sub_process_name} onChange={e => updateDetails(node.id, { sub_process_name: e.target.value })} disabled={isReadOnly} />
                        </div>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea value={det.sub_process_description} onChange={e => updateDetails(node.id, { sub_process_description: e.target.value })} disabled={isReadOnly} rows={4} />
                      </div>
                      <div>
                        <Label>Linked Process</Label>
                      <Input value={(nodes.find(n => n.id === det.linked_process_id)?.name) || det.linked_process_id} readOnly />
                      </div>
                      <div>
                        <Label>Departments Involved</Label>
                        <DepartmentsMultiSelect value={det.departments_involved} onChange={(v) => updateDetails(node.id, { departments_involved: v })} />
                      </div>
                    </div>
                  );
                }
                if (node.type === 'activity') {
                  const det = d as Extract<NodeDetails, {type:'activity'}>;
  const processes = nodes.filter(n => n.type === 'process');
  const selectedProcId = det.linked_process_id || (() => {
    const sub = nodes.find(n => n.id === det.linked_sub_process_id);
    return sub?.parentId || '';
  })();
  const subs = nodes.filter(n => n.type === 'subprocess' && (!selectedProcId || n.parentId === selectedProcId));
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Activity ID</Label>
                          <Input value={det.activity_id} readOnly />
                        </div>
                        <div>
                          <Label>Activity Name</Label>
                          <Input value={det.activity_name} onChange={e => updateDetails(node.id, { activity_name: e.target.value })} disabled={isReadOnly} />
                        </div>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea value={det.activity_description} onChange={e => updateDetails(node.id, { activity_description: e.target.value })} disabled={isReadOnly} rows={4} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Linked Process</Label>
                          <Input value={(processes.find(p => p.id === selectedProcId)?.name) || selectedProcId} readOnly />
                        </div>
                        <div>
                          <Label>Linked Subprocess</Label>
                          <Input value={(subs.find(s => s.id === det.linked_sub_process_id)?.name) || det.linked_sub_process_id} readOnly />
                        </div>
                      </div>
                      <div>
                        <Label>Departments Involved</Label>
                        <DepartmentsMultiSelect value={det.departments_involved} onChange={(v) => updateDetails(node.id, { departments_involved: v })} />
                      </div>
                    </div>
                  );
                }
                if (node.type === 'risk') {
                  const det = d as Extract<NodeDetails, {type:'risk'}>;
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Risk ID</Label>
                          <Input value={det.risk_id} readOnly />
                        </div>
                        <div>
                          <Label>Risk Name</Label>
                          <Input value={det.risk_name} onChange={e => updateDetails(node.id, { risk_name: e.target.value })} disabled={isReadOnly} />
                        </div>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea value={det.risk_description} onChange={e => updateDetails(node.id, { risk_description: e.target.value })} disabled={isReadOnly} rows={4} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Category</Label>
                          <Select value={det.risk_category} onValueChange={v => updateDetails(node.id, { risk_category: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {riskCategories.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                }
                const det = d as Extract<NodeDetails, {type:'control'}>;
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Control ID</Label>
                        <Input value={det.control_id} readOnly />
                      </div>
                    </div>
                    <div>
                      <Label>Control Description</Label>
                      <Textarea value={det.control_description} onChange={e => updateDetails(node.id, { control_description: e.target.value })} rows={4} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Control Type</Label>
                        <Select value={det.control_type} onValueChange={v => updateDetails(node.id, { control_type: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {controlTypes.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Reference</Label>
                        <Input value={det.control_owner} onChange={e => updateDetails(node.id, { control_owner: e.target.value })} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => selectedNodeId && setDetailsById(prev => ({ ...prev }))}>Reset</Button>
                <Button onClick={() => setIsDetailsOpen(false)}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Read-Only Mode:</strong> This framework audit is completed and cannot be edited. You can only view and add comments.
            </p>
          </div>
        )}

        {/* Comments Section */}
        {comments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium">{comment.author}</span>
                        <Badge className={`text-xs ${getCommentTypeColor(comment.type)}`}>
                          {comment.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (selectedClient) {
    const client = clients.find(c => c.id === selectedClient);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Framework Module</h1>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            {renderFrameworkEditor()}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Framework Module</h1>
        <Badge className="bg-purple-100 text-purple-800">Framework Access</Badge>
      </div>

      {/* Search Bar */}
      <div className="flex justify-center">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MessageSquare className="h-5 w-5 text-slate-400" />
          </div>
          <Input
            type="text"
            placeholder="Search by client name, ID, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 w-full bg-white/80 backdrop-blur-sm border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl shadow-lg transition-all duration-200 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <span className="text-slate-400 hover:text-slate-600 transition-colors">
                ✕
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Client Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="completed" className="mt-6">
          {renderCompletedClients()}
        </TabsContent>

        <TabsContent value="in-progress" className="mt-6">
          {renderInProgressClients()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
