export interface AssignmentType { id: string; name: string; description?: string; active?: boolean }

const STORAGE_KEY = 'assignment-types';
const SETTINGS_KEY = 'assignmentTypes';

type Listener = () => void;

class AssignmentTypeStoreClass {
  private list: AssignmentType[] = [];
  private listeners = new Set<Listener>();
  private syncing = false;

  constructor() {
    this.loadFromLocal();
    this.syncFromServer();
  }

  private loadFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.list = JSON.parse(raw);
    } catch {}
    if (!Array.isArray(this.list) || this.list.length === 0) {
      this.list = [
        { id: 'ia', name: 'Internal Audit', active: true },
        { id: 'pa', name: 'Process Audit', active: true },
        { id: 'comp', name: 'Compliance', active: true },
        { id: 'sa', name: 'Special Audit', active: true },
        { id: 'ra', name: 'Risk Assessment', active: true },
        { id: 'oa', name: 'Operational Audit', active: true }
      ];
      this.persistLocal();
    }
  }

  private normalize(arr: any): AssignmentType[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: any) => ({
        id: String(x.id || '').trim() || `${Date.now()}${Math.random()}`,
        name: String(x.name || '').trim(),
        description: x.description ? String(x.description) : undefined,
        active: typeof x.active === 'boolean' ? x.active : true,
      }))
      .filter((x: AssignmentType) => x.name);
  }

  private persistLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list)); } catch {}
  }

  private async persistServer() {
    try {
      const body = JSON.stringify(this.list);
      await fetch(`/api/settings/${SETTINGS_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    } catch {}
  }

  private async syncFromServer() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const res = await fetch(`/api/settings/${SETTINGS_KEY}`);
      if (res.ok) {
        const data = await res.json();
        const normalized = this.normalize(data);
        if (normalized.length > 0) {
          this.list = normalized;
          this.persistLocal();
          this.notify();
        } else {
          await this.persistServer();
        }
      }
    } catch {}
    this.syncing = false;
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify() { for (const fn of this.listeners) fn(); }

  getAll(): AssignmentType[] { return [...this.list]; }

  add(name: string, description?: string) {
    const n = (name || '').trim(); if (!n) return;
    const exists = this.list.find(a => a.name.toLowerCase() === n.toLowerCase());
    if (exists) return;
    const id = `${Date.now()}${Math.random()}`;
    this.list = [...this.list, { id, name: n, description, active: true }];
    this.persistLocal();
    this.persistServer();
    this.notify();
  }

  remove(id: string) {
    this.list = this.list.filter(x => x.id !== id);
    this.persistLocal();
    this.persistServer();
    this.notify();
  }

  rename(id: string, name: string) {
    const n = (name || '').trim(); if (!n) return;
    this.list = this.list.map(x => x.id === id ? { ...x, name: n } : x);
    this.persistLocal();
    this.persistServer();
    this.notify();
  }

  setActive(id: string, active: boolean) {
    this.list = this.list.map(x => x.id === id ? { ...x, active } : x);
    this.persistLocal();
    this.persistServer();
    this.notify();
  }
}

export const AssignmentTypeStore = new AssignmentTypeStoreClass();
