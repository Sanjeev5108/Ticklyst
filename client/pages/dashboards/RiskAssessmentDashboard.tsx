import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RiskConfigStore } from '@/contexts/RiskConfigStore';
import { RiskAssessmentConfig, RiskCalcMode, ResidualFormula, RiskScoringModel, clamp, computeResidual, computeRiskScore } from '@shared/risk';
import { useAuth } from '@/contexts/AuthContext';
import { AssignmentTypeStore } from '@/contexts/AssignmentTypeStore';
import { Info } from 'lucide-react';

export default function RiskAssessmentDashboard() {
  const { user } = useAuth();
  const [configs, setConfigs] = React.useState(RiskConfigStore.getAll());
  const [scopeType, setScopeType] = React.useState<'global'|'assignment'>('global');
  const [assignmentTypes, setAssignmentTypes] = React.useState<{id:string;name:string}[]>([]);
  const [cfg, setCfg] = React.useState<RiskAssessmentConfig>(() => RiskConfigStore.getGlobal());
  const [editingAssignmentId, setEditingAssignmentId] = React.useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = React.useState<string | null>(null);
  const [selectedMode, setSelectedMode] = React.useState<'_select'|'assignment'|'project'>('_select');
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [previewText, setPreviewText] = React.useState('');
  const [infoDialogOpen, setInfoDialogOpen] = React.useState(false);
  const [openColorPickerFor, setOpenColorPickerFor] = React.useState<number | null>(null);
  const [breakpointErrors, setBreakpointErrors] = React.useState<string[]>([]);

  // Projects (sourced from ProjectManagement mock list)
  const projects = [
    { id: '1', title: 'SQ/25-26/0135 - Customisation T...' },
    { id: '2', title: 'SQ/25-26/0150 - Customisation T...' },
    { id: '3', title: 'CA Articles Training' },
    { id: '4', title: 'Reshmi - Customisation' },
    { id: '5', title: 'Artika VII - Customisation' },
    { id: '6', title: 'SQ/25-26/0086 - Prashanthi Cust...' },
    { id: '7', title: 'SQ/25-26/0168 - RMCL CCA June...' },
    { id: '8', title: 'KSS Event ABC' },
    { id: '9', title: 'SQ/25-26/0059 - MMD IA April 2...' }
  ];

  React.useEffect(() => {
    const unsub = RiskConfigStore.subscribe(() => setConfigs(RiskConfigStore.getAll()));
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (scopeType === 'global') {
      setCfg(prev => ({ ...RiskConfigStore.getGlobal(), enabled: prev?.enabled } as RiskAssessmentConfig));
    } else {
      // assignment-specific: derive from global and keep existing assignmentMap and enabled flag if any
      const base = RiskConfigStore.getGlobal();
      setCfg(prev => ({ ...base, enabled: prev?.enabled, id: 'assignment', scope: { ...base.scope, configType: 'assignment', assignmentMap: prev?.scope?.assignmentMap || {} } } as RiskAssessmentConfig));
    }
  }, [scopeType]);

  React.useEffect(() => {
    const sync = () => setAssignmentTypes(AssignmentTypeStore.getAll());
    const unsub = AssignmentTypeStore.subscribe(sync);
    sync();
    return () => unsub();
  }, []);

  // Enforce default constraints: control ≤ risk and residual ≤ risk
  React.useEffect(() => {
    setCfg(prev => ({
      ...prev,
      controlScore: { ...prev.controlScore, constraintControlLEQRisk: true },
      residualRisk: { ...prev.residualRisk, constraintResidualLEQRisk: true }
    } as RiskAssessmentConfig));
  }, []);

  // Initialize default residual thresholds and parameter when empty (min to max)
  React.useEffect(() => {
    setCfg(prev => {
      const existing = prev.residualRisk?.thresholds?.ranges || [];
      if (existing.length > 0) return prev;

      const p = prev.residualRisk?.parameter || 'residualRisk';
      let min = 1, max = 5;

      if (p === 'likelihood') {
        min = prev.riskScore?.likelihood?.scale?.min ?? prev.riskScore?.scale?.min ?? 1;
        max = prev.riskScore?.likelihood?.scale?.max ?? prev.riskScore?.scale?.max ?? 5;
      } else if (p === 'consequence') {
        min = prev.riskScore?.consequence?.scale?.min ?? prev.riskScore?.scale?.min ?? 1;
        max = prev.riskScore?.consequence?.scale?.max ?? prev.riskScore?.scale?.max ?? 5;
      } else if (p === 'controlScore') {
        min = prev.controlScore?.scale?.min ?? 1;
        max = prev.controlScore?.scale?.max ?? 5;
      } else {
        // riskScore or residualRisk - use riskScore range
        min = prev.riskScore?.scale?.min ?? 1;
        max = prev.riskScore?.scale?.max ?? 25;
        if (p === 'riskScore' || p === 'residualRisk') {
          const lmax = prev.riskScore?.likelihood?.scale?.max ?? prev.riskScore?.scale?.max ?? 5;
          const cmax = prev.riskScore?.consequence?.scale?.max ?? prev.riskScore?.scale?.max ?? 5;
          max = lmax * cmax;
        }
      }

      // Start with just min and max breakpoints (creates one range)
      const breakpoints = [min, max];
      const ranges = [{ from: min, to: max, label: 'Default', color: '#10B981' }];

      return { ...prev, residualRisk: { ...prev.residualRisk, parameter: prev.residualRisk?.parameter || 'residualRisk', thresholds: { ...prev.residualRisk.thresholds, ranges } } } as RiskAssessmentConfig;
    });
  }, []);

  // initialize single-row selection from existing cfg if present
  React.useEffect(() => {
    const map = (cfg.scope as any)?.assignmentMap || {};
    const keys = Object.keys(map);
    if (keys.length > 0) {
      const k = keys[0];
      setSelectedAssignmentId(k);
      setSelectedMode(map[k]?.mode || '_select');
      if (map[k]?.mode === 'assignment') setEditingAssignmentId(k);
    } else if (assignmentTypes.length > 0) {
      setSelectedAssignmentId(assignmentTypes[0].id);
      setSelectedMode('_select');
    }
  }, [assignmentTypes]);

  if (user?.role !== 'Admin') {
    return (
      <Card>
        <CardHeader><CardTitle>Risk Assessment</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Only Admins can configure risk settings.</p>
        </CardContent>
      </Card>
    );
  }

  const onSave = () => {
    // If editing a specific assignment type, persist that assignment config
    if (editingAssignmentId) {
      const perId = `assignment|${editingAssignmentId}`;
      const toSave = { ...cfg, id: perId, scope: { ...cfg.scope, configType: 'assignment', assignmentType: editingAssignmentId } } as RiskAssessmentConfig;
      RiskConfigStore.upsert(toSave);
      // also persist the overall assignmentMap into a central 'assignment' config for lookup
      const overall = RiskConfigStore.get('assignment') || RiskConfigStore.getGlobal();
      const overallNext = { ...overall, id: 'assignment', scope: { ...overall.scope, configType: 'assignment', assignmentMap: (cfg.scope as any).assignmentMap || {} } } as RiskAssessmentConfig;
      RiskConfigStore.upsert(overallNext);
      alert('Assignment-type configuration saved');
      return;
    }

    // otherwise persist the assignment-level mapping
    const id = scopeType === 'global' ? 'global' : 'assignment';
    RiskConfigStore.upsert({ ...cfg, id, scope: { ...cfg.scope, configType: scopeType } });
    alert('Settings saved');
  };

  const mode = cfg.riskScore.mode as RiskCalcMode;
  const isStandard = cfg.riskScoringModel === 'standard';

  // Helper functions for breakpoint management
  const getBreakpointsFromRanges = (ranges: any[]): number[] => {
    if (ranges.length === 0) return [];
    const breakpoints = [ranges[0].from];
    ranges.forEach(r => breakpoints.push(r.to));
    return breakpoints;
  };

  const getRangesFromBreakpoints = (breakpoints: number[], existingRanges: any[]): any[] => {
    if (breakpoints.length < 2) return [];
    const ranges = [];
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const from = breakpoints[i];
      const to = breakpoints[i + 1];
      const existingRange = existingRanges[i];
      ranges.push({
        from,
        to,
        label: existingRange?.label || `Level ${i + 1}`,
        color: existingRange?.color || 'Grey'
      });
    }
    return ranges;
  };

  const calculateDisplayRange = (from: number, to: number): string => {
    return `${from}–${to}`;
  };

  const getParameterMin = (): number => {
    const p = cfg.residualRisk?.parameter || 'residualRisk';
    if (p === 'likelihood') return cfg.riskScore?.likelihood?.scale?.min ?? cfg.riskScore?.scale?.min ?? 1;
    if (p === 'consequence') return cfg.riskScore?.consequence?.scale?.min ?? cfg.riskScore?.scale?.min ?? 1;
    if (p === 'controlScore') return cfg.controlScore?.scale?.min ?? 1;
    if (p === 'riskScore') return cfg.riskScore?.scale?.min ?? 1;
    // residualRisk
    return cfg.riskScore?.scale?.min ?? 1;
  };

  const getParameterMax = (): number => {
    const p = cfg.residualRisk?.parameter || 'residualRisk';
    if (p === 'likelihood') return cfg.riskScore?.likelihood?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
    if (p === 'consequence') return cfg.riskScore?.consequence?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
    if (p === 'controlScore') return cfg.controlScore?.scale?.max ?? 5;
    if (p === 'riskScore') {
      const l = cfg.riskScore?.likelihood?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
      const c = cfg.riskScore?.consequence?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
      return l * c;
    }
    // residualRisk
    const l = cfg.riskScore?.likelihood?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
    const c = cfg.riskScore?.consequence?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
    return l * c;
  };

  const validateBreakpoints = (breakpoints: number[], paramMin?: number, paramMax?: number): string[] => {
    const errors: string[] = [];
    const min = typeof paramMin === 'number' ? paramMin : getParameterMin();
    const max = typeof paramMax === 'number' ? paramMax : getParameterMax();

    for (let i = 0; i < breakpoints.length; i++) {
      if (i === 0) {
        // First breakpoint must be min
        if (breakpoints[i] !== min) {
          errors[i] = `Must be ${min}`;
        } else {
          errors[i] = '';
        }
      } else if (i === breakpoints.length - 1) {
        // Last breakpoint must be max
        if (breakpoints[i] !== max) {
          errors[i] = `Must be ${max}`;
        } else {
          errors[i] = '';
        }
      } else {
        // Middle breakpoints: must be > previous and < next, and within min-max range
        if (breakpoints[i] <= breakpoints[i - 1]) {
          errors[i] = `Must be > ${breakpoints[i - 1]}`;
        } else if (breakpoints[i] >= breakpoints[i + 1]) {
          errors[i] = `Must be < ${breakpoints[i + 1]}`;
        } else if (breakpoints[i] < min || breakpoints[i] > max) {
          errors[i] = `Must be ${min}-${max}`;
        } else {
          errors[i] = '';
        }
      }
    }
    return errors;
  };

  // When parameter or scale settings change, ensure existing breakpoints follow min/max rule
  React.useEffect(() => {
    const ranges = cfg.residualRisk.thresholds.ranges || [];
    if (!ranges || ranges.length === 0) return;
    const paramMin = getParameterMin();
    const paramMax = getParameterMax();
    const breakpoints = getBreakpointsFromRanges(ranges);
    let changed = false;
    const newBps = [...breakpoints];

    // Ensure we have at least 2 breakpoints (min and max)
    if (newBps.length < 2) {
      newBps.splice(0, newBps.length, paramMin, paramMax);
      changed = true;
    } else {
      // Force first = min and last = max
      if (newBps[0] !== paramMin) { newBps[0] = paramMin; changed = true; }
      if (newBps[newBps.length - 1] !== paramMax) { newBps[newBps.length - 1] = paramMax; changed = true; }

      // Clamp middle breakpoints and ensure ascending order
      for (let i = 1; i < newBps.length - 1; i++) {
        if (typeof newBps[i] !== 'number' || isNaN(newBps[i])) { newBps[i] = Math.floor((paramMin + paramMax) / 2); changed = true; }
        if (newBps[i] < paramMin) { newBps[i] = paramMin; changed = true; }
        if (newBps[i] > paramMax) { newBps[i] = paramMax; changed = true; }
        if (newBps[i] <= newBps[i - 1]) {
          const candidate = Math.min(newBps[i - 1] + 1, paramMax - 1);
          if (candidate !== newBps[i] && candidate < paramMax) { newBps[i] = candidate; changed = true; }
        }
        if (newBps[i] >= newBps[i + 1]) {
          const candidate = Math.max(newBps[i + 1] - 1, paramMin + 1);
          if (candidate !== newBps[i] && candidate > paramMin) { newBps[i] = candidate; changed = true; }
        }
      }
    }

    if (changed) {
      const newRanges = getRangesFromBreakpoints(newBps, ranges);
      setCfg(prev => ({ ...prev, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: newRanges } } } as RiskAssessmentConfig));
    }

    // re-validate and display errors if any
    const errors = validateBreakpoints(newBps, paramMin, paramMax);
    setBreakpointErrors(errors);
  }, [cfg.residualRisk.parameter, cfg.riskScore?.scale?.min, cfg.riskScore?.scale?.max, cfg.riskScore?.likelihood?.scale?.max, cfg.riskScore?.consequence?.scale?.max, cfg.controlScore?.scale?.max, JSON.stringify(cfg.residualRisk.thresholds.ranges)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Risk Assessment Module</h1>
        <Badge className="bg-emerald-100 text-emerald-800">Configuration</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Risk Assessment Module Applicability</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div>
              <Label>Enable Risk Assessment Module?</Label>
              <Select value={cfg.enabled ? 'yes' : 'no'} onValueChange={(v:any)=> setCfg(prev => ({ ...prev, enabled: v === 'yes' }))}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {cfg.enabled && (
      <>
      <Card>
        <CardHeader><CardTitle>General Assignment Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Config Type</Label>
              <Select value={scopeType} onValueChange={(v:any)=>setScopeType(v)}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="assignment">Assignment-specific</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {(scopeType === 'global') ? (
        <Tabs defaultValue="risk" className="space-y-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="risk">Risk Score</TabsTrigger>
            <TabsTrigger value="control">Control Score</TabsTrigger>
            <TabsTrigger value="residual">Rating Definition</TabsTrigger>
          </TabsList>

          <TabsContent value="risk">
            <Card>
              <CardHeader><CardTitle>Risk Score Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Risk Scoring Model</Label>
                    <Select value={cfg.riskScoringModel || 'flexible'} onValueChange={(v:any)=>{
                      if (v === 'standard') {
                        setCfg(prev => ({
                          ...prev,
                          riskScoringModel: 'standard',
                          riskScore: { ...prev.riskScore, mode: 'likelihood_consequence', scale: { min: 1, max: 25 }, likelihood: { ...(prev.riskScore.likelihood||{}), scale: { min:1, max:5 } }, consequence: { ...(prev.riskScore.consequence||{}), scale: { min:1, max:5 } } },
                          controlScore: { ...prev.controlScore, scale: { min:1, max:5 } },
                          residualRisk: { ...prev.residualRisk, formula: 'risk_times_one_minus_control_pct' }
                        } as RiskAssessmentConfig));
                      } else {
                        setCfg(prev => ({ ...prev, riskScoringModel: 'flexible' } as RiskAssessmentConfig));
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Scale model</SelectItem>
                        <SelectItem value="flexible">Flexible Model</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Calculation Mode</Label>
                    <Select value={cfg.riskScore.mode} onValueChange={(v:any)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, mode: v } })} disabled={isStandard}>
                      <SelectTrigger><SelectValue placeholder="Select mode"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single Value (manual)</SelectItem>
                        <SelectItem value="likelihood_consequence">Likelihood × Consequence</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {mode === 'single' ? (
                    <div className="md:col-span-1">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Label>Risk Scale Min</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.scale.min} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => { const riskMin = val; const riskMax = prev.riskScore.scale.max; const control = { ...prev.controlScore, scale: { min: clamp(prev.controlScore.scale.min, riskMin, riskMax), max: clamp(prev.controlScore.scale.max, riskMin, riskMax) } }; const residualThresholds = (prev.residualRisk.thresholds.ranges||[]).map(r=>({ ...r, from: clamp(r.from, riskMin, riskMax), to: clamp(r.to, riskMin, riskMax) })); return { ...prev, riskScore: { ...prev.riskScore, scale: { ...prev.riskScore.scale, min: val } }, controlScore: control, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: residualThresholds } } } as RiskAssessmentConfig }) }} disabled={isStandard} />
                        </div>
                        <div className="flex-1">
                          <Label>Risk Scale Max</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.scale.max} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => { const riskMin = prev.riskScore.scale.min; const riskMax = val; const control = { ...prev.controlScore, scale: { min: clamp(prev.controlScore.scale.min, riskMin, riskMax), max: clamp(prev.controlScore.scale.max, riskMin, riskMax) } }; const residualThresholds = (prev.residualRisk.thresholds.ranges||[]).map(r=>({ ...r, from: clamp(r.from, riskMin, riskMax), to: clamp(r.to, riskMin, riskMax) })); return { ...prev, riskScore: { ...prev.riskScore, scale: { ...prev.riskScore.scale, max: val } }, controlScore: control, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: residualThresholds } } } as RiskAssessmentConfig }) }} disabled={isStandard} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {mode === 'likelihood_consequence' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h3 className="font-medium">Likelihood Scale</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>Min</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.likelihood?.scale.min || 1} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, likelihood: { ...(cfg.riskScore.likelihood||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.likelihood?.scale||{min:1,max:5}), min: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                        <div>
                          <Label>Max</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.likelihood?.scale.max || 5} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, likelihood: { ...(cfg.riskScore.likelihood||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.likelihood?.scale||{min:1,max:5}), max: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium">Consequence Scale</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>Min</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.consequence?.scale.min || 1} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, consequence: { ...(cfg.riskScore.consequence||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.consequence?.scale||{min:1,max:5}), min: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                        <div>
                          <Label>Max</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.consequence?.scale.max || 5} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, consequence: { ...(cfg.riskScore.consequence||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.consequence?.scale||{min:1,max:5}), max: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="control">
            <Card>
              <CardHeader><CardTitle>Control Score Configuration</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Control Scale Min</Label>
                  <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.controlScore.scale.min} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => ({ ...prev, controlScore: { ...prev.controlScore, scale: { ...prev.controlScore.scale, min: clamp(val, prev.riskScore.scale.min, prev.riskScore.scale.max) } } } as RiskAssessmentConfig)); }} disabled={isStandard} />
                </div>
                <div>
                  <Label>Control Scale Max</Label>
                  <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.controlScore.scale.max} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => ({ ...prev, controlScore: { ...prev.controlScore, scale: { ...prev.controlScore.scale, max: clamp(val, prev.riskScore.scale.min, prev.riskScore.scale.max) } } } as RiskAssessmentConfig)); }} disabled={isStandard} />
                </div>
                <div>
                  <Label>Constraint</Label>
                  <p>Control Score ≤ Risk Score </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="residual">
            <Card>
              <CardHeader><CardTitle>Rating Definition</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Parameters</Label>
                    <Select value={cfg.residualRisk.parameter || 'residualRisk'} onValueChange={(v:any)=> setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, parameter: v } })}>
                      <SelectTrigger><SelectValue placeholder="Select parameter"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="likelihood">Likelihood</SelectItem>
                        <SelectItem value="consequence">Consequence</SelectItem>
                        <SelectItem value="riskScore">Risk Score</SelectItem>
                        <SelectItem value="controlScore">Control Score</SelectItem>
                        <SelectItem value="residualRisk">Residual Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Threshold Ranges</h3>
                  <div className="space-y-2">
                    {(() => {
                      const ranges = cfg.residualRisk.thresholds.ranges || [];
                      const breakpoints = getBreakpointsFromRanges(ranges);

                      return breakpoints.length > 0 ? breakpoints.map((breakpoint, idx) => {
                        const isLast = idx === breakpoints.length - 1;
                        const range = ranges[idx];
                        const displayRange = !isLast && range ? calculateDisplayRange(range.from, range.to) : '';
                        const hasError = breakpointErrors[idx];

                        return (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                            <div>
                              <Label>Breakpoint {(idx === 0 || idx === breakpoints.length - 1) && <span className="text-xs text-gray-500">(fixed)</span>}</Label>
                              <Input
                                type="number"
                                value={breakpoint}
                                onChange={(e) => {
                                  const raw = Math.round(Number(e.target.value));
                                    const newBreakpoints = [...breakpoints];
                                    newBreakpoints[idx] = raw;
                                    const paramMin = getParameterMin();
                                    const paramMax = getParameterMax();
                                    const errors = validateBreakpoints(newBreakpoints, paramMin, paramMax);
                                    setBreakpointErrors(errors);

                                    if (!errors[idx]) {
                                      const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                                      setCfg(prev => ({
                                        ...prev,
                                        residualRisk: {
                                          ...prev.residualRisk,
                                          thresholds: {
                                            ...prev.residualRisk.thresholds,
                                            ranges: newRanges
                                          }
                                        }
                                      } as RiskAssessmentConfig));
                                    }
                                }}
                                disabled={isStandard || idx === 0 || idx === breakpoints.length - 1}
                                className={hasError ? 'border-red-500' : ''}
                              />
                              {hasError && <div className="text-xs text-red-500 mt-1">{hasError}</div>}
                            </div>

                            {!isLast && (
                              <>
                                <div>
                                  <Label>Range</Label>
                                  <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 text-sm flex items-center">
                                    {displayRange}
                                  </div>
                                </div>

                                <div className="md:col-span-2">
                                  <Label>Label</Label>
                                  <Input
                                    value={range?.label || ''}
                                    onChange={(e) => {
                                      const newRanges = [...ranges];
                                      if (newRanges[idx]) {
                                        newRanges[idx] = { ...newRanges[idx], label: e.target.value };
                                        setCfg({
                                          ...cfg,
                                          residualRisk: {
                                            ...cfg.residualRisk,
                                            thresholds: {
                                              ...cfg.residualRisk.thresholds,
                                              ranges: newRanges
                                            }
                                          }
                                        });
                                      }
                                    }}
                                    disabled={isStandard}
                                  />
                                </div>

                                <div className="md:col-span-1 relative">
                                  <Label>Color</Label>
                                  <div className="flex items-center gap-2">
                                    <button type="button" className="h-6 w-6 rounded border" style={{ backgroundColor: range?.color || '#ffffff' }} aria-label="color preview" disabled={isStandard} />
                                    <Button size="sm" onClick={() => setOpenColorPickerFor(idx)} disabled={isStandard}>Choose color</Button>
                                  </div>

                                  {openColorPickerFor === idx && (
                                    <div className="absolute z-50 right-0 bottom-full mb-2 p-3 bg-white rounded border shadow-lg w-64">
                                      <div className="space-y-3">
                                        <div>
                                          <h4 className="text-xs font-medium text-gray-700 mb-2">Theme Colors</h4>
                                          <div className="grid grid-cols-10 gap-1">
                                            {['#000000','#FFFFFF','#1F2937','#4B5563','#2563EB','#F97316','#EF4444','#10B981','#F59E0B','#8B5CF6'].map(c => (
                                              <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                const newRanges = [...ranges];
                                                if (newRanges[idx]) {
                                                  newRanges[idx] = { ...newRanges[idx], color: c };
                                                  setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                }
                                                setOpenColorPickerFor(null);
                                              }} />
                                            ))}
                                          </div>
                                          <div className="grid grid-cols-10 gap-1 mt-1">
                                            {['#F3F4F6','#E5E7EB','#9CA3AF','#6B7280','#DBEAFE','#FED7AA','#FECACA','#D1FAE5','#FEF3C7','#E9D5FF'].map(c => (
                                              <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                const newRanges = [...ranges];
                                                if (newRanges[idx]) {
                                                  newRanges[idx] = { ...newRanges[idx], color: c };
                                                  setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                }
                                                setOpenColorPickerFor(null);
                                              }} />
                                            ))}
                                          </div>
                                          <div className="grid grid-cols-10 gap-1 mt-1">
                                            {['#D1D5DB','#B3B6BB','#7B8392','#4B5563','#93C5FD','#FDBA74','#F87171','#6EE7B7','#FDE047','#C4B5FD'].map(c => (
                                              <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                const newRanges = [...ranges];
                                                if (newRanges[idx]) {
                                                  newRanges[idx] = { ...newRanges[idx], color: c };
                                                  setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                }
                                                setOpenColorPickerFor(null);
                                              }} />
                                            ))}
                                          </div>
                                          <div className="grid grid-cols-10 gap-1 mt-1">
                                            {['#9B9B9B','#8A8A8A','#5E6B73','#374151','#3B82F6','#EA580C','#DC2626','#059669','#D97706','#7C3AED'].map(c => (
                                              <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                const newRanges = [...ranges];
                                                if (newRanges[idx]) {
                                                  newRanges[idx] = { ...newRanges[idx], color: c };
                                                  setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                }
                                                setOpenColorPickerFor(null);
                                              }} />
                                            ))}
                                          </div>
                                          <div className="grid grid-cols-10 gap-1 mt-1">
                                            {['#6B7280','#5B5B5B','#44525A','#1F2937','#1D4ED8','#C2410C','#B91C1C','#047857','#B45309','#5B21B6'].map(c => (
                                              <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                const newRanges = [...ranges];
                                                if (newRanges[idx]) {
                                                  newRanges[idx] = { ...newRanges[idx], color: c };
                                                  setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                }
                                                setOpenColorPickerFor(null);
                                              }} />
                                            ))}
                                          </div>
                                        </div>

                                        <div>
                                          <h4 className="text-xs font-medium text-gray-700 mb-2">Standard Colors</h4>
                                          <div className="grid grid-cols-10 gap-1">
                                            {['#C53030','#DD6B20','#D69E2E','#38A169','#00B5D8','#3182CE','#553C9A','#805AD5','#D53F8C','#E53E3E'].map(c => (
                                              <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                const newRanges = [...ranges];
                                                if (newRanges[idx]) {
                                                  newRanges[idx] = { ...newRanges[idx], color: c };
                                                  setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                }
                                                setOpenColorPickerFor(null);
                                              }} />
                                            ))}
                                          </div>
                                        </div>

                                        <div className="border-t pt-2">
                                          <Input placeholder="Custom color (#rrggbb)" value={range?.color || ''} onChange={(e) => {
                                            const newRanges = [...ranges];
                                            if (newRanges[idx]) {
                                              newRanges[idx] = { ...newRanges[idx], color: e.target.value };
                                              setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                            }
                                          }} className="text-xs" />
                                        </div>
                                      </div>
                                      <div className="flex justify-end mt-3 pt-2 border-t">
                                        <Button size="sm" variant="ghost" onClick={() => setOpenColorPickerFor(null)}>Close</Button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="md:col-span-1">
                                  <Button variant="outline" onClick={() => {
                                    // Don't allow removing first or last breakpoint (min/max)
                                    if (idx === 0 || idx === breakpoints.length - 1) return;
                                    const newBreakpoints = breakpoints.filter((_, i) => i !== idx);
                                    const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                    setBreakpointErrors([]);
                                  }} disabled={isStandard || idx === 0 || idx === breakpoints.length - 1}>Remove</Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      }) : <div className="text-sm text-gray-500">No breakpoints defined</div>;
                    })()}
                  </div>
                  <div>
                    <Button size="sm" onClick={() => {
                      setCfg(prev => {
                        const ranges = prev.residualRisk.thresholds.ranges || [];
                        const breakpoints = getBreakpointsFromRanges(ranges);
                        const paramMin = getParameterMin();
                        const paramMax = getParameterMax();

                        // Find the largest gap between consecutive breakpoints to insert new one
                        let bestGapIndex = 0;
                        let bestGapSize = 0;
                        for (let i = 0; i < breakpoints.length - 1; i++) {
                          const gap = breakpoints[i + 1] - breakpoints[i];
                          if (gap > bestGapSize && gap > 1) {
                            bestGapSize = gap;
                            bestGapIndex = i;
                          }
                        }

                        // If no gap found or all gaps are size 1, can't add more breakpoints
                        if (bestGapSize <= 1) return prev;

                        // Insert new breakpoint in the middle of the best gap and clamp within allowed range
                        const newValue = Math.floor((breakpoints[bestGapIndex] + breakpoints[bestGapIndex + 1]) / 2);
                        const clampedValue = Math.min(Math.max(newValue, paramMin + 1), paramMax - 1);
                        const newBreakpoints = [...breakpoints];
                        newBreakpoints.splice(bestGapIndex + 1, 0, clampedValue);

                        const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                        return { ...prev, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: newRanges } } } as RiskAssessmentConfig;
                      });
                    }} disabled={isStandard || ((): boolean => { const bps = getBreakpointsFromRanges(cfg.residualRisk.thresholds.ranges || []); for (let i = 0; i < bps.length - 1; i++) { if (bps[i + 1] - bps[i] > 1) return false; } return true; })()}>Add Breakpoint</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      ) : (
        <Card>
          <CardHeader><CardTitle>Assignment Applicability</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-3">Assignment</th>
                    <th className="px-2 py-3">Assignment Type / Scope</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-2 py-3 w-1/3">
                      <Select value={selectedAssignmentId || ''} onValueChange={(v:any) => {
                        setSelectedAssignmentId(v);
                        const curMap = (cfg.scope as any).assignmentMap || {};
                        curMap[v] = curMap[v] || { enabled: true, projectId: undefined, mode: 'assignment' };
                        setCfg({ ...cfg, scope: { ...cfg.scope, assignmentMap: curMap } });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                        <SelectContent>
                          {assignmentTypes.map(opt => (<SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-3 w-2/3 flex items-center gap-3">
                      <Select value={selectedMode || '_select'} onValueChange={(v:any) => {
                        const raw = v as string;
                        const mode = raw === '_select' ? '' : (raw as 'assignment'|'project');
                        setSelectedMode(raw === '_select' ? '_select' : (raw as any));
                        if (!selectedAssignmentId) return;
                        const cur = (cfg.scope && (cfg.scope as any).assignmentMap) || {};
                        const next = { ...cur, [selectedAssignmentId]: { enabled: mode !== '', projectId: cur[selectedAssignmentId]?.projectId, mode: mode === '' ? undefined : mode } };
                        setCfg({ ...cfg, scope: { ...cfg.scope, assignmentMap: next } });
                        if (mode === 'assignment') {
                          const id = `assignment|${selectedAssignmentId}`;
                          const existing = RiskConfigStore.get(id);
                          if (existing) setCfg(prev => ({ ...existing, enabled: prev?.enabled } as RiskAssessmentConfig));
                          else {
                            const base = RiskConfigStore.getGlobal();
                            setCfg(prev => ({ ...base, enabled: prev?.enabled, id, scope: { ...base.scope, configType: 'assignment', assignmentType: selectedAssignmentId } } as RiskAssessmentConfig));
                          }
                          setEditingAssignmentId(selectedAssignmentId);
                        } else {
                          setEditingAssignmentId(null);
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select scope" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_select">Select</SelectItem>
                          <SelectItem value="assignment">Assignment type</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {scopeType !== 'global' && editingAssignmentId && (
        <div className="mt-4">
          <Tabs defaultValue="risk" className="space-y-4">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="risk">Risk Score</TabsTrigger>
              <TabsTrigger value="control">Control Score</TabsTrigger>
              <TabsTrigger value="residual">Rating Definition</TabsTrigger>
            </TabsList>

            <TabsContent value="risk">
            <Card>
              <CardHeader><CardTitle>Risk Score Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Risk Scoring Model</Label>
                    <Select value={cfg.riskScoringModel || 'flexible'} onValueChange={(v:any)=>{
                      if (v === 'standard') {
                        setCfg(prev => ({
                          ...prev,
                          riskScoringModel: 'standard',
                          riskScore: { ...prev.riskScore, mode: 'likelihood_consequence', scale: { min: 1, max: 25 }, likelihood: { ...(prev.riskScore.likelihood||{}), scale: { min:1, max:5 } }, consequence: { ...(prev.riskScore.consequence||{}), scale: { min:1, max:5 } } },
                          controlScore: { ...prev.controlScore, scale: { min:1, max:5 } },
                          residualRisk: { ...prev.residualRisk, formula: 'risk_times_one_minus_control_pct' }
                        } as RiskAssessmentConfig));
                      } else {
                        setCfg(prev => ({ ...prev, riskScoringModel: 'flexible' } as RiskAssessmentConfig));
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Scale model</SelectItem>
                        <SelectItem value="flexible">Flexible Model</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Calculation Mode</Label>
                    <Select value={cfg.riskScore.mode} onValueChange={(v:any)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, mode: v } })} disabled={isStandard}>
                      <SelectTrigger><SelectValue placeholder="Select mode"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single Value (manual)</SelectItem>
                        <SelectItem value="likelihood_consequence">Likelihood × Consequence</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {mode === 'single' ? (
                    <div className="md:col-span-1">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Label>Risk Scale Min</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.scale.min} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => { const riskMin = val; const riskMax = prev.riskScore.scale.max; const control = { ...prev.controlScore, scale: { min: clamp(prev.controlScore.scale.min, riskMin, riskMax), max: clamp(prev.controlScore.scale.max, riskMin, riskMax) } }; const residualThresholds = (prev.residualRisk.thresholds.ranges||[]).map(r=>({ ...r, from: clamp(r.from, riskMin, riskMax), to: clamp(r.to, riskMin, riskMax) })); return { ...prev, riskScore: { ...prev.riskScore, scale: { ...prev.riskScore.scale, min: val } }, controlScore: control, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: residualThresholds } } } as RiskAssessmentConfig }) }} disabled={isStandard} />
                        </div>
                        <div className="flex-1">
                          <Label>Risk Scale Max</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.scale.max} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => { const riskMin = prev.riskScore.scale.min; const riskMax = val; const control = { ...prev.controlScore, scale: { min: clamp(prev.controlScore.scale.min, riskMin, riskMax), max: clamp(prev.controlScore.scale.max, riskMin, riskMax) } }; const residualThresholds = (prev.residualRisk.thresholds.ranges||[]).map(r=>({ ...r, from: clamp(r.from, riskMin, riskMax), to: clamp(r.to, riskMin, riskMax) })); return { ...prev, riskScore: { ...prev.riskScore, scale: { ...prev.riskScore.scale, max: val } }, controlScore: control, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: residualThresholds } } } as RiskAssessmentConfig }) }} disabled={isStandard} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {mode === 'likelihood_consequence' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h3 className="font-medium">Likelihood Scale</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>Min</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.likelihood?.scale.min || 1} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, likelihood: { ...(cfg.riskScore.likelihood||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.likelihood?.scale||{min:1,max:5}), min: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                        <div>
                          <Label>Max</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.likelihood?.scale.max || 5} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, likelihood: { ...(cfg.riskScore.likelihood||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.likelihood?.scale||{min:1,max:5}), max: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium">Consequence Scale</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>Min</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.consequence?.scale.min || 1} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, consequence: { ...(cfg.riskScore.consequence||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.consequence?.scale||{min:1,max:5}), min: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                        <div>
                          <Label>Max</Label>
                          <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.riskScore.consequence?.scale.max || 5} onChange={(e)=> setCfg({ ...cfg, riskScore: { ...cfg.riskScore, consequence: { ...(cfg.riskScore.consequence||{ scale:{min:1,max:5}, labels:[]}), scale: { ...(cfg.riskScore.consequence?.scale||{min:1,max:5}), max: Math.round(Number(e.target.value)) } } } })} disabled={isStandard} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

            <TabsContent value="control">
            <Card>
              <CardHeader><CardTitle>Control Score Configuration</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Control Scale Min</Label>
                  <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.controlScore.scale.min} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => ({ ...prev, controlScore: { ...prev.controlScore, scale: { ...prev.controlScore.scale, min: clamp(val, prev.riskScore.scale.min, prev.riskScore.scale.max) } } } as RiskAssessmentConfig)); }} disabled={isStandard} />
                </div>
                <div>
                  <Label>Control Scale Max</Label>
                  <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} value={cfg.controlScore.scale.max} onChange={(e)=>{ const val = Math.round(Number(e.target.value)); setCfg(prev => ({ ...prev, controlScore: { ...prev.controlScore, scale: { ...prev.controlScore.scale, max: clamp(val, prev.riskScore.scale.min, prev.riskScore.scale.max) } } } as RiskAssessmentConfig)); }} disabled={isStandard} />
                </div>
                <div>
                  <Label>Constraint</Label>
                  <p>Control Score ≤ Risk Score </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

            <TabsContent value="residual">
              <Card>
                <CardHeader><CardTitle>Rating Definition</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Parameters</Label>
                      <Select value={cfg.residualRisk.parameter || 'residualRisk'} onValueChange={(v:any)=> setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, parameter: v } })}>
                        <SelectTrigger><SelectValue placeholder="Select parameter"/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="likelihood">Likelihood</SelectItem>
                          <SelectItem value="consequence">Consequence</SelectItem>
                          <SelectItem value="riskScore">Risk Score</SelectItem>
                          <SelectItem value="controlScore">Control Score</SelectItem>
                          <SelectItem value="residualRisk">Residual Risk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium">Threshold Ranges</h3>
                    <div className="space-y-2">
                      {(() => {
                        const ranges = cfg.residualRisk.thresholds.ranges || [];
                        const breakpoints = getBreakpointsFromRanges(ranges);

                        return breakpoints.length > 0 ? breakpoints.map((breakpoint, idx) => {
                          const isLast = idx === breakpoints.length - 1;
                          const range = ranges[idx];
                          const displayRange = !isLast && range ? calculateDisplayRange(range.from, range.to) : '';
                          const hasError = breakpointErrors[idx];

                          return (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                              <div>
                              <Label>Breakpoint {(idx === 0 || idx === breakpoints.length - 1) && <span className="text-xs text-gray-500">(fixed)</span>}</Label>
                              <Input
                                  type="number"
                                  value={breakpoint}
                                  onChange={(e) => {
                                    const raw = Math.round(Number(e.target.value));
                                    const newBreakpoints = [...breakpoints];
                                    newBreakpoints[idx] = raw;
                                    const paramMin = getParameterMin();
                                    const paramMax = getParameterMax();
                                    const errors = validateBreakpoints(newBreakpoints, paramMin, paramMax);
                                    setBreakpointErrors(errors);

                                    if (!errors[idx]) {
                                      const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                                      setCfg(prev => ({
                                        ...prev,
                                        residualRisk: {
                                          ...prev.residualRisk,
                                          thresholds: {
                                            ...prev.residualRisk.thresholds,
                                            ranges: newRanges
                                          }
                                        }
                                      } as RiskAssessmentConfig));
                                    }
                                  }}
                                  disabled={isStandard || idx === 0 || idx === breakpoints.length - 1}
                                className={hasError ? 'border-red-500' : ''}
                                />
                                {hasError && <div className="text-xs text-red-500 mt-1">{hasError}</div>}
                              </div>

                              {!isLast && (
                                <>
                                  <div>
                                    <Label>Range</Label>
                                    <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 text-sm flex items-center">
                                      {displayRange}
                                    </div>
                                  </div>

                                  <div className="md:col-span-2">
                                    <Label>Label</Label>
                                    <Input
                                      value={range?.label || ''}
                                      onChange={(e) => {
                                        const newRanges = [...ranges];
                                        if (newRanges[idx]) {
                                          newRanges[idx] = { ...newRanges[idx], label: e.target.value };
                                          setCfg({
                                            ...cfg,
                                            residualRisk: {
                                              ...cfg.residualRisk,
                                              thresholds: {
                                                ...cfg.residualRisk.thresholds,
                                                ranges: newRanges
                                              }
                                            }
                                          });
                                        }
                                      }}
                                      disabled={isStandard}
                                    />
                                  </div>

                                  <div className="md:col-span-1 relative">
                                    <Label>Color</Label>
                                    <div className="flex items-center gap-2">
                                      <button type="button" className="h-6 w-6 rounded border" style={{ backgroundColor: range?.color || '#ffffff' }} aria-label="color preview" disabled={isStandard} />
                                      <Button size="sm" onClick={() => setOpenColorPickerFor(idx)} disabled={isStandard}>Choose color</Button>
                                    </div>

                                    {openColorPickerFor === idx && (
                                      <div className="absolute z-50 right-0 bottom-full mb-2 p-3 bg-white rounded border shadow-lg w-64">
                                        <div className="space-y-3">
                                          <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Theme Colors</h4>
                                            <div className="grid grid-cols-10 gap-1">
                                              {['#000000','#FFFFFF','#1F2937','#4B5563','#2563EB','#F97316','#EF4444','#10B981','#F59E0B','#8B5CF6'].map(c => (
                                                <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                  const newRanges = [...ranges];
                                                  if (newRanges[idx]) {
                                                    newRanges[idx] = { ...newRanges[idx], color: c };
                                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                  }
                                                  setOpenColorPickerFor(null);
                                                }} />
                                              ))}
                                            </div>
                                            <div className="grid grid-cols-10 gap-1 mt-1">
                                              {['#F3F4F6','#E5E7EB','#9CA3AF','#6B7280','#DBEAFE','#FED7AA','#FECACA','#D1FAE5','#FEF3C7','#E9D5FF'].map(c => (
                                                <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                  const newRanges = [...ranges];
                                                  if (newRanges[idx]) {
                                                    newRanges[idx] = { ...newRanges[idx], color: c };
                                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                  }
                                                  setOpenColorPickerFor(null);
                                                }} />
                                              ))}
                                            </div>
                                            <div className="grid grid-cols-10 gap-1 mt-1">
                                              {['#D1D5DB','#B3B6BB','#7B8392','#4B5563','#93C5FD','#FDBA74','#F87171','#6EE7B7','#FDE047','#C4B5FD'].map(c => (
                                                <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                  const newRanges = [...ranges];
                                                  if (newRanges[idx]) {
                                                    newRanges[idx] = { ...newRanges[idx], color: c };
                                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                  }
                                                  setOpenColorPickerFor(null);
                                                }} />
                                              ))}
                                            </div>
                                            <div className="grid grid-cols-10 gap-1 mt-1">
                                              {['#9B9B9B','#8A8A8A','#5E6B73','#374151','#3B82F6','#EA580C','#DC2626','#059669','#D97706','#7C3AED'].map(c => (
                                                <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                  const newRanges = [...ranges];
                                                  if (newRanges[idx]) {
                                                    newRanges[idx] = { ...newRanges[idx], color: c };
                                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                  }
                                                  setOpenColorPickerFor(null);
                                                }} />
                                              ))}
                                            </div>
                                            <div className="grid grid-cols-10 gap-1 mt-1">
                                              {['#6B7280','#5B5B5B','#44525A','#1F2937','#1D4ED8','#C2410C','#B91C1C','#047857','#B45309','#5B21B6'].map(c => (
                                                <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                  const newRanges = [...ranges];
                                                  if (newRanges[idx]) {
                                                    newRanges[idx] = { ...newRanges[idx], color: c };
                                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                  }
                                                  setOpenColorPickerFor(null);
                                                }} />
                                              ))}
                                            </div>
                                          </div>

                                          <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Standard Colors</h4>
                                            <div className="grid grid-cols-10 gap-1">
                                              {['#C53030','#DD6B20','#D69E2E','#38A169','#00B5D8','#3182CE','#553C9A','#805AD5','#D53F8C','#E53E3E'].map(c => (
                                                <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                                  const newRanges = [...ranges];
                                                  if (newRanges[idx]) {
                                                    newRanges[idx] = { ...newRanges[idx], color: c };
                                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                                  }
                                                  setOpenColorPickerFor(null);
                                                }} />
                                              ))}
                                            </div>
                                          </div>

                                          <div className="border-t pt-2">
                                            <Input placeholder="Custom color (#rrggbb)" value={range?.color || ''} onChange={(e) => {
                                              const newRanges = [...ranges];
                                              if (newRanges[idx]) {
                                                newRanges[idx] = { ...newRanges[idx], color: e.target.value };
                                                setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                              }
                                            }} className="text-xs" />
                                          </div>
                                        </div>
                                        <div className="flex justify-end mt-3 pt-2 border-t">
                                          <Button size="sm" variant="ghost" onClick={() => setOpenColorPickerFor(null)}>Close</Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="md:col-span-1">
                                  <Button variant="outline" onClick={() => {
                                    // Don't allow removing first or last breakpoint (min/max)
                                    if (idx === 0 || idx === breakpoints.length - 1) return;
                                    const newBreakpoints = breakpoints.filter((_, i) => i !== idx);
                                    const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                    setBreakpointErrors([]);
                                  }} disabled={isStandard || idx === 0 || idx === breakpoints.length - 1}>Remove</Button>
                                </div>
                                </>
                              )}
                            </div>
                          );
                        }) : <div className="text-sm text-gray-500">No breakpoints defined</div>;
                      })()}
                    </div>
                    <div>
                    <Button size="sm" onClick={() => {
                      setCfg(prev => {
                        const ranges = prev.residualRisk.thresholds.ranges || [];
                        const breakpoints = getBreakpointsFromRanges(ranges);
                        const paramMin = getParameterMin();
                        const paramMax = getParameterMax();

                        // Find the largest gap between consecutive breakpoints to insert new one
                        let bestGapIndex = 0;
                        let bestGapSize = 0;
                        for (let i = 0; i < breakpoints.length - 1; i++) {
                          const gap = breakpoints[i + 1] - breakpoints[i];
                          if (gap > bestGapSize && gap > 1) {
                            bestGapSize = gap;
                            bestGapIndex = i;
                          }
                        }

                        // If no gap found or all gaps are size 1, can't add more breakpoints
                        if (bestGapSize <= 1) return prev;

                        // Insert new breakpoint in the middle of the best gap and clamp within allowed range
                        const newValue = Math.floor((breakpoints[bestGapIndex] + breakpoints[bestGapIndex + 1]) / 2);
                        const clampedValue = Math.min(Math.max(newValue, paramMin + 1), paramMax - 1);
                        const newBreakpoints = [...breakpoints];
                        newBreakpoints.splice(bestGapIndex + 1, 0, clampedValue);

                        const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                        return { ...prev, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: newRanges } } } as RiskAssessmentConfig;
                      });
                    }} disabled={isStandard || ((): boolean => { const bps = getBreakpointsFromRanges(cfg.residualRisk.thresholds.ranges || []); for (let i = 0; i < bps.length - 1; i++) { if (bps[i + 1] - bps[i] > 1) return false; } return true; })()}>Add Breakpoint</Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      )}

      </>
      )}

      <div className="flex justify-end">
        <Button onClick={onSave}>Save Settings</Button>
      </div>

      {/* Preview */}
      <Card className="relative">
        <CardHeader><CardTitle>Know how it works</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          {mode === 'likelihood_consequence' && (
            <>
              <div>
                <Label>Likelihood</Label>
                <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} defaultValue={cfg.riskScore.likelihood?.scale.min || 1} id="prevL" />
              </div>
              <div>
                <Label>Consequence</Label>
                <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} defaultValue={cfg.riskScore.consequence?.scale.min || 1} id="prevC" />
              </div>
            </>
          )}
          {mode === 'single' && (
            <div className="md:col-span-2">
              <Label>Risk Score</Label>
              <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} defaultValue={cfg.riskScore.scale.min} id="prevR" />
            </div>
          )}
          <div>
            <Label>Control Score</Label>
            <Input type="number" step={1} onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }} defaultValue={cfg.controlScore.scale.min} id="prevCS" />
          </div>
          <div className="md:col-span-2">
            <Button variant="outline" onClick={() => {
              const l = Number((document.getElementById('prevL') as HTMLInputElement)?.value || 0);
              const c = Number((document.getElementById('prevC') as HTMLInputElement)?.value || 0);
              const rManual = Number((document.getElementById('prevR') as HTMLInputElement)?.value || 0);
              const cs = Number((document.getElementById('prevCS') as HTMLInputElement)?.value || 0);
              const riskScore = computeRiskScore(mode, l, c, rManual);
              const resid = computeResidual(cfg.residualRisk.formula, riskScore, cs, cfg.controlScore.scale);

              const inherentFormula = mode === 'single'
                ? `${cfg.naming.riskDisplayName} (manual) = ${rManual}`
                : `${cfg.naming.riskDisplayName} = Likelihood × Impact = ${l} × ${c} = ${riskScore}`;

              const displayResidualLabel = cfg.naming.residualDisplayName === 'Net Risk' ? 'Residual Risk' : cfg.naming.residualDisplayName;

              let residualFormulaText = '';
              if (cfg.residualRisk.formula === 'risk_times_control') {
                residualFormulaText = `${displayResidualLabel} = Risk × Control Score = ${riskScore} × ${cs} = ${resid}`;
              } else {
                const csPct = cfg.controlScore.scale.max > cfg.controlScore.scale.min ? ((cs - cfg.controlScore.scale.min) / (cfg.controlScore.scale.max - cfg.controlScore.scale.min)) : 0;
                residualFormulaText = `${displayResidualLabel} = Risk × (1 − Control%) = ${riskScore} × (1 − ${csPct.toFixed(2)}) = ${resid}`;
              }

              const final = `${inherentFormula}\n${residualFormulaText}\n\nFormulas used:\n- Inherent Risk = Likelihood × Impact\n- Residual Risk = ${cfg.residualRisk.formula === 'risk_times_control' ? 'Risk × Control Score' : 'Risk × (1 − Control%)'}`;
              setPreviewText(final);
              setPreviewDialogOpen(true);
            }}>How Scoring works</Button>
          </div>

          {/* info button */}
          <div className="absolute right-3 bottom-3">
            <Button variant="ghost" aria-label="Likelihood info" onClick={()=>setInfoDialogOpen(true)} className="inline-flex items-center justify-center h-9 w-9 rounded-full border bg-white text-sm font-medium shadow-sm">
              <Info className="h-4 w-4 text-slate-700" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculation Result</DialogTitle>
            <DialogDescription>Shows the calculated inherent and residual (net) risk with formulas.</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm mt-2"><p>{previewText}</p></div>
          <DialogFooter>
            <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info dialog for Likelihood rating */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Likelihood Rating (Probability of Occurrence)</DialogTitle>
            <DialogDescription>Likelihood expresses how often a risk event is expected to occur. Below is a global reference using a 1–5 scale.</DialogDescription>
          </DialogHeader>
          <div className="text-sm mt-2 space-y-4 overflow-y-auto flex-grow pr-2">
            <h3 className="font-semibold">📊 Risk Scoring in Risk Assessment</h3>
            <p>This guide explains how risk scores are derived using Likelihood, Consequence (Impact), and Control Effectiveness, helping you apply risk assessment consistently.</p>

            <h4 className="font-semibold">1��⃣ Likelihood (Probability of Occurrence)</h4>
            <p><strong>Definition:</strong> How often a risk event is expected to occur.<br/>Scale can be 1–5, 1–10, or % ranges.</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left">Rating</th>
                  <th className="text-left">Descriptor</th>
                  <th className="text-left">Qualitative Definition</th>
                  <th className="text-left">Quantitative Benchmark</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1</td><td>Rare</td><td>May occur only in exceptional circumstances</td><td>Once in 10+ years, &lt;5%</td></tr>
                <tr><td>2</td><td>Unlikely</td><td>Could occur, but not expected</td><td>Once in 5–10 years, 5–20%</td></tr>
                <tr><td>3</td><td>Possible</td><td>Might occur at some time</td><td>Once in 2–5 years, 21–50%</td></tr>
                <tr><td>4</td><td>Likely</td><td>Will probably occur in most circumstances</td><td>Annually or every 1–2 years, 51–80%</td></tr>
                <tr><td>5</td><td>Almost Certain</td><td>Expected to occur frequently</td><td>More than once a year, &gt;80%</td></tr>
              </tbody>
            </table>
            <div className="font-semibold">🔑 Tip:</div>
            <div>If using a 1–10 scale, divide probability bands into finer increments (e.g., 10% each).</div>

            <h4 className="font-semibold">2️⃣ Consequence (Impact)</h4>
            <p><strong>Definition:</strong> Measures severity of the effect if the risk occurs. Impacts may be financial, operational, compliance, reputational, or safety-related.</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left">Rating</th>
                  <th className="text-left">Descriptor</th>
                  <th className="text-left">Financial Impact (example)</th>
                  <th className="text-left">Operational Impact</th>
                  <th className="text-left">Compliance / Legal</th>
                  <th className="text-left">Reputational Impact</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1</td><td>Insignificant</td><td>&lt;0.5% of revenue</td><td>Minimal disruption (&lt;1 day)</td><td>No legal issues</td><td>No stakeholder concern</td></tr>
                <tr><td>2</td><td>Minor</td><td>0.5–2% of revenue</td><td>Short-term disruption (&lt;1 week)</td><td>Minor breach, no fine</td><td>Localized concern</td></tr>
                <tr><td>3</td><td>Moderate</td><td>2–5% of revenue</td><td>Medium disruption (1–4 weeks)</td><td>Regulatory warning/fine</td><td>Negative local press</td></tr>
                <tr><td>4</td><td>Major</td><td>5–10% of revenue</td><td>Long-term disruption (1–3 months)</td><td>Major fine/sanction</td><td>National media coverage</td></tr>
                <tr><td>5</td><td>Severe / Catastrophic</td><td>&gt;10% of revenue</td><td>Shutdown (&gt;3 months)</td><td>License revoked / litigation</td><td>Global reputation damage</td></tr>
              </tbody>
            </table>
            <div className="font-semibold">🔑 Tip:</div>
            <div>Define thresholds in absolute terms or % of revenue, depending on organization size.</div>

            <h4 className="font-semibold">3️⃣ Control Score (Effectiveness)</h4>
            <p><strong>Definition:</strong> Effectiveness of existing controls in preventing, detecting, or correcting a risk.</p>
            <p className="font-semibold">Control Dimensions &amp; Weights</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left">Dimension</th>
                  <th className="text-left">Weight %</th>
                  <th className="text-left">Key Question</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Design</td><td>30%</td><td>Is the control well-designed to mitigate the risk?</td></tr>
                <tr><td>Implementation</td><td>40%</td><td>Is it consistently applied and reliable?</td></tr>
                <tr><td>Coverage</td><td>15%</td><td>Does it cover the full risk universe?</td></tr>
                <tr><td>Monitoring &amp; Review</td><td>15%</td><td>Is it reviewed and improved regularly?</td></tr>
              </tbody>
            </table>
            <p className="font-semibold">Control Rating Guidelines</p>
            <div className="space-y-2">
              <div><strong>Design (30%)</strong>
                <div>1: No design / ineffective</div>
                <div>2: Weak, mostly manual</div>
                <div>3: Moderate, partial coverage</div>
                <div>4: Good, covers most risks</div>
                <div>5: Excellent, automated &amp; preventive</div>
              </div>
              <div><strong>Implementation (40%)</strong>
                <div>1: Not implemented / fails</div>
                <div>2: Inconsistent, error-prone</div>
                <div>3: Works sometimes, gaps exist</div>
                <div>4: Consistent, minor exceptions</div>
                <div>5: Fully embedded, reliable</div>
              </div>
              <div><strong>Coverage (15%)</strong>
                <div>1: &lt;20% coverage</div>
                <div>2: 20–50% coverage</div>
                <div>3: 50–75% coverage</div>
                <div>4: 75–90% coverage</div>
                <div>5: &gt;90% coverage</div>
              </div>
              <div><strong>Monitoring &amp; Review (15%)</strong>
                <div>1: None</div>
                <div>2: Ad hoc / informal</div>
                <div>3: Periodic but limited</div>
                <div>4: Structured &amp; documented</div>
                <div>5: Continuous, automated alerts</div>
              </div>
            </div>

            <h4 className="font-semibold">4️⃣ Integrated Risk Assessment Methodology</h4>
            <p><strong>Step 1: Inherent Risk (Before Controls)</strong></p>
            <p>Inherent Risk Score (IRS) = Likelihood (L) × Consequence (C)</p>

            <p><strong>Step 2: Control Effectiveness</strong></p>
            <p>Weighted average of 4 dimensions.</p>
            <p>Control Score (CS) = (∑ (Dimension Rating × Weight)) / Max Scale</p>
            <p>Control Effectiveness (CE) = CS / Max Scale</p>

            <p><strong>Step 3: Residual Risk</strong></p>
            <p>Residual Risk = Inherent Risk Score × (1 − CE)</p>

            <h4 className="font-semibold">5️⃣ Examples</h4>
            <p><strong>Example 1: Operational Risk – Data Breach</strong></p>
            <p>Likelihood = 4/5, Consequence = 5/5 → IRS = 4 × 5 = 20 (High)</p>
            <p>Control Score: Design=4 (1.2), Implementation=3 (1.2), Coverage=3 (0.45), Monitoring=2 (0.30) → Total = 3.15/5 → 63% effective</p>
            <p>Residual Risk: 20 × (1 − 0.63) = 7.4 (Moderate)</p>

            <p><strong>Example 2: Strategic Risk – Supply Chain Disruption</strong></p>
            <p>Likelihood = 3/5, Consequence = 4/5 → IRS = 3 × 4 = 12 (Medium-High)</p>
            <p>Control Score: Design=5 (1.5), Implementation=4 (1.6), Coverage=4 (0.6), Monitoring=4 (0.6) → Total = 4.3/5 → 86% effective</p>
            <p>Residual Risk: 12 �� (1 − 0.86) = 1.7 (Low)</p>

            <h4 className="font-semibold">6️⃣ Summary Flow</h4>
            <p>Rate Likelihood &amp; Consequence → Inherent Risk Score<br/>Rate Controls → Control Score &amp; Effectiveness<br/>Apply formula → Residual Risk<br/>Visualize on Heatmaps → Reporting &amp; Decision-making</p>
          </div>
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
