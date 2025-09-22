import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Search, Check, ClipboardList, X } from 'lucide-react';

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

const industries = [
  'Manufacturing',
  'Retail',
  'Hospitality',
  'Automotive',
  'Healthcare'
];

const clients = [
  { id: 'CLT-001', name: 'Bull Machines India Pvt. LTD', industry: 'Manufacturing' },
  { id: 'CLT-002', name: 'Supreme Mobiles', industry: 'Retail' },
  { id: 'CLT-003', name: 'Thalapakatti Hospitality Pvt. LTD', industry: 'Hospitality' },
  { id: 'CLT-004', name: 'KTM', industry: 'Automotive' },
  { id: 'CLT-005', name: 'KMCH', industry: 'Healthcare' }
];

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
  const [selectedClientId, setSelectedClientId] = useState<string>('CLT-001');

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [processOptions, setProcessOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedProcessesIndustry, setSelectedProcessesIndustry] = useState<string[]>([]);
  const [selectedProcessesClient, setSelectedProcessesClient] = useState<string[]>([]);
  const [industryProcessMap, setIndustryProcessMap] = useState<Record<string, string[]>>({});
  const [industryNodeMap, setIndustryNodeMap] = useState<Record<string, string[]>>({});
  const [clientNodeMap, setClientNodeMap] = useState<Record<string, string[]>>({});
  const [industrySelections, setIndustrySelections] = useState<Set<string>>(new Set());
  const [clientSelections, setClientSelections] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, NodeDetails>>({});
  const [openItemPicker, setOpenItemPicker] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  const selectedClient = clients.find(c => c.id === selectedClientId);

  useEffect(() => {
    if (tree.length) return;
    const SAMPLE_URL = 'https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c';
    const normalizeRows = (data: any): any[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      const keys = Object.keys(data);
      if ((data as any).Sheet1 && Array.isArray((data as any).Sheet1)) return (data as any).Sheet1;
      if ((data as any).sheets && typeof (data as any).sheets === 'object') {
        const first = Object.values((data as any).sheets)[0] as any[];
        if (Array.isArray(first)) return first;
      }
      if (keys.length === 1 && Array.isArray((data as any)[keys[0]])) return (data as any)[keys[0]];
      return [];
    };
    (async () => {
      try {
        const res = await fetch(SAMPLE_URL);
        const json = await res.json();
        const rows = normalizeRows(json);
        if (!rows.length) return;
        const nodes: TreeNode[] = [];
        const ensure = (n: TreeNode) => { if (!nodes.some(x => x.id === n.id)) nodes.push(n); };
        const procIndex = new Map<string, string>();
        const subIndex = new Map<string, string>();
        const actIndex = new Map<string, string>();
        const get = (row: any, keys: string[]) => { for (const k of keys) { const v = row[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); } return ''; };
        const getNext = {
          proc: () => `P${procIndex.size + 1}`,
          sub: (p: string) => `${p}.${nodes.filter(n => n.type==='subprocess' && n.parentId===p).length + 1}`,
          act: (s: string) => `${s}.${nodes.filter(n => n.type==='activity' && n.parentId===s).length + 1}`,
          risk: (a: string) => `${a}/R${nodes.filter(n => n.type==='risk' && n.parentId===a).length + 1}`,
          ctrl: (r: string) => `${r}/C${nodes.filter(n => n.type==='control' && n.parentId===r).length + 1}`,
        };
        for (const row of rows) {
          const processName = get(row, ['Process','process','PROCESS']);
          const subName = get(row, ['Sub Process','SubProcess','subprocess']);
          const activityName = get(row, ['Activity','activity']);
          const riskDesc = get(row, ['Identification of Risk of Material Misstatement (What could go wrong?) Risk Description','Risk Description','Risk','risk']);
          const controlDesc = get(row, ['Controls in Place','Control','Control Description']);
          if (!processName) continue;
          let procId = procIndex.get(processName);
          if (!procId) { procId = getNext.proc(); procIndex.set(processName, procId); ensure({ id: procId, type: 'process', name: processName, isExpanded: true }); }
          let subId = '';
          if (subName) { const key = procId + '|' + subName; subId = subIndex.get(key) || ''; if (!subId) { subId = getNext.sub(procId); subIndex.set(key, subId); ensure({ id: subId, type: 'subprocess', name: subName, parentId: procId, isExpanded: true }); } }
          let actId = '';
          if (activityName) { const key = (subId || procId) + '|' + activityName; actId = actIndex.get(key) || ''; if (!actId) { const parent = subId || getNext.sub(procId); if (!subId) { subId = parent; ensure({ id: subId, type: 'subprocess', name: 'General', parentId: procId, isExpanded: true }); } actId = getNext.act(subId); actIndex.set(key, actId); ensure({ id: actId, type: 'activity', name: activityName, parentId: subId, isExpanded: true }); } }
          let riskId = '';
          if (riskDesc) { const parent = actId || (subId || getNext.sub(procId)); if (!actId) { if (!subId) { subId = parent as string; ensure({ id: subId, type: 'subprocess', name: 'General', parentId: procId, isExpanded: true }); } const parentAct = getNext.act(subId); ensure({ id: parentAct, type: 'activity', name: 'General', parentId: subId, isExpanded: true }); actId = parentAct; } riskId = getNext.risk(actId); ensure({ id: riskId, type: 'risk', name: riskDesc, parentId: actId }); }
          if (riskId && controlDesc) { const ctrlId = getNext.ctrl(riskId); ensure({ id: ctrlId, type: 'control', name: controlDesc || 'Control', parentId: riskId }); }
        }
        setTree(nodes);
        setProcessOptions(nodes.filter(n=>n.type==='process').map(n=>({id:n.id,name:n.name})));
      } catch {}
    })();
  }, [tree.length]);

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

  const visibleNodes = tree.filter(n => isParentExpanded(n));
  const collectDescendantIds = (id: string, acc: string[] = []) => {
    const children = tree.filter(n => n.parentId === id);
    for (const c of children) { acc.push(c.id); collectDescendantIds(c.id, acc); }
    return acc;
  };
  const renderNodes = useMemo(() => {
    const selectedProcs = tab === 'industry' ? selectedProcessesIndustry : selectedProcessesClient;
    const baseIds = selectedProcs.length ? selectedProcs : [];
    const ids: string[] = [];
    for (const id of baseIds) ids.push(id, ...collectDescendantIds(id));
    if (!ids.length) return [] as TreeNode[];
    return visibleNodes.filter(n => ids.includes(n.id));
  }, [visibleNodes, selectedProcessesIndustry, selectedProcessesClient, tab, tree]);
  const toggleSelectIndustry = (id: string) => { setIndustrySelections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };
  const toggleSelectClient = (id: string) => { setClientSelections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };

  const toggleExpand = (id: string) => {
    setTree(prev => prev.map(n => n.id === id ? { ...n, isExpanded: !n.isExpanded } : n));
  };

  const toggleSelectCascade = (id: string, checked: boolean) => {
    const ids = [id, ...collectDescendantIds(id)];
    const setIds = new Set(ids);
    setTree(prev => prev.map(n => setIds.has(n.id) ? { ...n, isSelected: checked } : n));
    setDetails(prev => {
      const next = { ...prev } as Record<string, NodeDetails>;
      if (checked) {
        for (const nid of ids) {
          if (!next[nid]) {
            next[nid] = {
              description: '',
              industry: selectedIndustry,
              client: selectedClientId,
              itemId: '',
              applicable: null
            };
          }
        }
      }
      return next;
    });
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
    if (!details[id]) {
      setDetails(prev => ({
        ...prev,
        [id]: {
          description: '',
          industry: selectedIndustry,
          client: selectedClientId,
          itemId: '',
          applicable: null
        }
      }));
    }
  };

  const selectedNode = selectedNodeId ? tree.find(n => n.id === selectedNodeId) || null : null;
  const nodeDetails: NodeDetails | undefined = selectedNodeId ? details[selectedNodeId!] : undefined;

  const updateNodeDetails = (patch: Partial<NodeDetails>) => {
    if (!selectedNodeId) return;
    setDetails(prev => ({
      ...prev,
      [selectedNodeId]: {
        description: nodeDetails?.description || '',
        industry: nodeDetails?.industry || selectedIndustry,
        client: nodeDetails?.client || selectedClientId,
        itemId: nodeDetails?.itemId || '',
        applicable: nodeDetails?.applicable ?? null,
        ...patch
      }
    }));
  };

  const resetSelectionsToFilter = () => {
    setDetails(prev => {
      const updated = { ...prev } as Record<string, NodeDetails>;
      Object.keys(updated).forEach(key => {
        if (!updated[key].industry) updated[key].industry = selectedIndustry;
        if (!updated[key].client) updated[key].client = selectedClientId;
      });
      return updated;
    });
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
                <Select value={selectedIndustry} onValueChange={(v) => { setSelectedIndustry(v); setSelectedProcessesIndustry(industryProcessMap[v] || []); setIndustrySelections(new Set()); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map(ind => (<SelectItem key={ind} value={ind}>{ind}</SelectItem>))}
                  </SelectContent>
                </Select>
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
              </div>
              <div>
                <Label>Processes (Multiple)</Label>
                <ProcessesMultiSelect
                  options={processOptions.filter(p => (industryProcessMap[selectedClient?.industry||'']?.length ? industryProcessMap[selectedClient!.industry]!.includes(p.id) : true))}
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
        <Card className="h-[600px] overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>Checklist Tree</CardTitle>
              <div className="flex items-center gap-2">
                {tab === 'industry' ? (
                  <Button onClick={() => { setIndustryProcessMap(prev => ({ ...prev, [selectedIndustry]: selectedProcessesIndustry })); setIndustryNodeMap(prev => ({ ...prev, [selectedIndustry]: Array.from(industrySelections) })); }}>Save Industry Mapping</Button>
                ) : (
                  <Button onClick={() => { setClientNodeMap(prev => ({ ...prev, [selectedClientId]: Array.from(clientSelections) })); }}>Save Client Mapping</Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 h-full flex flex-col">

            <ScrollArea className="flex-1 pr-2">
              <div className="divide-y">
                {renderNodes.map((node) => {
                  const level = getLevel(node);
                  const hasChildren = tree.some(n => n.parentId === node.id);
                  const nd = details[node.id];
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
                            {nd?.applicable !== undefined && nd?.applicable !== null && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${nd.applicable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {nd.applicable ? 'Applicable' : 'Not Applicable'}
                              </span>
                            )}
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
