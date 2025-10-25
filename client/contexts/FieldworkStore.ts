import { FieldworkRecord, FieldworkStatus, ReviewComment, ReviewStatus } from '@shared/fieldwork';

const STORAGE_KEY = 'fieldwork-records';

type Listener = () => void;

class FWStore {
  private records: Record<string, FieldworkRecord> = {};
  private listeners = new Set<Listener>();
  private syncing = false;

  constructor() {
    this.load();
    this.syncFromServer();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.records = JSON.parse(raw);
      // migrate: re-key records to project-specific keys if needed
      const migrated: Record<string, FieldworkRecord> = {} as any;
      let changed = false;
      for (const [key, rec] of Object.entries(this.records)) {
        const hasComposite = key.includes('|');
        const nextKey = rec && rec.projectId ? `${rec.projectId}|${rec.controlId}` : key;
        if (!hasComposite && rec && rec.projectId) changed = true;
        migrated[nextKey] = rec as any;
      }
      if (changed) {
        this.records = migrated;
        this.persist();
      }
    } catch {}
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {}
  }

  private async persistServerKey(id: string) {
    try {
      const rec = this.records[id];
      if (!rec) return;
      await fetch(`/api/fieldwork/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec)
      });
    } catch {}
  }

  private async syncFromServer() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const res = await fetch('/api/fieldwork');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          // Server is source of truth if present
          const serverRecords: Record<string, FieldworkRecord> = data;
          const merged: Record<string, FieldworkRecord> = { ...this.records };
          for (const [id, rec] of Object.entries(serverRecords)) {
            merged[id] = rec as FieldworkRecord;
          }
          this.records = merged;
          this.persist();
          this.notify();
        }
      }
    } catch {}
    this.syncing = false;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  getAll(): Record<string, FieldworkRecord> {
    return { ...this.records };
  }

  get(id: string): FieldworkRecord | undefined {
    return this.records[id];
  }

  upsert(rec: FieldworkRecord) {
    const key = rec.projectId ? `${rec.projectId}|${rec.controlId}` : rec.controlId;
    this.records[key] = { ...rec };
    this.persist();
    this.persistServerKey(key);
    this.notify();
  }

  ensure(id: string, factory: () => FieldworkRecord): FieldworkRecord {
    if (!this.records[id]) {
      const rec = factory();
      if (!rec.risk) {
        rec.risk = { mode: 'likelihood_consequence', likelihood: 0, consequence: 0, riskScore: 0, controlScore: 0, residualRisk: 0, overridden: false };
      }
      this.records[id] = rec;
      this.persist();
      this.persistServerKey(id);
      this.notify();
    } else {
      // backfill risk structure if missing
      const cur = this.records[id];
      if (!cur.risk) {
        this.records[id] = { ...cur, risk: { mode: 'likelihood_consequence', likelihood: 0, consequence: 0, riskScore: 0, controlScore: 0, residualRisk: 0, overridden: false } } as any;
        this.persist();
        this.persistServerKey(id);
        this.notify();
      }
    }
    return this.records[id];
  }

  patch(id: string, patch: Partial<FieldworkRecord>) {
    const cur = this.records[id];
    if (!cur) return;
    this.records[id] = { ...cur, ...patch } as FieldworkRecord;
    this.persist();
    this.persistServerKey(id);
    this.notify();
  }

  patchTab<T extends keyof FieldworkRecord>(id: string, tab: T, patch: Partial<FieldworkRecord[T]>) {
    const cur = this.records[id];
    if (!cur) return;
    this.records[id] = { ...cur, [tab]: { ...(cur as any)[tab], ...(patch as any) } } as FieldworkRecord;
    this.persist();
    this.persistServerKey(id);
    this.notify();
  }

  setStatus(id: string, status: FieldworkStatus) {
    const cur = this.records[id];
    if (!cur) return;
    this.records[id] = { ...cur, status };
    this.persist();
    this.persistServerKey(id);
    this.notify();
  }

  submitForReview(id: string) {
    this.setStatus(id, 'submitted');
  }

  addReview(id: string, author: string, content: string, status: Exclude<ReviewStatus, ''>) {
    const cur = this.records[id];
    if (!cur) return;
    const text = content && content.trim() ? `${status}: ${content}` : status;
    const entry: ReviewComment = { author, content: text, timestamp: new Date().toISOString() };
    const history = cur.reviewHistory ? [...cur.reviewHistory, entry] : [entry];
    const nextStatus: FieldworkStatus = status === 'Approved' ? 'approved' : 'rejected';
    this.records[id] = {
      ...cur,
      remarks: { ...cur.remarks, reviewComments: '', reviewStatus: status },
      reviewHistory: history,
      status: nextStatus,
      activeTab: Math.max(cur.activeTab, 4),
      progress: Math.max(cur.progress, 4)
    };
    this.persist();
    this.persistServerKey(id);
    this.notify();
  }

  addAuditRemark(id: string, author: string, content: string) {
    const cur = this.records[id];
    if (!cur) return;
    const text = (content || '').trim();
    if (!text) return;
    const entry: ReviewComment = { author, content: text, timestamp: new Date().toISOString() };
    const history = cur.auditRemarksHistory ? [...cur.auditRemarksHistory, entry] : [entry];
    this.records[id] = {
      ...cur,
      auditRemarksHistory: history,
      remarks: { ...cur.remarks, auditRemarks: text, revisedAuditRemarks: '' }
    } as any;
    this.persist();
    this.persistServerKey(id);
    this.notify();
  }
}

export const FieldworkStore = new FWStore();
