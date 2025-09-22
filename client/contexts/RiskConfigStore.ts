import { DEFAULT_GLOBAL_RISK_CONFIG, RiskAssessmentConfig } from '@shared/risk';

const STORAGE_KEY = 'risk-configs';

type Listener = () => void;

class RiskStore {
  private configs: Record<string, RiskAssessmentConfig> = {};
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.configs = JSON.parse(raw);
    } catch {}
    if (!this.configs['global']) {
      const def = DEFAULT_GLOBAL_RISK_CONFIG();
      this.configs['global'] = def;
      this.persist();
    }
  }

  private persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs)); } catch {}
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  getAll(): Record<string, RiskAssessmentConfig> { return { ...this.configs }; }

  getGlobal(): RiskAssessmentConfig { return this.configs['global']; }

  get(id: string): RiskAssessmentConfig | undefined { return this.configs[id]; }

  upsert(cfg: RiskAssessmentConfig) {
    this.configs[cfg.id] = { ...cfg, auditTrail: { ...cfg.auditTrail, updatedAt: new Date().toISOString() } };

    // No automatic propagation from Global; assignment configs maintain their own Rating Definition.

    this.persist();
    this.notify();
  }

  ensureAssignment(clientId: string, projectId: string): RiskAssessmentConfig {
    const id = `${clientId}|${projectId}`;
    if (!this.configs[id]) {
      const base = this.getGlobal();
      const created: RiskAssessmentConfig = {
        ...base,
        id,
        scope: { ...base.scope, configType: 'assignment', clientId, projectId },
        auditTrail: { createdBy: 'system', createdAt: new Date().toISOString() }
      };
      this.configs[id] = created;
      this.persist();
      this.notify();
    }
    return this.configs[id];
  }

  getEffective(clientId?: string, projectId?: string): RiskAssessmentConfig {
    if (clientId && projectId) {
      const id = `${clientId}|${projectId}`;
      return this.configs[id] || this.getGlobal();
    }
    return this.getGlobal();
  }
}

export const RiskConfigStore = new RiskStore();
