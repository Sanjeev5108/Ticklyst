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
  const [details, setDetails] = useState<Record<string, NodeDetails>>({});
  const [openItemPicker, setOpenItemPicker] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  const selectedClient = clients.find(c => c.id === selectedClientId);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          const mapped: SoAClient[] = (data || []).map((r: any) => ({ id: r.id, name: r.name, industry: r.industry }));
          setClients(mapped);
          if (!selectedClientId && mapped.length) setSelectedClientId(mapped[0].id);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/settings/${encodeURIComponent('soa:industry:' + selectedIndustry)}`);
        if (res.ok) {
          const saved = await res.json();
          if (saved && typeof saved === 'object') {
            if (Array.isArray(saved.processes)) setSelectedProcessesIndustry(saved.processes);
            if (saved.nodeApplicability && typeof saved.nodeApplicability === 'object') {
              const appMap: Record<string, boolean | null> = saved.nodeApplicability;
              // apply to details and selections
              setDetails(prev => {
                const copy = { ...prev } as Record<string, NodeDetails>;
                for (const [id, val] of Object.entries(appMap)) {
                  const existing = copy[id] || { description: '', industry: selectedIndustry, client: selectedClientId, itemId: '', applicable: null };
                  copy[id] = { ...existing, applicable: val };
                }
                return copy;
              });
              setIndustrySelections(new Set(Object.keys(appMap).filter(id => appMap[id] === true)));
            }
          }
        }
      } catch {}
    })();
  }, [selectedIndustry, selectedClientId]);

  useEffect(() => {
    (async () => {
      if (!selectedClient) return;
      const ind = selectedClient.industry;
      try {
        const res = await fetch(`/api/settings/${encodeURIComponent('soa:industry:' + ind)}`);
        if (!res.ok) { setClientNeedsIndustryMapping('Do industry mapping first.'); setSelectedProcessesClient([]); return; }
        const saved = await res.json();
        if (!saved || !Array.isArray(saved.processes) || !saved.processes.length) {
          setClientNeedsIndustryMapping('Do industry mapping first.');
          setSelectedProcessesClient([]);
          return;
        }
        setClientNeedsIndustryMapping(null);
        setIndustryProcessMap(prev => ({ ...prev, [ind]: saved.processes }));
        setSelectedProcessesClient(saved.processes);
        // apply industry applicability to this client as initial
        if (saved.nodeApplicability && typeof saved.nodeApplicability === 'object') {
          const appMap: Record<string, boolean | null> = saved.nodeApplicability;
          setDetails(prev => {
            const copy = { ...prev } as Record<string, NodeDetails>;
            for (const [id, val] of Object.entries(appMap)) {
              const existing = copy[id] || { description: '', industry: ind, client: selectedClientId, itemId: '', applicable: null };
              copy[id] = { ...existing, client: selectedClientId, industry: ind, applicable: val };
            }
            return copy;
          });
          setClientSelections(new Set(Object.keys(appMap).filter(id => appMap[id] === true)));
        } else {
          setClientSelections(new Set());
        }
      } catch {
        setClientNeedsIndustryMapping('Do industry mapping first.');
        setSelectedProcessesClient([]);
      }
    })();
  }, [selectedClientId, selectedClient?.industry]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/framework/tree');
        if (!res.ok) return;
        const data = await res.json();
        const nodes = Array.isArray(data?.nodes) ? data.nodes as any[] : [];
        if (!nodes.length) return;
        const mapped: TreeNode[] = nodes.map((n: any) => ({ id: n.id, type: n.type, name: n.name, parentId: n.parentId, isExpanded: true }));
        setTree(mapped);
        setProcessOptions(mapped.filter(n => n.type === 'process').map(n => ({ id: n.id, name: n.name })));
      } catch {}
    })();
  }, []);

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
        <Card className="h-[600px] overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>Checklist Tree</CardTitle>
              <div className="flex items-center gap-2">
                {tab === 'industry' ? (
                  <Button disabled={isSaving} onClick={async () => {
                    try {
                      setIsSaving(true);
                      setIndustryProcessMap(prev => ({ ...prev, [selectedIndustry]: selectedProcessesIndustry }));
                      setIndustryNodeMap(prev => ({ ...prev, [selectedIndustry]: Array.from(industrySelections) }));
                      const nodeApplicability: Record<string, boolean | null> = {};
                      for (const [id, det] of Object.entries(details)) {
                        if (det.industry === selectedIndustry && det.applicable !== undefined && det.applicable !== null) {
                          nodeApplicability[id] = det.applicable;
                        }
                      }
                      const payload = {
                        industry: selectedIndustry,
                        processes: selectedProcessesIndustry,
                        nodeApplicability,
                        updatedAt: new Date().toISOString(),
                      };
                      await fetch(`/api/settings/${encodeURIComponent('soa:industry:' + selectedIndustry)}` , { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
                      await fetch(`/api/settings/${encodeURIComponent('soa:client:' + selectedClientId)}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                          clientId: selectedClientId,
                          industry: selectedClient?.industry || '',
                          processes: selectedProcessesClient,
                          nodeApplicability,
                          updatedAt: new Date().toISOString()
                        })
                      });
                      toast({ title: 'Saved successfully' });
                    } catch {
                      toast({ title: 'Save failed' });
                    }
                  }}>Save Client Mapping</Button>
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
