import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RiskAssessmentConfig, RiskCalcMode, RiskScoringModel, clamp } from '@shared/risk';

interface Props {
  value: RiskAssessmentConfig;
  onChange: (cfg: RiskAssessmentConfig) => void;
}

export default function ProjectRiskAssessmentForm({ value, onChange }: Props) {
  const [cfg, setCfg] = React.useState<RiskAssessmentConfig>(value);
  const [openColorPickerFor, setOpenColorPickerFor] = React.useState<number | null>(null);
  const [breakpointErrors, setBreakpointErrors] = React.useState<string[]>([]);

  React.useEffect(() => { setCfg(value); }, [value]);
  React.useEffect(() => { onChange(cfg); }, [cfg]);

  const mode = cfg.riskScore.mode as RiskCalcMode;
  const isStandard = cfg.riskScoringModel === 'standard';

  const getBreakpointsFromRanges = (ranges: any[]): number[] => {
    if (ranges.length === 0) return [];
    const breakpoints = [ranges[0].from];
    ranges.forEach(r => breakpoints.push(r.to));
    return breakpoints;
  };

  const getRangesFromBreakpoints = (breakpoints: number[], existingRanges: any[]): any[] => {
    if (breakpoints.length < 2) return [];
    const ranges = [] as any[];
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const from = breakpoints[i];
      const to = breakpoints[i + 1];
      const existingRange = existingRanges[i];
      ranges.push({ from, to, label: existingRange?.label || `Level ${i + 1}`, color: existingRange?.color || 'Grey' });
    }
    return ranges;
  };

  const calculateDisplayRange = (from: number, to: number): string => `${from}–${to}`;

  const getParameterMin = (): number => {
    const p = cfg.residualRisk?.parameter || 'residualRisk';
    if (p === 'likelihood') return cfg.riskScore?.likelihood?.scale?.min ?? cfg.riskScore?.scale?.min ?? 1;
    if (p === 'consequence') return cfg.riskScore?.consequence?.scale?.min ?? cfg.riskScore?.scale?.min ?? 1;
    if (p === 'controlScore') return cfg.controlScore?.scale?.min ?? 1;
    if (p === 'riskScore') return cfg.riskScore?.scale?.min ?? 1;
    // residualRisk defaults to risk score scale
    return cfg.riskScore?.scale?.min ?? 1;
  };

  const getParameterMax = (): number => {
    const p = cfg.residualRisk?.parameter || 'residualRisk';
    if (p === 'likelihood') return cfg.riskScore?.likelihood?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
    if (p === 'consequence') return cfg.riskScore?.consequence?.scale?.max ?? cfg.riskScore?.scale?.max ?? 5;
    if (p === 'controlScore') return cfg.controlScore?.scale?.max ?? 5;
    // for riskScore and residualRisk, use the derived riskScore scale (synced to L×C below)
    return cfg.riskScore?.scale?.max ?? 25;
  };

  const validateBreakpoints = (breakpoints: number[], paramMin?: number, paramMax?: number): string[] => {
    const errors: string[] = [];
    const min = typeof paramMin === 'number' ? paramMin : getParameterMin();
    const max = typeof paramMax === 'number' ? paramMax : getParameterMax();

    if (breakpoints.length < 2) return ['At least two breakpoints required'];

    // first and last fixed
    if (breakpoints[0] !== min) errors[0] = `First breakpoint must be ${min}`;
    if (breakpoints[breakpoints.length - 1] !== max) errors[breakpoints.length - 1] = `Last breakpoint must be ${max}`;

    for (let i = 0; i < breakpoints.length; i++) {
      const v = Math.round(Number(breakpoints[i]));
      if (Number.isNaN(v)) { errors[i] = 'Invalid number'; continue; }
      if (v < min || v > max) errors[i] = `Value must be between ${min} and ${max}`;
      if (i > 0 && v <= breakpoints[i - 1]) errors[i] = 'Must be strictly ascending';
    }
    return errors;
  };

  // Keep riskScore.scale in sync with product of Likelihood × Consequence when in L×C mode
  React.useEffect(() => {
    if (cfg.riskScore.mode !== 'likelihood_consequence') return;
    const l = cfg.riskScore.likelihood?.scale;
    const c = cfg.riskScore.consequence?.scale;
    if (!l || !c) return;
    const derivedMin = Math.round(l.min) * Math.round(c.min);
    const derivedMax = Math.round(l.max) * Math.round(c.max);
    if (cfg.riskScore.scale.min === derivedMin && cfg.riskScore.scale.max === derivedMax) return;
    setCfg(prev => {
      const newMin = derivedMin; const newMax = derivedMax;
      const control = { ...prev.controlScore, scale: { min: clamp(prev.controlScore.scale.min, newMin, newMax), max: clamp(prev.controlScore.scale.max, newMin, newMax) } };
      const param = prev.residualRisk?.parameter || 'residualRisk';
      let residual = prev.residualRisk;
      if (param === 'riskScore' || param === 'residualRisk') {
        const ranges = prev.residualRisk.thresholds.ranges || [];
        const adjRanges = ranges.map(r => ({ from: clamp(Math.round(r.from), newMin, newMax), to: clamp(Math.round(r.to), newMin, newMax), label: r.label, color: r.color }));
        residual = { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: adjRanges } };
      }
      return { ...prev, riskScore: { ...prev.riskScore, scale: { min: newMin, max: newMax } }, controlScore: control, residualRisk: residual } as RiskAssessmentConfig;
    });
  }, [cfg.riskScore.mode, cfg.riskScore.likelihood?.scale, cfg.riskScore.consequence?.scale]);

  // Clamp breakpoints when parameter changes or relevant scales change
  React.useEffect(() => {
    const param = cfg.residualRisk?.parameter || 'residualRisk';
    const ranges = cfg.residualRisk.thresholds.ranges || [];
    if (!ranges.length) return;

    // Calculate parameter-specific min/max without using getParameterMin/Max to avoid circular dependency
    let min: number, max: number;
    if (param === 'likelihood') {
      min = cfg.riskScore?.likelihood?.scale?.min ?? 1;
      max = cfg.riskScore?.likelihood?.scale?.max ?? 5;
    } else if (param === 'consequence') {
      min = cfg.riskScore?.consequence?.scale?.min ?? 1;
      max = cfg.riskScore?.consequence?.scale?.max ?? 5;
    } else if (param === 'controlScore') {
      min = cfg.controlScore?.scale?.min ?? 1;
      max = cfg.controlScore?.scale?.max ?? 5;
    } else {
      // riskScore or residualRisk
      min = cfg.riskScore?.scale?.min ?? 1;
      max = cfg.riskScore?.scale?.max ?? 25;
    }

    const current = getBreakpointsFromRanges(ranges);
    if (current.length === 0) return;

    // Check if adjustment is needed
    const needsAdjustment = current[0] !== min || current[current.length - 1] !== max ||
      current.some((v, i) => i > 0 && i < current.length - 1 && (v < min + 1 || v > max - 1 || (i > 0 && v <= current[i - 1])));

    if (!needsAdjustment) return;

    setCfg(prev => {
      const next = [...current];
      next[0] = min;
      next[next.length - 1] = max;

      for (let i = 1; i < next.length - 1; i++) {
        next[i] = Math.min(Math.max(Math.round(next[i]), min + 1), max - 1);
        if (next[i] <= next[i - 1]) next[i] = next[i - 1] + 1;
        if (i + 1 < next.length && next[i] >= next[i + 1]) next[i] = Math.max(next[i + 1] - 1, min + 1);
      }

      const errs = validateBreakpoints(next, min, max);
      setBreakpointErrors(errs);
      const newRanges = getRangesFromBreakpoints(next, ranges);
      return { ...prev, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: newRanges } } } as RiskAssessmentConfig;
    });
  }, [cfg.residualRisk.parameter, cfg.riskScore.likelihood?.scale?.min, cfg.riskScore.likelihood?.scale?.max, cfg.riskScore.consequence?.scale?.min, cfg.riskScore.consequence?.scale?.max, cfg.controlScore.scale.min, cfg.controlScore.scale.max, cfg.riskScore.scale.min, cfg.riskScore.scale.max]);

  return (
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
                      riskScoringModel: 'standard' as RiskScoringModel,
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
                                  residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: newRanges } }
                                } as RiskAssessmentConfig));
                              }
                            }}
                            onKeyDown={(e) => { if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') { e.preventDefault(); } }}
                            step={1}
                            disabled={isStandard || idx === 0 || idx === breakpoints.length - 1}
                            className={hasError ? 'border-red-500' : ''}
                          />
                          {hasError && <div className="text-xs text-red-500 mt-1">{hasError}</div>}
                        </div>

                        {!isLast && (
                          <>
                            <div>
                              <Label>Range</Label>
                              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 text-sm flex items-center">{displayRange}</div>
                            </div>

                            <div className="md:col-span-2">
                              <Label>Label</Label>
                              <Input
                                value={range?.label || ''}
                                onChange={(e) => {
                                  const newRanges = [...ranges];
                                  if (newRanges[idx]) {
                                    newRanges[idx] = { ...newRanges[idx], label: e.target.value };
                                    setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                  }
                                }}
                                step={1}
                              />
                            </div>

                            <div className="md:col-span-1 relative">
                              <Label>Color</Label>
                              <div className="flex items-center gap-2">
                                <button type="button" className="h-6 w-6 rounded border" style={{ backgroundColor: range?.color || '#ffffff' }} aria-label="color preview" />
                                <Button size="sm" onClick={() => setOpenColorPickerFor(idx)}>Choose color</Button>
                              </div>

                              {openColorPickerFor === idx && (
                                <div className="absolute z-50 right-0 bottom_full mb-2 p-3 bg-white rounded border shadow-lg w-64">
                                  <div className="space-y-3">
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-700 mb-2">Theme Colors</h4>
                                      <div className="grid grid-cols-10 gap-1">
                                        {['#000000','#FFFFFF','#1F2937','#4B5563','#2563EB','#F97316','#EF4444','#10B981','#F59E0B','#8B5CF6'].map(c => (
                                          <button key={c} type="button" title={c} className={"h-5 w-5 rounded border border-gray-300 " + (range?.color === c ? 'ring-2 ring-blue-500' : '')} style={{ backgroundColor: c }} onClick={() => {
                                            const newRanges = [...ranges];
                                            if (newRanges[idx]) { newRanges[idx] = { ...newRanges[idx], color: c }; setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } }); }
                                            setOpenColorPickerFor(null);
                                          }} />
                                        ))}
                                      </div>
                                    </div>
                                    <div className="border-t pt-2">
                                      <Input placeholder="Custom color (#rrggbb)" value={range?.color || ''} onChange={(e) => {
                                        const newRanges = [...ranges];
                                        if (newRanges[idx]) { newRanges[idx] = { ...newRanges[idx], color: e.target.value }; setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } }); }
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
                                if (idx === 0 || idx === breakpoints.length - 1) return;
                                const newBreakpoints = breakpoints.filter((_, i) => i !== idx);
                                const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                                setCfg({ ...cfg, residualRisk: { ...cfg.residualRisk, thresholds: { ...cfg.residualRisk.thresholds, ranges: newRanges } } });
                                setBreakpointErrors([]);
                              }} disabled={idx === 0 || idx === breakpoints.length - 1}>Remove</Button>
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

                    let bestGapIndex = 0; let bestGapSize = 0;
                    for (let i = 0; i < breakpoints.length - 1; i++) {
                      const gap = breakpoints[i + 1] - breakpoints[i];
                      if (gap > bestGapSize && gap > 1) { bestGapSize = gap; bestGapIndex = i; }
                    }
                    if (bestGapSize <= 1) return prev;

                    const newValue = Math.floor((breakpoints[bestGapIndex] + breakpoints[bestGapIndex + 1]) / 2);
                    const clampedValue = Math.min(Math.max(newValue, paramMin + 1), paramMax - 1);
                    const newBreakpoints = [...breakpoints];
                    newBreakpoints.splice(bestGapIndex + 1, 0, clampedValue);

                    const newRanges = getRangesFromBreakpoints(newBreakpoints, ranges);
                    return { ...prev, residualRisk: { ...prev.residualRisk, thresholds: { ...prev.residualRisk.thresholds, ranges: newRanges } } } as RiskAssessmentConfig;
                  });
                }} disabled={((): boolean => { const bps = getBreakpointsFromRanges(cfg.residualRisk.thresholds.ranges || []); for (let i = 0; i < bps.length - 1; i++) { if (bps[i + 1] - bps[i] > 1) return false; } return true; })()}>Add Breakpoint</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
