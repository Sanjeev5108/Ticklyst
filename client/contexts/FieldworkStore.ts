import { FieldworkRecord, FieldworkStatus, ReviewComment, ReviewStatus } from '@shared/fieldwork';

const STORAGE_KEY = 'fieldwork-records';

type Listener = () => void;

class FWStore {
  private records: Record<string, FieldworkRecord> = {};
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.records = JSON.parse(raw);
    } catch {}
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {}
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
    this.records[rec.controlId] = { ...rec };
    this.persist();
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
      this.notify();
    } else {
      // backfill risk structure if missing
      const cur = this.records[id];
      if (!cur.risk) {
        this.records[id] = { ...cur, risk: { mode: 'likelihood_consequence', likelihood: 0, consequence: 0, riskScore: 0, controlScore: 0, residualRisk: 0, overridden: false } } as any;
      }
    }
    return this.records[id];
  }

  patch(id: string, patch: Partial<FieldworkRecord>) {
    const cur = this.records[id];
    if (!cur) return;
    this.records[id] = { ...cur, ...patch } as FieldworkRecord;
    this.persist();
    this.notify();
  }

  patchTab<T extends keyof FieldworkRecord>(id: string, tab: T, patch: Partial<FieldworkRecord[T]>) {
    const cur = this.records[id];
    if (!cur) return;
    this.records[id] = { ...cur, [tab]: { ...(cur as any)[tab], ...(patch as any) } } as FieldworkRecord;
    this.persist();
    this.notify();
  }

  setStatus(id: string, status: FieldworkStatus) {
    const cur = this.records[id];
    if (!cur) return;
    this.records[id] = { ...cur, status };
    this.persist();
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
    this.notify();
  }
}

export const FieldworkStore = new FWStore();
