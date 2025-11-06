import { DEFAULT_GLOBAL_RISK_CONFIG, RiskAssessmentConfig } from "@shared/risk";

const STORAGE_KEY = "risk-configs";
const SETTINGS_KEY = "riskConfigs";

type Listener = () => void;

class RiskStore {
  private configs: Record<string, RiskAssessmentConfig> = {};
  private listeners = new Set<Listener>();
  private syncing = false;

  constructor() {
    this.loadLocal();
    const hasUser = !!localStorage.getItem("currentUser");
    if (hasUser) this.syncFromServer();
    // Defer syncing until after login to avoid failed fetches on public pages or cold starts
    if (typeof window !== "undefined") {
      window.addEventListener("auth:login", () => this.syncFromServer());
    }
  }

  private loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.configs = JSON.parse(raw);
    } catch {}
    if (!this.configs["global"]) {
      const def = DEFAULT_GLOBAL_RISK_CONFIG();
      this.configs["global"] = def;
      this.persistLocal();
    }
  }

  private persistLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
    } catch {}
  }

  private async persistServer() {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      await fetch(`/api/settings/${SETTINGS_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.configs),
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => {});
      clearTimeout(t);
    } catch {}
  }

  private normalize(obj: any): Record<string, RiskAssessmentConfig> {
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, RiskAssessmentConfig> = {};
    for (const [k, v] of Object.entries(obj)) {
      const val = v as any;
      if (!val || typeof val !== "object") continue;
      const id = String((val as any).id || k);
      out[id] = { ...(val as any), id } as RiskAssessmentConfig;
    }
    return out;
  }

  public async syncFromServer() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`/api/settings/${SETTINGS_KEY}`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => undefined as any);
      clearTimeout(t);
      if (res && res.ok) {
        const data = await res.json();
        const incoming = this.normalize(data);
        const merged: Record<string, RiskAssessmentConfig> = {
          ...incoming,
          ...this.configs,
        };
        if (!merged["global"]) merged["global"] = DEFAULT_GLOBAL_RISK_CONFIG();
        this.configs = merged;
        this.persistLocal();
        this.notify();
        // ensure server has something
        await this.persistServer();
      } else {
        // seed server if empty/missing
        await this.persistServer();
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

  getAll(): Record<string, RiskAssessmentConfig> {
    return { ...this.configs };
  }

  getGlobal(): RiskAssessmentConfig {
    return this.configs["global"];
  }

  get(id: string): RiskAssessmentConfig | undefined {
    return this.configs[id];
  }

  upsert(cfg: RiskAssessmentConfig) {
    this.configs[cfg.id] = {
      ...cfg,
      auditTrail: { ...cfg.auditTrail, updatedAt: new Date().toISOString() },
    } as RiskAssessmentConfig;
    this.persistLocal();
    this.persistServer();
    this.notify();
  }

  ensureAssignment(clientId: string, projectId: string): RiskAssessmentConfig {
    const id = `${clientId}|${projectId}`;
    if (!this.configs[id]) {
      const base = this.getGlobal();
      const created: RiskAssessmentConfig = {
        ...base,
        id,
        scope: { ...base.scope, configType: "assignment", clientId, projectId },
        auditTrail: {
          createdBy: "system",
          createdAt: new Date().toISOString(),
        },
      };
      this.configs[id] = created;
      this.persistLocal();
      this.persistServer();
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
