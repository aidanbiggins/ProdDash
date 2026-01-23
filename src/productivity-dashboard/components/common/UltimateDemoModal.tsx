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
        className="modal-backdrop fade show"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div
            className="modal-content"
            style={{
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(212, 163, 115, 0.3)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header */}
            <div
              className="modal-header border-0 pb-0"
              style={{ padding: '1.5rem 1.5rem 1rem' }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(212, 163, 115, 0.15)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <i className="bi bi-magic" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <div>
                  <h5
                    className="modal-title mb-1"
                    style={{ color: '#f8fafc', fontWeight: 600 }}
                  >
                    Load Ultimate Demo
                  </h5>
                  <p className="mb-0 small" style={{ color: '#94a3b8' }}>
                    Load synthetic data to explore all PlatoVue features
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={isLoading}
              />
            </div>

            {/* Body */}
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Presets */}
              <div className="mb-4">
                <h6
                  className="mb-3"
                  style={{
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Presets
                </h6>
                <div className="d-flex gap-3">
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
                <h6
                  className="mb-3"
                  style={{
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Demo Packs
                </h6>
                <div
                  className="rounded-3 p-3"
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="row g-2">
                    {DEMO_PACK_INFO.map((pack) => (
                      <div key={pack.id} className="col-6">
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
                <label
                  className="form-label"
                  style={{
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Seed (for reproducibility)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="ultimate-demo-v1"
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                  }}
                />
                <small style={{ color: '#64748b' }}>
                  Same seed always produces identical data
                </small>
              </div>

              {/* Demo Story Panel */}
              <DemoStoryPanel />

              {/* Capability Preview */}
              <CapabilityPreview bundle={previewBundle} />
            </div>

            {/* Footer */}
            <div
              className="modal-footer border-0 pt-0"
              style={{ padding: '0 1.5rem 1.5rem', gap: '0.75rem' }}
            >
              <button
                type="button"
                className="btn btn-bespoke-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-bespoke-primary"
                onClick={handleLoad}
                disabled={isLoading}
                style={{ minWidth: '160px' }}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill me-2"></i>
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
      className="flex-fill p-3 rounded-3 text-start border-0"
      onClick={onClick}
      style={{
        background: selected
          ? 'rgba(212, 163, 115, 0.15)'
          : 'rgba(15, 23, 42, 0.5)',
        border: selected
          ? '1px solid var(--accent-primary)'
          : '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      <div className="d-flex align-items-center gap-2 mb-1">
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: selected
              ? '2px solid var(--accent-primary)'
              : '2px solid rgba(255, 255, 255, 0.3)',
            background: selected ? 'var(--accent-primary)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#0f172a',
              }}
            />
          )}
        </div>
        <span style={{ color: '#f8fafc', fontWeight: 500, fontSize: '0.875rem' }}>
          {label}
        </span>
      </div>
      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{description}</span>
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
      className="d-flex align-items-start gap-2 p-2 rounded-2"
      style={{
        background: enabled ? 'rgba(212, 163, 115, 0.08)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={disabled ? undefined : onToggle}
    >
      <div
        className="form-check"
        style={{ marginTop: '2px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="form-check-input"
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
          style={{
            backgroundColor: enabled ? 'var(--accent-primary)' : 'rgba(15, 23, 42, 0.8)',
            borderColor: enabled ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.2)',
          }}
        />
      </div>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div
          style={{
            color: enabled ? '#f8fafc' : '#94a3b8',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          {pack.name}
        </div>
        <div
          style={{
            color: '#64748b',
            fontSize: '0.7rem',
            lineHeight: 1.3,
          }}
        >
          {pack.description}
        </div>
        {hasMissingDeps && (
          <div
            style={{
              color: '#f59e0b',
              fontSize: '0.65rem',
              marginTop: '2px',
            }}
          >
            <i className="bi bi-exclamation-triangle me-1"></i>
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
      className="rounded-3 p-3 mb-4"
      style={{
        background: 'rgba(45, 212, 191, 0.08)',
        border: '1px solid rgba(45, 212, 191, 0.2)',
      }}
    >
      <div
        className="d-flex align-items-center justify-content-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-lightbulb" style={{ color: '#2dd4bf' }}></i>
          <span style={{ color: '#e2e8f0', fontSize: '0.8125rem', fontWeight: 500 }}>
            What You'll Find in This Demo
          </span>
        </div>
        <i
          className={`bi bi-chevron-${expanded ? 'up' : 'down'}`}
          style={{ color: '#64748b', fontSize: '0.75rem' }}
        ></i>
      </div>

      {expanded && (
        <div className="mt-3">
          <div className="row g-2">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="col-6">
                <div
                  className="p-2 rounded-2"
                  style={{ background: 'rgba(15, 23, 42, 0.4)' }}
                >
                  <div
                    style={{
                      color: '#f8fafc',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      marginBottom: '2px',
                    }}
                  >
                    {pattern.name}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {pattern.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-2 pt-2"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#64748b',
              fontSize: '0.65rem',
            }}
          >
            <i className="bi bi-info-circle me-1"></i>
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
    ENABLED: { icon: 'bi-check-circle', color: '#86efac', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' },
    LIMITED: { icon: 'bi-exclamation-triangle', color: '#fcd34d', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
    BLOCKED: { icon: 'bi-x-circle', color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
  };

  return (
    <div
      className="rounded-3 p-3"
      style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6
          className="mb-0"
          style={{
            color: '#e2e8f0',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Live Feature Preview
        </h6>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          {summary.features_enabled}/{summary.total_features} enabled
          {summary.features_limited > 0 && `, ${summary.features_limited} limited`}
          {summary.features_blocked > 0 && `, ${summary.features_blocked} blocked`}
        </span>
      </div>

      {/* Enabled features */}
      {enabledFeatures.length > 0 && (
        <div className="mb-2">
          <div className="d-flex flex-wrap gap-1">
            {enabledFeatures.slice(0, 12).map((feat) => (
              <span key={feat.feature_key} className="badge" style={{ ...STATUS_CONFIG.ENABLED, fontSize: '0.65rem', fontWeight: 500 }}>
                <i className={`${STATUS_CONFIG.ENABLED.icon} me-1`}></i>
                {feat.display_name}
              </span>
            ))}
            {enabledFeatures.length > 12 && (
              <span className="badge" style={{ background: STATUS_CONFIG.ENABLED.bg, color: STATUS_CONFIG.ENABLED.color, fontSize: '0.65rem' }}>
                +{enabledFeatures.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Limited features */}
      {limitedFeatures.length > 0 && (
        <div className="mb-2">
          <div className="d-flex flex-wrap gap-1">
            {limitedFeatures.map((feat) => (
              <button
                key={feat.feature_key}
                type="button"
                className="badge border-0"
                onClick={() => setExpandedFeature(expandedFeature === feat.feature_key ? null : feat.feature_key)}
                style={{
                  ...STATUS_CONFIG.LIMITED,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <i className={`${STATUS_CONFIG.LIMITED.icon} me-1`}></i>
                {feat.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Blocked features */}
      {blockedFeatures.length > 0 && (
        <div className="mb-2">
          <div className="d-flex flex-wrap gap-1">
            {blockedFeatures.slice(0, 8).map((feat) => (
              <button
                key={feat.feature_key}
                type="button"
                className="badge border-0"
                onClick={() => setExpandedFeature(expandedFeature === feat.feature_key ? null : feat.feature_key)}
                style={{
                  ...STATUS_CONFIG.BLOCKED,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <i className={`${STATUS_CONFIG.BLOCKED.icon} me-1`}></i>
                {feat.display_name}
              </button>
            ))}
            {blockedFeatures.length > 8 && (
              <span className="badge" style={{ background: STATUS_CONFIG.BLOCKED.bg, color: STATUS_CONFIG.BLOCKED.color, fontSize: '0.65rem' }}>
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
          <div className="rounded-2 p-2 mt-2" style={{ background: `${cfg.bg}`, border: `1px solid ${cfg.border}` }}>
            <div className="d-flex align-items-start gap-2">
              <i className="bi bi-info-circle" style={{ color: cfg.color, marginTop: '2px' }}></i>
              <div>
                <div style={{ color: cfg.color, fontSize: '0.75rem', fontWeight: 500, marginBottom: '4px' }}>
                  {feat.display_name} — {effectiveStatus === 'BLOCKED' ? 'Blocked' : 'Limited'}
                </div>
                {isPackBlocked ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>• Enable the required data pack to unlock this feature</div>
                ) : (
                  feat.reasons.map((r, i) => (
                    <div key={i} style={{ color: '#94a3b8', fontSize: '0.7rem' }}>• {r}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* All enabled message */}
      {blockedFeatures.length === 0 && limitedFeatures.length === 0 && (
        <div className="text-center py-2" style={{ color: '#86efac', fontSize: '0.8rem' }}>
          <i className="bi bi-stars me-2"></i>
          All {summary.total_features} features enabled with this configuration!
        </div>
      )}

      {/* Data summary */}
      <div className="d-flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
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
      <div
        style={{
          color: '#f8fafc',
          fontSize: '1.125rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{label}</div>
    </div>
  );
}

export default UltimateDemoModal;
