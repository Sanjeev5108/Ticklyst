export interface AssignmentType { id: string; name: string; description?: string; active?: boolean }

const STORAGE_KEY = 'assignment-types';

type Listener = () => void;

class AssignmentTypeStoreClass {
  private list: AssignmentType[] = [];
  private listeners = new Set<Listener>();

  constructor() { this.load(); }

  private load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) this.list = JSON.parse(raw); } catch {}
    if (!Array.isArray(this.list) || this.list.length === 0) {
      this.list = [
        { id: 'ia', name: 'Internal Audit' },
        { id: 'pa', name: 'Process Audit' },
        { id: 'comp', name: 'Compliance' },
        { id: 'sa', name: 'Special Audit' },
        { id: 'ra', name: 'Risk Assessment' },
        { id: 'oa', name: 'Operational Audit' }
      ];
      this.persist();
    }
  }
  private persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list)); } catch {} }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify() { for (const fn of this.listeners) fn(); }

  getAll(): AssignmentType[] { return [...this.list]; }

  add(name: string, description?: string) {
    const n = name.trim(); if (!n) return;
    const exists = this.list.find(a => a.name.toLowerCase() === n.toLowerCase());
    if (exists) return;
    const id = `${Date.now()}`;
    this.list = [...this.list, { id, name: n, description, active: true }];
    this.persist(); this.notify();
  }

  remove(id: string) { this.list = this.list.filter(x => x.id !== id); this.persist(); this.notify(); }
  rename(id: string, name: string) {
    this.list = this.list.map(x => x.id === id ? { ...x, name } : x); this.persist(); this.notify();
  }
  setActive(id: string, active: boolean) { this.list = this.list.map(x => x.id === id ? { ...x, active } : x); this.persist(); this.notify(); }
}

export const AssignmentTypeStore = new AssignmentTypeStoreClass();
