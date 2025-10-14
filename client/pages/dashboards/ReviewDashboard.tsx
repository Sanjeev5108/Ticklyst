import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle2, XCircle, Search, Save } from 'lucide-react';
import { FieldworkRecord } from '@shared/fieldwork';
import { FieldworkStore } from '@/contexts/FieldworkStore';
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
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, FieldworkRecord>>({});
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Approved' | 'Rejected'>('Submitted');
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('0');
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({});
  const [ackOpen, setAckOpen] = useState(false);
  const [ackMsg, setAckMsg] = useState('');

  useEffect(() => {
    const unsub = FieldworkStore.subscribe(() => setRecords(FieldworkStore.getAll()));
    setRecords(FieldworkStore.getAll());
    return () => unsub();
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
      const status = records[c.id]?.status || 'draft';
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
    const all = Object.values(records).filter(r => r.status === 'submitted');
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
    const rec = FieldworkStore.get(id);
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



      <Card className="h-[560px] overflow-hidden">
        <CardHeader>
          <CardTitle>Submitted Rows (Read-only)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 h-full">
          <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  {['Activity','Risk','Control','Test of Control','Substantive Procedure','Sampling Applicable?','Sampling Methodology','Control Effective','Attachments','Audit Remarks','Red flag','Reportable','Observation Ranking','Audit Observation','Effect','Recommendation','Annexure','Review Comments','Approve','Reject'].map(h => (
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
                    <td className="p-3 align-top w-64 break-words">{row.testOfControl || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.substantiveProcedure || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.samplingApplicable || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.samplingMethodology || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.controlEffective || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.attachments || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.auditRemarks || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.redFlag || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.reportable || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.observationRanking || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.auditObservation || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.effect || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.recommendation || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">{row.annexure || '-'}</td>
                    <td className="p-3 align-top w-64 break-words">
                      <Input value={reviewDraft[row.id] || ''} onChange={(e)=> setReviewDraft(prev => ({ ...prev, [row.id]: e.target.value }))} placeholder="Add review comments" />
                    </td>
                    <td className="p-3 align-top w-64 break-words">
                      <Button variant="outline" size="sm" onClick={()=>{ if (!user) return; FieldworkStore.addReview(row.id, user.username, reviewDraft[row.id] || '', 'Approved'); setAckMsg('Approved successfully'); setAckOpen(true); }}>
                        Approve
                      </Button>
                    </td>
                    <td className="p-3 align-top w-64 break-words">
                      <Button variant="destructive" size="sm" onClick={()=>{ if (!user) return; FieldworkStore.addReview(row.id, user.username, reviewDraft[row.id] || '', 'Rejected'); setAckMsg('Rejected'); setAckOpen(true); }}>
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
    </div>
  );
}
