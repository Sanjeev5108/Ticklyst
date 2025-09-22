export type RiskCalcMode = 'single' | 'likelihood_consequence';
export type ResidualFormula = 'risk_times_control' | 'risk_times_one_minus_control_pct';
export type RiskScoringModel = 'standard' | 'flexible';

export interface Scale {
  min: number; // inclusive
  max: number; // inclusive
}

export interface LabelDef {
  value: number; // numeric value within scale or range start
  label: string;
  color?: string; // hex or tailwind color name
}

export interface RangeLabelDef {
  from: number; // inclusive
  to: number;   // inclusive
  label: string;
  color?: string;
}

export interface RiskNaming {
  riskDisplayName: string; // e.g., Inherent Risk
  controlDisplayName: string; // e.g., Control Effectiveness
  residualDisplayName: string; // e.g., Net Risk
  definition?: string;
}

export interface ThresholdsConfig {
  ranges: RangeLabelDef[]; // for risk/residual levels
  heatmapColors?: { [level: string]: string }; // optional color per level label
}

export interface RiskAssessmentConfig {
  id: string; // 'global' or `${clientId}|${projectId}`
  scope: {
    clientId?: string;
    projectId?: string;
    businessUnits?: string[];
    processes?: string[];
    assignmentType?: string;
    assignmentMap?: { [assignmentTypeId: string]: { enabled: boolean; projectId?: string; mode?: 'assignment' | 'project' } };
    configType: 'global' | 'assignment';
  };
  enabled?: boolean;
  riskScoringModel?: RiskScoringModel;
  riskScore: {
    mode: RiskCalcMode;
    scale: Scale; // used when mode === 'single' or for derived total range
    labels: LabelDef[]; // qualitative mapping for numeric values
    likelihood?: {
      scale: Scale;
      labels: LabelDef[];
    };
    consequence?: {
      scale: Scale;
      labels: LabelDef[];
    };
  };
  controlScore: {
    scale: Scale;
    labels: LabelDef[]; // qualitative mapping for numeric values
    constraintControlLEQRisk: boolean; // Control Score ≤ Risk Score
  };
  residualRisk: {
    formula: ResidualFormula;
    displayName: string; // custom display name
    parameter?: string; // selected parameter for rating definition UI
    scale?: Scale; // optional custom scale, otherwise inherit from risk
    thresholds: ThresholdsConfig; // ranges and colors
    constraintResidualLEQRisk: boolean; // Residual ≤ Risk Score
  };
  naming: RiskNaming;
  constraints: {
    requireJustificationOnOverride: boolean;
  };
  auditTrail: {
    createdBy: string;
    createdAt: string;
    updatedBy?: string;
    updatedAt?: string;
    history?: { user: string; action: string; timestamp: string; details?: any }[];
  };
}

export const DEFAULT_GLOBAL_RISK_CONFIG = (): RiskAssessmentConfig => ({
  id: 'global',
  scope: { configType: 'global' },
  riskScoringModel: 'standard',
  riskScore: {
    mode: 'likelihood_consequence',
    scale: { min: 1, max: 25 },
    labels: [
      { value: 1, label: 'Low', color: 'Green' },
      { value: 5, label: 'High', color: 'Red' }
    ],
    likelihood: {
      scale: { min: 1, max: 5 },
      labels: [
        { value: 1, label: 'Rare', color: 'Green' },
        { value: 5, label: 'Almost Certain', color: 'Red' }
      ]
    },
    consequence: {
      scale: { min: 1, max: 5 },
      labels: [
        { value: 1, label: 'Insignificant', color: 'Green' },
        { value: 5, label: 'Critical', color: 'Red' }
      ]
    }
  },
  controlScore: {
    scale: { min: 1, max: 5 },
    labels: [
      { value: 1, label: 'Effective', color: 'Green' },
      { value: 3, label: 'Ineffective', color: 'Orange' },
      { value: 5, label: 'Not Implemented', color: 'Red' }
    ],
    constraintControlLEQRisk: true
  },
  residualRisk: {
    formula: 'risk_times_one_minus_control_pct',
    displayName: 'Residual Risk',
    parameter: 'residualRisk',
    thresholds: {
      ranges: [
        { from: 1, to: 5, label: 'Low', color: 'Green' },
        { from: 6, to: 12, label: 'Medium', color: 'Orange' },
        { from: 13, to: 25, label: 'High', color: 'Red' }
      ],
      heatmapColors: { Low: 'Green', Medium: 'Orange', High: 'Red' }
    },
    constraintResidualLEQRisk: true
  },
  naming: {
    riskDisplayName: 'Inherent Risk',
    controlDisplayName: 'Control Effectiveness',
    residualDisplayName: 'Net Risk',
    definition: ''
  },
  // per-assignment applicability mapping
  // assignmentMap keys are assignmentType ids, value indicates if enabled and optional projectId
  assignmentMap: {},
  constraints: {
    requireJustificationOnOverride: true
  },
  auditTrail: { createdBy: 'system', createdAt: new Date().toISOString() }
});

export function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function computeRiskScore(mode: RiskCalcMode, likelihood?: number, consequence?: number, manual?: number) {
  if (mode === 'single') return manual ?? 0;
  const l = Number(likelihood || 0);
  const c = Number(consequence || 0);
  return l * c;
}

export function computeResidual(
  formula: ResidualFormula,
  riskScore: number,
  controlScore: number,
  controlScale: Scale
) {
  if (formula === 'risk_times_control') {
    return riskScore * controlScore;
  }
  // risk × (1 – control%) => interpret control% from control score normalized to [0,1]
  const pct = controlScale.max > controlScale.min ? (controlScore - controlScale.min) / (controlScale.max - controlScale.min) : 0;
  return riskScore * (1 - pct);
}

export function resolveLevel(val: number, thresholds: ThresholdsConfig): { level: string; color?: string } |
  undefined {
  for (const r of thresholds.ranges) {
    if (val >= r.from && val <= r.to) return { level: r.label, color: r.color || thresholds.heatmapColors?.[r.label] };
  }
  return undefined;
}
