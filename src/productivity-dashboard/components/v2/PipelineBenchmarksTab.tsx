/**
 * Pipeline Benchmarks Tab - Configure target pass-through rates and stage durations
 *
 * Allows users to set target PTR (pass-through rate) for each pipeline stage.
 * Shows actual performance vs target to identify underperforming stages.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Info, RotateCcw, Save } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  PipelineBenchmarkConfig,
  StageBenchmark,
  DEFAULT_PIPELINE_BENCHMARKS,
  getPerformanceStatus,
  PerformanceStatus
} from '../../types/pipelineTypes';
import { CanonicalStage } from '../../types/entities';
import { saveOrgConfig, loadOrgConfig } from '../../services/configService';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';

// Stage display configuration
const STAGE_CONFIG: Record<string, { label: string; description: string }> = {
  [CanonicalStage.SCREEN]: {
    label: 'Screen',
    description: 'Initial recruiter screen to HM screen'
  },
  [CanonicalStage.HM_SCREEN]: {
    label: 'HM Screen',
    description: 'HM phone screen to onsite/technical'
  },
  [CanonicalStage.ONSITE]: {
    label: 'Onsite',
    description: 'Onsite interviews to offer decision'
  },
  [CanonicalStage.OFFER]: {
    label: 'Offer',
    description: 'Offer extended to accepted/hired'
  },
};

interface ActualPTRData {
  stage: CanonicalStage;
  actualRate: number | null;
  sampleSize: number;
}

function getStatusBadge(status: PerformanceStatus) {
  switch (status) {
    case 'ahead':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
          <CheckCircle className="w-3 h-3" />
          Above Target
        </span>
      );
    case 'on-track':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
          <CheckCircle className="w-3 h-3" />
          On Track
        </span>
      );
    case 'behind':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          Below Target
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          <AlertTriangle className="w-3 h-3" />
          Critical
        </span>
      );
  }
}

export function PipelineBenchmarksTab() {
  const { state } = useDashboard();
  const { currentOrg, user } = useAuth();
  const organizationId = currentOrg?.id;

  const [benchmarks, setBenchmarks] = useState<PipelineBenchmarkConfig>(DEFAULT_PIPELINE_BENCHMARKS);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      if (!organizationId) return;

      const config = await loadOrgConfig(organizationId);
      if (config?.pipelineBenchmarks) {
        setBenchmarks(config.pipelineBenchmarks);
      }
    }
    loadConfig();
  }, [organizationId]);

  // Calculate actual PTRs from recruiter summary funnel metrics
  const actualPTRs = useMemo<ActualPTRData[]>(() => {
    const summaries = state.overview?.recruiterSummaries;
    if (!summaries || summaries.length === 0) return [];

    // Aggregate stage conversion metrics across all recruiters
    // FunnelConversionMetrics has: screenToHmScreen, hmScreenToOnsite, onsiteToOffer, offerToHired
    const aggregated = {
      screenToHmScreen: { entered: 0, converted: 0 },
      hmScreenToOnsite: { entered: 0, converted: 0 },
      onsiteToOffer: { entered: 0, converted: 0 },
      offerToHired: { entered: 0, converted: 0 },
    };

    for (const summary of summaries) {
      const funnel = summary.funnelConversion;
      aggregated.screenToHmScreen.entered += funnel.screenToHmScreen.entered;
      aggregated.screenToHmScreen.converted += funnel.screenToHmScreen.converted;
      aggregated.hmScreenToOnsite.entered += funnel.hmScreenToOnsite.entered;
      aggregated.hmScreenToOnsite.converted += funnel.hmScreenToOnsite.converted;
      aggregated.onsiteToOffer.entered += funnel.onsiteToOffer.entered;
      aggregated.onsiteToOffer.converted += funnel.onsiteToOffer.converted;
      aggregated.offerToHired.entered += funnel.offerToHired.entered;
      aggregated.offerToHired.converted += funnel.offerToHired.converted;
    }

    const results: ActualPTRData[] = [];

    // Screen PTR: Screen → HM Screen
    if (aggregated.screenToHmScreen.entered > 0) {
      results.push({
        stage: CanonicalStage.SCREEN,
        actualRate: aggregated.screenToHmScreen.converted / aggregated.screenToHmScreen.entered,
        sampleSize: aggregated.screenToHmScreen.entered,
      });
    }

    // HM Screen PTR: HM Screen → Onsite
    if (aggregated.hmScreenToOnsite.entered > 0) {
      results.push({
        stage: CanonicalStage.HM_SCREEN,
        actualRate: aggregated.hmScreenToOnsite.converted / aggregated.hmScreenToOnsite.entered,
        sampleSize: aggregated.hmScreenToOnsite.entered,
      });
    }

    // Onsite PTR: Onsite → Offer
    if (aggregated.onsiteToOffer.entered > 0) {
      results.push({
        stage: CanonicalStage.ONSITE,
        actualRate: aggregated.onsiteToOffer.converted / aggregated.onsiteToOffer.entered,
        sampleSize: aggregated.onsiteToOffer.entered,
      });
    }

    // Offer PTR: Offer → Hired
    if (aggregated.offerToHired.entered > 0) {
      results.push({
        stage: CanonicalStage.OFFER,
        actualRate: aggregated.offerToHired.converted / aggregated.offerToHired.entered,
        sampleSize: aggregated.offerToHired.entered,
      });
    }

    return results;
  }, [state.overview?.recruiterSummaries]);

  // Get actual PTR for a specific stage
  const getActualPTR = useCallback((stage: CanonicalStage): ActualPTRData | undefined => {
    return actualPTRs.find(p => p.stage === stage);
  }, [actualPTRs]);

  // Update a benchmark field
  const handleUpdateBenchmark = useCallback((
    stage: CanonicalStage,
    field: 'targetPassRate' | 'minPassRate' | 'targetDays' | 'maxDays',
    value: number
  ) => {
    setBenchmarks(prev => ({
      ...prev,
      stages: prev.stages.map(s =>
        s.stage === stage ? { ...s, [field]: value } : s
      ),
      lastUpdated: new Date(),
      source: 'manual',
    }));
    setIsDirty(true);
  }, []);

  // Update total TTF target
  const handleUpdateTTFTarget = useCallback((value: number) => {
    setBenchmarks(prev => ({
      ...prev,
      targetTotalTTF: value,
      lastUpdated: new Date(),
      source: 'manual',
    }));
    setIsDirty(true);
  }, []);

  // Save to Supabase
  const handleSave = useCallback(async () => {
    if (!organizationId) {
      setError('No organization selected');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Load current config
      const currentConfig = await loadOrgConfig(organizationId);
      const configToSave = {
        ...(currentConfig || state.dataStore.config),
        pipelineBenchmarks: benchmarks,
        lastUpdated: new Date(),
        lastUpdatedBy: user?.email || 'unknown',
      };

      const saved = await saveOrgConfig(organizationId, configToSave, user?.id);

      if (saved) {
        setSuccess('Pipeline benchmarks saved successfully');
        setIsDirty(false);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to save benchmarks');
      }
    } catch (err) {
      console.error('Error saving benchmarks:', err);
      setError('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  }, [organizationId, benchmarks, user, state.dataStore.config]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    if (!confirm('Reset all pipeline benchmarks to defaults? This cannot be undone.')) return;
    setBenchmarks(DEFAULT_PIPELINE_BENCHMARKS);
    setIsDirty(true);
  }, []);

  const hasData = actualPTRs.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Pipeline Benchmarks
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set target pass-through rates for each stage. The funnel will show how you're performing against these targets.
          </p>
        </div>
        {benchmarks.source === 'manual' && benchmarks.lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Last updated: {new Date(benchmarks.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 rounded-lg flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Overall TTF Target */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Overall Time-to-Fill Target</h3>
            <p className="text-xs text-muted-foreground">Target median days from application to hire</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="w-20 px-2 py-1.5 rounded-md text-sm text-center bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={benchmarks.targetTotalTTF}
              onChange={(e) => handleUpdateTTFTarget(parseInt(e.target.value) || 45)}
              min={1}
              max={365}
            />
            <span className="text-sm text-muted-foreground">days</span>
            {state.overview?.medianTTF && (
              <div className="flex items-center gap-2 pl-4 border-l border-border">
                <span className="text-xs text-muted-foreground">Actual:</span>
                <span className={`font-mono text-sm ${
                  state.overview.medianTTF <= benchmarks.targetTotalTTF
                    ? 'text-green-400'
                    : 'text-amber-400'
                }`}>
                  {state.overview.medianTTF}d
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage Benchmarks Table */}
      <div className="glass-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Stage Pass-Through Rates</h3>
          <p className="text-xs text-muted-foreground">
            Set target and minimum PTR for each stage. Candidates below minimum trigger alerts.
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stage
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    Target PTR
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Goal pass-through rate for this stage</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    Min PTR
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Below this triggers critical alerts</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actual PTR
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Variance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {benchmarks.stages.map((benchmark) => {
                const config = STAGE_CONFIG[benchmark.stage];
                const actual = getActualPTR(benchmark.stage);
                const hasActual = actual && actual.actualRate !== null;

                const status = hasActual
                  ? getPerformanceStatus(
                      actual.actualRate!,
                      benchmark.targetPassRate,
                      benchmark.minPassRate,
                      true // higher is better for pass rates
                    )
                  : null;

                const variance = hasActual
                  ? ((actual.actualRate! - benchmark.targetPassRate) * 100).toFixed(0)
                  : null;

                return (
                  <tr key={benchmark.stage} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{config?.label || benchmark.stage}</p>
                        <p className="text-xs text-muted-foreground">{config?.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          className="w-16 px-2 py-1 rounded-md text-xs text-center bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={Math.round(benchmark.targetPassRate * 100)}
                          onChange={(e) => handleUpdateBenchmark(
                            benchmark.stage,
                            'targetPassRate',
                            (parseInt(e.target.value) || 0) / 100
                          )}
                          min={0}
                          max={100}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          className="w-16 px-2 py-1 rounded-md text-xs text-center bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={Math.round(benchmark.minPassRate * 100)}
                          onChange={(e) => handleUpdateBenchmark(
                            benchmark.stage,
                            'minPassRate',
                            (parseInt(e.target.value) || 0) / 100
                          )}
                          min={0}
                          max={100}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasActual ? (
                        <div>
                          <span className="font-mono text-foreground">
                            {Math.round(actual.actualRate! * 100)}%
                          </span>
                          <p className="text-xs text-muted-foreground">n={actual.sampleSize}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No data</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {status ? getStatusBadge(status) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {variance !== null ? (
                        <span className={`font-mono text-sm flex items-center justify-center gap-1 ${
                          parseFloat(variance) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {parseFloat(variance) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {parseFloat(variance) >= 0 ? '+' : ''}{variance}pp
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md text-sm font-medium border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
        {isDirty && (
          <span className="text-xs text-amber-400 flex items-center justify-center gap-1 sm:ml-auto">
            <AlertTriangle className="w-3 h-3" />
            Unsaved changes
          </span>
        )}
      </div>

      {/* Help Section */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Understanding Pass-Through Rates</h3>
        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Pass-Through Rate (PTR)</strong> is the percentage of candidates
            who advance from one stage to the next. Higher rates generally indicate better candidate quality
            or less selective screening.
          </p>
          <p>
            <strong className="text-foreground">Target PTR</strong> is your goal for each stage. Hitting this
            rate indicates a well-calibrated hiring process.
          </p>
          <p>
            <strong className="text-foreground">Minimum PTR</strong> is your red-flag threshold. Falling below
            this may indicate sourcing quality issues, misaligned job descriptions, or overly aggressive screening.
          </p>
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Above Target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>On Track</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Below Target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Critical</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PipelineBenchmarksTab;
