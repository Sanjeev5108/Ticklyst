import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus,
  MessageSquare,
  Send
} from 'lucide-react';

interface AuditTrackRow {
  id: string;
  auditObservation: string;
  actionPlan: string;
  responsibility: string;
  designation: string;
  dueDate: string;
  previousDueDates?: string[];
  status: string;
}

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

const statuses = ["Open", "In Progress", "Closed", "Overdue"];

export default function ATRDashboard() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'note' | 'issue' | 'resolution'>('note');
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);

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

  // Controls (copied parsing logic from Fieldwork) ------------------------------------------------
  interface ControlRow { id: string; name: string; process?: string; subprocess?: string; activity?: string; risk?: string }
  const FRAMEWORK_DATA_URL = 'https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c';
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [controlsSearch, setControlsSearch] = useState('');
  const [selectedControl, setSelectedControl] = useState<string | null>(null);

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
      } catch (err) { console.error('Failed to fetch framework', err); }
    })();
  }, [controls.length]);


  const [auditTrackData, setAuditTrackData] = useState<AuditTrackRow[]>([
    {
      id: "at1",
      auditObservation: "",
      actionPlan: "",
      responsibility: "",
      designation: "",
      dueDate: "",
      previousDueDates: [],
      status: ""
    }
  ]);

  const [comments, setComments] = useState<Comment[]>([]);

  const updateAuditTrackField = (id: string, field: keyof AuditTrackRow, value: string) => {
    setAuditTrackData(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        if (field === 'dueDate') {
          const prevDate = row.dueDate;
          if (prevDate && prevDate !== value) {
            const prevList = row.previousDueDates ? [...row.previousDueDates] : [];
            prevList.unshift(prevDate);
            return { ...row, dueDate: value, previousDueDates: prevList } as AuditTrackRow;
          }
          return { ...row, dueDate: value } as AuditTrackRow;
        }
        return { ...row, [field]: value } as AuditTrackRow;
      })
    );
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'Team Member',
      content: newComment.trim(),
      timestamp: new Date().toLocaleString(),
      type: commentType
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');
    setIsCommentDialogOpen(false);
  };

  const getCommentTypeColor = (type: string) => {
    const colors = {
      'note': 'bg-blue-100 text-blue-800',
      'issue': 'bg-red-100 text-red-800',
      'resolution': 'bg-green-100 text-green-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const renderATREditor = () => {
    const selectedClientData = clients.find(c => c.id === selectedClient);
  // If editing a control, editor should be editable. If viewing a completed client ATR, read-only.
  const isReadOnly = !!selectedControl ? false : (selectedClientData?.status === 'completed');

  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">ATR Editor (Audit Track Report)</h3>
          <div className="flex gap-2">
            <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Add Comments</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Comment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comment-type">Comment Type</Label>
                    <select
                      id="comment-type"
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value as any)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="note">Note</option>
                      <option value="issue">Issue</option>
                      <option value="resolution">Resolution</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="comment">Comment</Label>
                    <Textarea
                      id="comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Enter your comment..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleAddComment} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Add Comment
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {!isReadOnly && (
              <Button onClick={() => setAuditTrackData(prev => [...prev, {
                id: `at${Date.now()}`,
                auditObservation: "",
                actionPlan: "",
                responsibility: "",
                designation: "",
                dueDate: "",
                status: ""
              }])} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 border-r">Audit Observation</th>
                <th className="text-left p-3 border-r">Action Plan</th>
                <th className="text-left p-3 border-r">Responsibility</th>
                <th className="text-left p-3 border-r">Designation</th>
                <th className="text-left p-3 border-r">Due date</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {auditTrackData.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 border-r">
                    <Input
                      value={row.auditObservation}
                      onChange={(e) => updateAuditTrackField(row.id, 'auditObservation', e.target.value)}
                      placeholder="Enter audit observation"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.actionPlan}
                      onChange={(e) => updateAuditTrackField(row.id, 'actionPlan', e.target.value)}
                      placeholder="Enter action plan"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.responsibility}
                      onChange={(e) => updateAuditTrackField(row.id, 'responsibility', e.target.value)}
                      placeholder="Enter responsibility"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.designation}
                      onChange={(e) => updateAuditTrackField(row.id, 'designation', e.target.value)}
                      placeholder="Enter designation"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateAuditTrackField(row.id, 'dueDate', e.target.value)}
                      disabled={isReadOnly}
                    />
                    {row.previousDueDates && row.previousDueDates.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        <div>Previous dates:</div>
                        {row.previousDueDates.map((d, idx) => (
                          <div key={idx}>{d}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <Select
                      value={row.status}
                      onValueChange={(value) => updateAuditTrackField(row.id, 'status', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Read-Only Mode:</strong> This ATR report is completed and cannot be edited. You can only view and add comments.
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

  if (selectedClient || selectedControl) {
    // If a control is selected, show ATR editor for that control
    const client = selectedClient ? clients.find(c => c.id === selectedClient) : undefined;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{selectedControl ? `ATR Editor - Control ${selectedControl}` : (client?.name || 'Client')}</h1>
            <p className="text-gray-600">{selectedControl ? `Control ID: ${selectedControl} • ATR Module` : `Client ID: ${selectedClient} • ${client?.industry} • ATR Module`}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => { setSelectedControl(null); setSelectedClient(null); }}>
              Back to ATR Reports
            </Button>
            <Badge className="bg-green-100 text-green-800">ATR Access</Badge>
          </div>
        </div>

        <Tabs defaultValue="access" className="mt-4">
          <TabsList>
            <TabsTrigger value="reportable">Reportable Controls</TabsTrigger>
            <TabsTrigger value="access">ATR Access</TabsTrigger>
          </TabsList>
          <TabsContent value="reportable">
            <Card className="shadow-lg mt-4">
              <CardContent className="p-6">
                <div style={{maxHeight:420, overflow:'auto'}}>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-3 w-40">Control ID</th>
                        <th className="text-left p-3">Control</th>
                        <th className="text-left p-3 w-40">Process</th>
                        <th className="text-left p-3 w-48">Subprocess</th>
                        <th className="text-left p-3 w-40">Activity</th>
                        <th className="text-left p-3 w-48">Risk</th>

                      </tr>
                    </thead>
                    <tbody>
                      {controls.filter(c=>{
                        const q = controlsSearch.trim().toLowerCase();
                        if (!q) return true;
                        return [c.id,c.name,c.process,c.subprocess,c.activity,c.risk].filter(Boolean).map(s=>String(s).toLowerCase()).some(s=>s.includes(q));
                      }).map(c=> (
                        <tr key={c.id} className="border-t hover:bg-slate-50">
                          <td className="p-3 text-xs text-slate-600">{c.id}</td>
                          <td className="p-3">{c.name}</td>
                          <td className="p-3 text-xs text-slate-600">{c.process || '-'}</td>
                          <td className="p-3 text-xs text-slate-600">{c.subprocess || '-'}</td>
                          <td className="p-3 text-xs text-slate-600">{c.activity || '-'}</td>
                          <td className="p-3 text-xs text-slate-600">{c.risk || '-'}</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="access">
            <div className="space-y-4 mt-4">
              {renderATREditor()}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">ATR Module</h1>
        <Badge className="bg-green-100 text-green-800">ATR Access</Badge>
      </div>


      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="reportable">Reportable Controls</TabsTrigger>
          <TabsTrigger value="access">ATR Access</TabsTrigger>
        </TabsList>
        <TabsContent value="reportable">
          {/* Controls List (like Fieldwork) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Search Controls</Label>
              <div className="relative">
                <Input className="pl-9" placeholder="Search controls, process, risk..." value={controlsSearch} onChange={e=>setControlsSearch(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Filter</Label>
              <Select value="all" onValueChange={()=>{}}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end">
              <Badge className="bg-blue-50 text-blue-800">Controls</Badge>
            </div>
          </div>

          <div className="mt-4">
            <Card className="h-[420px] overflow-hidden">
              <CardHeader>
                <CardTitle>Controls</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 h-full">
                <div style={{maxHeight:420, overflow:'auto'}}>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-3 w-40">Control ID</th>
                        <th className="text-left p-3">Control</th>
                        <th className="text-left p-3 w-40">Process</th>
                        <th className="text-left p-3 w-48">Subprocess</th>
                        <th className="text-left p-3 w-40">Activity</th>
                        <th className="text-left p-3 w-48">Risk</th>

                      </tr>
                    </thead>
                    <tbody>
                      {controls.filter(c=>{
                        const q = controlsSearch.trim().toLowerCase();
                        if (!q) return true;
                        return [c.id,c.name,c.process,c.subprocess,c.activity,c.risk].filter(Boolean).map(s=>String(s).toLowerCase()).some(s=>s.includes(q));
                      }).map(c=> (
                        <tr key={c.id} className="border-t hover:bg-slate-50">
                          <td className="p-3 text-xs text-slate-600">{c.id}</td>
                          <td className="p-3">{c.name}</td>
                          <td className="p-3 text-xs text-slate-600">{c.process || '-'}</td>
                          <td className="p-3 text-xs text-slate-600">{c.subprocess || '-'}</td>
                          <td className="p-3 text-xs text-slate-600">{c.activity || '-'}</td>
                          <td className="p-3 text-xs text-slate-600">{c.risk || '-'}</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="access">
          {renderATREditor()}
        </TabsContent>
      </Tabs>

    </div>
  );
}
