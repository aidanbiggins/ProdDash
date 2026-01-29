// Ultimate Demo Modal
// Interactive modal for loading synthetic demo data with configurable packs
// See docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md

import React, { useState, useMemo, useCallback } from 'react';
import { Sparkles, Play, ChevronDown, ChevronUp, Info, Check, X, AlertTriangle, Lightbulb } from 'lucide-react';
import {
  DemoPackConfig,
  DemoPackInfo,
  DEMO_PACK_INFO,
  DEFAULT_PACK_CONFIG,
  MINIMAL_PACK_CONFIG,
  getMissingDependencies,
} from '../../types/demoTypes';
import { generateUltimateDemo, getDemoStoryPatterns, computeDemoCoverage, DemoStoryPattern } from '../../services/ultimateDemoGenerator';
import { evaluateCapabilities, FEATURE_REGISTRY } from '../../services/capabilityEngine';
import { CapabilityStatus, FeatureCoverageEntry } from '../../types/capabilityTypes';
import { Checkbox } from '../../../components/ui/toggles';

interface UltimateDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDemo: (bundle: ReturnType<typeof generateUltimateDemo>) => void;
  isLoading?: boolean;
}

type PresetType = 'all' | 'minimal' | 'custom';

const PRESET_CONFIGS: Record<PresetType, DemoPackConfig> = {
  all: DEFAULT_PACK_CONFIG,
  minimal: MINIMAL_PACK_CONFIG,
  custom: DEFAULT_PACK_CONFIG,
};

export function UltimateDemoModal({
  isOpen,
  onClose,
  onLoadDemo,
  isLoading = false,
}: UltimateDemoModalProps) {
  const [preset, setPreset] = useState<PresetType>('all');
  const [packConfig, setPackConfig] = useState<DemoPackConfig>(DEFAULT_PACK_CONFIG);
  const [seed, setSeed] = useState('ultimate-demo-v1');

  // Preview the bundle to show capability status
  const previewBundle = useMemo(() => {
    return generateUltimateDemo(seed, packConfig);
  }, [seed, packConfig]);

  const handlePresetChange = useCallback((newPreset: PresetType) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      setPackConfig(PRESET_CONFIGS[newPreset]);
    }
  }, []);

  const handlePackToggle = useCallback((packId: keyof DemoPackConfig) => {
    setPreset('custom');
    setPackConfig((prev) => {
      const newConfig = { ...prev, [packId]: !prev[packId] };

      if (newConfig[packId]) {
        // If enabling a pack, auto-enable its dependencies
        const packInfo = DEMO_PACK_INFO.find((p) => p.id === packId);
        if (packInfo) {
          for (const dep of packInfo.dependencies) {
            newConfig[dep] = true;
          }
        }
      } else {
        // If disabling a pack, also disable packs that depend on it
        for (const pack of DEMO_PACK_INFO) {
          if (pack.dependencies.includes(packId) && newConfig[pack.id]) {
            newConfig[pack.id] = false;
          }
        }
      }

      return newConfig;
    });
  }, []);

  const handleLoad = useCallback(() => {
    const bundle = generateUltimateDemo(seed, packConfig);
    onLoadDemo(bundle);
  }, [seed, packConfig, onLoadDemo]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        tabIndex={-1}
        role="dialog"
      >
        <div className="w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div className="glass-panel rounded-xl overflow-hidden flex flex-col max-h-full">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-lg font-semibold text-foreground">
                    Load Ultimate Demo
                  </h5>
                  <p className="text-sm text-muted-foreground">
                    Load synthetic data to explore all PlatoVue features
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={onClose}
                disabled={isLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
              {/* Presets */}
              <div>
                <h6 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Presets
                </h6>
                <div className="grid grid-cols-3 gap-3">
                  <PresetButton
                    label="All Features"
                    description="Recommended - enables everything"
                    selected={preset === 'all'}
                    onClick={() => handlePresetChange('all')}
                  />
                  <PresetButton
                    label="Minimal"
                    description="Core ATS only"
                    selected={preset === 'minimal'}
                    onClick={() => handlePresetChange('minimal')}
                  />
                  <PresetButton
                    label="Custom"
                    description="Pick individual packs"
                    selected={preset === 'custom'}
                    onClick={() => handlePresetChange('custom')}
                  />
                </div>
              </div>

              {/* Demo Packs */}
              <div>
                <h6 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Demo Packs
                </h6>
                <div className="glass-panel p-3 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEMO_PACK_INFO.map((pack) => (
                      <PackToggle
                        key={pack.id}
                        pack={pack}
                        enabled={packConfig[pack.id]}
                        onToggle={() => handlePackToggle(pack.id)}
                        missingDeps={getMissingDependencies(pack.id, packConfig)}
                        disabled={pack.id === 'core_ats'} // Core ATS is always required
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Seed Input */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                  Seed (for reproducibility)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="ultimate-demo-v1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Same seed always produces identical data
                </p>
              </div>

              {/* Demo Story Panel */}
              <DemoStoryPanel />

              {/* Capability Preview */}
              <CapabilityPreview bundle={previewBundle} />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex justify-end gap-3 border-t border-border">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 text-primary-foreground min-w-[160px] inline-flex items-center justify-center gap-2 transition-colors"
                onClick={handleLoad}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Load Demo Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Preset button component
function PresetButton({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`p-3 rounded-lg text-left transition-all border ${
        selected
          ? 'bg-primary/10 border-primary'
          : 'bg-muted/50 border-border hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-4 h-4 rounded-full flex items-center justify-center border-2 ${
            selected ? 'border-primary bg-primary' : 'border-muted-foreground'
          }`}
        >
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

// Pack toggle component
function PackToggle({
  pack,
  enabled,
  onToggle,
  missingDeps,
  disabled,
}: {
  pack: DemoPackInfo;
  enabled: boolean;
  onToggle: () => void;
  missingDeps: (keyof DemoPackConfig)[];
  disabled?: boolean;
}) {
  const hasMissingDeps = missingDeps.length > 0 && !enabled;

  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
        enabled ? 'bg-primary/10' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
      onClick={disabled ? undefined : onToggle}
    >
      <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
          {pack.name}
        </div>
        <div className="text-xs text-muted-foreground leading-tight">
          {pack.description}
        </div>
        {hasMissingDeps && (
          <div className="text-xs mt-0.5 text-warn flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Requires: {missingDeps.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Demo story panel component
function DemoStoryPanel() {
  const patterns = getDemoStoryPatterns();
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="glass-panel p-3 rounded-lg border border-primary/20">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            What You'll Find in This Demo
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {expanded && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs font-medium text-foreground mb-0.5">
                  {pattern.name}
                </div>
                <div className="text-[0.65rem] text-muted-foreground">
                  {pattern.description}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 text-[0.65rem] border-t border-border text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            These patterns are intentionally placed to demonstrate PlatoVue's detection capabilities.
          </div>
        </div>
      )}
    </div>
  );
}

// Direct pack-to-feature gates for the demo preview.
const PACK_FEATURE_GATES: Partial<Record<keyof DemoPackConfig, string[]>> = {
  recruiter_hm: [
    'ct_actions', 'ov_recruiter_table',
    'hm_kpi_tiles', 'hm_latency_heatmap', 'hm_decay_curve', 'hm_scorecard', 'hm_hiring_cycle',
    'q_acceptance_by_recruiter',
    'cap_load_table',
    'sla_owner_attribution',
    'sc_recruiter_leaves',
    'export_exec_brief',
    'explain_hm_latency',
  ],
  offers_outcomes: [
    'ct_accept_rate',
    'hm_decay_curve',
    'q_acceptance_by_recruiter',
    'vi_decay_candidate',
    'dh_ttf_comparison',
    'explain_accept_rate',
  ],
  snapshots_diffs: [
    'sla_dwell_times', 'sla_breach_detection', 'sla_owner_attribution',
  ],
  capacity_history: [
    'cap_fit_matrix', 'cap_rebalance',
    'sc_recruiter_leaves', 'sc_spin_up_team',
  ],
  calibration_history: [
    'fc_oracle',
  ],
  scenarios: [
    'sc_recruiter_leaves', 'sc_spin_up_team',
  ],
};

// Capability preview component
function CapabilityPreview({
  bundle,
}: {
  bundle: ReturnType<typeof generateUltimateDemo>;
}) {
  const [expandedFeature, setExpandedFeature] = React.useState<string | null>(null);

  const coverage = computeDemoCoverage(bundle);
  const engineResult = evaluateCapabilities(coverage);

  // Build set of features blocked by disabled packs
  const packBlockedFeatures = new Set<string>();
  for (const [packId, featureKeys] of Object.entries(PACK_FEATURE_GATES)) {
    if (!bundle.packsEnabled[packId as keyof DemoPackConfig]) {
      for (const fk of featureKeys!) {
        packBlockedFeatures.add(fk);
      }
    }
  }

  // Group features by effective status
  const enabledFeatures: FeatureCoverageEntry[] = [];
  const limitedFeatures: FeatureCoverageEntry[] = [];
  const blockedFeatures: FeatureCoverageEntry[] = [];

  for (const [key, entry] of engineResult.feature_coverage) {
    if (packBlockedFeatures.has(key)) {
      blockedFeatures.push({ ...entry, status: 'BLOCKED', blocked_by: [`pack_disabled`] });
    } else if (entry.status === 'ENABLED') {
      enabledFeatures.push(entry);
    } else if (entry.status === 'LIMITED') {
      limitedFeatures.push(entry);
    } else {
      blockedFeatures.push(entry);
    }
  }

  const totalFeatures = enabledFeatures.length + limitedFeatures.length + blockedFeatures.length;
  const summary = {
    features_enabled: enabledFeatures.length,
    features_limited: limitedFeatures.length,
    features_blocked: blockedFeatures.length,
    total_features: totalFeatures,
  };

  return (
    <div className="glass-panel p-3 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h6 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Live Feature Preview
        </h6>
        <span className="text-xs text-muted-foreground">
          {summary.features_enabled}/{summary.total_features} enabled
          {summary.features_limited > 0 && `, ${summary.features_limited} limited`}
          {summary.features_blocked > 0 && `, ${summary.features_blocked} blocked`}
        </span>
      </div>

      {/* Enabled features */}
      {enabledFeatures.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {enabledFeatures.slice(0, 12).map((feat) => (
            <span key={feat.feature_key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.65rem] font-medium bg-good/20 text-good">
              <Check className="w-3 h-3" />
              {feat.display_name}
            </span>
          ))}
          {enabledFeatures.length > 12 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium bg-good/20 text-good">
              +{enabledFeatures.length - 12} more
            </span>
          )}
        </div>
      )}

      {/* Limited features */}
      {limitedFeatures.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {limitedFeatures.map((feat) => (
            <button
              key={feat.feature_key}
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.65rem] font-medium bg-warn/20 text-warn cursor-pointer border-0"
              onClick={() => setExpandedFeature(expandedFeature === feat.feature_key ? null : feat.feature_key)}
            >
              <AlertTriangle className="w-3 h-3" />
              {feat.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Blocked features */}
      {blockedFeatures.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {blockedFeatures.slice(0, 8).map((feat) => (
            <button
              key={feat.feature_key}
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.65rem] font-medium bg-bad/20 text-bad cursor-pointer border-0"
              onClick={() => setExpandedFeature(expandedFeature === feat.feature_key ? null : feat.feature_key)}
            >
              <X className="w-3 h-3" />
              {feat.display_name}
            </button>
          ))}
          {blockedFeatures.length > 8 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium bg-bad/20 text-bad">
              +{blockedFeatures.length - 8} more blocked
            </span>
          )}
        </div>
      )}

      {/* Expanded explanation */}
      {expandedFeature && (() => {
        const feat = engineResult.feature_coverage.get(expandedFeature);
        if (!feat) return null;
        const isPackBlocked = packBlockedFeatures.has(expandedFeature);
        const effectiveStatus: CapabilityStatus = isPackBlocked ? 'BLOCKED' : feat.status;
        if (effectiveStatus === 'ENABLED') return null;
        const isBlocked = effectiveStatus === 'BLOCKED';
        return (
          <div className={`rounded-lg p-2 mt-2 ${isBlocked ? 'bg-bad/10 border border-bad/20' : 'bg-warn/10 border border-warn/20'}`}>
            <div className="flex items-start gap-2">
              <Info className={`w-4 h-4 mt-0.5 ${isBlocked ? 'text-bad' : 'text-warn'}`} />
              <div>
                <div className={`text-xs font-medium mb-1 ${isBlocked ? 'text-bad' : 'text-warn'}`}>
                  {feat.display_name} — {isBlocked ? 'Blocked' : 'Limited'}
                </div>
                {isPackBlocked ? (
                  <div className="text-xs text-muted-foreground">• Enable the required data pack to unlock this feature</div>
                ) : (
                  feat.reasons.map((r, i) => (
                    <div key={i} className="text-xs text-muted-foreground">• {r}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* All enabled message */}
      {blockedFeatures.length === 0 && limitedFeatures.length === 0 && (
        <div className="text-center py-2 text-sm text-good flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" />
          All {summary.total_features} features enabled with this configuration!
        </div>
      )}

      {/* Data summary */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-border">
        <DataStat label="Requisitions" value={bundle.requisitions.length} />
        <DataStat label="Candidates" value={bundle.candidates.length} />
        <DataStat label="Events" value={bundle.events.length} />
        <DataStat label="Users" value={bundle.users.length} />
      </div>
    </div>
  );
}

// Data stat component
function DataStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-foreground font-mono">
        {value.toLocaleString()}
      </div>
      <div className="text-[0.65rem] text-muted-foreground">{label}</div>
    </div>
  );
}

export default UltimateDemoModal;
