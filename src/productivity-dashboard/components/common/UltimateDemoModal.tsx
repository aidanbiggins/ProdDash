// Ultimate Demo Modal
// Interactive modal for loading synthetic demo data with configurable packs
// See docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md

import React, { useState, useMemo, useCallback } from 'react';
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
        className="fixed inset-0 bg-[var(--glass-shadow-backdrop)] opacity-100"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-[1055] p-4"
        tabIndex={-1}
        role="dialog"
      >
        <div className="w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div
            className="rounded-2xl overflow-hidden flex flex-col max-h-full"
            style={{
              background: 'linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-base) 100%)',
              border: '1px solid var(--accent-border)',
              boxShadow: 'var(--glass-shadow-elevated)',
            }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-0 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                  }}
                >
                  <i className="bi bi-magic text-2xl"></i>
                </div>
                <div>
                  <h5 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Load Ultimate Demo
                  </h5>
                  <p className="mb-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Load synthetic data to explore all PlatoVue features
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-white opacity-70 hover:opacity-100"
                onClick={onClose}
                disabled={isLoading}
              >
                <i className="bi bi-x text-2xl"></i>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
              {/* Presets */}
              <div className="mb-4">
                <h6 className="mb-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>
                  Presets
                </h6>
                <div className="flex gap-3">
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
              <div className="mb-4">
                <h6 className="mb-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>
                  Demo Packs
                </h6>
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_PACK_INFO.map((pack) => (
                      <div key={pack.id}>
                        <PackToggle
                          pack={pack}
                          enabled={packConfig[pack.id]}
                          onToggle={() => handlePackToggle(pack.id)}
                          missingDeps={getMissingDependencies(pack.id, packConfig)}
                          disabled={pack.id === 'core_ats'} // Core ATS is always required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seed Input */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>
                  Seed (for reproducibility)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-transparent border border-glass-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="ultimate-demo-v1"
                  style={{
                    background: 'var(--color-bg-surface)',
                    color: 'var(--text-label)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <small className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Same seed always produces identical data
                </small>
              </div>

              {/* Demo Story Panel */}
              <DemoStoryPanel />

              {/* Capability Preview */}
              <CapabilityPreview bundle={previewBundle} />
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 flex justify-end gap-3 flex-shrink-0 border-t border-white/10">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-base)] border border-glass-border"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 text-white min-w-[160px]"
                onClick={handleLoad}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill mr-2"></i>
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
      className="flex-1 p-3 rounded-xl text-left transition-all duration-200"
      onClick={onClick}
      style={{
        background: selected ? 'var(--accent-bg)' : 'var(--glass-bg)',
        border: selected ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{
            border: selected ? '2px solid var(--accent)' : '2px solid var(--glass-border-strong)',
            background: selected ? 'var(--accent)' : 'transparent',
          }}
        >
          {selected && (
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-bg-base)' }} />
          )}
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
      </div>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</span>
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
      className="flex items-start gap-2 p-2 rounded-lg"
      style={{
        background: enabled ? 'var(--accent-bg)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
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
        <div className="text-[0.8125rem] font-medium" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {pack.name}
        </div>
        <div className="text-[0.7rem] leading-tight" style={{ color: 'var(--text-muted)' }}>
          {pack.description}
        </div>
        {hasMissingDeps && (
          <div className="text-[0.65rem] mt-0.5" style={{ color: 'var(--color-warn)' }}>
            <i className="bi bi-exclamation-triangle mr-1"></i>
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
    <div
      className="rounded-xl p-3 mb-4"
      style={{
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
      }}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <i className="bi bi-lightbulb" style={{ color: 'var(--accent)' }}></i>
          <span className="text-[0.8125rem] font-medium" style={{ color: 'var(--text-label)' }}>
            What You'll Find in This Demo
          </span>
        </div>
        <i
          className={`bi bi-chevron-${expanded ? 'up' : 'down'} text-xs`}
          style={{ color: 'var(--text-muted)' }}
        ></i>
      </div>

      {expanded && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            {patterns.map((pattern) => (
              <div key={pattern.id}>
                <div className="p-2 rounded-lg" style={{ background: 'var(--glass-bg)' }}>
                  <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    {pattern.name}
                  </div>
                  <div className="text-[0.65rem]" style={{ color: 'var(--text-muted)' }}>
                    {pattern.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-2 pt-2 text-[0.65rem] border-t"
            style={{
              borderColor: 'var(--glass-border)',
              color: 'var(--text-muted)',
            }}
          >
            <i className="bi bi-info-circle mr-1"></i>
            These patterns are intentionally placed to demonstrate PlatoVue's detection capabilities.
          </div>
        </div>
      )}
    </div>
  );
}

// Direct pack-to-feature gates for the demo preview.
// The capability engine only understands data coverage metrics, not pack states.
// This mapping ensures toggling a pack immediately reflects in the feature preview.
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

// Capability preview component - uses the capability engine for live status
function CapabilityPreview({
  bundle,
}: {
  bundle: ReturnType<typeof generateUltimateDemo>;
}) {
  const [expandedFeature, setExpandedFeature] = React.useState<string | null>(null);

  // Evaluate capabilities using the engine
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

  // Group features by effective status (engine result + pack overrides)
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

  // Compute effective summary
  const totalFeatures = enabledFeatures.length + limitedFeatures.length + blockedFeatures.length;
  const summary = {
    features_enabled: enabledFeatures.length,
    features_limited: limitedFeatures.length,
    features_blocked: blockedFeatures.length,
    total_features: totalFeatures,
  };

  const STATUS_CONFIG: Record<CapabilityStatus, { icon: string; color: string; bg: string; border: string }> = {
    ENABLED: { icon: 'bi-check-circle', color: 'var(--color-good-text)', bg: 'var(--color-good-bg)', border: 'var(--color-good-border)' },
    LIMITED: { icon: 'bi-exclamation-triangle', color: 'var(--color-warn-text)', bg: 'var(--color-warn-bg)', border: 'var(--color-warn-border)' },
    BLOCKED: { icon: 'bi-x-circle', color: 'var(--color-bad-text)', bg: 'var(--color-bad-bg)', border: 'var(--color-bad-border)' },
  };

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h6 className="mb-0 text-xs uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>
          Live Feature Preview
        </h6>
        <span className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>
          {summary.features_enabled}/{summary.total_features} enabled
          {summary.features_limited > 0 && `, ${summary.features_limited} limited`}
          {summary.features_blocked > 0 && `, ${summary.features_blocked} blocked`}
        </span>
      </div>

      {/* Enabled features */}
      {enabledFeatures.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1">
            {enabledFeatures.slice(0, 12).map((feat) => (
              <span key={feat.feature_key} className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium" style={{ ...STATUS_CONFIG.ENABLED }}>
                <i className={`${STATUS_CONFIG.ENABLED.icon} mr-1`}></i>
                {feat.display_name}
              </span>
            ))}
            {enabledFeatures.length > 12 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium" style={{ background: STATUS_CONFIG.ENABLED.bg, color: STATUS_CONFIG.ENABLED.color }}>
                +{enabledFeatures.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Limited features */}
      {limitedFeatures.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1">
            {limitedFeatures.map((feat) => (
              <button
                key={feat.feature_key}
                type="button"
                className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium border-0 cursor-pointer"
                onClick={() => setExpandedFeature(expandedFeature === feat.feature_key ? null : feat.feature_key)}
                style={{ ...STATUS_CONFIG.LIMITED }}
              >
                <i className={`${STATUS_CONFIG.LIMITED.icon} mr-1`}></i>
                {feat.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Blocked features */}
      {blockedFeatures.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1">
            {blockedFeatures.slice(0, 8).map((feat) => (
              <button
                key={feat.feature_key}
                type="button"
                className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium border-0 cursor-pointer"
                onClick={() => setExpandedFeature(expandedFeature === feat.feature_key ? null : feat.feature_key)}
                style={{ ...STATUS_CONFIG.BLOCKED }}
              >
                <i className={`${STATUS_CONFIG.BLOCKED.icon} mr-1`}></i>
                {feat.display_name}
              </button>
            ))}
            {blockedFeatures.length > 8 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium" style={{ background: STATUS_CONFIG.BLOCKED.bg, color: STATUS_CONFIG.BLOCKED.color }}>
                +{blockedFeatures.length - 8} more blocked
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded explanation */}
      {expandedFeature && (() => {
        const feat = engineResult.feature_coverage.get(expandedFeature);
        if (!feat) return null;
        const isPackBlocked = packBlockedFeatures.has(expandedFeature);
        const effectiveStatus: CapabilityStatus = isPackBlocked ? 'BLOCKED' : feat.status;
        if (effectiveStatus === 'ENABLED') return null;
        const cfg = STATUS_CONFIG[effectiveStatus];
        return (
          <div className="rounded-lg p-2 mt-2" style={{ background: `${cfg.bg}`, border: `1px solid ${cfg.border}` }}>
            <div className="flex items-start gap-2">
              <i className="bi bi-info-circle mt-0.5" style={{ color: cfg.color }}></i>
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: cfg.color }}>
                  {feat.display_name} — {effectiveStatus === 'BLOCKED' ? 'Blocked' : 'Limited'}
                </div>
                {isPackBlocked ? (
                  <div className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>• Enable the required data pack to unlock this feature</div>
                ) : (
                  feat.reasons.map((r, i) => (
                    <div key={i} className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>• {r}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* All enabled message */}
      {blockedFeatures.length === 0 && limitedFeatures.length === 0 && (
        <div className="text-center py-2 text-[0.8rem]" style={{ color: 'var(--color-good-text)' }}>
          <i className="bi bi-stars mr-2"></i>
          All {summary.total_features} features enabled with this configuration!
        </div>
      )}

      {/* Data summary */}
      <div className="flex gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
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
      <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {value.toLocaleString()}
      </div>
      <div className="text-[0.65rem]" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

export default UltimateDemoModal;
